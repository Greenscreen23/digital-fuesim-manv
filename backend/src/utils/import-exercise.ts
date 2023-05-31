import { plainToInstance } from 'class-transformer';
import type { ExerciseIds } from 'digital-fuesim-manv-shared';
import {
    migrateStateExport,
    ReducerError,
    StateExport,
    validateExerciseExport,
} from 'digital-fuesim-manv-shared';
import type { DatabaseService } from '../database/services/database-service';
import { ExerciseWrapper } from '../exercise/exercise-wrapper';

export async function importExercise(
    importObject: StateExport,
    ids: ExerciseIds,
    databaseService: DatabaseService
): Promise<ExerciseWrapper | string> {
    const migratedImportObject = migrateStateExport(importObject);
    // console.log(
    //     inspect(importObject.history, { depth: 2, colors: true })
    // );
    const importInstance = plainToInstance(
        StateExport,
        migratedImportObject
        // TODO: verify that this is indeed not required
        // // Workaround for https://github.com/typestack/class-transformer/issues/876
        // { enableImplicitConversion: true }
    );
    // console.log(
    //     inspect(importInstance.history, { depth: 2, colors: true })
    // );
    const validationErrors = validateExerciseExport(importInstance);
    if (validationErrors.length > 0) {
        return `The validation of the import failed: ${validationErrors}`;
    }
    try {
        return await ExerciseWrapper.importFromFile(
            databaseService,
            importInstance,
            {
                participantId: ids.participantId,
                trainerId: ids.trainerId,
            }
        );
    } catch (e: unknown) {
        if (e instanceof ReducerError) {
            return `Error importing exercise: ${e.message}`;
        }
        throw e;
    }
}
