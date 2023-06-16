import type {
    ExerciseIds,
    ExerciseTimeline,
    StateExport,
} from 'digital-fuesim-manv-shared';
import { createExercise } from '../../../exercise/exercise-helpers';
import type { DatabaseService } from '../../../database/services/database-service';
import { UserReadableIdGenerator } from '../../../utils/user-readable-id-generator';
import { exerciseMap } from '../../exercise-map';
import type { HttpResponse } from '../utils';
import { MongoService } from '../../../database/mongo-service';

export async function postExercise(
    databaseService: DatabaseService,
    importObject: StateExport,
    mongoService: MongoService
): Promise<HttpResponse<ExerciseIds>> {
    try {
        const participantId = UserReadableIdGenerator.generateId();
        const trainerId = UserReadableIdGenerator.generateId(8);
        await mongoService.createExercise(trainerId, participantId, importObject);
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
                message: error,
            },
        };
    }
}

export function getExercise(exerciseId: string): HttpResponse {
    const exerciseExists = exerciseMap.has(exerciseId);
    return {
        statusCode: exerciseExists ? 200 : 404,
        body: undefined,
    };
}

export async function deleteExercise(
    exerciseId: string,
    mongoService: MongoService
): Promise<HttpResponse> {
    const exerciseWrapper = exerciseMap.get(exerciseId);
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
    await mongoService.deleteExercise(exerciseId);
    return {
        statusCode: 204,
        body: undefined,
    };
}

export async function getExerciseHistory(
    exerciseId: string
): Promise<HttpResponse<ExerciseTimeline>> {
    const exerciseWrapper = exerciseMap.get(exerciseId);
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
