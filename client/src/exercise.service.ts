import { ApiService } from './api.service';
import {
    ClientToServerEvents,
    ExerciseAction,
    ExerciseState,
    ServerToClientEvents,
    SocketResponse,
    UUID,
    socketIoTransports,
    uuid,
} from 'digital-fuesim-manv-shared';
import { OptimisticActionHandler } from './optimistic-action-handler';
import { OriginService } from './origin.service';
import { SimulatedParticipant } from './simulate-participants';
import { Socket, io } from 'socket.io-client';
import { Store } from './store.service';
import { freeze } from 'immer';
import fs from 'node:fs';

export class ExerciseService {
    private socket: Socket<ServerToClientEvents, ClientToServerEvents>;

    private optimisticActionHandler?: OptimisticActionHandler<
        ExerciseAction,
        ExerciseState,
        SocketResponse
    >;

    constructor(
        private readonly store: Store,
        private readonly originService: OriginService,
        private readonly apiSerivce: ApiService,
        private readonly amountInViewport: {
            vehicles: number;
            unloadedVehicles: number;
            patients: number;
        }
    ) {
        this.socket = io(this.originService.wsOrigin, {
            ...socketIoTransports,
        }).on('connect_error', (error) => {
            console.error(error);
        });;
        this.initializeSocket();
    }

    private joined: boolean = false;

    private data?: {
        payloads: { id: UUID; send: number; received?: number }[];
        running: {
            start: number;
            end?: number;
            ticks: { at: number }[];
        }[];
        connections: { start: number; end?: number; origin: string }[];
        start: number;
    };

    public async benchmark(): Promise<unknown> {
        const start = Number(process.env['START']);
        this.data = {
            payloads: [],
            connections: [{ start: 0, origin: this.originService.wsOrigin }],
            running: [],
            start: start,
        };
        const puppet = new SimulatedParticipant(
            this.store,
            async (action, optimistic) => {
                await new Promise((resolve) => setTimeout(resolve, 100));
                const id = uuid();
                this.data?.payloads.push({
                    id,
                    send: Date.now() - this.data.start,
                });
                while (true) {
                    try {
                        await this.proposeAction(action, optimistic, id);
                        break;
                    } catch (e: unknown) {
                        console.error(e);
                    }
                }
            },
            this.amountInViewport
        );

        await puppet.prepareSimulation();
        await new Promise((resolve) => setTimeout(resolve, 10_000));

        return this.data;
    }

    private async rejoinExercise() {
        this.store.blocking = true;
        const exerciseId = this.store.exerciseId;
        const ownClientId = this.store.ownClientId;
        const lastClientName = this.store.lastClientName;
        const ownClient = this.store.state.clients[ownClientId]!;

        console.error(process.env['ID'], ': rejoining exercise');

        while (this.originService.newOrigin()) {
            try {
                this.socket.off('performAction');
                this.socket.off('disconnect');
                this.socket.disconnect();
                // eslint-disable-next-line no-await-in-loop, no-async-promise-executor, @typescript-eslint/no-loop-func
                await new Promise<void>(async (resolve, reject) => {
                    if (!(await this.apiSerivce.checkHealth())) {
                        reject('Server ist nicht erreichbar');
                        return;
                    }

                    this.socket = io(this.originService.wsOrigin, {
                        ...socketIoTransports,
                    });
                    this.socket.connect().on('connect_error', (error) => {
                        reject(error);
                    });
                    this.initializeSocket();

                    if (
                        exerciseId === undefined ||
                        lastClientName === undefined
                    ) {
                        reject('Es konnte keine Übung gefunden werden');
                        return;
                    }

                    const joinResponse = await new Promise<
                        SocketResponse<{
                            clientId: UUID;
                            state: ExerciseState;
                        }>
                    >((resolve) => {
                        this.socket.emit(
                            'joinExercise',
                            exerciseId,
                            lastClientName,
                            ownClientId,
                            resolve
                        );
                    });

                    if (!joinResponse.success) {
                        reject(joinResponse.message);
                        return;
                    }

                    this.store.joinExercise(
                        joinResponse.payload.clientId,
                        exerciseId,
                        lastClientName,
                        joinResponse.payload.state
                    );

                    this.store.blocking = false

                    console.log(
                        process.env['ID'],
                        ': rejoined exercise on host',
                        this.originService.wsOrigin
                    );
                    resolve();
                });
                return;
            } catch (e: unknown) {
                if (e) {
                    console.error(e);
                }
            }
        }

        console.error('Es konnte kein Server erreicht werden');
    }

