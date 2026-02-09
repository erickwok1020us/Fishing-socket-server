const { ConfigHashManager, computeConfigHash, sortObjectDeep } = require('../../src/modules/ConfigHash');
const { WEAPONS, FISH_SPECIES } = require('../../fish3DGameEngine');

describe('M6 Gate: Config Hash (SHA-256)', () => {
    let manager;

    beforeEach(() => {
        manager = new ConfigHashManager({ weapons: WEAPONS, fishSpecies: FISH_SPECIES });
    });

    test('produces SHA-256 hex hash (64 chars)', () => {
        const hash = manager.getHash();
        expect(hash.length).toBe(64);
        expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });

    test('same config produces same hash (deterministic)', () => {
        const sorted1 = sortObjectDeep({ weapons: WEAPONS, fishSpecies: FISH_SPECIES });
        const sorted2 = sortObjectDeep({ weapons: WEAPONS, fishSpecies: FISH_SPECIES });
        expect(computeConfigHash(sorted1)).toBe(computeConfigHash(sorted2));
    });

    test('different config produces different hash', () => {
        const sorted1 = sortObjectDeep({ weapons: WEAPONS, fishSpecies: FISH_SPECIES });
        const altWeapons = { ...WEAPONS, '1x': { ...WEAPONS['1x'], cost: 999 } };
        const sorted2 = sortObjectDeep({ weapons: altWeapons, fishSpecies: FISH_SPECIES });
        expect(computeConfigHash(sorted1)).not.toBe(computeConfigHash(sorted2));
    });

    test('getVersion returns version number', () => {
        const version = manager.getVersion();
        expect(typeof version).toBe('number');
        expect(version).toBeGreaterThanOrEqual(1);
    });

    test('getInfo returns hash, version, and historyLength', () => {
        const info = manager.getInfo();
        expect(info.hash).toBeDefined();
        expect(info.version).toBeDefined();
        expect(info.historyLength).toBeDefined();
    });
});
