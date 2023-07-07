import { RaftServer } from './RaftServer';
import fs from 'node:fs';
import raft from 'node-zmq-raft';
import { PeriodicEventHandler } from 'digital-fuesim-manv-shared';

async function main() {
    const raftConfigPath = process.env['RAFT_CONFIG_PATH'];
    if (!raftConfigPath) {
        console.error('RAFT_CONFIG_PATH not set');
        process.exit(1);
    }

    const raftConfig = JSON.parse(fs.readFileSync(raftConfigPath).toString());

    let stateMachine: RaftServer;
    const server = await raft.server.builder.build({
        factory: {
            state: () => {
                stateMachine = new RaftServer(raftConfig.dfmUrl);
                return stateMachine
            },
        },
        ...raftConfig,
    });

    // const tickInterval = 1_000;
    // const tickHandler = new PeriodicEventHandler(async () => {
    //     if (server.isLeader) {
    //         stateMachine.tick(tickInterval, raftConfig.id);
    //     }
    // }, tickInterval);
    // tickHandler.start();
}

main();
