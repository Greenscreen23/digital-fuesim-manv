import type { ExerciseAction, UUID } from 'digital-fuesim-manv-shared';
import { Client } from 'digital-fuesim-manv-shared';
import type { ExerciseSocket } from '../exercise-server';
import { exerciseMap } from './exercise-map';
import type { ExerciseWrapper } from './exercise-wrapper';
import { MongoService } from '../database/mongo-service';

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
        mongoService: MongoService
    ): Promise<UUID | undefined> {
        const exercise = exerciseMap.get(exerciseId);
        if (!exercise) {
            return undefined;
        }
        this.chosenExercise = exercise;

        const clients = this.chosenExercise.getStateSnapshot().clients;
        if (clientId && clients[clientId]) {
            this.relatedExerciseClient = clients[clientId];
            this.chosenExercise.addExistingClient(this);
            return clientId;
        }

        // Although getRoleFromUsedId may throw an error, this should never happen here
        // as the provided id is guaranteed to be one of the ids of the exercise as the exercise
        // was fetched with this exact id from the exercise map.
        const role = this.chosenExercise.getRoleFromUsedId(exerciseId);
        this.relatedExerciseClient = Client.create(clientName, role, undefined);
        await this.chosenExercise.addClient(this, mongoService);
        return this.relatedExerciseClient.id;
    }

    /**
     * Note that this method simply returns when the client did not join an exercise.
     */
    public async leaveExercise(mongoService: MongoService) {
        if (this.chosenExercise === undefined) {
            // The client has not joined an exercise. Do nothing.
            return;
        }
        await this.chosenExercise.removeClient(this, mongoService);
    }

    public get exercise(): ExerciseWrapper | undefined {
        return this.chosenExercise;
    }

    public get client(): Client | undefined {
        return this.relatedExerciseClient;
    }

    public emitAction(action: ExerciseAction) {
        this.socket.emit('performAction', action);
    }

    public disconnect() {
        this.chosenExercise = undefined;
        if (this.socket.connected) {
            this.socket.disconnect();
        }
    }
}
