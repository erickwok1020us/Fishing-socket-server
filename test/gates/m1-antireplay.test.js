const { SequenceTracker } = require('../../src/modules/SequenceTracker');

describe('M1 Gate: Anti-Replay Sequence Validation', () => {
    let tracker;

    beforeEach(() => {
        tracker = new SequenceTracker();
        tracker.initSession('socket-1');
    });

    afterEach(() => {
        tracker.destroySession('socket-1');
    });

    test('should accept sequential sequence numbers', () => {
        expect(tracker.validate('socket-1', 1).valid).toBe(true);
        expect(tracker.validate('socket-1', 2).valid).toBe(true);
        expect(tracker.validate('socket-1', 3).valid).toBe(true);
    });

    test('should reject replayed (duplicate) sequence number', () => {
        tracker.validate('socket-1', 1);
        const result = tracker.validate('socket-1', 1);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('REPLAY_DETECTED');
    });

    test('should reject out-of-order (lower) sequence number', () => {
        tracker.validate('socket-1', 5);
        const result = tracker.validate('socket-1', 3);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('REPLAY_DETECTED');
    });

    test('should reject sequence gap larger than 100', () => {
        tracker.validate('socket-1', 1);
        const result = tracker.validate('socket-1', 200);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('SEQ_GAP_TOO_LARGE');
    });

    test('should accept reasonable gaps (packet loss tolerance)', () => {
        tracker.validate('socket-1', 1);
        const result = tracker.validate('socket-1', 50);
        expect(result.valid).toBe(true);
    });

    test('should reject non-integer sequence numbers', () => {
        const result = tracker.validate('socket-1', 1.5);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('INVALID_SEQ_TYPE');
    });

    test('should reject string sequence numbers', () => {
        const result = tracker.validate('socket-1', 'abc');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('INVALID_SEQ_TYPE');
    });

    test('should return NO_SESSION for unknown socket', () => {
        const result = tracker.validate('unknown-socket', 1);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('NO_SESSION');
    });

    test('should track violation count', () => {
        tracker.validate('socket-1', 1);
        tracker.validate('socket-1', 1);
        tracker.validate('socket-1', 1);
        expect(tracker.getViolationCount('socket-1')).toBe(2);
    });

    test('destroy session cleans up', () => {
        tracker.validate('socket-1', 1);
        tracker.destroySession('socket-1');
        expect(tracker.getViolationCount('socket-1')).toBe(0);
    });
});
