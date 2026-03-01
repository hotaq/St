import type { AdoptionErrorEnvelope } from "./types.ts";

export function createAdoptionError(
	errorCode: string,
	message: string,
	hint: string,
	contextRef?: string,
): AdoptionErrorEnvelope {
	if (errorCode.trim().length === 0) {
		throw new Error("errorCode is required");
	}

	if (message.trim().length === 0) {
		throw new Error("message is required");
	}

	if (hint.trim().length === 0) {
		throw new Error("hint is required");
	}

	return {
		errorCode,
		message,
		hint,
		contextRef,
	};
}
