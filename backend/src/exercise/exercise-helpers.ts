import type { StateExport } from 'digital-fuesim-manv-shared';
import { ExerciseState } from 'digital-fuesim-manv-shared';
import { isEmpty } from 'lodash-es';
import type { DatabaseService } from '../database/services/database-service';
import { importExercise } from '../utils/import-exercise';
import { ExerciseWrapper } from './exercise-wrapper';

export async function createExercise(
    databaseService: DatabaseService,
    importObject: StateExport,
    participantId: string,
    trainerId: string
): Promise<ExerciseWrapper> {
    return new Promise((resolve, reject) => {
        try {
            const exercise = isEmpty(importObject)
                ? ExerciseWrapper.create(
                      participantId,
                      trainerId,
                      databaseService,
                      ExerciseState.create(participantId)
                  )
                : importExercise(
                      importObject,
                      { participantId, trainerId },
                      databaseService
                  );
            resolve(exercise);
        } catch (e: unknown) {
            reject(e);
        }
    });
}
