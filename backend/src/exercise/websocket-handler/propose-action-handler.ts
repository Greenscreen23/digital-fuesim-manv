import type { ExerciseAction, UUID } from 'digital-fuesim-manv-shared';
import {
    validateExerciseAction,
    validatePermissions,
} from 'digital-fuesim-manv-shared';
import type raft from 'node-zmq-raft';
import { proposeExerciseActionToStateMachine } from '../raft/send-to-state-machine';
import type { ExerciseStateMachine } from '../state-machine';
import type { ExerciseServer, ExerciseSocket } from '../../exercise-server';
import { clientMap } from '../client-map';
import { secureOn } from './secure-on';

export const registerProposeActionHandler = (
    io: ExerciseServer,
    client: ExerciseSocket,
    raftClient: raft.client.ZmqRaftClient,
    stateMachine: ExerciseStateMachine
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
                await proposeExerciseActionToStateMachine(
                    raftClient,
                    exerciseWrapper.trainerId,
                    clientWrapper.client.id,
                    action,
                    id,
                    stateMachine
                );
            } catch (error: any) {
                callback({
                    success: false,
                    message: error.message ?? 'Ein Fehler ist aufgetreten',
                    expected: error.expected ?? false,
                });
                return;
            }
            // 5. send success response to emitting client
            callback({
                success: true,
            });
        }
    );
};
