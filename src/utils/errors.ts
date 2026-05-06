// Available: TypeError

export class TimeoutError extends Error {
	constructor(message: string = 'Operation timed out') {
		super(message);
		this.name = 'TimeoutError';
	}
}

abstract class UnexpectedError extends Error {
	constructor(message?: string) {
		super(message);
		this.name = "UnexpectedError";
	}
}

/**
	* Used to indicate that a value was unexpectedly `undefined`.
	* This is a self-documenting and code clarity measure, especially in places where the `!` non-null assertion operator could otherwise be used.
	*/
export class UnexpectedUndefinedError extends UnexpectedError {
	constructor(message?: string) {
		super(message ?? "Unexpected undefined value");
		this.name = "UnexpectedUndefinedError";
	}
}
