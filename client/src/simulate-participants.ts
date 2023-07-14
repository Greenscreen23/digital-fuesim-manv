import {
    ExerciseAction,
    Position,
    UUID,
    Vehicle,
    Viewport,
    WithPosition,
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
    isOnMap,
} from 'digital-fuesim-manv-shared';
import { Subject } from 'rxjs';
import { Store } from './store.service';
import { pickBy } from 'lodash-es';

/**
 * Simulates a participant in the viewport the client is currently restricted to
 */
export class SimulatedParticipant {
    private readonly destroy$ = new Subject<void>();

    constructor(
        private readonly store: Store,
        private readonly proposeAction: (
            action: ExerciseAction,
            optimistic?: boolean
        ) => Promise<unknown>,
        private readonly amountInViewport: {
            vehicles: number;
            unloadedVehicles: number;
            patients: number;
        }
    ) {}

    private tickInterval?: any;

    public async prepareSimulation() {
        const id = Number(process.env['ID']);

        const y = 6871497.363370008;
        const xBase = 1461493.8377002398;
        const xDiff = Math.abs(1461493.8377002398 - 1461712.8590994477);

        const viewPortId = uuid();
        await this.proposeAction(
            {
                type: '[Viewport] Add viewport',
                viewport: {
                    id: viewPortId,
                    type: 'viewport',
                    position: MapPosition.create(
                        MapCoordinates.create(xBase + xDiff * id, y)
                    ),
                    size: {
                        height: 76.59574468085107,
                        width: 136.17021276595744,
                    },
                    name: `Viewport ${id}`,
                },
            },
            false
        );
        await this.proposeAction(
            {
                type: '[Client] Restrict to viewport',
                clientId: this.store.ownClientId,
                viewportId: viewPortId,
            },
            false
        );

        const prepPromise = new Promise<void>((resolve) => {
            process.on('message', (msg: any) => {
                if (msg.type === 'prepare') {
                    resolve();
                }
            });
        });

        process.send!({ type: 'joined' });

        await prepPromise;

        console.log(`${id}: simulation gets prepared`);
        // make sure there are at least x vehicles in the viewport
        for (
            let i = Object.keys(this.getVisibleVehicles()).length;
            i < this.amountInViewport.vehicles;
            i++
        ) {
            // eslint-disable-next-line no-await-in-loop
            await this.createVehicle();
        }
        console.log(`${id}: all vehicles created`);
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
            await this.proposeAction(
                {
                    type: '[Vehicle] Unload vehicle',
                    vehicleId: vehicle.id,
                },
                false
            );
        }
        console.log(`${id}: all vehicles unloaded`);
        // make sure there are at least x patients in the viewport
        for (
            let i = Object.keys(this.getVisiblePatients()).length;
            i < this.amountInViewport.patients;
            i++
        ) {
            // eslint-disable-next-line no-await-in-loop
            await this.createPatient();
        }
        console.log(`${id}: all Patients created`);

        for (const personnelInViewport of Object.values(
            this.getVisiblePersonnel()
        )) {
            // eslint-disable-next-line no-await-in-loop
            await this.proposeAction({
                type: '[Personnel] Move personnel',
                personnelId: personnelInViewport.id,
                // TODO: maybe near a patient?
                targetPosition: this.getRandomPosition(),
            }, true);
        }
        console.log(`${id}: all Personnel moved once`);

        for (const materialInViewport of Object.values(
            this.getVisibleMaterials()
        )) {
            // eslint-disable-next-line no-await-in-loop
            await this.proposeAction({
                type: '[Material] Move material',
                materialId: materialInViewport.id,
                // TODO: maybe near a patient?
                targetPosition: this.getRandomPosition(),
            }, true);
        }
        console.log(`${id}: all Material moved once`);

        for (const patientsInViewport of Object.values(
            this.getVisiblePatients()
        )) {
            // eslint-disable-next-line no-await-in-loop
            await this.proposeAction({
                type: '[Patient] Move patient',
                patientId: patientsInViewport.id,
                // TODO: maybe near a patient?
                targetPosition: this.getRandomPosition(),
            }, true);
        }
        console.log(`${id}: all Patients moved once`);

        const startProm = new Promise<void>((resolve) =>
            process.on('message', (msg: any) => {
                if (msg.type === 'start') {
                    resolve();
                }
            })
        );

        process.send!({ type: 'ready' });

        await startProm;

        this.tickInterval = setTimeout(() => {
            this.tick();
        }, 1000);

        await new Promise<void>((resolve) => {
            process.on('message', (msg: any) => {
                if (msg.type === 'stop') {
                    resolve();
                }
            });
        });
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
        return this.proposeAction({
            type: '[Patient] Add patient',
            patient,
        }, false);
    }

    private async createVehicle() {
        return this.proposeAction(
            {
                type: '[Vehicle] Add vehicle',
                ...createVehicleParameters(
                    uuid(),
                    defaultVehicleTemplates[0]!,
                    this.store.state.materialTemplates,
                    this.store.state.personnelTemplates,
                    this.getRandomPosition()
                ),
            },
            false
        );
    }

    private getCurrentViewport(): Viewport {
        const ownClientId = this.store.ownClientId;
        const ownClient = this.store.state.clients[ownClientId]!;
        const ownViewport =
            this.store.state.viewports[ownClient.viewRestrictedToViewportId!]!;
        return ownViewport;
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
        this.tickInterval = setTimeout(() => {
            this.tick();
        }, 1000);
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
                }, true),
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
                }, true),
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
                }, true),
        },
    ];

    private getRandomElement<T>(elements: T[]): T {
        if (elements.length === 0) {
            throw Error('No elements available');
        }
        return elements[Math.floor(Math.random() * elements.length)]!;
    }

    private visible<T extends WithPosition>(elements: {
        [key: UUID]: T;
    }): { [key: UUID]: T } {
        const viewport = this.getCurrentViewport();
        return pickBy(
            elements,
            (element) =>
                // Is placed on the map
                isOnMap(element) &&
                // No viewport restriction
                Viewport.isInViewport(viewport, currentCoordinatesOf(element))
        );
    }

    private getVisibleVehicles() {
        return this.visible(this.store.state.vehicles);
    }

    private getVisiblePatients() {
        return this.visible(this.store.state.patients);
    }

    private getVisibleMaterials() {
        return this.visible(this.store.state.materials);
    }

    private getVisiblePersonnel() {
        return this.visible(this.store.state.personnel);
    }

    private vehicleIsUnloaded(vehicle: Vehicle) {
        const material = this.store.state.materials;
        const personnel = this.store.state.personnel;
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
