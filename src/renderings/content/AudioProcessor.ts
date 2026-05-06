import { Win } from "#/utils/dom/dom";
import { Env } from "env";
import { Component } from "obsidian";
import { parseStrictFloat } from "TypeAssistant";
import { HtmlAttribute } from "utils/dom/constants";
import { ContentRendererPostProcessor, ContentRendererProcessor, PostProcessorParameter } from "./ContentRendererProcessor";

type AudioPlayerInfo = {
	readonly source: string;

	/** `preload` attribute is explicitly set to `"none"` or `"metadata"`. */
	readonly isPreloadDisabled: boolean;

	/** Time in seconds when playback should begin. */
	readonly startTime: number;
	/** Time in seconds when playback should end. If `null`, playback should continue until the end. */
	readonly endTime: number | null;

	/** See {@link HtmlAttribute.MediaElement.Plugin.Data.SeekOnPause} */
	readonly seekOnPause: "init" | "current";
	/** `true` it the `loop` attribute is present. */
	readonly isLooping: boolean;
	/** Milliseconds. Greater than zero.  */
	readonly loopDelay: number | null;

	readonly mobile: {
		/** Seconds. See {@link HtmlAttribute.MediaElement.Plugin.Data.START_OFFSET_MOBILE} */
		readonly startOffset: number | null,
		/** Seconds. See {@link HtmlAttribute.MediaElement.Plugin.Data.END_OFFSET_MOBILE} */
		readonly endOffset: number | null,
	}
}

export class AudioProcessor extends ContentRendererProcessor implements ContentRendererPostProcessor {

	public override onunload(): void {
		Env.log.proc(`AudioProcessor:onunload: audio elements: ${this.registeredAudioItems.length}`);
		super.onunload();

		this.registeredAudioItems = [];
		this.currentlyPlaying = null
	}

	public handleHtml(param: PostProcessorParameter): void {

		param.el.querySelectorAll('audio').forEach(audioEl => {
			AudioProcessor.setDefaults(audioEl);

			const info = AudioProcessor.getPlayerInfo(param, audioEl);
			if (!info) {
				Env.log.w(`No source set on audio element: ${audioEl.outerHTML}`);
				return;
			}

			Env.log.proc(info);

			const controller = this.addChild(new TimeLoopController(info, param));
			this.registeredAudioItems.push({ el: audioEl, controller: controller });
			controller.init(audioEl);

			if (param.config.media.preventMultiplePlayback)
				this.preventMultiplePlayback(audioEl);
		});
	}

	private preventMultiplePlayback(audioEl: HTMLAudioElement) {

		this.registerDomEvent(audioEl, "play", (el) => {
			const audioElThatStartedPlaying = el.target as HTMLAudioElement;

			if (this.currentlyPlaying && this.currentlyPlaying.el !== audioElThatStartedPlaying) {
				this.currentlyPlaying.controller.cancelLoopTimeout();
				this.currentlyPlaying.el.pause();
			}

			const match = this.registeredAudioItems.find(p => p.el === audioElThatStartedPlaying) ?? null;
			Env.assert(match !== null, "Expected to find the element.")
			this.currentlyPlaying = match;
		});

		this.registerDomEvent(audioEl, "pause", (el) => {
			const audioElThatPaused = el.target as HTMLAudioElement;

			if (this.currentlyPlaying?.el === audioElThatPaused && !this.currentlyPlaying.controller.isPendingLoop)
				this.currentlyPlaying = null;
		});
	}

	private registeredAudioItems: { el: HTMLAudioElement, controller: TimeLoopController }[] = [];
	/**
		* - Note: If paused because of {@link HtmlAttribute.MediaElement.Plugin.Data.LoopDelay} it is still considered playing.
		*/
	private currentlyPlaying: { el: HTMLAudioElement, controller: TimeLoopController } | null = null;

