import { createServer } from 'node:http';
import type * as core from 'express-serve-static-core';
import { Server } from 'socket.io';
import { socketIoTransports } from 'digital-fuesim-manv-shared';
import { Config } from '../config';
import type { ExerciseSocket, ExerciseServer } from '../exercise-server';
import { clientMap } from './client-map';
import { ClientWrapper } from './client-wrapper';
import {
    registerGetStateHandler,
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
        registerGetStateHandler(this.exerciseServer, client);
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
            clientMap.get(client)!.leaveExercise();
            this.backendWebsocketServer.publishAction(
                {
                    type: '[Backend] Apply Exercise Action',
                    action: {
                        type: '[Client] Remove client',
                        clientId: clientMap.get(client)!.client!.id,
                    },
                    emitterId: clientMap.get(client)!.client!.id,
                },
                clientMap.get(client)!.exercise!.id!
            );
            clientMap.delete(client);
        });
    }

    public close(): void {
        this.exerciseServer.close();
    }
}
