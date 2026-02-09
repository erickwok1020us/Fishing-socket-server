const { AnomalyDetector, ESCALATION_LEVELS, COOLDOWN_DURATION_MS } = require('../../src/modules/AnomalyDetector');

describe('M4 Gate: Anomaly Escalation (Phase 3)', () => {
    let detector;

    beforeEach(() => {
        detector = new AnomalyDetector();
    });

    test('new player starts at NONE escalation level', () => {
        detector.getPlayerStats('p1');
        expect(detector.getEscalationLevel('p1')).toBe(ESCALATION_LEVELS.NONE);
    });

    test('1 flag triggers WARNING level', () => {
        const stats = detector.getPlayerStats('p1');
        stats.flags.push({ weapon: '1x', timestamp: Date.now() });
        expect(detector.getEscalationLevel('p1')).toBe(ESCALATION_LEVELS.WARNING);
    });

    test('3 flags triggers COOLDOWN level', () => {
        const stats = detector.getPlayerStats('p1');
        for (let i = 0; i < 3; i++) {
            stats.flags.push({ weapon: '1x', timestamp: Date.now() });
        }
        expect(detector.getEscalationLevel('p1')).toBe(ESCALATION_LEVELS.COOLDOWN);
    });

    test('5 flags triggers DISCONNECT level', () => {
        const stats = detector.getPlayerStats('p1');
        for (let i = 0; i < 5; i++) {
            stats.flags.push({ weapon: '1x', timestamp: Date.now() });
        }
        expect(detector.getEscalationLevel('p1')).toBe(ESCALATION_LEVELS.DISCONNECT);
    });

    test('cooldown blocks player temporarily', () => {
        detector.getPlayerStats('p1');
        expect(detector.isInCooldown('p1')).toBe(false);
        detector.applyCooldown('p1');
        expect(detector.isInCooldown('p1')).toBe(true);
    });

    test('cooldown expires after duration', () => {
        const stats = detector.getPlayerStats('p1');
        stats.cooldownUntil = Date.now() - 1;
        expect(detector.isInCooldown('p1')).toBe(false);
    });

    test('ESCALATION_LEVELS has correct values', () => {
        expect(ESCALATION_LEVELS.NONE).toBe(0);
        expect(ESCALATION_LEVELS.WARNING).toBe(1);
        expect(ESCALATION_LEVELS.COOLDOWN).toBe(2);
        expect(ESCALATION_LEVELS.DISCONNECT).toBe(3);
    });

    test('COOLDOWN_DURATION_MS is 10 seconds', () => {
        expect(COOLDOWN_DURATION_MS).toBe(10000);
    });
});
