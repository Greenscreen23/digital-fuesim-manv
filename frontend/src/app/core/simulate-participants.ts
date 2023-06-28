import type { Store } from '@ngrx/store';
import type {
    ExerciseAction,
    Position,
    UUID,
    Vehicle,
    Viewport,
} from 'digital-fuesim-manv-shared';
import {
    defaultPatientCategories,
    createVehicleParameters,
    defaultVehicleTemplates,
    PatientTemplate,
    isInSpecificVehicle,
    MapCoordinates,
    currentCoordinatesOf,
    MapPosition,
    uuid,
} from 'digital-fuesim-manv-shared';
import { Subject, takeUntil } from 'rxjs';
import { AppState } from '../state/app.state';
import {
    selectConfiguration,
    selectExerciseStatus,
    selectMaterialTemplates,
    selectMaterials,
    selectPersonnel,
    selectPersonnelTemplates,
} from '../state/application/selectors/exercise.selectors';
import { selectStateSnapshot } from '../state/get-state-snapshot';
import {
    selectRestrictedViewport,
    selectVisibleMaterials,
    selectVisiblePatients,
    selectVisiblePersonnel,
    selectVisibleVehicles,
} from '../state/application/selectors/shared.selectors';

/**
 * Simulates a participant in the viewport the client is currently restricted to
 */
export class SimulatedParticipant {
    private readonly destroy$ = new Subject<void>();

    constructor(
        private readonly store: Store<AppState>,
        private readonly proposeAction: (
            action: ExerciseAction,
            optimistic?: boolean
        ) => Promise<unknown>
    ) {}

    private tickInterval?: any;
    private readonly amountInViewport = {
        vehicles: selectStateSnapshot(selectConfiguration, this.store)
            .numberOfVehicles,
        unloadedVehicles: selectStateSnapshot(selectConfiguration, this.store)
            .numberOfVehicles,
        patients: selectStateSnapshot(selectConfiguration, this.store)
            .numberOfPatients,
    };

    // in ms
    private readonly simulationTime =
        selectStateSnapshot(selectConfiguration, this.store).testDuration *
        1000;

    public async prepareSimulation() {
        console.log(`${Date()}: simulation gets prepared`);
        // make sure there are at least x vehicles in the viewport
        for (
            let i = Object.keys(this.getVisibleVehicles()).length;
            i < this.amountInViewport.vehicles;
            i++
        ) {
            // eslint-disable-next-line no-await-in-loop
            await this.createVehicle();
        }
        console.log(`${Date()}: all vehicles created`);
        // Unload x vehicles in the viewport
        const vehiclesInViewport = Object.values(this.getVisibleVehicles());
        const numberOfUnloadedVehicles = vehiclesInViewport.filter((_vehicle) =>
            this.vehicleIsUnloaded(_vehicle)
        ).length;
        const unloadableVehicles = vehiclesInViewport
            .filter((_vehicle) => !this.vehicleIsUnloaded(_vehicle))
            .slice(
                0,
                this.amountInViewport.unloadedVehicles -
                    numberOfUnloadedVehicles
            );
        for (const vehicle of unloadableVehicles) {
            // eslint-disable-next-line no-await-in-loop
            await this.proposeAction({
                type: '[Vehicle] Unload vehicle',
                vehicleId: vehicle.id,
            });
        }
        console.log(`${Date()}: all vehicles unloaded`);
        // make sure there are at least x patients in the viewport
        for (
            let i = Object.keys(this.getVisiblePatients()).length;
            i < this.amountInViewport.patients;
            i++
        ) {
            // eslint-disable-next-line no-await-in-loop
            await this.createPatient();
        }
        console.log(`${Date()}: all Patients created`);

        for (const personnelInViewport of Object.values(
            this.getVisiblePersonnel()
        )) {
            // eslint-disable-next-line no-await-in-loop
            await this.proposeAction({
                type: '[Personnel] Move personnel',
                personnelId: personnelInViewport.id,
                // TODO: maybe near a patient?
                targetPosition: this.getRandomPosition(),
            });
        }
        console.log(`${Date()}: all Personnel moved once`);

        for (const materialInViewport of Object.values(
            this.getVisibleMaterials()
        )) {
            // eslint-disable-next-line no-await-in-loop
            await this.proposeAction({
                type: '[Material] Move material',
                materialId: materialInViewport.id,
                // TODO: maybe near a patient?
                targetPosition: this.getRandomPosition(),
            });
        }
        console.log(`${Date()}: all Material moved once`);

        for (const patientsInViewport of Object.values(
            this.getVisiblePatients()
        )) {
            // eslint-disable-next-line no-await-in-loop
            await this.proposeAction({
                type: '[Patient] Move patient',
                patientId: patientsInViewport.id,
                // TODO: maybe near a patient?
                targetPosition: this.getRandomPosition(),
            });
        }
        console.log(`${Date()}: all Patients moved once`);

        console.log(
            `${Date()}: letting exercise simulation run for ${
                this.simulationTime / 60 / 1000
            } minutes`
        );

        // starting exercise (and with it, the tick)
        if (selectStateSnapshot(selectExerciseStatus, this.store) !== 'running')
            await this.proposeAction({
                type: '[Exercise] Start',
            });

        // every second: check whether you should move a random vehicle, personnel, patient or material
        this.tickInterval = setInterval(() => {
            this.tick();
        }, 1000);

        await new Promise((resolve) =>
            setTimeout(resolve, this.simulationTime)
        );

        this.stopSimulation();
        console.log(`${Date()}: simulation stopped`);
        if (
            selectStateSnapshot(selectExerciseStatus, this.store) === 'running'
        ) {
            await this.proposeAction({
                type: '[Exercise] Pause',
            });
            console.log(`${Date()}: and tick paused, too`);
        } else {
            console.log(`${Date()}: tick was already paused`);
        }
    }

