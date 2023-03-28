import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';
import type { ExerciseRadiogram } from 'digital-fuesim-manv-shared';

const map: { [Key in ExerciseRadiogram['type']]: string } = {
    materialCountRadiogram: 'Anzahl an Material',
    patientCountRadiogram: 'Anzahl an Patienten',
    personnelCountRadiogram: 'Anzahl an Personal',
    treatmentStatusRadiogram: 'Behandlungsstatus',
    vehicleCountRadiogram: 'Anzahl an Fahrzeugen',
};

@Pipe({
    name: 'humanReadableRadiogramType',
})
export class HumanReadableRadiogramTypePipe implements PipeTransform {
    transform(value: ExerciseRadiogram['type']): string {
        return map[value];
    }
}