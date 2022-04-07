import type { OnInit } from '@angular/core';
import { EventEmitter, Output, Component } from '@angular/core';
import { Store } from '@ngrx/store';
import type { Immutable, Patient, UUID } from 'digital-fuesim-manv-shared';
import { healthPointsDefaults } from 'digital-fuesim-manv-shared';
import type { Observable } from 'rxjs';
import { ApiService } from 'src/app/core/api.service';
import type { AppState } from 'src/app/state/app.state';
import {
    getSelectClient,
    getSelectPatient,
} from 'src/app/state/exercise/exercise.selectors';
import type { PopupComponent } from '../../utility/popup-manager';

@Component({
    selector: 'app-patient-popup',
    templateUrl: './patient-popup.component.html',
    styleUrls: ['./patient-popup.component.scss'],
})
export class PatientPopupComponent implements PopupComponent, OnInit {
    // These properties are only set after OnInit
    public patientId!: UUID;

    @Output() readonly closePopup = new EventEmitter<void>();

    public patient$?: Observable<Immutable<Patient>>;
    public client$ = this.store.select(
        getSelectClient(this.apiService.ownClientId!)
    );

    public currentYear = new Date().getFullYear();

    // To use it in the template
    public readonly healthPointsDefaults = healthPointsDefaults;

    constructor(
        private readonly store: Store<AppState>,
        private readonly apiService: ApiService
    ) {}

    ngOnInit(): void {
        this.patient$ = this.store.select(getSelectPatient(this.patientId));
    }
}