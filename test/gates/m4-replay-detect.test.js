const { SequenceTracker } = require('../../src/modules/SequenceTracker');

describe('M4 Gate: Replay Attempt Detection', () => {
    let tracker;

    beforeEach(() => {
        tracker = new SequenceTracker();
        tracker.initSession('socket-1');
    });

    afterEach(() => {
        tracker.destroySession('socket-1');
    });

    test('replayed sequence is detected and counted', () => {
        tracker.validate('socket-1', 1);
        tracker.validate('socket-1', 2);

        const result = tracker.validate('socket-1', 2);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('REPLAY_DETECTED');
        expect(tracker.getViolationCount('socket-1')).toBe(1);
    });

    test('multiple replay attempts are all counted', () => {
        tracker.validate('socket-1', 1);

        tracker.validate('socket-1', 1);
        tracker.validate('socket-1', 1);
        tracker.validate('socket-1', 0);

        expect(tracker.getViolationCount('socket-1')).toBe(3);
    });

    test('replay detection includes expected vs received in response', () => {
        tracker.validate('socket-1', 5);
        const result = tracker.validate('socket-1', 3);

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('REPLAY_DETECTED');
        expect(result.expected).toBe(6);
        expect(result.received).toBe(3);
    });
});