	/**
		* @returns `null` if no source was set.
		*/
	private static getPlayerInfo(_param: PostProcessorParameter, el: HTMLAudioElement): AudioPlayerInfo | null {
		Env.log.proc(`getPlayerInfo`);

		const getSource = () => {
			let src = el.getAttribute('src');
			if (!src) {
				const sourceEl = el.querySelector('source');
				if (sourceEl)
					src = sourceEl.getAttribute('src');
			}
			return src;
		}

		const getSeekOnPauseAttribute = () => {
			switch (el.getAttribute(HtmlAttribute.MediaElement.Plugin.Data.SeekOnPause.NAME)) {
				case HtmlAttribute.MediaElement.Plugin.Data.SeekOnPause.Values.CURRENT:
					return "current";

				case HtmlAttribute.MediaElement.Plugin.Data.SeekOnPause.Values.INITIAL:
				case null:
					return "init";
			}
		};

		const getLoopDelay = () => {
			const delay = parseStrictFloat(el.getAttribute(HtmlAttribute.MediaElement.Plugin.Data.LoopDelay.NAME));
			if (delay === null)
				return null;

			// Make sure loop delay is positive and convert to milliseconds.
			return delay <= 0 ? null : delay * 1000.00;
		};

		const getCustomStartAndEndTimes = (source: string, mobileStartOffset: number | null, mobileEndOffset: number | null) => {
			const times = AudioProcessor.parseStartAndEndTimes(source);
			if (times === null || times.start === undefined)
				return null;

			const urlStartTime = AudioProcessor.timeToSeconds(times.start);
			const urlEndTime = times.end ? AudioProcessor.timeToSeconds(times.end) : null;

			const effectiveTimes = {
				start: mobileStartOffset && Env.isMobile ? urlStartTime + mobileStartOffset : urlStartTime,
				end: urlEndTime && mobileEndOffset && Env.isMobile ? urlEndTime + mobileEndOffset : urlEndTime,
			}

			if (Env.isMobile && (mobileStartOffset || mobileEndOffset)) {
				Env.log.proc(`\tAdjusting start time (${urlStartTime}) to ${effectiveTimes.start}, end time: (${urlEndTime}) to ${effectiveTimes.end}`);
			}

			return effectiveTimes;
		}

		const source = getSource();
		if (source === null)
			return null;

		const mobleStartOffset = parseStrictFloat(el.getAttribute(HtmlAttribute.MediaElement.Plugin.Data.START_OFFSET_MOBILE));
		const mobileEndOffset = parseStrictFloat(el.getAttribute(HtmlAttribute.MediaElement.Plugin.Data.END_OFFSET_MOBILE));
		const startEnd = getCustomStartAndEndTimes(source, mobleStartOffset, mobileEndOffset);

		return {
			source: source,
			isPreloadDisabled: el.preload == "none" || el.preload == "metadata",
			startTime: startEnd ? startEnd.start : 0,
			endTime: startEnd ? startEnd.end : null,
			seekOnPause: getSeekOnPauseAttribute(),
			isLooping: el.hasAttribute(HtmlAttribute.MediaElement.Loop.NAME),
			loopDelay: getLoopDelay(),
			mobile: {
				startOffset: mobleStartOffset,
				endOffset: mobileEndOffset,
			},
		} as AudioPlayerInfo;
	}

	/**
		* Parses out the start and end times as strings. Supports optional milliseconds and optional end time.
		* @param src For example, "https://domain.net/abc.mp3#t=00:20:41.400,00:20:48".
		* @returns
		*/
	private static parseStartAndEndTimes(src: string): { start: string | undefined; end: string | undefined } | null {

		// - `\.` matches the literal dot.
		// - `(\d{3})` captures exactly three digits (milliseconds).
		// - `(?:...)` makes the group non-capturing (we only want the digits, not the dot itself).
		// - `?` makes the entire milliseconds part optional.

		const regex = /#t=((\d{2}:\d{2}:\d{2}(?:\.(\d{1,3}))?)(?:,(\d{2}:\d{2}:\d{2}(?:\.(\d{1,3}))?))?)/;
		const match = src.match(regex);

		if (!match)
			return null;

		// match[1] is the full matched time string (e.g., "00:20:41.400,00:20:48")
		// match[2] is the first full timestamp string (e.g., "00:20:41.400")
		// match[3] is the milliseconds of the first timestamp (e.g., "400")
		// match[4] is the second full timestamp string (e.g., "00:20:48")
		// match[5] is the milliseconds of the second timestamp (e.g., undefined or "000")

		const startTime = match[2]; // This will include HH:MM:SS.mmm if milliseconds exist
		const endTime = match[4];   // This will include HH:MM:SS.mmm if milliseconds exist

		return { start: startTime, end: endTime };
	}

