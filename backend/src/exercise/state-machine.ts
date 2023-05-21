import { decode } from 'msgpack-lite';
import raft from 'node-zmq-raft'

export class ExerciseStateMachine extends raft.api.StateMachineBase {
    constructor() {
        super();
        (this as any)[Symbol.for('setReady')]();
    }

    override close() {
        return super.close();
    }

    override applyEntries(entries: Buffer[], nextIndex: number, currentTerm: number, snapshot?: any) {
        entries.forEach(entry => {
            if (raft.common.LogEntry.readers.readTypeOf(entry) === raft.common.LogEntry.LOG_ENTRY_TYPE_STATE) {
                console.log(decode(raft.common.LogEntry.readers.readDataOf(entry)))
            } else {
                console.log('Recieved entry that was not a state')
            }
        })
        return super.applyEntries(entries, nextIndex, currentTerm, snapshot);
    }
}
