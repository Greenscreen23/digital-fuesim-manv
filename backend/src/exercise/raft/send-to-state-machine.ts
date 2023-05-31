import raft from 'node-zmq-raft';
import { encode } from 'msgpack-lite';
import type { ExerciseAction, StateExport } from 'digital-fuesim-manv-shared';
import type { ExerciseStateMachine } from 'exercise/state-machine';
import type { ExerciseRaftAction } from './types';

export async function addExerciseToStateMachine(
    client: raft.client.ZmqRaftClient,
    trainerId: string,
    participantId: string,
    importObject: StateExport,
    stateMachine: ExerciseStateMachine
): Promise<void> {
    return sendToStateMachine(
        client,
        {
            type: 'addExerciseRaftAction',
            trainerId,
            participantId,
            importObject,
        },
        stateMachine
    );
}

export async function removeExerciseFromStateMachine(
    client: raft.client.ZmqRaftClient,
    exerciseId: string,
    stateMachine: ExerciseStateMachine
): Promise<void> {
    return sendToStateMachine(
        client,
        {
            type: 'removeExerciseRaftAction',
            exerciseId,
        },
        stateMachine
    );
}

export async function proposeExerciseActionToStateMachine(
    client: raft.client.ZmqRaftClient,
    exerciseId: string,
    clientId: string | null,
    action: ExerciseAction,
    stateMachine: ExerciseStateMachine
): Promise<void> {
    return sendToStateMachine(
        client,
        {
            type: 'proposeExerciseActionRaftAction',
            exerciseId,
            clientId,
            action,
        },
        stateMachine
    );
}

async function sendToStateMachine(
    client: raft.client.ZmqRaftClient,
    action: ExerciseRaftAction,
    stateMachine: ExerciseStateMachine
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const id = raft.utils.id.genIdent();
        stateMachine.promises.set(id, { resolve, reject });
        client
            .requestUpdate(id, encode(action))
            .catch((error) => reject(error));
    });
}
