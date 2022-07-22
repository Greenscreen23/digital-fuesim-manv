import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Store } from '@ngrx/store';
import type { UUID } from 'digital-fuesim-manv-shared';
import { Hospital } from 'digital-fuesim-manv-shared';
import { debounce } from 'lodash';
import { ApiService } from 'src/app/core/api.service';
import { debounceTimeout } from 'src/app/shared/variables/debounce-timeout';
import type { AppState } from 'src/app/state/app.state';
import { selectHospitals } from 'src/app/state/exercise/exercise.selectors';

@Component({
    selector: 'app-hospital-editor-modal',
    templateUrl: './hospital-editor-modal.component.html',
    styleUrls: ['./hospital-editor-modal.component.scss'],
})
export class HospitalEditorModalComponent {
    public hospitals$ = this.store.select(selectHospitals);

    constructor(
        private readonly store: Store<AppState>,
        public readonly activeModal: NgbActiveModal,
        private readonly apiService: ApiService
    ) {}

    public addHospital() {
        this.apiService.proposeAction({
            type: '[Hospital] Add hospital',
            hospital: Hospital.create('Krankenhaus-???', 60 * 60 * 1000),
        });
    }

    public readonly editTransportDurationToHospital = debounce(
        (hospitalId: UUID, transportDuration: number) => {
            this.apiService.proposeAction({
                type: '[Hospital] Edit transportDuration to hospital',
                hospitalId,
                transportDuration,
            });
        },
        debounceTimeout
    );

    public readonly renameHospital = debounce(
        (hospitalId: UUID, name: string) => {
            this.apiService.proposeAction({
                type: '[Hospital] Rename hospital',
                hospitalId,
                name,
            });
        },
        debounceTimeout
    );

    public removeHospital(hospitalId: UUID) {
        this.apiService.proposeAction({
            type: '[Hospital] Remove hospital',
            hospitalId,
        });
    }

    public close() {
        this.activeModal.close();
    }
}
