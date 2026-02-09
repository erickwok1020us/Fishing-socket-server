const { ConfigHashManager } = require('../../src/modules/ConfigHash');
const { WEAPONS, FISH_SPECIES } = require('../../fish3DGameEngine');

describe('M6 Gate: Version Auto-Increment on Config Change', () => {
    test('version is a positive integer', () => {
        const manager = new ConfigHashManager({ weapons: WEAPONS, fishSpecies: FISH_SPECIES });
        expect(manager.getVersion()).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(manager.getVersion())).toBe(true);
    });

    test('version increments when config changes via updateConfig', () => {
        const manager = new ConfigHashManager({ weapons: WEAPONS, fishSpecies: FISH_SPECIES });
        const v1 = manager.getVersion();
        const uniqueCost = Date.now() % 100000;

        manager.updateConfig({ weapons: { '1x': { cost: uniqueCost } } });
        expect(manager.getVersion()).toBe(v1 + 1);
    });

    test('version does NOT increment when config is identical', () => {
        const manager = new ConfigHashManager({ weapons: WEAPONS, fishSpecies: FISH_SPECIES });
        const v1 = manager.getVersion();

        manager.updateConfig({ weapons: WEAPONS, fishSpecies: FISH_SPECIES });
        expect(manager.getVersion()).toBe(v1);
    });

    test('updateConfig with two different configs increments twice', () => {
        const manager = new ConfigHashManager({ weapons: WEAPONS, fishSpecies: FISH_SPECIES });
        const v1 = manager.getVersion();
        const ts = Date.now();

        manager.updateConfig({ weapons: { '1x': { cost: ts } } });
        expect(manager.getVersion()).toBe(v1 + 1);

        manager.updateConfig({ weapons: { '1x': { cost: ts + 1 } } });
        expect(manager.getVersion()).toBe(v1 + 2);
    });
});
