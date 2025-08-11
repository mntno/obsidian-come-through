import { Platform } from "obsidian";

const isProduction = process.env.NODE_ENV === "production";
const isDev = !isProduction;

const noopLogger = {
	debug: () => { },
	log: () => { },
	info: () => { },
	warn: () => { },
};

const devLogger = isDev ? console : noopLogger;

export const Env = {
	isDev: !isProduction,
	dev: isProduction ? () => { } : (action: () => void) => action(),

	/** Always logs */
	error: console.error,
	assert: console.assert,

	/**
		*
		*/
	log: {
		/** To provide very granular, low-level, and highly detailed information. These logs are often too numerous to be helpful during general development but are invaluable when you're trying to diagnose a specific, complex bug. */
		d: devLogger.debug,

		/**
			* - This is the most general-purpose logging method. It's a good default when a message doesn't neatly fit into the error, warn, or info categories, or when you're just doing quick, ad-hoc debugging.
			* - When you use `console.log()`, you are typically saying: "Just output this general message." It's more of a catch-all, or often used for quick, ad-hoc debugging prints.
			*/
		l: devLogger.log,

		/**
			* - To provide high-level, general information about the application's flow or significant events. These are like "milestones" that give you an overview of what the application is doing.
			* - This is an informational message about a significant event or the general flow of the application. It implies a higher level of importance or a more structured type of message than a generic `log`.
			*/
		i: devLogger.info,

		/** To indicate a potential issue, a suboptimal practice, a deprecated feature being used, or a situation that might lead to an error later but isn't critical right now. It's a "heads up" or a "soft error." */
		w: devLogger.warn,

		/** Debug log for content processors. See {@link ContentRendererProcessor}. */
		proc: false ? devLogger.debug : noopLogger.debug,

		/** Debug log for views. */
		view: false ? devLogger.debug : noopLogger.debug,

	},

	perf: {
		now: (): DOMHighResTimeStamp => performance.now(),
		log: (text: string, timestamp: DOMHighResTimeStamp) => {
			const end = performance.now() - timestamp;
			devLogger.warn(`${text}: ${end} ms`);
		},
	},

	/** @returns `true` if running in the capacitor-js mobile app or if compiled for development with UI in mobile mode. */
	get isMobile() {
		if (Platform.isMobileApp)
			return true;
		if (isDev && Platform.isMobile)
			return true;
		return false;
	},
} as const;
