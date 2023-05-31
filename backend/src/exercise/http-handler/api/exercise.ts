import type {
    ExerciseIds,
    ExerciseTimeline,
    StateExport,
} from 'digital-fuesim-manv-shared';
import type { ExerciseStateMachine } from 'exercise/state-machine';
import type raft from 'node-zmq-raft';
import { UserReadableIdGenerator } from '../../../utils/user-readable-id-generator';
import type { HttpResponse } from '../utils';
import {
    addExerciseToStateMachine,
    removeExerciseFromStateMachine,
} from '../../raft/send-to-state-machine';

export async function postExercise(
    importObject: StateExport,
    client: raft.client.ZmqRaftClient,
    stateMachine: ExerciseStateMachine
): Promise<HttpResponse<ExerciseIds>> {
    try {
        const participantId = UserReadableIdGenerator.generateId();
        const trainerId = UserReadableIdGenerator.generateId(8);
        await addExerciseToStateMachine(
            client,
            trainerId,
            participantId,
            importObject,
            stateMachine
        );
        return {
            statusCode: 201,
            body: {
                participantId,
                trainerId,
            },
        };
    } catch (error: any) {
        if (error instanceof RangeError) {
            return {
                statusCode: 503,
                body: {
                    message: 'No ids available.',
                },
            };
        }
        return {
            statusCode: 400,
            body: {
                message: error.message,
            },
        };
    }
}

export function getExercise(
    exerciseId: string,
    stateMachine: ExerciseStateMachine
): HttpResponse {
    const exerciseExists = stateMachine.exerciseMap.has(exerciseId);
    return {
        statusCode: exerciseExists ? 200 : 404,
        body: undefined,
    };
}

export async function deleteExercise(
    exerciseId: string,
    client: raft.client.ZmqRaftClient,
    stateMachine: ExerciseStateMachine
): Promise<HttpResponse> {
    const exerciseWrapper = stateMachine.exerciseMap.get(exerciseId);
    if (exerciseWrapper === undefined) {
        return {
            statusCode: 404,
            body: {
                message: `Exercise with id '${exerciseId}' was not found`,
            },
        };
    }
    if (exerciseWrapper.getRoleFromUsedId(exerciseId) !== 'trainer') {
        return {
            statusCode: 403,
            body: {
                message:
                    'Exercises can only be deleted by using their trainer id',
            },
        };
    }

    await removeExerciseFromStateMachine(client, exerciseId, stateMachine);

    return {
        statusCode: 204,
        body: undefined,
    };
}

export async function getExerciseHistory(
    exerciseId: string,
    stateMachine: ExerciseStateMachine
): Promise<HttpResponse<ExerciseTimeline>> {
    const exerciseWrapper = stateMachine.exerciseMap.get(exerciseId);
    if (exerciseWrapper === undefined) {
        return {
            statusCode: 404,
            body: {
                message: `Exercise with id '${exerciseId}' was not found`,
            },
        };
    }
    return {
        statusCode: 200,
        body: await exerciseWrapper.getTimeLine(),
    };
}
