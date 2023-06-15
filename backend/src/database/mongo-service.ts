import {
    ExerciseAction,
    StateExport,
    UUID,
    uuid,
} from 'digital-fuesim-manv-shared';
import { exerciseMap } from '../exercise/exercise-map';
import { createExercise } from '../exercise/exercise-helpers';
import { DatabaseService } from './services/database-service';
import mongodb from 'mongodb';
import { PeriodicEventHandler } from '../exercise/periodic-events/periodic-event-handler';

interface ExerciseHistoryEntry {
    exerciseId: string;
    participantId: string;
    importObject: StateExport;
    history: {
        id: UUID;
        action: ExerciseAction;
        emitterId: string | null;
    }[];
}

export class MongoService {
    private readonly client: mongodb.MongoClient;
    private readonly collection = 'exercises';

    private readonly lastAppliedId: { [exerciseId: string]: UUID | null } = {};
    private readonly promises: {
        [action in 'apply' | 'create' | 'delete']: { [id: string]: () => void };
    } = {
        apply: {},
        create: {},
        delete: {},
    };

    private readonly syncInterval = 1_000;

    private readonly syncHandler = new PeriodicEventHandler(
        this.synchronize.bind(this),
        this.syncInterval
    );

    constructor(
        private readonly databaseService: DatabaseService,
        mongoUrl: string,
        private readonly mongoDb: string
    ) {
        this.client = new mongodb.MongoClient(mongoUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        } as any);
    }

    public async close(): Promise<void> {
        await this.client.close();
    }

    public async connect(): Promise<void> {
        await this.client.connect();
        this.syncHandler.start();
    }

    public get exerciseHistories() {
        return this.client
            .db(this.mongoDb)
            .collection<ExerciseHistoryEntry>(this.collection, {
                readPreference: mongodb.ReadPreference.PRIMARY_PREFERRED,
            });
    }

    public async createExercise(
        exerciseId: string,
        participantId: string,
        importObject: StateExport
    ) {
        return new Promise<void>((resolve) => {
            this.promises.create[exerciseId] = resolve;
            this.exerciseHistories.insertOne({
                exerciseId,
                participantId,
                importObject,
                history: [],
            });
        });
    }

    public async deleteExercise(exerciseId: string) {
        return new Promise<void>((resolve) => {
            this.promises.delete[exerciseId] = resolve;
            this.exerciseHistories.deleteOne({
                exerciseId,
            });
        });
    }

    public async addAction(
        exerciseId: string,
        action: ExerciseAction,
        emitterId: string | null
    ) {
        return new Promise<void>((resolve) => {
            const actionId = uuid();
            this.promises.apply[actionId] = resolve;
            this.exerciseHistories.updateOne(
                {
                    exerciseId,
                },
                {
                    $push: {
                        history: {
                            id: actionId,
                            action,
                            emitterId,
                        },
                    },
                }
            );
        });
    }

    public async synchronize() {
        const exerciseIds = [...exerciseMap.keys()];

        const exercisesInDatabase = await this.exerciseHistories
            .find()
            .project<Omit<ExerciseHistoryEntry, 'history'>>({ history: 0 })
            .toArray();

        exercisesInDatabase
            .filter(({ exerciseId }) => !exerciseIds.includes(exerciseId))
            .forEach(async ({ exerciseId, participantId, importObject }) => {
                console.log('creating exercise', exerciseId);
                const exercise = await createExercise(
                    this.databaseService,
                    importObject,
                    participantId,
                    exerciseId
                );
                exerciseMap.set(exerciseId, exercise);
                exerciseMap.set(participantId, exercise);
                this.promises.create[exerciseId]?.();
                this.lastAppliedId[exerciseId] = null;
            });

        exerciseIds
            .filter(
                (exerciseId) =>
                    exerciseMap
                        .get(exerciseId)
                        ?.getRoleFromUsedId(exerciseId) === 'trainer' &&
                    !exercisesInDatabase.some(
                        ({ exerciseId: id }) => id === exerciseId
                    )
            )
            .forEach(async (exerciseId) => {
                const exercise = exerciseMap.get(exerciseId);
                if (exercise) {
                    console.log('deleting exercise', exerciseId);
                    await exercise.deleteExercise();
                    this.promises.delete[exerciseId]?.();
                    delete this.lastAppliedId[exerciseId];
                }
            });

        exercisesInDatabase.forEach(async ({ exerciseId }) => {
            const exerciseWrapper = exerciseMap.get(exerciseId);
            (
                await this.exerciseHistories
                    .aggregate<ExerciseHistoryEntry>([
                        {
                            $match: {
                                exerciseId,
                            },
                        },
                        {
                            $project: {
                                history: {
                                    $slice: [
                                        '$history',
                                        {
                                            $subtract: [
                                                {
                                                    $indexOfArray: [
                                                        '$history.id',
                                                        this.lastAppliedId[
                                                            exerciseId
                                                        ],
                                                    ],
                                                },
                                                {
                                                    $add: [
                                                        { $size: '$history' },
                                                        -1,
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            },
                        },
                    ])
                    .toArray()
            )[0]?.history.forEach(({ id, action, emitterId }) => {
                console.log('applying action', action, 'for', exerciseId);
                this.lastAppliedId[exerciseId] = id;
                exerciseWrapper?.applyAction(action, emitterId);
                this.promises.apply[id]?.();
            });
        });
    }
}
