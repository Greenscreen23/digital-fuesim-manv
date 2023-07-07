import fs from 'node:fs';
import express from 'express';
import raft from 'node-zmq-raft';
import { ExerciseWebsocketServer } from './exercise/websocket';
import { ExerciseHttpServer } from './exercise/http-server';
import { Config } from './config';
import type { DatabaseService } from './database/services/database-service';
import type { ExerciseWrapper } from './exercise/exercise-wrapper';
import { ExerciseStateMachine } from './exercise/state-machine';
import { RaftWebsocketServer } from './exercise/raft-websocket';
import { PeriodicEventHandler } from 'digital-fuesim-manv-shared';

export class FuesimServer {
    private readonly _httpServer: ExerciseHttpServer;
    private readonly _websocketServer: ExerciseWebsocketServer;
    private readonly _raftClient: raft.client.ZmqRaftClient;
    private readonly _stateMachine: ExerciseStateMachine;
    private readonly _raftWebsocket: RaftWebsocketServer;

    private readonly saveTick = async () => {
        const exercisesToSave: ExerciseWrapper[] = [];
        this.stateMachine.exerciseMap.forEach((exercise, key) => {
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

    private readonly tickInterval = 1000;

    private readonly tickHandler = new PeriodicEventHandler(async () => {
        try {
            const currentConfig = await this.raftClient.requestConfig();
            if (currentConfig.leaderId === this.id) {
                this.stateMachine.tickAllExercises(
                    this.tickInterval,
                    this.raftClient,
                    this.id
                );
            }
        } catch(e: unknown) {
            console.error(e);
        }
    }, this.tickInterval);

    private readonly id!: string;

    constructor(
        private readonly databaseService: DatabaseService,
        raftConfigPath: string,
        exercises: ExerciseWrapper[]
    ) {
        const app = express();
        if (Config.useDb) {
            this.saveHandler.start();
        }
        const raftConfig = JSON.parse(
            fs.readFileSync(raftConfigPath).toString()
        );
        this.id = raftConfig.id;
        this._stateMachine = new ExerciseStateMachine(
            databaseService,
            exercises
        );
        this._raftClient = new raft.client.ZmqRaftClient(
            raftConfig.peers.map((peer: any) => peer.url),
            {
                timeout: raftConfig.serverResponseTimeout,
                serverElectionGraceDelay: raftConfig.serverElectionGraceDelay,
            }
        );
        this._httpServer = new ExerciseHttpServer(
            app,
            this.raftClient,
            this.stateMachine,
            raftConfig.origins
        );

        this._websocketServer = new ExerciseWebsocketServer(
            app,
            this.raftClient,
            this.stateMachine
        );

        this._raftWebsocket = new RaftWebsocketServer(
            app,
            this.raftClient,
            this.stateMachine
        );

        this.tickHandler.start();
    }

    public get websocketServer(): ExerciseWebsocketServer {
        if (!this._websocketServer) {
            throw new Error('Websocket server not initialized yet');
        }
        return this._websocketServer;
    }

    public get httpServer(): ExerciseHttpServer {
        if (!this._httpServer) {
            throw new Error('HTTP server not initialized yet');
        }
        return this._httpServer;
    }

    public get stateMachine(): ExerciseStateMachine {
        if (!this._stateMachine) {
            throw new Error('State machine not initialized yet');
        }
        return this._stateMachine;
    }

    public get raftClient(): raft.client.ZmqRaftClient {
        if (!this._raftClient) {
            throw new Error('Raft client not initialized yet');
        }
        return this._raftClient;
    }

    public get raftWebsocket(): RaftWebsocketServer {
        if (!this._raftWebsocket) {
            throw new Error('Raft websocket not initialized yet');
        }
        return this._raftWebsocket;
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