    private initializeSocket() {
        this.data?.connections.push({
            start: Date.now() - this.data.start,
            origin: this.originService.wsOrigin,
        });
        this.socket.on('performAction', (action: ExerciseAction, id?: UUID) => {
            freeze(action, true);
            if (id) {
                const payload = this.data?.payloads.find((p) => p.id === id);
                if (payload) {
                    payload.received = Date.now() - this.data!.start;
                }
            }

            if (action.type === '[Exercise] Start') {
                this.data?.running.push({
                    start: Date.now() - this.data.start,
                    ticks: [],
                });
            }

            if (action.type === '[Exercise] Tick') {
                this.data?.running.at(-1)?.ticks.push({
                    at: Date.now() - this.data.start,
                });
            }

            if (action.type === '[Exercise] Pause') {
                const lastRun = this.data?.running.at(-1);
                if (lastRun) {
                    lastRun.end = Date.now() - this.data!.start;
                }
            }

            this.optimisticActionHandler?.performAction(action);
        });
        this.socket.on('disconnect', async (reason) => {
            if (reason === 'io client disconnect') {
                return;
            }

            console.error('disconnected, reason:', reason);

            if (this.data?.connections.at(-1)) {
                this.data.connections.at(-1)!.end =
                    Date.now() - this.data.start;
            }
            if (this.joined) {
                this.rejoinExercise();
            }
        });
    }

    /**
     * Use the function in ApplicationService instead
     *
     * Join an exercise and retrieve its state
     * Displays an error message if the join failed
     * @returns whether the join was successful
     */
    public async joinExercise(
        exerciseId: string,
        clientName: string
    ): Promise<boolean> {
        const joinResponse = await new Promise<
            SocketResponse<{ clientId: UUID; state: ExerciseState }>
        >((resolve) => {
            this.socket.emit(
                'joinExercise',
                exerciseId,
                clientName,
                undefined,
                resolve
            );
        });
        if (!joinResponse.success) {
            console.error(joinResponse.message);
            return false;
        }

        freeze(joinResponse.payload.state, true);
        this.store.joinExercise(
            joinResponse.payload.clientId,
            exerciseId,
            clientName,
            joinResponse.payload.state
        );
        // Only do this after the correct state is in the store
        this.optimisticActionHandler = new OptimisticActionHandler<
            ExerciseAction,
            ExerciseState,
            SocketResponse
        >(
            (exercise) => (this.store.state = exercise),
            () => this.store.state,
            (action) => this.store.applyServerAction(action),
            async (action, id) => {
                const response = await new Promise<SocketResponse>(
                    (resolve) => {
                        this.socket.emit('proposeAction', action, id, resolve);
                    }
                );
                if (!response.success) {
                    console.error(response.message);
                }
                return response;
            }
        );
        this.joined = true;
        return true;
    }

    /**
     *
     * @param optimistic wether the action should be applied before the server responds (to reduce latency) (this update is guaranteed to be synchronous)
     * @returns the response of the server
     */
    public async proposeAction(
        action: ExerciseAction,
        optimistic: boolean = false,
        id: UUID | undefined = undefined
    ) {
        if (!this.optimisticActionHandler) {
            throw new Error('No optimistic action handler!');
        }
        return Promise.race([
            this.optimisticActionHandler.proposeAction(action, id, optimistic),
            new Promise<SocketResponse>((_resolve, reject) => {
                setTimeout(() => reject('timeout'), 10_000);
            }),
        ]);
    }
}
