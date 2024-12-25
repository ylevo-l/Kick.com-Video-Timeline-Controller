// ==UserScript==
// @name         Kick.com Video Timeline Controller
// @namespace    https://github.com/fxdk14/Kick.com-Video-Timeline-Controller
// @version      3.10
// @description  Arrow key controls for precise Kick.com timeline navigation with advanced reliability, smooth and accurate buffer info, a consistent UI, and a preloading functionality.
// @author       fxdk_
// @match        https://kick.com/*
// @icon         https://kick.com/favicon.ico
// @grant        none
// @run-at       document-end
// ==/UserScript==

(() => {
    'use strict';

    const config = {
        seekInitial: 0.5,
        seekIncrement: 0.1,
        seekMax: 5,
        seekInterval: 100,
        holdThreshold: 300,
        notificationDuration: 1000,
        notificationScale: 1,
        videoSelector: 'video',
        notificationPosition: 'bottom-center',
        debug: false,
        smoothingFactor: 0.05,
    };

    const debugLog = config.debug ? console.log.bind(console, '[KickTimelineController]:') : () => {};

    const createElem = (tag, styles = {}, parent = null, text = null, attrs = {}) => {
        const elem = document.createElement(tag);
        Object.assign(elem.style, styles);
        Object.assign(elem, attrs);
        if (text) elem.textContent = text;
        if (parent) parent.appendChild(elem);
        return elem;
    };

    class NotificationManager {
        /**
         * Constructs a new notification manager
         * @param {number} duration
         * @param {string} position
         * @param {string} containerId
         * @param {number} scale
         */
        constructor({ duration = 1000, position = 'bottom-center', containerId = 'notification-container', scale = 1 } = {}) {
            this.duration = duration;
            this.scale = scale;
            this.container = document.getElementById(containerId) || createElem('div', {
                position: 'fixed', zIndex: 10000, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', ...this.getPositionStyles(position)
            }, document.body, null, { id: containerId });

            this.box = createElem('div', {
                minWidth: '100px', maxWidth: '150px', padding: '8px 12px',
                backgroundColor: 'rgba(20, 20, 20, 0.95)', color: '#e0ffe0',
                borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                fontSize: '12px', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                textAlign: 'center', opacity: 0, transform: `translateY(10px) scale(${this.scale})`,
                transition: 'opacity 0.2s ease, transform 0.2s ease',
                textShadow: '0 0 5px #28a745', pointerEvents: 'auto',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', flexDirection: 'row',
            }, this.container);

            this.textContainer = createElem('div', { display: 'flex', alignItems: 'center' }, this.box);
            this.signSpan = createElem('span', { marginRight: '4px', fontWeight: 'bold', width: '10px', display: 'inline-block', textAlign: 'center' }, this.textContainer);
            this.numberSpan = createElem('span', { flex: 1 }, this.textContainer);
            this.bufferBar = createElem('div', { width: '100%', height: '3px', backgroundColor: 'rgba(0, 150, 0, 0.45)', borderRadius: '2px', position: 'absolute', bottom: 0, left: 0, overflow: 'hidden' }, this.box);
            this.progressBar = createElem('div', { height: '100%', backgroundColor: '#40ff28', width: '0%', borderRadius: '2px', transition: 'width 0.1s ease',}, this.bufferBar);
        }

        /**
         * Returns the position style of a notification
         * @param {string} pos
         * @returns {{bottom: string, left: string, transform: string}|{top: string, left: string, transform: string}|{top: string, right: string}|{bottom: string, left: string}|{bottom: string, right: string}|{top: string, left: string}}
         */
        getPositionStyles(pos) {
            switch (pos) {
                case 'top-left': return { top: '15px', left: '15px' };
                case 'top-right': return { top: '15px', right: '15px' };
                case 'bottom-left': return { bottom: '15px', left: '15px' };
                case 'bottom-right': return { bottom: '15px', right: '15px' };
                case 'top-center': return { top: '15px', left: '50%', transform: 'translateX(-50%)' };
                case 'bottom-center':
                default: return { bottom: '15px', left: '50%', transform: 'translateX(-50%)' };
            }
        }

        /**
         * Displays a new message
         * @param {string} message
         */
        show(message) {
            const [sign, ...numParts] = message.split('');
            this.signSpan.textContent = sign === '-' ? '-' : '+';
            this.numberSpan.textContent = `${numParts.join('')}s`;
            Object.assign(this.box.style, { opacity: 1, transform: `translateY(0) scale(${this.scale})` });
            clearTimeout(this.hideTimer);
            this.hideTimer = setTimeout(() => {
                Object.assign(this.box.style, { opacity: 0, transform: `translateY(10px) scale(${this.scale})` });
            }, this.duration);
        }

         /**
          * Updates the buffer bar of the notification
          * @param {number} currentTime
          * @param {any} buffered
          * @param {number} duration
          * @param {number} smoothMaxBufferedEnd
          * @param {boolean} isBuffering
          * @param {boolean} isSeekingBackward
          */
        updateBufferBar(currentTime, buffered, duration, smoothMaxBufferedEnd, isBuffering = false, isSeekingBackward = false) {
            if (!this.progressBar || duration === 0 || isNaN(duration)) {
                this.progressBar.style.width = '0%';
                return;
            }

            if (isBuffering) {
                this.progressBar.style.width = isSeekingBackward ? '0%' : '100%';
                return;
            }

            let bufferedStart = 0;
            let bufferedEnd = 0;
            if (buffered && buffered.length > 0) {
                for (let i = 0; i < buffered.length; i++) {
                    if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
                        bufferedStart = buffered.start(i);
                        bufferedEnd = buffered.end(i);
                        break;
                    }
                }
                if (bufferedEnd - bufferedStart <= 0) {
                    this.progressBar.style.width = '0%';
                    return;
                }
            }

            if (bufferedEnd > 0) {
                const availableBuffer = bufferedEnd - bufferedStart;
                const currentAvailablePosition = currentTime - bufferedStart;

                let bufferWidth = (availableBuffer / duration) * 100;
                let currentPositionWithinBuffer = (currentAvailablePosition / availableBuffer) * 100;
                 if (bufferWidth <= 0) {
                    this.progressBar.style.width = '0%';
                    return;
                }
                 this.progressBar.style.width = `${Math.min(100, currentPositionWithinBuffer)}%`;
            }
            else {
                this.progressBar.style.width = '0%';
            }
        }
    }

    class VideoController {
        /**
         * Constructs a new Video Controller
         * @param config
         */
        constructor(config) {
            this.config = config;
            this.keys = {
                'ArrowLeft': { active: false, seek: -config.seekInitial },
                'ArrowRight': { active: false, seek: config.seekInitial }
            };
            this.notification = new NotificationManager({
                duration: config.notificationDuration,
                position: config.notificationPosition,
                scale: config.notificationScale
            });
            this.isBuffering = false;
            this.animationFrameId = null;
            this.maxBufferedEnd = 0;
            this.smoothMaxBufferedEnd = 0;
            this.seekDisabled = false;
            this.seekTimeout = null;
            this.lastCheckTime = 0;
            this.playbackRate = 1;
            this.isSeekingBackward = false;
            this.init();
        }

        /**
         * Initializer for the controller
         */
        init() {
            this.observeVideo();
        }

         /**
          * Observes the DOM for video element
          */
        observeVideo() {
            const existingVideo = document.querySelector(this.config.videoSelector);
            if (existingVideo) {
                this.setupVideo(existingVideo);
                return;
            }

            this.observer = new MutationObserver((mutations, observer) => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) {
                            const video = node.matches(this.config.videoSelector) ? node : node.querySelector(this.config.videoSelector);
                            if (video) {
                                this.setupVideo(video);
                                observer.disconnect();
                                return;
                            }
                        }
                    }
                }
            });
            this.observer.observe(document.body, { childList: true, subtree: true });
        }

        /**
         * Sets up the video
         * @param {HTMLVideoElement} video
         */
        setupVideo(video) {
            this.video = video;
            this.bindEvents();
            this.bindVideoEvents();
            this.startBufferUpdates();
            this.prefetchVideo();
            debugLog('Video element found and initialized:', this.video);
        }

         /**
          * Prefetches the video
          */
        prefetchVideo() {
            if (!this.video || !this.video.src || this.prefetchingVideo) {
                if (this.prefetchingVideo) debugLog("prefetchVideo - Already prefetching.");
                if (!this.video || !this.video.src) debugLog("prefetchVideo - No video element or source available.");
                return;
            }

            this.prefetchingVideo = true;
            debugLog("prefetchVideo - Prefeching video...");
            this.preloadingVideo = createElem('video', { position: 'absolute', top: '-10000px', left: '-10000px' }, document.body, null, { src: this.video.src });

            this.preloadingVideo.play().then(() => {
                debugLog("prefetchVideo - prefetching video started.")
            });
            this.preloadingVideo.addEventListener('error', (error) => {
                debugLog('prefetchVideo - Error preloading video: ', error)
                document.body.removeChild(this.preloadingVideo);
                this.preloadingVideo = null;
                this.prefetchingVideo = false;
            });
            this.preloadingVideo.addEventListener('ended', () => {
                debugLog('prefetchVideo - preloading video finished.')
                document.body.removeChild(this.preloadingVideo);
                this.preloadingVideo = null;
                this.prefetchingVideo = false;
            });
        }

         /**
          * Starts the buffer updates
          */
        startBufferUpdates() {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
            }
            const update = () => {
                this.logBufferInfo('bufferUpdate');
                this.animationFrameId = requestAnimationFrame(update);
            };
            update();
        }

         /**
          * Stops the buffer updates
          */
        stopBufferUpdates() {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
        }

         /**
          * Binds the keyboard events
          */
        bindEvents() {
            window.addEventListener('keydown', e => this.onKeyDown(e));
            window.addEventListener('keyup', e => this.onKeyUp(e));
        }

        /**
         * Binds the video events
         */
        bindVideoEvents() {
            this.video.addEventListener('waiting', () => {
                this.isBuffering = true;
                this.logBufferInfo('waiting');
                this.notification.updateBufferBar(this.video.currentTime, this.video.buffered, this.video.duration, this.smoothMaxBufferedEnd, this.isBuffering, this.isSeekingBackward);
            });
            this.video.addEventListener('playing', () => {
                this.isBuffering = false;
                this.logBufferInfo('playing');
            });
            this.video.addEventListener('ended', () => this.stopBufferUpdates());
            this.video.addEventListener('pause', () => this.stopBufferUpdates());
            this.video.addEventListener('play', () => this.startBufferUpdates());
            this.video.addEventListener('progress', () => this.logBufferInfo('progress'));
            this.video.addEventListener('canplay', () => this.logBufferInfo('canplay'));
            this.video.addEventListener('canplaythrough', () => this.logBufferInfo('canplaythrough'));
        }

        /**
         * Logs the buffer info for debugging purposes
         * @param {string} event
         */
        logBufferInfo(event) {
            if (!this.video) return;
            const { buffered, currentTime, duration } = this.video;
            let bufferRanges = [];
            let currentMaxBuffer = 0;
            for (let i = 0; i < buffered.length; i++) {
                const start = buffered.start(i).toFixed(2);
                const end = buffered.end(i).toFixed(2);
                bufferRanges.push(`[${start}s - ${end}s]`);
                if (buffered.end(i) > currentMaxBuffer)
                    currentMaxBuffer = buffered.end(i);
            }
            if (currentMaxBuffer > 0) {
                this.maxBufferedEnd = currentMaxBuffer;
            }
            this.smoothMaxBufferedEnd = this.smoothMaxBufferedEnd + (this.maxBufferedEnd - this.smoothMaxBufferedEnd) * this.config.smoothingFactor;
            const now = performance.now() / 1000;
            if (this.lastCheckTime !== 0) {
                this.playbackRate = (currentTime - this.lastCheckTime) / (now - (this.lastCheckTime === 0 ? now : this.lastCheckTime))
                if (isNaN(this.playbackRate) || !isFinite(this.playbackRate)) this.playbackRate = 1;
            }
            this.lastCheckTime = now;
            debugLog(
                `${event} Event - Current Time: ${currentTime.toFixed(2)}s / Duration: ${duration ? duration.toFixed(2) + 's' : 'N/A'}, ` +
                `Buffered: ${bufferRanges.length > 0 ? bufferRanges.join(', ') : 'No buffer'}. ` +
                `Is Buffering: ${this.isBuffering} smoothMaxBufferedEnd: ${this.smoothMaxBufferedEnd.toFixed(2)}`
            );
            this.notification.updateBufferBar(currentTime, buffered, duration, this.smoothMaxBufferedEnd, this.isBuffering, this.isSeekingBackward);
        }

        /**
         * Checks if the user is focused on an input field
         * @returns {boolean}
         */
        isInputFocused() {
            const el = document.activeElement;
            return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        }

        /**
         * Handles the key down events
         * @param {KeyboardEvent} e
         */
        onKeyDown(e) {
            if (this.isInputFocused()) return;
            const key = this.keys[e.key];
            if (!key || key.active) return;

            e.preventDefault();
            key.active = true;
            key.currentSeek = Math.abs(key.seek);
            debugLog(`Keydown: ${e.key} - Initial seek: ${key.seek}, Holding for continuous seek`);
            this.logBufferInfo('intervalUpdate');
            key.timer = setTimeout(() => {
                key.interval = setInterval(() => {
                    if (this.isBuffering) {
                        debugLog(`Buffering - skipping seek during interval`);
                        return;
                    }
                    key.currentSeek = Math.min(key.currentSeek + this.config.seekIncrement, this.config.seekMax);
                    const amount = key.seek > 0 ? key.currentSeek : -key.currentSeek;
                    this.logBufferInfo('intervalUpdate');
                    this.seekVideo(amount);
                    this.notification.show(`${key.seek > 0 ? '+' : '-'}${key.currentSeek.toFixed(2)}`);
                }, this.config.seekInterval);
            }, this.config.holdThreshold);

            this.isSeekingBackward = key.seek < 0;
            const baseSeek = e.shiftKey ? (key.seek > 0 ? 0.1 : -0.1) : key.seek;
            this.logBufferInfo('intervalUpdate');
            this.seekVideo(baseSeek);
            this.notification.show(`${baseSeek > 0 ? '+' : '-'}${Math.abs(baseSeek).toFixed(2)}`);
        }

        /**
         * Handles key up events
         * @param {KeyboardEvent} e
         */
        onKeyUp(e) {
            const key = this.keys[e.key];
            if (!key) return;
            clearTimeout(key.timer);
            clearInterval(key.interval);
            key.active = false;
            key.currentSeek = Math.abs(this.config.seekInitial);
            debugLog(`Keyup: ${e.key} - Seeking stopped, resetting currentSeek`);
            this.isSeekingBackward = false;
        }

        /**
         * Seeks to a new position in the video timeline
         * @param {number} amount
         */
        seekVideo(amount) {
            if (!this.video || isNaN(this.video.duration)) {
                debugLog("seekVideo - video element invalid or duration NaN");
                return;
            }

            const bufferThreshold = 1;
            let lastBufferedEnd = 0;
            if (this.video.buffered && this.video.buffered.length > 0) {
                for (let i = 0; i < this.video.buffered.length; i++) {
                    if (this.video.currentTime >= this.video.buffered.start(i) && this.video.currentTime <= this.video.buffered.end(i)) {
                        lastBufferedEnd = this.video.buffered.end(i);
                        break;
                    }
                }
            }
            else {
                return;
            }
            const timeToEnd = this.video.duration - lastBufferedEnd;
            if ((timeToEnd <= bufferThreshold && amount > 0) || this.seekDisabled) {
                debugLog(`seekVideo - seek is disabled near end of buffer: timeToEnd=${timeToEnd.toFixed(2)}s, amount=${amount.toFixed(2)}s`);
                this.seekDisabled = true;
                return;
            }
            this.seekDisabled = false;
            let newTime = this.video.currentTime + amount;
            newTime = Math.round(Math.max(0, Math.min(newTime, this.video.duration)) * 100) / 100;

            if (this.video.currentTime === newTime) {
                debugLog("seekVideo - Current time is the same as new time, skipping");
                return;
            }

            this.video.currentTime = newTime;
            debugLog(`Seeking video by ${amount.toFixed(2)}s, new time: ${newTime.toFixed(2)}s`);
        }
    }

    function initialize() {
        if (window.videoControllerInitialized) return;
        window.videoControllerInitialized = true;
        new VideoController(config);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
