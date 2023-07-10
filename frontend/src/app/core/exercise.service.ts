import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import {
    ClientToServerEvents,
    ExerciseAction,
    ExerciseState,
    ServerToClientEvents,
    SocketResponse,
    UUID,
    uuid,
} from 'digital-fuesim-manv-shared';
import { socketIoTransports } from 'digital-fuesim-manv-shared';
import { freeze } from 'immer';
import {
    debounceTime,
    filter,
    pairwise,
    Subject,
    switchMap,
    takeUntil,
} from 'rxjs';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { handleChanges } from '../shared/functions/handle-changes';
import type { AppState } from '../state/app.state';
import {
    createApplyServerActionAction,
    createJoinExerciseAction,
    createLeaveExerciseAction,
    createSetExerciseStateAction,
} from '../state/application/application.actions';
import { selectExerciseStateMode } from '../state/application/selectors/application.selectors';
import {
    selectClients,
    selectExerciseState,
} from '../state/application/selectors/exercise.selectors';
import {
    selectCurrentRole,
    selectOwnClient,
    selectVisibleVehicles,
} from '../state/application/selectors/shared.selectors';
import { selectStateSnapshot } from '../state/get-state-snapshot';
import { MessageService } from './messages/message.service';
import { OptimisticActionHandler } from './optimistic-action-handler';
import { OriginService } from './origin.service';
import { ApiService } from './api.service';
import { isString } from 'lodash-es';
import { SimulatedParticipant } from './simulate-participants';

/**
 * This Service deals with the state synchronization of a live exercise.
 * In addition, it notifies the user during an exercise of certain events (new client connected, vehicle arrived etc.).
 *
 * While this service should be used for proposing all actions (= changing the state) all
 * read operations should be done via the central frontend store (with the help of selectors).
 */