	/**
		* Converts a time string in HH:MM:SS.mmm format to seconds.
		* @param timeString The time string (e.g., "00:01:30", or "00:01:30.432").
		* @returns The time in seconds.
		*/
	private static timeToSeconds(timeString: string): number {
		let totalSeconds = 0;
		let milliseconds = 0;

		// First, check for and extract milliseconds if present
		const msParts = timeString.split(".");
		let baseTimeString = timeString;
		if (msParts.length > 1) {
			baseTimeString = msParts[0] ?? ""; // The part before milliseconds
			// Convert milliseconds string to number, handle cases like ".4" or ".40"
			const msPartValue = msParts[1];
			milliseconds = msPartValue !== undefined ? Number(`0.${msPartValue}`) : 0;
		}

		// Split the remaining time string by ':'
		const parts = baseTimeString.split(":").map(Number);

		// Parse parts from right to left (most common for time formats like HH:MM:SS, MM:SS)
		// index 0: seconds (if only 1 part) or hours (if 3 parts)
		// index 1: minutes (if 2 or 3 parts)
		// index 2: hours (if 3 parts)

		// For media fragments, "10" means 10 seconds.
		// "01:20" means 1 minute 20 seconds.
		// "01:02:20" means 1 hour 2 minutes 20 seconds.

		const firstPart = parts[0];
		const secondPart = parts[1];
		const thirdPart = parts[2];

		if (firstPart !== undefined && secondPart !== undefined && thirdPart !== undefined) {
			// HH:MM:SS
			totalSeconds = firstPart * 3600 + secondPart * 60 + thirdPart;
		} else if (firstPart !== undefined && secondPart !== undefined) {
			// MM:SS
			totalSeconds = firstPart * 60 + secondPart;
		} else if (firstPart !== undefined) {
			// SS (single number implies seconds for media fragments)
			totalSeconds = firstPart;
		}
		// Add the fractional seconds from milliseconds
		totalSeconds += milliseconds;

		const originalMsPart = msParts[1] ?? "";
		Env.log.proc(`\ttimeToSeconds:\n\t\tinput: "${timeString}${originalMsPart ? `.${originalMsPart}` : ""}", output ${totalSeconds}`);

		return totalSeconds;
	}

	/**
		* Allows for audio to be added by merely specifying the `src`: `<audio controls src="https://externalvideo"></video>`.
		*
		* - If you embed a internal audio file like this `![Local Auido](LocalAudio.mp3)` in Obisidan, `controls` and `controlslist="nodownload"` will be added when rendered.
		* - This means that there is no way to include an audio file without controls/a player, which makes sense.
		*/
	private static setDefaults(el: HTMLAudioElement) {
		if (!el.hasAttribute(HtmlAttribute.MediaElement.Controls.NAME))
			el.setAttribute(HtmlAttribute.MediaElement.Controls.NAME, HtmlAttribute.MediaElement.Controls.Values.DISPLAY);

		if (!el.hasAttribute(HtmlAttribute.MediaElement.ControlsList.NAME))
			el.setAttribute(HtmlAttribute.MediaElement.ControlsList.NAME, HtmlAttribute.MediaElement.ControlsList.Values.NODOWNLOAD + " " + HtmlAttribute.MediaElement.ControlsList.Values.NOFULLSCREEN + " " + HtmlAttribute.MediaElement.ControlsList.Values.NOREMOTEPLAYBACK);

		// Load metadata if: `preload="none"` or `preload` was not specified.
		if (el.hasAttribute(HtmlAttribute.MediaElement.Preload.NAME) && el.getAttribute(HtmlAttribute.MediaElement.Preload.NAME) === HtmlAttribute.MediaElement.Preload.Values.NONE || !el.hasAttribute(HtmlAttribute.MediaElement.Preload.NAME)) {
			el.setAttribute(HtmlAttribute.MediaElement.Preload.NAME, HtmlAttribute.MediaElement.Preload.Values.METADATA);
			// Setting the attribute immediately changes the property.
			Env.assert(el.preload === "metadata", `Expected \`preload\` === "metadata"`);
		}
	}
}


