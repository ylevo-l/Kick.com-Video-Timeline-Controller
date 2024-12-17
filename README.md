# Kick.com Video Timeline Controller

## Overview
A Tampermonkey script for precise video navigation on Kick.com using arrow keys and on-screen notifications.

## Controls
- **Arrow Right**: Seek forward by the default increment.
- **Arrow Left**: Seek backward by the default increment.
- **Hold Arrow Keys**: Gradually increases seek speed to the maximum.
- **Shift + Arrow Keys**: Seek with smaller, precise increments.

## Configuration
- `seekInitial`: Initial seek increment in seconds (default: `0.5s`).
- `seekIncrement`: Increment added while holding keys (default: `0.1s`).
- `seekMax`: Maximum seek speed in seconds (default: `5s`).
- `notificationDuration`: Duration of notifications in milliseconds (default: `1000ms`).
- `notificationScale`: Scale of the notification box (default: `1`).

### Customize the `config` object:
```javascript
const config = {
    seekInitial: 0.5,
    seekIncrement: 0.1,
    seekMax: 5,
    notificationDuration: 1000,
    notificationScale: 1
};
