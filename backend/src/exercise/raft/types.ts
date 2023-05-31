import type { ExerciseAction, StateExport } from 'digital-fuesim-manv-shared';

export interface RaftAction {
    type: `${string}RaftAction`;
}

export interface ProposeExerciseActionRaftAction extends RaftAction {
    type: 'proposeExerciseActionRaftAction';
    exerciseId: string;
    clientId: string | null;
    action: ExerciseAction;
}

export interface AddExerciseRaftAction extends RaftAction {
    type: 'addExerciseRaftAction';
    trainerId: string;
    participantId: string;
    importObject: StateExport;
}

export interface RemoveExerciseRaftAction extends RaftAction {
    type: 'removeExerciseRaftAction';
    exerciseId: string;
}

export type ExerciseRaftAction =
    | AddExerciseRaftAction
    | ProposeExerciseActionRaftAction
    | RemoveExerciseRaftAction;
