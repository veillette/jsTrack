declare module 'undo-manager' {
	interface UndoCommand {
		undo: () => void;
		redo: () => void;
		groupId?: string;
	}

	interface UndoManagerInstance {
		add(command: UndoCommand): UndoManagerInstance;
		setCallback(callback: () => void): void;
		undo(): UndoManagerInstance;
		redo(): UndoManagerInstance;
		clear(): void;
		hasUndo(): boolean;
		hasRedo(): boolean;
		getCommands(groupId?: string): UndoCommand[];
		getIndex(): number;
		setLimit(max: number): void;
	}

	interface UndoManagerConstructor {
		new (): UndoManagerInstance;
		(): UndoManagerInstance;
	}

	const UndoManager: UndoManagerConstructor;
	export default UndoManager;
}
