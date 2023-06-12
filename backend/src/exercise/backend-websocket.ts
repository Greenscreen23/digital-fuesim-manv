import type { StateExport, ExerciseAction } from 'digital-fuesim-manv-shared';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { isString } from 'lodash-es';
import type { DatabaseService } from '../database/services/database-service';
import { exerciseMap } from './exercise-map';
import { createExercise } from './exercise-helpers';

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
    emitterId: string;
}

interface ApplyAction {
    action: ApplyExerciseAction | CreateExerciseAction | DeleteExerciseAction;
    exerciseId: string;
}

interface ClientToServerEvents {
    sendAction: (action: ApplyAction) => void;
}

interface ServerToClientEvents {}

export class BackendWebsocketServer {
    private readonly receivingSocket: Server<
        ClientToServerEvents,
        ServerToClientEvents
    >;
    private readonly peers: Map<
        string,
        Socket<ServerToClientEvents, ClientToServerEvents>
    >;

    constructor(
        peers: { id: string; url: string }[],
        private readonly databaseService: DatabaseService
    ) {
        this.receivingSocket = new Server(8047);
        this.peers = new Map(
            peers.map(({ id, url }) => [
                id,
                io(url, { transports: ['websocket'] }),
            ])
        );

        this.peers.forEach((socket, id) => {
            socket.connect().on('connect_error', (err) => {
                console.error(`Failed to connect to ${id}: ${err}`);
            });
        });

        this.receivingSocket.on('connection', (socket) => {
            socket.on('sendAction', ({ action, exerciseId }) => {
                if (action.type === '[Backend] Create Exercise') {
                    this.createExercise(action, exerciseId);
                } else if (action.type === '[Backend] Delete Exercise') {
                    this.deleteExercise(action, exerciseId);
                } else {
                    this.applyAction(action, exerciseId);
                }
            });

            socket.on('disconnect', () => {
                socket.removeAllListeners();
                socket.disconnect();
            });
        });
    }

    public publishAction(
        action:
            | ApplyExerciseAction
            | CreateExerciseAction
            | DeleteExerciseAction,
        exerciseId: string
    ) {
        this.peers.forEach((socket) => {
            socket.emit('sendAction', { action, exerciseId });
        });
    }

    private async createExercise(
        action: CreateExerciseAction,
        exerciseId: string
    ) {
        const { participantId, trainerId, importObject } = action;
        const newExerciseOrError = await createExercise(
            this.databaseService,
            importObject,
            participantId,
            trainerId
        );

        if (isString(newExerciseOrError)) {
            console.error(
                `Tried to create exercise ${exerciseId} but failed: ${newExerciseOrError}`
            );
            return;
        }

        exerciseMap.set(participantId, newExerciseOrError);
        exerciseMap.set(trainerId, newExerciseOrError);
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
    }

    private applyAction(action: ApplyExerciseAction, exerciseId: string) {
        const exerciseWrapper = exerciseMap.get(exerciseId);
        if (!exerciseWrapper) {
            console.error(
                `Tried to apply action ${action.action.type} but the exercise ${exerciseId} does not exist.`
            );
            return;
        }

        exerciseWrapper.applyAction(action.action, action.emitterId);
    }
}
