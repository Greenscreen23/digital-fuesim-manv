import type { Server as HttpServer } from 'node:http';
import cors from 'cors';
import type { Express } from 'express';
import express from 'express';
import type raft from 'node-zmq-raft';
import { Config } from '../config';
import {
    deleteExercise,
    getExercise,
    getExerciseHistory,
    postExercise,
} from './http-handler/api/exercise';
import { getHealth } from './http-handler/api/health';
import { secureHttp } from './http-handler/secure-http';
import type { ExerciseStateMachine } from './state-machine';
import type { Origin } from './http-handler/api/origins';
import { getOrigins } from './http-handler/api/origins';

export class ExerciseHttpServer {
    public readonly httpServer: HttpServer;
    /**
     * @param uploadLimit in Megabyte can be set via ENV DFM_UPLOAD_LIMIT
     */
    constructor(
        app: Express,
        client: raft.client.ZmqRaftClient,
        stateMachine: ExerciseStateMachine,
        origins: Origin[]
    ) {
        // TODO: Temporary allow all
        app.use(cors());

        app.use(express.json({ limit: `${Config.uploadLimit}mb` }));

        // This endpoint is used to determine whether the API itself is running.
        // It should be independent from any other services that may or may not be running.
        // This is used for the Cypress CI.
        app.get('/api/health', async (_req, res) => secureHttp(getHealth, res));
        app.get('/api/origins', async (_req, res) =>
            secureHttp(() => getOrigins(origins), res)
        );
        app.post('/api/exercise', async (req, res) =>
            secureHttp(
                async () => postExercise(req.body, client, stateMachine),
                res
            )
        );
        app.get('/api/exercise/:exerciseId', async (req, res) =>
            secureHttp(
                () => getExercise(req.params.exerciseId, stateMachine),
                res
            )
        );
        app.delete('/api/exercise/:exerciseId', async (req, res) =>
            secureHttp(
                async () =>
                    deleteExercise(req.params.exerciseId, client, stateMachine),
                res
            )
        );
        app.get('/api/exercise/:exerciseId/history', async (req, res) =>
            secureHttp(
                async () =>
                    getExerciseHistory(req.params.exerciseId, stateMachine),
                res
            )
        );

        this.httpServer = app.listen(Config.httpPort);
    }

    public close(): void {
        this.httpServer.close();
    }
}
