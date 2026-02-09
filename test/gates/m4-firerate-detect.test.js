const { AnomalyDetector } = require('../../src/modules/AnomalyDetector');

describe('M4 Gate: Fire Rate Anomaly Detection', () => {
    let detector;

    beforeEach(() => {
        detector = new AnomalyDetector();
    });

    test('records shots per weapon', () => {
        detector.recordShot('socket-1', '1x');
        detector.recordShot('socket-1', '1x');
        detector.recordShot('socket-1', '3x');

        const stats = detector.getPlayerStats('socket-1');
        expect(stats.shotsByWeapon.get('1x')).toBe(2);
        expect(stats.shotsByWeapon.get('3x')).toBe(1);
    });

    test('records hits per weapon', () => {
        detector.recordHit('socket-1', '1x');
        detector.recordHit('socket-1', '1x');

        const stats = detector.getPlayerStats('socket-1');
        expect(stats.hitsByWeapon.get('1x')).toBe(2);
    });

    test('calculates hit rate correctly', () => {
        for (let i = 0; i < 10; i++) {
            detector.recordShot('socket-1', '1x');
        }
        for (let i = 0; i < 3; i++) {
            detector.recordHit('socket-1', '1x');
        }

        const stats = detector.getPlayerStats('socket-1');
        expect(stats.getHitRate('1x')).toBeCloseTo(0.3, 5);
    });

    test('returns 0 hit rate when no shots fired', () => {
        const stats = detector.getPlayerStats('socket-1');
        expect(stats.getHitRate('1x')).toBe(0);
    });
});
