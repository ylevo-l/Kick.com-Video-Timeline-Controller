// ==UserScript==
// @name         Kick.com Video Timeline Controller
// @namespace    https://github.com/fxdk14/Kick.com-Video-Timeline-Controller
// @version      1.1
// @description  Arrow key controls for precise Kick.com timeline navigation.
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
        notificationPosition: 'bottom-center'
    };

    class NotificationManager {
        constructor({duration = 1000, position = 'bottom-center', containerId = 'notification-container', scale = 1} = {}) {
            this.duration = duration;
            this.scale = scale;
            let container = document.getElementById(containerId);
            if (!container) {
                container = document.createElement('div');
                container.id = containerId;
                container.style.cssText = `position: fixed; z-index: 10000; pointer-events: none; display: flex; align-items: center; justify-content: center; ${this.getPositionStyles(position)}`;
                document.body.appendChild(container);
            }
            this.box = document.createElement('div');
            this.box.style.cssText = `
                min-width: 100px; max-width: 150px; padding: 8px 12px;
                background-color: rgba(20, 20, 20, 0.95); color: #e0ffe0;
                border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.5);
                font-size: 12px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                text-align: center; opacity: 0; transform: translateY(10px) scale(${this.scale});
                transition: opacity 0.2s ease, transform 0.2s ease;
                text-shadow: 0 0 5px #28a745; pointer-events: auto;
                display: flex; align-items: center; justify-content: center;
            `;
            this.signSpan = document.createElement('span');
            this.numberSpan = document.createElement('span');
            this.signSpan.style.cssText = `width: 10px; text-align: right; margin-right: 4px; font-weight: bold;`;
            this.numberSpan.style.flex = '1';
            this.box.appendChild(this.signSpan);
            this.box.appendChild(this.numberSpan);
            container.appendChild(this.box);
        }

        getPositionStyles(pos) {
            switch(pos) {
                case 'top-left': return 'top: 15px; left: 15px;';
                case 'top-right': return 'top: 15px; right: 15px;';
                case 'bottom-left': return 'bottom: 15px; left: 15px;';
                case 'bottom-right': return 'bottom: 15px; right: 15px;';
                case 'top-center': return 'top: 15px; left: 50%; transform: translateX(-50%);';
                case 'bottom-center':
                default: return 'bottom: 15px; left: 50%; transform: translateX(-50%);';
            }
        }

        show(message) {
            const [sign, ...numParts] = message.split('');
            this.signSpan.textContent = sign === '-' ? '-' : '+';
            this.numberSpan.textContent = `${numParts.join('')}s`;
            this.box.style.cssText += `opacity: 1; transform: translateY(0) scale(${this.scale});`;
            clearTimeout(this.hideTimer);
            this.hideTimer = setTimeout(() => {
                this.box.style.cssText += `opacity: 0; transform: translateY(10px) scale(${this.scale});`;
            }, this.duration);
        }
    }

    class VideoController {
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
            this.init();
        }

        init() {
            this.waitForVideo().then(video => {
                this.video = video;
                this.bindEvents();
                this.bindVideoEvents();
            }).catch(() => {});
        }

        waitForVideo() {
            return new Promise((resolve, reject) => {
                let attempts = 0;
                const interval = setInterval(() => {
                    const video = document.querySelector(this.config.videoSelector);
                    if (video) { clearInterval(interval); resolve(video); }
                    else if (++attempts >= 20) { clearInterval(interval); reject(); }
                }, 500);
            });
        }

        bindEvents() {
            window.addEventListener('keydown', e => this.onKeyDown(e));
            window.addEventListener('keyup', e => this.onKeyUp(e));
        }

        bindVideoEvents() {
            this.video.addEventListener('waiting', () => this.isBuffering = true);
            this.video.addEventListener('playing', () => this.isBuffering = false);
            this.isBuffering = !this.video.paused && this.video.readyState < 3;
        }

        isInputFocused() {
            const el = document.activeElement;
            return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        }

        onKeyDown(e) {
            if (this.isInputFocused()) return;
            const key = this.keys[e.key];
            if (!key || key.active) return;
            e.preventDefault();
            key.active = true;
            key.currentSeek = Math.abs(key.seek);
            key.timer = setTimeout(() => {
                key.interval = setInterval(() => {
                    if (this.isBuffering) return;
                    key.currentSeek = Math.min(key.currentSeek + this.config.seekIncrement, this.config.seekMax);
                    const amount = key.seek > 0 ? key.currentSeek : -key.currentSeek;
                    this.seekVideo(amount);
                    this.notification.show(`${key.seek > 0 ? '+' : '-'}${key.currentSeek.toFixed(2)}`);
                }, this.config.seekInterval);
            }, this.config.holdThreshold);
            const baseSeek = e.shiftKey ? (key.seek > 0 ? 0.1 : -0.1) : key.seek;
            this.seekVideo(baseSeek);
            this.notification.show(`${baseSeek > 0 ? '+' : '-'}${Math.abs(baseSeek).toFixed(2)}`);
        }

        onKeyUp(e) {
            const key = this.keys[e.key];
            if (!key) return;
            clearTimeout(key.timer);
            clearInterval(key.interval);
            key.active = false;
            key.currentSeek = Math.abs(this.config.seekInitial);
        }

        seekVideo(amount) {
            let newTime = this.video.currentTime + amount;
            this.video.currentTime = Math.round(Math.max(0, Math.min(newTime, this.video.duration)) * 100) / 100;
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
