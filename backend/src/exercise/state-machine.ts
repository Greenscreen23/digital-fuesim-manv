import { decode, encode } from 'msgpack-lite';
import raft from 'node-zmq-raft';
import { isEmpty } from 'lodash-es';
import {
    ExerciseState,
    ExpectedReducerError,
    ReducerError,
    StateExport,
    UUID,
} from 'digital-fuesim-manv-shared';
import { importExercise } from '../utils/import-exercise';
import type { DatabaseService } from '../database/services/database-service';
import { UserReadableIdGenerator } from '../utils/user-readable-id-generator';
import type {
    AddExerciseRaftAction,
    ExerciseRaftAction,
    ProposeExerciseActionRaftAction,
    RemoveExerciseRaftAction,
} from './raft/types';
import { ExerciseWrapper } from './exercise-wrapper';
import { Buffer } from 'node:buffer';
import { ClientWrapper } from './client-wrapper';

export class ExerciseStateMachine {
    exerciseMap = new Map<string, ExerciseWrapper>();
    promises = new Map<
        Buffer | string,
        {
            resolve: () => void;
            reject: (reason: { expected: boolean; message: string }) => void;
        }
    >();

    constructor(
        private readonly databaseService: DatabaseService,
        exercises: ExerciseWrapper[]
    ) {
        exercises.forEach((exercise) => {
            this.exerciseMap.set(exercise.participantId, exercise);
            this.exerciseMap.set(exercise.trainerId, exercise);
        });
        UserReadableIdGenerator.lock([...this.exerciseMap.keys()]);
    }

    close() {}

    applyEntries(
        entries: Buffer[],
        nextIndex: number,
        currentTerm: number,
        snapshot?: raft.common.SnapshotFile
    ) {
        entries.forEach(async (entry) => {
            if (
                raft.common.LogEntry.readers.readTypeOf(entry) ===
                raft.common.LogEntry.LOG_ENTRY_TYPE_STATE
            ) {
                const id = raft.common.LogEntry.readers.readRequestIdOf(
                    entry,
                    'hex'
                );
                const action = decode(
                    raft.common.LogEntry.readers.readDataOf(entry)
                ) as ExerciseRaftAction;
                switch (action.type) {
                    case 'addExerciseRaftAction':
                        await this.addExercise(action, this.promises.get(id));
                        break;
                    case 'removeExerciseRaftAction':
                        await this.removeExercise(
                            action,
                            this.promises.get(id)
                        );
                        break;
                    case 'proposeExerciseActionRaftAction':
                        this.applyAction(action, this.promises.get(id));
                        break;
                    default:
                        console.log(
                            'Received entry that was of an unknown type'
                        );
                        break;
                }
                this.promises.delete(id);
            }
        });
    }

    tickAllExercises(
        tickInterval: number,
        client: raft.client.ZmqRaftClient,
        leaderId: string
    ) {
        this.exerciseMap.forEach((exercise, key) => {
            if (key.length !== 8) {
                return;
            }
            if (!exercise.started) {
                return;
            }

            exercise.tick(tickInterval, client, this, leaderId);
        });
    }

    async addExercise(
        action: AddExerciseRaftAction,
        promise?: {
            resolve: () => void;
            reject: (reason: { expected: boolean; message: string }) => void;
        }
    ) {
        try {
            const newExerciseOrError = isEmpty(action.importObject)
                ? ExerciseWrapper.create(
                      action.participantId,
                      action.trainerId,
                      this.databaseService,
                      ExerciseState.create(action.participantId)
                  )
                : await importExercise(
                      action.importObject,
                      {
                          participantId: action.participantId,
                          trainerId: action.trainerId,
                      },
                      this.databaseService
                  );
            if (!(newExerciseOrError instanceof ExerciseWrapper)) {
                promise?.reject({
                    expected: false,
                    message: newExerciseOrError,
                });
                return;
            }
            this.exerciseMap.set(action.participantId, newExerciseOrError);
            this.exerciseMap.set(action.trainerId, newExerciseOrError);
        } catch (error: unknown) {
            if (error instanceof RangeError) {
                promise?.reject({
                    expected: false,
                    message: 'No ids available',
                });
            }
            throw error;
        }

        promise?.resolve();
    }

    async removeExercise(
        action: RemoveExerciseRaftAction,
        promise?: {
            resolve: () => void;
            reject: (reason: { expected: boolean; message: string }) => void;
        }
    ) {
        const exerciseWrapper = this.exerciseMap.get(action.exerciseId);
        if (!exerciseWrapper) {
            promise?.reject({ expected: false, message: 'Exercise not found' });
            return;
        }
        this.exerciseMap.delete(exerciseWrapper.trainerId);
        this.exerciseMap.delete(exerciseWrapper.participantId);
        await exerciseWrapper.deleteExercise();

        promise?.resolve();
    }

    applyAction(
        action: ProposeExerciseActionRaftAction,
        promise?: {
            resolve: () => void;
            reject: (reason: { expected: boolean; message: string }) => void;
        }
    ) {
        const exerciseWrapper = this.exerciseMap.get(action.exerciseId);
        if (!exerciseWrapper) {
            promise?.reject({ expected: false, message: 'Exercise not found' });
            return;
        }

        try {
            exerciseWrapper.applyAction(
                action.action,
                action.clientId,
                action.actionId
            );

            switch (action.action.type) {
                case '[Exercise] Tick':
                    exerciseWrapper.tickCounter++;
                    break;
                case '[Exercise] Pause':
                    exerciseWrapper.pause();
                    break;
                case '[Exercise] Start':
                    exerciseWrapper.start();
                    break;
                default:
                    break;
            }

            exerciseWrapper.markAsModified();
        } catch (error: any) {
            if (error instanceof ReducerError) {
                if (error instanceof ExpectedReducerError) {
                    promise?.reject({
                        message: error.message,
                        expected: true,
                    });
                } else {
                    promise?.reject({
                        message: error.message,
                        expected: false,
                    });
                }
                console.warn('got reducer error:', error)
            }
            console.log(error);
            return;
        }

        promise?.resolve();
    }
}