@Injectable({
    providedIn: 'root',
})
export class ExerciseService {
    private socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
        this.originService.wsOrigin,
        {
            ...socketIoTransports,
        }
    );

    private optimisticActionHandler?: OptimisticActionHandler<
        ExerciseAction,
        ExerciseState,
        SocketResponse
    >;

    constructor(
        private readonly store: Store<AppState>,
        private readonly messageService: MessageService,
        private readonly originService: OriginService,
        private readonly apiSerivce: ApiService
    ) {
        this.initializeSocket();
    }

    private data?: {
        payloads: { id: UUID; send: number; received?: number }[];
        running: {
            start: number;
            end?: number;
            ticks: { at: number; leader: string }[];
        }[];
        connections: { start: number; end?: number; origin: string }[];
        start: number;
    };

    public async benchmark(): Promise<unknown> {
        this.data = {
            payloads: [],
            connections: [{ start: 0, origin: this.originService.wsOrigin }],
            running: [],
            start: Date.now(),
        };
        const puppet = new SimulatedParticipant(
            this.store,
            async (action, optimistic) => {
                // await new Promise((resolve) => setTimeout(resolve, 100))
                const id = uuid();
                this.data?.payloads.push({
                    id,
                    send: Date.now() - this.data.start,
                });
                try {
                    await this.proposeAction(action, optimistic, id);
                } catch (e: unknown) {
                    console.error(e);
                }
            }
        );

        await puppet.prepareSimulation();
        await new Promise((resolve) => setTimeout(resolve, 10_000));

        return this.data;
    }

    public async oldbenchmark(): Promise<unknown> {
        this.data = {
            payloads: [],
            connections: [
                { start: Date.now(), origin: this.originService.wsOrigin },
            ],
            running: [],
            start: Date.now(),
        };
        for (let i = 0; i < 1_000; i++) {
            // eslint-disable-next-line no-await-in-loop, @typescript-eslint/no-loop-func, no-promise-executor-return
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const action = {
                type: '[Hospital] Add hospital',
                hospital: {
                    id: uuid(),
                    type: 'hospital',
                    name: `Krankenhaus-${i}`,
                    transportDuration: 3600000,
                    patientIds: {},
                },
            } as const;
            this.data.payloads.push({
                id: action.hospital.id,
                send: Date.now() - this.data.start,
            });
            this.proposeAction(action);
        }
        // eslint-disable-next-line no-promise-executor-return
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        return this.data;
    }

    private async rejoinExercise() {
        while (this.originService.newOrigin()) {
            try {
                // eslint-disable-next-line no-await-in-loop, no-async-promise-executor, @typescript-eslint/no-loop-func
                await new Promise<void>(async (resolve, reject) => {
                    const { exerciseId, ownClientId, lastClientName } =
                        selectStateSnapshot(
                            (state) => state.application,
                            this.store
                        );

                    const ownClient = selectStateSnapshot(
                        selectOwnClient,
                        this.store
                    );

                    this.socket.off('performAction');
                    this.socket.off('disconnect');
                    this.socket.disconnect();

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

                    if (
                        exerciseId === undefined ||
                        lastClientName === undefined
                    ) {
                        reject('Es konnte keine Übung gefunden werden');
                        return;
                    }

                    const state = selectStateSnapshot(
                        (state) => state.application.exerciseState,
                        this.store
                    );

                    if (!state) {
                        reject('Der Übungszustand konnte nicht geladen werden');
                        return;
                    }

                    const joinResponse = await new Promise<
                        SocketResponse<{
                            clientId: UUID;
                            actions?: ExerciseAction[];
                        }>
                    >((resolve) => {
                        this.socket.emit(
                            'joinExercise',
                            exerciseId,
                            lastClientName,
                            ownClientId,
                            ownClient?.viewRestrictedToViewportId,
                            state.appliedActionCount,
                            resolve
                        );
                    });

                    if (!joinResponse.success) {
                        reject(joinResponse.message);
                        return;
                    }

                    if (!joinResponse.payload.actions) {
                        reject('Es konnten keine Aktionen geladen werden');
                        return;
                    }

                    freeze(joinResponse.payload.actions, true);
                    joinResponse.payload.actions.forEach((action) => {
                        this.store.dispatch(
                            createApplyServerActionAction(action)
                        );
                    });

                    this.store.dispatch(
                        createJoinExerciseAction(
                            joinResponse.payload.clientId,
                            selectStateSnapshot(
                                (state) => state.application.exerciseState,
                                this.store
                            )!,
                            exerciseId,
                            lastClientName
                        )
                    );
                    this.initializeSocket();
                    resolve();
                });
                return;
            } catch (e: unknown) {
                if (e) {
                    this.messageService.postError({
                        title: 'Fehler beim Beitreten der Übung',
                        error: e,
                    });
                }
            }
        }

        this.messageService.postError({
            title: 'Fehler beim Beitreten der Übung',
            error: 'Es konnte kein Server erreicht werden',
        });
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
                    leader: action.leaderId,
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

            if (this.data?.connections.at(-1)) {
                this.data.connections.at(-1)!.end =
                    Date.now() - this.data.start;
            }
            this.originService.resetOrigins();
            this.rejoinExercise();
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
        this.socket.connect().on('connect_error', (error) => {
            this.messageService.postError({
                title: 'Fehler beim Verbinden zum Server',
                error,
            });
        });
        const joinResponse = await new Promise<
            SocketResponse<{ clientId: UUID; state?: ExerciseState }>
        >((resolve) => {
            this.socket.emit(
                'joinExercise',
                exerciseId,
                clientName,
                undefined,
                undefined,
                undefined,
                resolve
            );
        });
        if (!joinResponse.success) {
            this.messageService.postError({
                title: 'Fehler beim Beitreten der Übung',
                error: joinResponse.message,
            });
            return false;
        }
        if (!joinResponse.payload.state) {
            this.messageService.postError({
                title: 'Fehler beim Beitreten der Übung',
                error: 'Der Übungszustand konnte nicht geladen werden',
            });
            return false;
        }
        freeze(joinResponse.payload.state, true);
        this.store.dispatch(
            createJoinExerciseAction(
                joinResponse.payload.clientId,
                joinResponse.payload.state,
                exerciseId,
                clientName
            )
        );
        // Only do this after the correct state is in the store
        this.optimisticActionHandler = new OptimisticActionHandler<
            ExerciseAction,
            ExerciseState,
            SocketResponse
        >(
            (exercise) =>
                this.store.dispatch(createSetExerciseStateAction(exercise)),
            () => selectStateSnapshot(selectExerciseState, this.store),
            (action) =>
                this.store.dispatch(createApplyServerActionAction(action)),
            async (action, id) => {
                const response = await new Promise<SocketResponse>(
                    (resolve) => {
                        this.socket.emit('proposeAction', action, id, resolve);
                    }
                );
                if (!response.success) {
                    if (!response.expected) {
                        this.messageService.postError({
                            title: 'Fehler beim Senden der Aktion',
                            error: response.message,
                        });
                    } else {
                        this.messageService.postError({
                            title: 'Diese Aktion ist nicht gestattet!',
                            error: response.message,
                        });
                    }
                }
                return response;
            }
        );
        this.startNotifications();
        return true;
    }

    /**
     * Use the function in ApplicationService instead
     */
    public leaveExercise() {
        this.socket.disconnect();
        this.stopNotifications();
        this.optimisticActionHandler = undefined;
        this.store.dispatch(createLeaveExerciseAction());
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
        if (
            selectStateSnapshot(selectExerciseStateMode, this.store) !==
                'exercise' ||
            this.optimisticActionHandler === undefined
        ) {
            // Especially during timeTravel, buttons that propose actions are only deactivated via best effort
            this.messageService.postError({
                title: 'Änderungen konnten nicht vorgenommen werden',
                body: 'Treten Sie der Übung wieder bei.',
            });
            return { success: false };
        }

        // TODO: throw if `response.success` is false
        return Promise.race([
            this.optimisticActionHandler.proposeAction(action, id, optimistic),
            new Promise<SocketResponse>((_resolve, reject) => {
                setTimeout(() => reject('timeout'), 10_000);
            }),
        ]);
    }

    private readonly stopNotifications$ = new Subject<void>();

    private startNotifications() {
        // If the user is a trainer, display a message for each joined or disconnected client
        this.store
            .select(selectCurrentRole)
            .pipe(
                filter((role) => role === 'trainer'),
                switchMap(() => this.store.select(selectClients)),
                pairwise(),
                takeUntil(this.stopNotifications$)
            )
            .subscribe(([oldClients, newClients]) => {
                handleChanges(oldClients, newClients, {
                    createHandler: (newClient) => {
                        this.messageService.postMessage({
                            title: `${newClient.name} ist als ${
                                newClient.role === 'trainer'
                                    ? 'Trainer'
                                    : 'Teilnehmer'
                            } beigetreten.`,
                            color: 'info',
                        });
                    },
                    deleteHandler: (oldClient) => {
                        this.messageService.postMessage({
                            title: `${oldClient.name} hat die Übung verlassen.`,
                            color: 'info',
                        });
                    },
                });
            });
        // If the user is restricted to a viewport, display a message for each vehicle that arrived at this viewport
        this.store
            .select(selectOwnClient)
            .pipe(
                filter(
                    (client) =>
                        client?.viewRestrictedToViewportId !== undefined &&
                        !client.isInWaitingRoom
                ),
                switchMap((client) =>
                    this.store
                        .select(selectVisibleVehicles)
                        // pipe in here so no pairs of events from different viewports are built
                        // Do not trigger the message if the vehicle was removed and added again at the same time
                        .pipe(debounceTime(0), pairwise())
                ),
                takeUntil(this.stopNotifications$)
            )
            .subscribe(([oldVehicles, newVehicles]) => {
                handleChanges(oldVehicles, newVehicles, {
                    createHandler: (newVehicle) => {
                        this.messageService.postMessage({
                            title: `${newVehicle.name} ist eingetroffen.`,
                            color: 'info',
                        });
                    },
                });
            });
    }

    private stopNotifications() {
        this.stopNotifications$.next();
    }
}