class TimeLoopController extends Component {

	public readonly info: AudioPlayerInfo;
	public readonly param: PostProcessorParameter;

	constructor(info: AudioPlayerInfo, param: PostProcessorParameter) {
		super();

		this.info = info;
		this.param = param;
	}

	public override onunload(): void {
		super.onunload();
		this.cancelLoopTimeout();
	}

	public init(audioPlayer: HTMLAudioElement) {

		// For first play only.
		if (this.info.seekOnPause === "current")
			this.state.forceControlPositionBeforeNextPlayback = true;

		this.removeLoopAttribute(audioPlayer);

		// https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadedmetadata_event
		// https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadeddata_event
		// if `preload="none"`, loadedmetadata or loadeddata will not be called until user starts playback.
		// Not called if there is no start and/or end time, regardless of preload value.
		this.registerDomEvent(audioPlayer, "loadedmetadata", ev => this.onLoadedMetadata(ev.target as HTMLAudioElement));

		// If user chooses to play outside of defined time range, stop interfering.
		// This is also called when setting `currentTime` programatically.
		this.registerDomEvent(audioPlayer, "seeking", ev => this.onSeeking(ev.target as HTMLAudioElement));

		// The seeked event is fired when a seek operation completed, the current playback position has changed,
		// and the Boolean `seeking` attribute is changed to false. https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeked_event
		// Listen for seeked event to resume playback or perform iterative correction
		this.registerDomEvent(audioPlayer, "seeked", ev => this.onSeeked(ev.target as HTMLAudioElement));

		this.registerDomEvent(audioPlayer, "play", ev => this.onPlay(ev.target as HTMLAudioElement));
		this.registerDomEvent(audioPlayer, "pause", ev => this.onPause(ev.target as HTMLAudioElement));
		this.registerDomEvent(audioPlayer, "timeupdate", ev => this.onTimeUpdate(ev.target as HTMLAudioElement));

		this.register(() => this.cancelLoopTimeout());
	}

	/**
		* Removes the `loop` attribute inorder to gain full control over the looping.
		* The "timeupdate" might not be called when playback has reached the end, and browser engine will not pause the playback, it just sets the playback position to 0.
		*/
	private removeLoopAttribute(audioPlayer: HTMLAudioElement) {
		if (this.info.isLooping)
			audioPlayer.removeAttribute(HtmlAttribute.MediaElement.Loop.NAME);
	}

	private readonly state = {

		/**
			* If `true`, attempting to start playback when {@link isTimeWithinStartTolerance} returns `false` for the player's current playback position will adjust the player's position.
			*
			* See {@link onPlay}.
			*
			* Is reset to `false` at the end of {@link onPlay}.
			*/
		forceControlPositionBeforeNextPlayback: false,

		/** Flag to indicate if play() should be called after seeked event. */
		playAfterSeek: false,
		/** Flag to indicate if we are in an iterative seek correction process. */
		isCorrectingSeek: false,
		/** Counter for iterative seek attempts. */
		seekAttempts: 0,

		/**
			* `true` if user seeked before start time or after end time, in which case, stop controlling the player.
			* Intended to be used as a flag to give up control over playback if the user seeked out of range.
			*
			* @todo Always `false` as there is no trivial way to know for sure wheather seek was initiated by user. This was set to `true` in {@link onSeeking} if current playback position was out of range, but caused problems on mobile.
			*/
		didSeekOutOfTimeRange: false,

		/** `true` if playback stopped by itself because reached the end time. */
		didReachEnd: false,

		/** The timeout for the {@link AudioPlayerInfo.loopDelay|loop delay}. */
		loopTimeoutID: null as number | null,
	};

	/** Use this instead of assigning `currentTime` directly because {@link state|state variables} need to be set before assignment. */
	private seekTo(player: HTMLAudioElement, time: number, options?: {
		/** Set the state so that playback begins after seek finished. */
		playAfterSeeked?: boolean,
		/** On the next `seeked` event, adjust the `currentTime` if outside tolerance. */
		adjustNextSeek?: boolean,
	}) {
		const {
			adjustNextSeek = true,
			playAfterSeeked = false,
		} = options || {};

		this.state.playAfterSeek = playAfterSeeked;

		if (adjustNextSeek) {
			this.state.isCorrectingSeek = true;
			this.state.seekAttempts = 0;
		}

		player.currentTime = time;
	}

