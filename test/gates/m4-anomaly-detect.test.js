const { AnomalyDetector, SIGMA_THRESHOLD, MIN_SHOTS_FOR_DETECTION } = require('../../src/modules/AnomalyDetector');

describe('M4 Gate: Statistical Anomaly Detection (Z-score)', () => {
    let detector;

    beforeEach(() => {
        detector = new AnomalyDetector();
    });

    test('sigma threshold is 3.0 (per DEC-M4-001)', () => {
        expect(SIGMA_THRESHOLD).toBe(3.0);
    });

    test('minimum shots required before detection', () => {
        expect(MIN_SHOTS_FOR_DETECTION).toBe(50);
    });

    test('no anomaly detected with normal hit rate', () => {
        for (let i = 0; i < 100; i++) {
            detector.recordShot('socket-1', '1x');
            if (Math.random() < 0.35) {
                detector.recordHit('socket-1', '1x');
            }
        }

        const anomalies = detector.checkAnomaly('socket-1');
        expect(anomalies).toBeNull();
    });

    test('anomaly detected with impossibly high hit rate (100%)', () => {
        for (let i = 0; i < 100; i++) {
            detector.recordShot('socket-1', '1x');
            detector.recordHit('socket-1', '1x');
        }

        const anomalies = detector.checkAnomaly('socket-1');
        expect(anomalies).not.toBeNull();
        expect(anomalies.length).toBeGreaterThan(0);
        expect(anomalies[0].weapon).toBe('1x');
        expect(anomalies[0].zScore).toBeGreaterThan(SIGMA_THRESHOLD);
    });

    test('no detection below minimum shot threshold', () => {
        for (let i = 0; i < 10; i++) {
            detector.recordShot('socket-1', '1x');
            detector.recordHit('socket-1', '1x');
        }

        const anomalies = detector.checkAnomaly('socket-1');
        expect(anomalies).toBeNull();
    });

    test('anomaly flag includes all required fields', () => {
        for (let i = 0; i < 100; i++) {
            detector.recordShot('socket-1', '1x');
            detector.recordHit('socket-1', '1x');
        }

        const anomalies = detector.checkAnomaly('socket-1');
        expect(anomalies[0]).toHaveProperty('weapon');
        expect(anomalies[0]).toHaveProperty('observedRate');
        expect(anomalies[0]).toHaveProperty('expectedRate');
        expect(anomalies[0]).toHaveProperty('zScore');
        expect(anomalies[0]).toHaveProperty('shots');
        expect(anomalies[0]).toHaveProperty('timestamp');
    });

    test('expected hit rates are defined for all weapons', () => {
        expect(detector.expectedHitRates['1x']).toBeDefined();
        expect(detector.expectedHitRates['3x']).toBeDefined();
        expect(detector.expectedHitRates['5x']).toBeDefined();
        expect(detector.expectedHitRates['8x']).toBeDefined();
    });
});
