import { createServer } from 'node:http';
import type * as core from 'express-serve-static-core';
import { Server } from 'socket.io';
import { socketIoTransports } from 'digital-fuesim-manv-shared';
import { Config } from '../config';
import type { ExerciseSocket, ExerciseServer } from '../exercise-server';
import { clientMap } from './client-map';
import { ClientWrapper } from './client-wrapper';
import {
    registerJoinExerciseHandler,
    registerProposeActionHandler,
} from './websocket-handler';
import type { BackendWebsocketServer } from './backend-websocket';

export class ExerciseWebsocketServer {
    public readonly exerciseServer: ExerciseServer;
    public constructor(
        app: core.Express,
        private readonly backendWebsocketServer: BackendWebsocketServer
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
        registerProposeActionHandler(
            this.exerciseServer,
            client,
            (action, exerciseId) =>
                this.backendWebsocketServer.publishAction(action, exerciseId)
        );
        registerJoinExerciseHandler(
            this.exerciseServer,
            client,
            (action, exerciseId) =>
                this.backendWebsocketServer.publishAction(action, exerciseId)
        );

        // Register disconnect handler
        client.on('disconnect', () => {
            const clientWrapper = clientMap.get(client);
            if (!clientWrapper?.client) {
                console.warn('unknown client disconnected')
                return;
            }
            if (!clientWrapper.exercise) {
                console.warn('client without exercise disconnected')
                return;
            }
            clientWrapper.leaveExercise((action, exerciseId) => this.backendWebsocketServer.publishAction(action, exerciseId));
            clientMap.delete(client);
        });
    }

    public close(): void {
        this.exerciseServer.close();
    }
}