	private isTimeWithinStartTolerance(time: number) {
		return (Math.max(0, time) > this.info.startTime + SEEK_TOLERANCE) || (Math.max(0, time) < Math.max(0, this.info.startTime - SEEK_TOLERANCE))
	}

	public cancelLoopTimeout() {
		if (this.state.loopTimeoutID !== null) {
			Env.log.proc(`\tcancelLoopTimeout: cleared timeout`);
			Win.Timeout.clear(this.param.el, this.state.loopTimeoutID);
			this.state.loopTimeoutID = null;
		}
	}

	/** Currently paused but will begin playing after {@link AudioPlayerInfo.loopDelay}. */
	public get isPendingLoop() {
		return this.state.loopTimeoutID !== null;
	}

	private onLoadedMetadata(player: HTMLAudioElement) {
		// https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/readyState
		Env.log.proc(`\t(event) loadedmetadata:\n\t\treadyState: ${player.readyState} (at least metadata loaded), current time: ${player.currentTime}, desired time: ${this.info.startTime}`)

		if (player.currentTime != this.info.startTime) {
			Env.log.proc(`\t\tSetting current time to ${this.info.startTime}`);
			this.seekTo(player, this.info.startTime);
		}
	}

	/**
		* Ensure playback starts at the given start time.
		*/
	private onPlay(player: HTMLAudioElement) {
		Env.log.proc(`\t(event) play: current time: ${player.currentTime}\n\t\tdesired time: ${this.info.startTime}, didSeekOutOfTimeRange: ${this.state.didSeekOutOfTimeRange}`)

		this.cancelLoopTimeout();

		if (this.state.didSeekOutOfTimeRange)
			return;

		if (this.state.forceControlPositionBeforeNextPlayback || this.info.seekOnPause === "init") {
			if (this.isTimeWithinStartTolerance(player.currentTime)) {
				Env.log.proc(`\t\tAdjusting seek because the player's current time beyond the tolerance margin.`);
				this.seekTo(player, this.info.startTime, { playAfterSeeked: true });
			}
		}
		this.state.forceControlPositionBeforeNextPlayback = false;
	}

	private onPause(player: HTMLAudioElement) {
		Env.log.proc(`\t(event) pause: current time: ${player.currentTime}\n\t\tdesired time: ${this.info.startTime}, didSeekOutOfTimeRange: ${this.state.didSeekOutOfTimeRange}, didReachEnd: ${this.state.didReachEnd}`);

		const didReachEnd = this.state.didReachEnd;
		this.state.didReachEnd = false;
		this.cancelLoopTimeout();

		if (this.state.didSeekOutOfTimeRange)
			return;

		if (didReachEnd && this.info.isLooping) {
			if (this.info.loopDelay) {
				Env.log.proc(`\t\tSetting playback position to ${this.info.startTime}. Will request playback in ${this.info.loopDelay}s`);
				this.seekTo(player, this.info.startTime);

				this.state.loopTimeoutID = Win.Timeout.set(this.param.el, this.info.loopDelay, () => {
					this.cancelLoopTimeout();
					player.play().catch(Env.catch);
				});
			}
			else {
				Env.log.proc(`\t\tSetting playback position to ${this.info.startTime} and requesting playback.`);
				this.seekTo(player, this.info.startTime, { playAfterSeeked: true });
			}
		}
		else {
			switch (this.info.seekOnPause) {
				case "init":
					Env.log.proc(`\t\tSetting playback position to ${this.info.startTime}.`);
					this.seekTo(player, this.info.startTime);
					break;
				case "current":
					Env.log.proc(`\t\tRetaining playback position`);
			}
		}
	}

