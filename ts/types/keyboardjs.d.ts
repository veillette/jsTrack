declare module 'keyboardjs' {
	interface KeyEvent {
		key: string;
		preventDefault(): void;
		preventRepeat(): void;
	}

	function on(
		keys: string | string[],
		pressHandler: (e: KeyEvent) => void,
		releaseHandler?: (e?: KeyEvent) => void,
	): void;
	function pause(): void;
	function resume(): void;

	export default { on, pause, resume };
}
