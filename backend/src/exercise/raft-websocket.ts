import { Server } from 'socket.io';
import type raft from 'node-zmq-raft';
import { ExerciseStateMachine } from './state-machine';
import type * as core from 'express-serve-static-core';
import { createServer } from 'node:http';

export class RaftWebsocketServer {
    public readonly websocketServer: Server<{
        applyEntries: (
            entries: Buffer[],
            nextIndex: number,
            currentTerm: number,
            snapshot: raft.common.SnapshotFile | undefined,
        ) => void;
        // tick: (tickInterval: number, leaderId: string) => void;
    }>;

    constructor(
        app: core.Express,
        private readonly raftClient: raft.client.ZmqRaftClient,
        private readonly stateMachine: ExerciseStateMachine
    ) {
        const server = createServer(app);

        this.websocketServer = new Server(server, {
            cors: {
                origin: '*',
            },
            transports: ['websocket'],
        });

        this.websocketServer.listen(5431);

        this.websocketServer.on('connection', (socket) => {
            socket.on(
                'applyEntries',
                async (entries, nextIndex, currentTerm, snapshot) => {
                    try {
                        this.stateMachine.applyEntries(
                            entries,
                            nextIndex,
                            currentTerm,
                            snapshot
                        );
                    } catch (e: unknown) {
                        console.warn(
                            `An error occurred while applying entries.`,
                            e
                        );
                    }
                }
            );
            // socket.on('tick', (tickInterval, leaderId) => {
            //     this.stateMachine.tickAllExercises(
            //         tickInterval,
            //         this.raftClient,
            //         leaderId
            //     );
            // });
        });
    }
}
