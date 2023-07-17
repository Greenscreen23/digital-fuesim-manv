import type { ExerciseAction, UUID } from 'digital-fuesim-manv-shared';
import { Client } from 'digital-fuesim-manv-shared';
import type { ExerciseSocket } from '../exercise-server';
import { exerciseMap } from './exercise-map';
import type { ExerciseWrapper } from './exercise-wrapper';
import { ApplyExerciseAction } from './backend-websocket';

export class ClientWrapper {
    public constructor(private readonly socket: ExerciseSocket) {}

    private chosenExercise?: ExerciseWrapper;

    private relatedExerciseClient?: Client;

    /**
     * @param exerciseId The exercise id to be used for the client.
     * @param clientName The public name of the client.
     * @returns The joined client's id, or undefined when the exercise doesn't exists.
     */
    public async joinExercise(
        exerciseId: string,
        clientName: string,
        clientId: UUID | undefined,
        viewRestrictedToViewportId: UUID | undefined,
        onApply: (action: ApplyExerciseAction, exerciseId: string) => Promise<void>
    ): Promise<UUID | undefined> {
        const exercise = exerciseMap.get(exerciseId);
        if (!exercise) {
            return undefined;
        }
        this.chosenExercise = exercise;

        const clients = this.chosenExercise.getStateSnapshot().clients;
        if (clientId && clients[clientId]) {
            this.relatedExerciseClient = clients[clientId]!;
            if (
                this.relatedExerciseClient.viewRestrictedToViewportId !=
                viewRestrictedToViewportId
            ) {
                const action: ExerciseAction = {
                    type: '[Client] Restrict to viewport',
                    viewportId: viewRestrictedToViewportId,
                    clientId: this.relatedExerciseClient.id,
                };
                await onApply(
                    {
                        type: '[Backend] Apply Exercise Action',
                        action,
                        emitterId: this.relatedExerciseClient.id,
                    },
                    exerciseId
                );
                this.chosenExercise.applyAction(action, this.relatedExerciseClient.id);
            }
            this.chosenExercise.addExistingClient(this);
            return clientId;
        }
        if (clientId && !clients[clientId]) {
            console.warn('Client tried to join which id was not found', clientId, clients)
        }

        // Although getRoleFromUsedId may throw an error, this should never happen here
        // as the provided id is guaranteed to be one of the ids of the exercise as the exercise
        // was fetched with this exact id from the exercise map.
        const role = this.chosenExercise.getRoleFromUsedId(exerciseId);
        this.relatedExerciseClient = Client.create(
            clientName,
            role,
            viewRestrictedToViewportId
        );
        await this.chosenExercise.addClient(this, onApply);
        return this.relatedExerciseClient.id;
    }

    /**
     * Note that this method simply returns when the client did not join an exercise.
     */
    public async leaveExercise(onApply: (action: ApplyExerciseAction, exerciseId: string) => Promise<void>) {
        if (this.chosenExercise === undefined) {
            // The client has not joined an exercise. Do nothing.
            return;
        }
        await this.chosenExercise.removeClient(this, onApply);
    }

    public get exercise(): ExerciseWrapper | undefined {
        return this.chosenExercise;
    }

    public get client(): Client | undefined {
        return this.relatedExerciseClient;
    }

    public emitAction(action: ExerciseAction, id?: UUID) {
        this.socket.emit('performAction', action, id);
    }

    public disconnect() {
        this.chosenExercise = undefined;
        if (this.socket.connected) {
            this.socket.disconnect();
        }
    }
}
