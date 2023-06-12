import type { UUID } from 'digital-fuesim-manv-shared';
import type { ApplyExerciseAction } from 'exercise/backend-websocket';
import { ValidationErrorWrapper } from '../../utils/validation-error-wrapper';
import type { ExerciseServer, ExerciseSocket } from '../../exercise-server';
import { clientMap } from '../client-map';
import { secureOn } from './secure-on';

export const registerJoinExerciseHandler = (
    io: ExerciseServer,
    client: ExerciseSocket,
    onAddClient: (action: ApplyExerciseAction, exerciseId: string) => void
) => {
    secureOn(
        client,
        'joinExercise',
        (
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
                newClientId = clientMap
                    .get(client)
                    ?.joinExercise(exerciseId, clientName, clientId);
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
            onAddClient(
                {
                    type: '[Backend] Apply Exercise Action',
                    action: {
                        type: '[Client] Add client',
                        client: clientWrapper.client!,
                    },
                    emitterId: clientWrapper.client!.id,
                },
                exerciseId
            );
            callback({
                success: true,
                payload: newClientId,
            });
        }
    );
};
