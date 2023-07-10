import cluster from 'node:cluster';
import { OriginService } from './origin.service';
import { Store } from './store.service';
import { ApiService } from './api.service';
import { ExerciseService } from './exercise.service';
import fs from 'node:fs';

async function main() {
    const start = Date.now()
    const workers = Number(process.env['WORKERS']);
    const vehicles = Number(process.env['VEHICLES']);
    const patients = Number(process.env['PATIENTS']);
    const wsOrigin = process.env['WS_ORIGIN']!;
    const httpOrigin = process.env['HTTP_ORIGIN']!;

    let workersReady = 0;

    // Dependency injection, the easy way
    const originService = new OriginService(wsOrigin, httpOrigin);
    const store = new Store(originService);
    const apiService = new ApiService(originService, store);
    const exerciseService = new ExerciseService(
        store,
        originService,
        apiService,
        {
            vehicles: vehicles / workers,
            unloadedVehicles: vehicles / workers,
            patients: patients / workers,
        }
    );

    if (cluster.isPrimary) {
        const ids = await apiService.createExercise();
        console.log('exercise ids:', ids)
        await exerciseService.joinExercise(ids.trainerId, 'trainer');

        cluster.on('exit', (worker, code, signal) => {
            console.log(
                `worker ${worker.process.pid} died`,
                worker,
                code,
                signal
            );
        });

        for (let i = 0; i < workers; i++) {
            await new Promise<void>((resolve) => {
                cluster.fork({ ID: i, EXERCISE_ID: ids.trainerId, START: start }).on('message', (msg) => {
                    if (msg.type === 'ready') {
                        workersReady++;

                        if (workersReady === workers) {
                            console.log('All workers ready, starting exercise');

                            runExercise(exerciseService);
                        }
                    }
                    if (msg.type === 'joined') {
                        resolve()
                    }
                });
            })
        }

        Object.values(cluster.workers ?? {}).forEach((worker) => {
            worker?.send({ type: 'prepare' });
        });

    } else {
        const exerciseId = process.env['EXERCISE_ID']!;
        const outdir = process.env['OUTDIR']!;
        const id = process.env['ID']!;

        await exerciseService.joinExercise(exerciseId, id);

        const data = await exerciseService.benchmark();

        fs.writeFileSync(`${outdir}/${id}.json`, JSON.stringify(data));

        console.log(id, ': Done!')
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
