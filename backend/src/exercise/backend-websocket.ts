import {
    StateExport,
    type ExerciseAction,
    cloneDeepMutable,
} from 'digital-fuesim-manv-shared';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { isString } from 'lodash-es';
import type { DatabaseService } from '../database/services/database-service';
import { exerciseMap } from './exercise-map';
import { createExercise } from './exercise-helpers';
import { ExerciseWrapper } from './exercise-wrapper';

export interface CreateExerciseAction {
    type: '[Backend] Create Exercise';
    trainerId: string;
    participantId: string;
    importObject: StateExport;
}

export interface DeleteExerciseAction {
    type: '[Backend] Delete Exercise';
}

export interface ApplyExerciseAction {
    type: '[Backend] Apply Exercise Action';
    action: ExerciseAction;
    emitterId: string | null;
}

interface ApplyAction {
    action: ApplyExerciseAction | CreateExerciseAction | DeleteExerciseAction;
    exerciseId: string;
}

interface ClientToServerEvents {
    sendAction: (action: ApplyAction, callback: () => void) => void;
}

interface ServerToClientEvents {}

export class BackendWebsocketServer {
    private readonly receivingSocket: Server<
        ClientToServerEvents,
        ServerToClientEvents
    >;
    private readonly peers: Map<
        string,
        {
            socket: Socket<ServerToClientEvents, ClientToServerEvents>;
            queue: ApplyAction[];
            initializing: boolean;
        }
    >;

    private readonly pendingExercises = new Map<string, ApplyExerciseAction[]>();

    constructor(
        peers: { id: string; url: string }[],
        private readonly databaseService: DatabaseService
    ) {
        this.receivingSocket = new Server(8047, {
            transports: ['websocket'],
            maxHttpBufferSize: 1e10,
        });
        this.peers = new Map(
            peers.map(({ id, url }) => [
                id,
                {
                    socket: io(url, {
                        transports: ['websocket'],
                    }),
                    queue: [],
                    initializing: false,
                },
            ])
        );

        this.peers.forEach((peer, id) => {
            peer.socket
                .connect()
                .on('connect_error', (err) => {
                    console.error(`Failed to connect to ${id}: ${err}`);
                })
                .on('disconnect', (reason) => {
                    console.error('Disconnected from', id, 'because', reason);
                })
                .on('connect', () => {
                    console.log(`Connected to ${id}`);
                    peer.initializing = true;
                    const exercises = new Map<
                        ExerciseWrapper,
                        { trainerId?: string; participantId?: string }
                    >();
                    exerciseMap.forEach((exercise, key) => {
                        const keys = exercises.get(exercise) ?? {};
                        if (key.length === 8) {
                            keys.trainerId = key;
                        } else {
                            keys.participantId = key;
                        }
                        exercises.set(exercise, keys);
                    });

                    exercises.forEach(
                        ({ trainerId, participantId }, exercise) => {
                            if (!trainerId || !participantId) {
                                console.error('Got exercise without keys');
                                return;
                            }
                            peer.socket.emit('sendAction', {
                                action: {
                                    type: '[Backend] Create Exercise',
                                    trainerId,
                                    participantId,
                                    importObject: new StateExport(
                                        cloneDeepMutable(
                                            exercise.getStateSnapshot()
                                        ),
                                        undefined
                                    ),
                                },
                                exerciseId: trainerId,
                            }, () => {});
                        }
                    );

                    peer.queue.forEach(({ action, exerciseId }) => {
                        peer.socket.emit('sendAction', { action, exerciseId }, () => {});
                    });
                    peer.queue = [];
                    peer.initializing = false;
                });
        });

        this.receivingSocket.on('connection', (socket) => {
            console.log('new connection');
            socket.on('sendAction', ({ action, exerciseId }, callback) => {
                console.log('got action', action.type, 'for', exerciseId);
                if (action.type === '[Backend] Create Exercise') {
                    this.createExercise(action, exerciseId);
                } else if (action.type === '[Backend] Delete Exercise') {
                    this.deleteExercise(action, exerciseId);
                } else {
                    this.applyAction(action, exerciseId);
                }
                callback();
            });
            socket.on('disconnect', (reason) => {
                console.log('disconnected because', reason);
            });
        });
    }

    public async publishAction(
        action:
            | ApplyExerciseAction
            | CreateExerciseAction
            | DeleteExerciseAction,
        exerciseId: string
    ) {
        const acks: Promise<void>[] = [];
        this.peers.forEach((peer) => {
            if (peer.initializing) {
                peer.queue.push({ action, exerciseId });
                return;
            }
            if (peer.socket.connected) {
                acks.push(new Promise(resolve => {
                    peer.socket.emit('sendAction', { action, exerciseId }, resolve);
                }))
            }
        });
        await Promise.all(acks);
    }

    private async createExercise(
        action: CreateExerciseAction,
        exerciseId: string
    ) {
        const { participantId, trainerId, importObject } = action;
        this.pendingExercises.set(exerciseId, []);
        const newExerciseOrError = await createExercise(
            this.databaseService,
            importObject,
            participantId,
            trainerId
        );

        if (isString(newExerciseOrError)) {
            this.pendingExercises.delete(exerciseId);
            console.error(
                `Tried to create exercise ${exerciseId} but failed: ${newExerciseOrError}`
            );
            return;
        }

        exerciseMap.set(participantId, newExerciseOrError);
        exerciseMap.set(trainerId, newExerciseOrError);
        this.pendingExercises.get(exerciseId)?.forEach((action) => {
            this.applyAction(action, exerciseId);
        })

        this.pendingExercises.delete(exerciseId);

        console.log('created exercise', trainerId);
    }

    private deleteExercise(_action: DeleteExerciseAction, exerciseId: string) {
        const exerciseWrapper = exerciseMap.get(exerciseId);
        if (!exerciseWrapper) {
            console.error(
                `Tried to delete the exercise ${exerciseId} but it does not exist.`
            );
            return;
        }

        exerciseWrapper.deleteExercise();
        console.log('deleted exercise', exerciseId);
    }

    private applyAction(action: ApplyExerciseAction, exerciseId: string) {
        const exerciseWrapper = exerciseMap.get(exerciseId);
        if (!exerciseWrapper) {
            const pending = this.pendingExercises.get(exerciseId);
            if (pending) {
                pending.push(action);
                return;
            }

            console.error(
                `Tried to apply action ${action.action.type} but the exercise ${exerciseId} does not exist.`
            );
            return;
        }

        exerciseWrapper.applyAction(action.action, action.emitterId);
        console.log('applied action', action.action.type, 'to', exerciseId);
    }
}