	/**
		* Called whenever player is moving to a new playback position.
		* - This includes initial start time.
		*/
	private onSeeking(player: HTMLAudioElement) {
		//const isCurrentTimeWithinRange = player.currentTime >= this.info.startTime && (this.info.endTime === null || player.currentTime <= this.info.endTime);
		//this.state.didSeekOutOfTimeRange = !isCurrentTimeWithinRange;
		Env.log.proc(`\t(event) seeking: ${player.seeking}, currentTime: ${player.currentTime}\n\t\tdidSeekOutOfTimeRange: ${this.state.didSeekOutOfTimeRange}`);
	}

	private onSeeked(player: HTMLAudioElement) {
		Env.log.proc(`\t(event) seeked: readyState: ${player.readyState}\n\t\tcurrent time: ${player.currentTime}, desired time: ${this.info.startTime}, didSeekOutOfTimeRange: ${this.state.didSeekOutOfTimeRange}\n\t\tplayAfterSeek: ${this.state.playAfterSeek}, isCorrectingSeek: ${this.state.isCorrectingSeek}/${this.state.seekAttempts}`);

		if (this.state.didSeekOutOfTimeRange)
			return;

		const requestBeginPlayback = () => {
			if (this.state.playAfterSeek && player.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
				this.state.playAfterSeek = false;
				Env.log.proc(`\t\tStarting playback. readyState is >= ${HTMLMediaElement.HAVE_CURRENT_DATA}`);
				player.play().catch(Env.catch);
			}
			else {
				Env.log.proc(`\t\tDid not start playback (playAfterSeek: ${this.state.playAfterSeek}, readyState: ${player.readyState}).`);
			}
		};

		if (this.state.isCorrectingSeek && this.state.seekAttempts < MAX_SEEK_ATTEMPTS) {
			this.state.seekAttempts++;

			if (this.isTimeWithinStartTolerance(player.currentTime)) {
				Env.log.proc(`\t\tSeeking back further (seek attempt ${this.state.seekAttempts - 1}).`);

				const adjustedTime = player.currentTime > this.info.startTime
					? player.currentTime - SEEK_STEP_BACK_AMOUNT
					: player.currentTime + SEEK_STEP_BACK_AMOUNT;

				this.seekTo(player, Math.max(0, adjustedTime), { adjustNextSeek: false });
			}
			else {
				Env.log.proc(`\t\tNo need to seek back ${this.state.seekAttempts > 1 ? "further" : ""}`);
				requestBeginPlayback();
			}
		}
		else {
			requestBeginPlayback();
		}
	}

	/**
		* Whenever this is called depends on the engine.
		* - It'll likely not be called before looping when the {@link HtmlAttribute.MediaElement.Loop.NAME|loop} attribute is set, see {@link removeLoopAttribute}.
		* - {@link player}.`ended` is only `true` after the whole file as played, i.e., not when pausing because of a set end time.
		*
		* @param player
		*/
	private onTimeUpdate(player: HTMLAudioElement) {
		Env.log.proc(`\t(event) timeupdate: ${player.currentTime}\n\t\tEnd of file: ${player.ended}. Is player paused: ${player.paused}\n\t\tpast end time: ${(this.info.endTime ? player.currentTime >= this.info.endTime : player.ended)}, didSeekOutOfTimeRange: ${this.state.didSeekOutOfTimeRange}`);

		if (this.state.didSeekOutOfTimeRange)
			return;

		if (player.ended)
			this.state.didReachEnd = true;
		else
			this.state.didReachEnd = this.info.endTime ? player.currentTime >= this.info.endTime : false;

		if (!this.state.didReachEnd)
			return;

		// If `ended` is true (and there's no `loop` attribute) or playback has passed the end time, the engine pauses playback, which means that `onPause` will be called.
		// Extra measure. Player would normally already be paused.
		if (!player.paused) {
			Env.log.proc(`\t\tPausing because past end time`);
			player.pause();
		}
	}
}

// These are involved in attemping to find the key frames in case the custom start time is set after a key frame, the playback position will begin at the next.
/** Stop adjusting after this number of attempts even if the players position is beyond tolerance margin. */
const MAX_SEEK_ATTEMPTS = 10;
/** The time to adjust backwards on each attempt. */
const SEEK_STEP_BACK_AMOUNT = 0.10; //0.50;
const SEEK_TOLERANCE = 0.05; //0.10;