    public stopSimulation() {
        clearInterval(this.tickInterval);
    }

    private async createPatient() {
        const category =
            defaultPatientCategories[
                Math.floor(Math.random() * defaultPatientCategories.length)
            ]!;
        const patient = PatientTemplate.generatePatient(
            category.patientTemplates[
                Math.floor(Math.random() * category.patientTemplates.length)
            ]!,
            category.name,
            MapPosition.create(this.getRandomPosition())
        );
        return this.proposeAction(
            {
                type: '[Patient] Add patient',
                patient,
            },
            false
        );
    }

    private async createVehicle() {
        return this.proposeAction(
            {
                type: '[Vehicle] Add vehicle',
                ...createVehicleParameters(
                    uuid(),
                    defaultVehicleTemplates[0]!,
                    selectStateSnapshot(selectMaterialTemplates, this.store),
                    selectStateSnapshot(selectPersonnelTemplates, this.store),
                    this.getRandomPosition()
                ),
            },
            false
        );
    }

    private getCurrentViewport(): Viewport {
        return selectStateSnapshot(selectRestrictedViewport, this.store)!;
    }

    private getRandomPosition(): MapCoordinates {
        const viewport = this.getCurrentViewport();
        return MapCoordinates.create(
            currentCoordinatesOf(viewport).x +
                Math.random() * viewport.size.width,
            currentCoordinatesOf(viewport).y -
                Math.random() * viewport.size.height
        );
    }

    private async tick() {
        const randomNumber = Math.random();
        let previousActionProbability = 0;
        for (const { probability, sendAction } of this.randomActionMap) {
            previousActionProbability += probability;
            if (randomNumber < previousActionProbability) {
                // eslint-disable-next-line no-await-in-loop
                await sendAction();
                break;
            }
        }
    }

    private readonly probabilityMultiplyer = 4;

    private readonly randomActionMap = [
        {
            probability: 0.0735 * this.probabilityMultiplyer,
            sendAction: async () =>
                this.proposeAction({
                    type: '[Personnel] Move personnel',
                    personnelId: this.getRandomElement(
                        Object.keys(this.getVisiblePersonnel())
                    ),
                    // TODO: maybe near a patient?
                    targetPosition: this.getRandomPosition(),
                }),
        },
        {
            probability: 0.053 * this.probabilityMultiplyer,
            sendAction: async () =>
                this.proposeAction({
                    type: '[Material] Move material',
                    materialId: this.getRandomElement(
                        Object.keys(this.getVisibleMaterials())
                    ),
                    // TODO: maybe near a patient?
                    targetPosition: this.getRandomPosition(),
                }),
        },
        {
            probability: 0.022 * this.probabilityMultiplyer,
            sendAction: async () =>
                this.proposeAction({
                    type: '[Patient] Move patient',
                    patientId: this.getRandomElement(
                        Object.keys(this.getVisiblePatients())
                    ),
                    targetPosition: this.getRandomPosition(),
                }),
        },
    ];

    private getRandomElement<T>(elements: T[]): T {
        if (elements.length === 0) {
            throw Error('No elements available');
        }
        return elements[Math.floor(Math.random() * elements.length)]!;
    }

    private getVisibleVehicles() {
        return selectStateSnapshot(selectVisibleVehicles, this.store);
    }

    private getVisiblePatients() {
        return selectStateSnapshot(selectVisiblePatients, this.store);
    }

    private getVisibleMaterials() {
        return selectStateSnapshot(selectVisibleMaterials, this.store);
    }

    private getVisiblePersonnel() {
        return selectStateSnapshot(selectVisiblePersonnel, this.store);
    }

    private vehicleIsUnloaded(vehicle: Vehicle) {
        const material = selectStateSnapshot(selectMaterials, this.store);
        const personnel = selectStateSnapshot(selectPersonnel, this.store);
        return (
            Object.keys(vehicle.materialIds).every(
                (materialId) =>
                    material[materialId] === undefined ||
                    !isInSpecificVehicle(material[materialId]!, vehicle.id)
            ) &&
            Object.keys(vehicle.personnelIds).every(
                (personnelId) =>
                    personnel[personnelId] === undefined ||
                    !isInSpecificVehicle(personnel[personnelId]!, vehicle.id)
            )
        );
    }

    public destroy() {
        this.destroy$.next();
        this.stopSimulation();
    }
}
