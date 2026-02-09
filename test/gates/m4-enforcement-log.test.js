const { AnomalyDetector } = require('../../src/modules/AnomalyDetector');
const { SequenceTracker } = require('../../src/modules/SequenceTracker');

describe('M4 Gate: Enforcement Logging', () => {
    test('anomaly flags are stored in player stats', () => {
        const detector = new AnomalyDetector();

        for (let i = 0; i < 100; i++) {
            detector.recordShot('socket-1', '1x');
            detector.recordHit('socket-1', '1x');
        }

        detector.checkAnomaly('socket-1');
        const stats = detector.getPlayerStats('socket-1');
        expect(stats.flags.length).toBeGreaterThan(0);
    });

    test('sequence violations are counted and trackable', () => {
        const tracker = new SequenceTracker();
        tracker.initSession('socket-1');

        tracker.validate('socket-1', 1);
        tracker.validate('socket-1', 1);
        tracker.validate('socket-1', 0);

        expect(tracker.getViolationCount('socket-1')).toBe(2);
        tracker.destroySession('socket-1');
    });

    test('anomaly detector getStats returns tracking info', () => {
        const detector = new AnomalyDetector();
        detector.recordShot('socket-1', '1x');
        detector.recordShot('socket-2', '3x');

        const stats = detector.getStats();
        expect(stats.trackedPlayers).toBe(2);
        expect(stats.sigmaThreshold).toBe(3.0);
        expect(stats.minShotsRequired).toBe(50);
    });

    test('player cleanup removes all tracking data', () => {
        const detector = new AnomalyDetector();
        detector.recordShot('socket-1', '1x');
        detector.destroyPlayer('socket-1');

        const stats = detector.getStats();
        expect(stats.trackedPlayers).toBe(0);
    });

    test('sequence tracker cleanup removes session', () => {
        const tracker = new SequenceTracker();
        tracker.initSession('socket-1');
        tracker.destroySession('socket-1');

        expect(tracker.getStats().activeSessions).toBe(0);
    });
});
