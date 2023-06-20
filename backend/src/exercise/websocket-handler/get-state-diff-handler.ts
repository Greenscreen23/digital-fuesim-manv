import { clientMap } from '../../exercise/client-map';
import type { ExerciseServer, ExerciseSocket } from '../../exercise-server';
import { secureOn } from './secure-on';

export const registerGetStateDiffHandler = (
    io: ExerciseServer,
    client: ExerciseSocket
) => {
    secureOn(client, 'getStateDiff', async (appliedActionCount, callback) => {
        const exercise = clientMap.get(client)?.exercise;
        if (!exercise) {
            callback({
                success: false,
                message: 'No exercise selected',
                expected: false,
            });
            return;
        }
        callback({
            success: true,
            payload: await exercise.getStateDiff(appliedActionCount),
        });
    });
};
