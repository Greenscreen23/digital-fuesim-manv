import type { OnInit } from '@angular/core';
import { Component, Input } from '@angular/core';
import { Tags } from 'digital-fuesim-manv-shared';

@Component({
    selector: 'app-patient-status-tags-field',
    templateUrl: './patient-status-tags-field.component.html',
    styleUrls: ['./patient-status-tags-field.component.scss'],
})
export class PatientStatusTagsFieldComponent implements OnInit {
    @Input() patientStatusTagsField!: Tags;
    isPregnant!: boolean;
    ngOnInit(): void {
        this.isPregnant = this.patientStatusTagsField.includes('P');
    }
}
