const { ConfigHashManager } = require('../../src/modules/ConfigHash');

describe('M6 Gate: Version Enforcement (Phase 3)', () => {
    let manager;

    beforeEach(() => {
        manager = new ConfigHashManager({
            WEAPONS: { '1x': { cost: 1, rtp: 0.91 } },
            FISH_SPECIES: { sardine: { health: 20 } }
        });
    });

    test('initial version is a positive integer', () => {
        expect(manager.getVersion()).toBeGreaterThanOrEqual(1);
    });

    test('hash is a 64-char hex string', () => {
        const hash = manager.getHash();
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('config change bumps version', () => {
        const v1 = manager.getVersion();
        manager.updateConfig({
            WEAPONS: { '1x': { cost: 2, rtp: 0.91 } },
            FISH_SPECIES: { sardine: { health: 20 } }
        });
        expect(manager.getVersion()).toBe(v1 + 1);
    });

    test('same config does not bump version', () => {
        const v1 = manager.getVersion();
        manager.updateConfig({
            WEAPONS: { '1x': { cost: 1, rtp: 0.91 } },
            FISH_SPECIES: { sardine: { health: 20 } }
        });
        expect(manager.getVersion()).toBe(v1);
    });

    test('getInfo returns hash, version, and historyLength', () => {
        const info = manager.getInfo();
        expect(info).toHaveProperty('hash');
        expect(info).toHaveProperty('version');
        expect(info).toHaveProperty('historyLength');
        expect(info.historyLength).toBeGreaterThanOrEqual(1);
    });
});
