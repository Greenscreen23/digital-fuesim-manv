import fs from 'node:fs';
import express from 'express';
import raft from 'node-zmq-raft';
import { PeriodicEventHandler } from './exercise/periodic-events/periodic-event-handler';
import { exerciseMap } from './exercise/exercise-map';
import { ExerciseWebsocketServer } from './exercise/websocket';
import { ExerciseHttpServer } from './exercise/http-server';
import { Config } from './config';
import type { DatabaseService } from './database/services/database-service';
import type { ExerciseWrapper } from './exercise/exercise-wrapper';
import { ExerciseStateMachine } from './exercise/state-machine';

export class FuesimServer {
    private readonly _httpServer: ExerciseHttpServer;
    private _websocketServer?: ExerciseWebsocketServer;
    private _raftServer?: raft.server.ZmqRaft;
    private _raftClient?: raft.client.ZmqRaftClient;

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
        raftConfigPath: string,
        raftPort: number
    ) {
        const app = express();
        this._httpServer = new ExerciseHttpServer(app, databaseService);
        if (Config.useDb) {
            this.saveHandler.start();
        }
        const raftConfig = JSON.parse(
            fs.readFileSync(raftConfigPath).toString()
        );
        raft.server.builder
            .build({
                ...raftConfig,
                factory: {
                    state: () => new ExerciseStateMachine(),
                },
            })
            .then((raftServer) => {
                this._raftServer = raftServer;
                this._raftClient = new raft.client.ZmqRaftClient(
                    raftConfig.peers.map((peer: any) => peer.url)
                );

                this._websocketServer = new ExerciseWebsocketServer(
                    app,
                    this._raftClient
                );
            });
    }

    public get websocketServer(): ExerciseWebsocketServer {
        if (!this._websocketServer) {
            throw new Error('Websocket server not initialized yet');
        }
        return this._websocketServer;
    }

    public get httpServer(): ExerciseHttpServer {
        return this._httpServer;
    }

    public get raftServer(): raft.server.ZmqRaft {
        if (!this._raftServer) {
            throw new Error('Raft server not initialized yet');
        }
        return this._raftServer;
    }

    public get raftClient(): raft.client.ZmqRaftClient {
        if (!this._raftClient) {
            throw new Error('Raft client not initialized yet');
        }
        return this._raftClient;
    }

    public async destroy() {
        this.httpServer.close();
        this.websocketServer.close();
        this.saveHandler.pause();
        // Save all remaining instances, if it's still possible
        if (this.databaseService.isInitialized) {
            await this.saveTick();
        }
    }
}
