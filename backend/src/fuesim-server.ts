import express from 'express';
import { PeriodicEventHandler } from './exercise/periodic-events/periodic-event-handler';
import { exerciseMap } from './exercise/exercise-map';
import { ExerciseWebsocketServer } from './exercise/websocket';
import { ExerciseHttpServer } from './exercise/http-server';
import { Config } from './config';
import type { DatabaseService } from './database/services/database-service';
import type { ExerciseWrapper } from './exercise/exercise-wrapper';
import { MongoService } from './database/mongo-service';

export class FuesimServer {
    private readonly _httpServer: ExerciseHttpServer;
    private readonly _websocketServer: ExerciseWebsocketServer;
    private readonly _mongoService: MongoService;

    private readonly saveTick = async () => {
        const exercisesToSave: ExerciseWrapper[] = [];
        exerciseMap.forEach((exercise, key) => {
            // Only use exercises referenced by their trainer id (8 characters) to not choose the same exercise twice
            if (key.length !== 8) {
                return;
            }
            if (exercise.changedSinceSave) {
                exercisesToSave.push(exercise);
            }
        });
        if (exercisesToSave.length === 0) {
            return;
        }
        await this.databaseService.transaction(async (manager) => {
            const exerciseEntities = await Promise.all(
                exercisesToSave.map(async (exercise) => {
                    exercise.markAsAboutToBeSaved();
                    return exercise.asEntity(false, manager);
                })
            );
            const actionEntities = exerciseEntities.flatMap(
                (exercise) => exercise.actions ?? []
            );
            // First save the exercises...
            await manager.save(exerciseEntities);
            // ...and then the actions
            await manager.save(actionEntities);
            // Re-map database id to instance
            exercisesToSave.forEach((exercise) => {
                if (!exercise.id) {
                    exercise.id = exerciseEntities.find(
                        (entity) => entity.trainerId === exercise.trainerId
                    )?.id;
                }
            });
            exercisesToSave
                .flatMap((exercise) => exercise.temporaryActionHistory)
                .forEach((action) => {
                    if (!action.id) {
                        action.id = actionEntities.find(
                            (entity) =>
                                entity.index === action.index &&
                                entity.exercise.id === action.exercise.id
                        )?.id;
                    }
                });
            exercisesToSave.forEach((exercise) => {
                exercise.markAsSaved();
            });
        });
    };

    private readonly saveTickInterval = 10_000;

    private readonly saveHandler = new PeriodicEventHandler(
        this.saveTick,
        this.saveTickInterval
    );

    constructor(
        private readonly databaseService: DatabaseService,
        mongoUrl: string
    ) {
        const app = express();
        this._mongoService = new MongoService(this.databaseService, mongoUrl, 'dfm');
        this.mongoService.connect()
        this._websocketServer = new ExerciseWebsocketServer(app, this.mongoService);
        this._httpServer = new ExerciseHttpServer(app, databaseService, this.mongoService);
        if (Config.useDb) {
            this.saveHandler.start();
        }
    }

    public get mongoService(): MongoService {
        return this._mongoService;
    }

    public get websocketServer(): ExerciseWebsocketServer {
        return this._websocketServer;
    }

    public get httpServer(): ExerciseHttpServer {
        return this._httpServer;
    }

    public async destroy() {
        this.mongoService.close();
        this.httpServer.close();
        this.websocketServer.close();
        this.saveHandler.pause();
        // Save all remaining instances, if it's still possible
        if (this.databaseService.isInitialized) {
            await this.saveTick();
        }
    }
}
