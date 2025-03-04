import type { OnInit } from '@angular/core';
import { Component, Input } from '@angular/core';
import { Store } from '@ngrx/store';
import type {
    RecurringEventActivityState,
    ReportableInformation,
    ReportBehaviorState,
} from 'digital-fuesim-manv-shared';
import { reportableInformations, UUID } from 'digital-fuesim-manv-shared';
import type { Observable } from 'rxjs';
import { combineLatest, map } from 'rxjs';
import { ExerciseService } from 'src/app/core/exercise.service';
import type { AppState } from 'src/app/state/app.state';
import {
    createSelectActivityStates,
    createSelectBehaviorState,
    selectCurrentTime,
} from 'src/app/state/application/selectors/exercise.selectors';

@Component({
    selector: 'app-simulated-region-overview-behavior-report',
    templateUrl: './simulated-region-overview-behavior-report.component.html',
    styleUrls: ['./simulated-region-overview-behavior-report.component.scss'],
})
export class SimulatedRegionOverviewBehaviorReportComponent implements OnInit {
    @Input() simulatedRegionId!: UUID;
    @Input() reportBehaviorId!: UUID;

    recurringActivities$!: Observable<{
        [key in ReportableInformation]?: RecurringEventActivityState;
    }>;

    currentTime$!: Observable<number>;

    reportableInformations = reportableInformations;
    reportableInformationTranslationMap: {
        [key in ReportableInformation]: string;
    } = {
        patientCount: 'Anzahl an Patienten',
        vehicleCount: 'Anzahl an Fahrzeugen',
        personnelCount: 'Anzahl an Rettungskräften',
        materialCount: 'Anzahl an Material',
        treatmentStatus: 'Behandlungsstatus',
    };

    createReportCollapsed = true;
    repeatingReport = false;
    selectedInformation: ReportableInformation | 'noSelect' = 'noSelect';

    constructor(
        private readonly exerciseService: ExerciseService,
        private readonly store: Store<AppState>
    ) {}

    ngOnInit(): void {
        const reportBehaviorState$ = this.store.select(
            createSelectBehaviorState<ReportBehaviorState>(
                this.simulatedRegionId,
                this.reportBehaviorId
            )
        );

        const activities$ = this.store.select(
            createSelectActivityStates(this.simulatedRegionId)
        );

        this.recurringActivities$ = combineLatest([
            reportBehaviorState$,
            activities$,
        ]).pipe(
            map(([reportBehaviorState, activities]) =>
                Object.fromEntries(
                    Object.entries(reportBehaviorState.activityIds)
                        .filter(
                            ([_informationType, activityId]) =>
                                activityId && activities[activityId]
                        )
                        .map(([informationType, activityId]) => [
                            informationType,
                            activities[activityId],
                        ])
                )
            )
        );

        this.currentTime$ = this.store.select(selectCurrentTime);
    }

    updateInterval(informationType: ReportableInformation, interval: string) {
        this.exerciseService.proposeAction({
            type: '[ReportBehavior] Update Recurring Report',
            simulatedRegionId: this.simulatedRegionId,
            behaviorId: this.reportBehaviorId,
            informationType,
            interval: Number(interval) * 1000 * 60,
        });
    }

    removeRepeatingReports(informationType: ReportableInformation) {
        this.exerciseService.proposeAction({
            type: '[ReportBehavior] Remove Recurring Report',
            simulatedRegionId: this.simulatedRegionId,
            behaviorId: this.reportBehaviorId,
            informationType,
        });
    }

    createReports(
        informationType: ReportableInformation | 'noSelect',
        interval: string,
        repeating: boolean
    ) {
        if (informationType === 'noSelect') return;

        if (repeating) {
            this.exerciseService.proposeAction({
                type: '[ReportBehavior] Create Recurring Report',
                simulatedRegionId: this.simulatedRegionId,
                behaviorId: this.reportBehaviorId,
                informationType,
                interval: Number(interval) * 1000 * 60,
            });
        } else {
            this.exerciseService.proposeAction({
                type: '[ReportBehavior] Create Report',
                simulatedRegionId: this.simulatedRegionId,
                informationType,
            });
        }

        this.createReportCollapsed = true;
        this.selectedInformation = 'noSelect';
    }
}
