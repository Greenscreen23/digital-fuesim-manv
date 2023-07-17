import type { ExerciseAction, UUID } from 'digital-fuesim-manv-shared';
import {
    ExpectedReducerError,
    ReducerError,
    validateExerciseAction,
    validatePermissions,
} from 'digital-fuesim-manv-shared';
import type { ApplyExerciseAction } from 'exercise/backend-websocket';
import type { ExerciseServer, ExerciseSocket } from '../../exercise-server';
import { clientMap } from '../client-map';
import { secureOn } from './secure-on';

export const registerProposeActionHandler = (
    io: ExerciseServer,
    client: ExerciseSocket,
    onApply: (action: ApplyExerciseAction, exerciseId: string) => Promise<void>
) => {
    secureOn(
        client,
        'proposeAction',
        async (action: ExerciseAction, id: UUID | undefined, callback): Promise<void> => {
            const clientWrapper = clientMap.get(client);
            if (!clientWrapper) {
                // There is no client. Skip.
                console.error('Got an action from missing client');
                return;
            }
            // 1. validate json
            const errors = validateExerciseAction(action);
            if (errors.length > 0) {
                callback({
                    success: false,
                    message: `Invalid payload: ${errors}`,
                    expected: false,
                });
                return;
            }
            // 2. Get matching exercise wrapper & client wrapper
            const exerciseWrapper = clientWrapper.exercise;
            if (!exerciseWrapper) {
                callback({
                    success: false,
                    message: 'No exercise selected',
                    expected: false,
                });
                return;
            }
            if (!clientWrapper.client) {
                callback({
                    success: false,
                    message: 'No client selected',
                    expected: false,
                });
                return;
            }
            // 3. validate user permissions
            if (
                !validatePermissions(
                    clientWrapper.client,
                    action,
                    exerciseWrapper.getStateSnapshot()
                )
            ) {
                callback({
                    success: false,
                    message: 'No sufficient rights',
                    expected: false,
                });
                return;
            }
            // 4. apply & broadcast action (+ save to timeline)
            try {
                exerciseWrapper.applyAction(action, clientWrapper.client.id, undefined, id);
                await onApply(
                    {
                        type: '[Backend] Apply Exercise Action',
                        action,
                        emitterId: clientWrapper.client.id,
                    },
                    exerciseWrapper.trainerId
                );
            } catch (error: any) {
                if (error instanceof ReducerError) {
                    if (error instanceof ExpectedReducerError) {
                        callback({
                            success: false,
                            message: error.message,
                            expected: true,
                        });
                    } else {
                        callback({
                            success: false,
                            message: error.message,
                            expected: false,
                        });
                    }
                    return;
                }
                throw error;
            }
            // 5. send success response to emitting client
            callback({
                success: true,
            });
        }
    );
};
