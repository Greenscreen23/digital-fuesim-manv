import type { ExerciseAction } from 'digital-fuesim-manv-shared';
import { validateExerciseAction } from 'digital-fuesim-manv-shared';
import type { ExerciseServer, ExerciseSocket } from '../../exercise-server';
import { clientMap } from '../client-map';

export const registerProposeActionHandler = (
    io: ExerciseServer,
    client: ExerciseSocket
) => {
    client.on('proposeAction', (action: ExerciseAction, callback): void => {
        // 1. validate json
        const errors = validateExerciseAction(action);
        if (errors.length > 0) {
            callback({
                success: false,
                message: `Invalid payload: ${errors}`,
            });
            return;
        }
        // 2. TODO: validate user permissions
        // 3. Get matching exercise wrapper
        const exerciseWrapper = clientMap.get(client)?.exercise;
        if (!exerciseWrapper) {
            callback({
                success: false,
                message: 'No exercise selected',
            });
            return;
        }
        // 4. apply action (+ save to timeline)
        try {
            exerciseWrapper.reduce(action);
        } catch (error: any) {
            callback({
                success: false,
                message: error.message,
            });
            return;
        }
        // 5. TODO: send success response to emitting client
        // 6. TODO: determine affected clients
        // 7. send new state to all affected clients
        // TODO: is this order of emits correct?
        io.emit('performAction', action);
        callback({
            success: true,
        });
    });
};
