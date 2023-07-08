import cluster from 'node:cluster';
import { OriginService } from './origin.service';
import { Store } from './store.service';
import { ApiService } from 'api.service';
import { ExerciseService } from 'exercise.service';

async function main() {
    const workers = Number(process.env['WORKER']);
    const vehicles = Number(process.env['VEHICLES']);
    const patients = Number(process.env['PATIENTS']);
    const wsOrigin = process.env['WS_ORIGIN']!;
    const httpOrigin = process.env['HTTP_ORIGIN']!;

    let workersReady = 0;

    // Dependency injection, the easy way
    const originService = new OriginService(wsOrigin, httpOrigin);
    const store = new Store();
    const apiService = new ApiService(originService, store);
    const exerciseService = new ExerciseService(
        store,
        originService,
        apiService,
        {
            vehicles,
            unloadedVehicles: vehicles,
            patients,
        }
    );

    if (cluster.isPrimary) {
        const ids = await apiService.createExercise();
        await exerciseService.joinExercise(ids.trainerId, 'trainer');

        for (let i = 0; i < workers; i++) {
            const worker = cluster.fork({ ID: i, EXERCISE_ID: ids.trainerId });
        }

        Object.values(cluster.workers ?? {}).forEach((worker) => {
            worker?.on('message', (msg) => {
                if (msg.type === 'ready') {
                    workersReady++;

                    if (workersReady === workers) {
                        console.log('All workers ready, starting exercise');

                        runExercise(exerciseService);
                    }
                }
            });
        });

        cluster.on('exit', (worker, code, signal) => {
            console.log(
                `worker ${worker.process.pid} died`,
                worker,
                code,
                signal
            );
        });
    } else {
        const exerciseId = process.env['EXERCISE_ID']!;

        await exerciseService.joinExercise(exerciseId, process.env['ID']!);

        await exerciseService.benchmark();
    }
}

async function runExercise(exerciseService: ExerciseService) {
    const duration = Number(process.env['DURATION']);

    exerciseService.proposeAction({
        type: '[Exercise] Start',
    });
    Object.values(cluster.workers ?? {}).forEach((worker) => {
        worker?.send({ type: 'start' });
    });

    await new Promise((resolve) => setTimeout(resolve, duration));

    exerciseService.proposeAction({
        type: '[Exercise] Pause',
    });

    Object.values(cluster.workers ?? {}).forEach((worker) => {
        worker?.send({ type: 'stop' });
    });
}

main();
