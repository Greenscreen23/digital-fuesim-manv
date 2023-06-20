import { createServer } from 'node:http';
import type * as core from 'express-serve-static-core';
import { Server } from 'socket.io';
import { socketIoTransports } from 'digital-fuesim-manv-shared';
import type raft from 'node-zmq-raft';
import { Config } from '../config';
import type { ExerciseSocket, ExerciseServer } from '../exercise-server';
import { clientMap } from './client-map';
import { ClientWrapper } from './client-wrapper';
import {
    registerGetStateHandler,
    registerJoinExerciseHandler,
    registerProposeActionHandler,
} from './websocket-handler';
import type { ExerciseStateMachine } from './state-machine';
import { registerGetStateDiffHandler } from './websocket-handler/get-state-diff-handler';

export class ExerciseWebsocketServer {
    public readonly exerciseServer: ExerciseServer;
    public constructor(
        app: core.Express,
        private readonly raftClient: raft.client.ZmqRaftClient,
        private readonly stateMachine: ExerciseStateMachine
    ) {
        const server = createServer(app);

        this.exerciseServer = new Server(server, {
            // TODO: this is only a temporary solution to make this work
            cors: {
                origin: '*',
            },
            ...socketIoTransports,
        });

        this.exerciseServer.listen(Config.websocketPort);

        this.exerciseServer.on('connection', (socket) => {
            this.registerClient(socket);
        });
    }

    private registerClient(client: ExerciseSocket): void {
        // Add client
        clientMap.set(client, new ClientWrapper(client));

        // register handlers
        registerGetStateHandler(this.exerciseServer, client);
        registerProposeActionHandler(
            this.exerciseServer,
            client,
            this.raftClient,
            this.stateMachine
        );
        registerJoinExerciseHandler(
            this.exerciseServer,
            client,
            this.raftClient,
            this.stateMachine
        );
        registerGetStateDiffHandler(this.exerciseServer, client);

        // Register disconnect handler
        client.on('disconnect', () => {
            clientMap
                .get(client)!
                .leaveExercise(this.raftClient, this.stateMachine);
            clientMap.delete(client);
        });
    }

    public close(): void {
        this.exerciseServer.close();
    }
}
