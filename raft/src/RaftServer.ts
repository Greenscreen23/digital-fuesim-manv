import { Socket, io } from 'socket.io-client';
import raft from 'node-zmq-raft';

export class RaftServer extends raft.api.StateMachineBase {
    private readonly socket: Socket<{
        applyEntries: (
            entries: Buffer[],
            nextIndex: number,
            currentTerm: number,
            snapshot: raft.common.SnapshotFile | undefined
        ) => void;
        // tick: (tickInterval: number, leaderId: string) => void;
    }>;

    // public tick(tickInterval: number, leaderId: string) {
    //     this.socket.emit('tick', tickInterval, leaderId);
    // }

    constructor(dfmUrl: string) {
        super();
        this.socket = io(dfmUrl, { transports: ['websocket'] });

        (this as any)[Symbol.for('setReady')]();
    }

    override close() {
        const ret = super.close();
        this.socket.close();
        return ret;
    }

    override async applyEntries(
        entries: Buffer[],
        nextIndex: number,
        currentTerm: number,
        snapshot?: raft.common.SnapshotFile
    ) {
        const ret = super.applyEntries(
            entries,
            nextIndex,
            currentTerm,
            snapshot
        );
        await this.socket.emit(
            'applyEntries',
            entries,
            nextIndex,
            currentTerm,
            snapshot
        );
        return ret;
    }
}
