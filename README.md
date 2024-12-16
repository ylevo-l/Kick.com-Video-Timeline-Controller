# Kick.com Video Timeline Controller

## Overview
Tampermonkey script for precise Kick.com video navigation with arrow keys and notifications.

## Controls
- **Arrow Right**: Seek forward by default increment.
- **Arrow Left**: Seek backward by default increment.
- **Hold Arrow Keys**: Gradually increases seek speed to max.
- **Shift + Arrow Keys**: Precise, smaller increments.

## Configuration
- `seekInitial`: Start increment (default: 0.5s).
- `seekIncrement`: Speed increase while holding (default: 0.1s).
- `seekMax`: Max speed (default: 5s).
- `notificationDuration`: Notification time (default: 1000ms).
- `notificationScale`: Notification size (default: 1).

### Edit the `config` object:
```javascript
const config = {
    seekInitial: 0.5,
    seekIncrement: 0.1,
    seekMax: 5,
    notificationDuration: 1000,
    notificationScale: 1
};
