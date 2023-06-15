import type { UUID } from 'digital-fuesim-manv-shared';
import { ValidationErrorWrapper } from '../../utils/validation-error-wrapper';
import type { ExerciseServer, ExerciseSocket } from '../../exercise-server';
import { clientMap } from '../client-map';
import { secureOn } from './secure-on';
import { MongoService } from '../../database/mongo-service';

export const registerJoinExerciseHandler = (
    io: ExerciseServer,
    client: ExerciseSocket,
    mongoService: MongoService
) => {
    secureOn(
        client,
        'joinExercise',
        async (
            exerciseId: string,
            clientName: string,
            clientId: UUID | undefined,
            callback
        ) => {
            // When this listener is registered the socket is in the map.
            const clientWrapper = clientMap.get(client)!;
            if (clientWrapper.exercise) {
                callback({
                    success: false,
                    message: 'The client has already joined an exercise',
                    expected: false,
                });
                return;
            }
            let newClientId: UUID | undefined;
            try {
                newClientId = await clientMap
                    .get(client)
                    ?.joinExercise(
                        exerciseId,
                        clientName,
                        clientId,
                        mongoService
                    );
            } catch (e: unknown) {
                if (e instanceof ValidationErrorWrapper) {
                    callback({
                        success: false,
                        message: `Invalid payload: ${e.errors}`,
                        expected: false,
                    });
                    return;
                }
                throw e;
            }
            if (!newClientId) {
                callback({
                    success: false,
                    message: 'The exercise does not exist',
                    expected: false,
                });
                return;
            }
            callback({
                success: true,
                payload: newClientId,
            });
        }
    );
};
