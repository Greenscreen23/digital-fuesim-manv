import { ExerciseIds } from 'digital-fuesim-manv-shared';
import { Store } from './store.service';
import { Origin, OriginService } from './origin.service';

export class ApiService {
    constructor(
        private readonly originService: OriginService,
        private readonly store: Store
    ) {
        this.getOrigins().then(
            ({ origins }) => (this.originService.origins = origins)
        );
    }

    public async checkHealth() {
        return this.api<null>(`${this.originService.httpOrigin}/api/health`)
            .then(() => true)
            .catch(() => false);
    }

    public async getOrigins() {
        return this.api<{ origins: Origin[] }>(
            `${this.originService.httpOrigin}/api/origins`
        );
    }

    public async createExercise() {
        return this.api<ExerciseIds>(
            `${this.originService.httpOrigin}/api/exercise`,
            'POST',
            {}
        );
    }

    /**
     * @param exerciseId the trainerId or participantId of the exercise
     * @returns wether the exercise exists
     */
    public async exerciseExists(exerciseId: string) {
        return this.api<null>(
            `${this.originService.httpOrigin}/api/exercise/${exerciseId}`
        )
            .then(() => true)
            .catch((error) => {
                if (error.status !== 404) {
                    console.error(error);
                }
                return false;
            });
    }

    private api<T>(
        url: string,
        method: 'GET' | 'POST' | 'DELETE' = 'GET',
        body?: any
    ): Promise<T> {
        return fetch(url, { method, body }).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            return response.json() as Promise<T>;
        });
    }
}
