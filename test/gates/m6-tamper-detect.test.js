const { ConfigHashManager } = require('../../src/modules/ConfigHash');
const { WEAPONS, FISH_SPECIES } = require('../../fish3DGameEngine');

describe('M6 Gate: Tamper Detection', () => {
    test('hash changes when weapon cost is tampered', () => {
        const original = new ConfigHashManager({ weapons: WEAPONS, fishSpecies: FISH_SPECIES });
        const originalHash = original.getHash();

        const tampered = { ...WEAPONS };
        tampered['1x'] = { ...tampered['1x'], cost: 0 };
        const tamperedManager = new ConfigHashManager({ weapons: tampered, fishSpecies: FISH_SPECIES });

        expect(tamperedManager.getHash()).not.toBe(originalHash);
    });

    test('hash changes when weapon RTP is tampered', () => {
        const original = new ConfigHashManager({ weapons: WEAPONS, fishSpecies: FISH_SPECIES });
        const originalHash = original.getHash();

        const tampered = { ...WEAPONS };
        tampered['1x'] = { ...tampered['1x'], rtp: 1.5 };
        const tamperedManager = new ConfigHashManager({ weapons: tampered, fishSpecies: FISH_SPECIES });

        expect(tamperedManager.getHash()).not.toBe(originalHash);
    });

    test('hash changes when fish species is tampered', () => {
        const original = new ConfigHashManager({ weapons: WEAPONS, fishSpecies: FISH_SPECIES });
        const originalHash = original.getHash();

        const firstKey = Object.keys(FISH_SPECIES)[0];
        const tamperedFish = { ...FISH_SPECIES, [firstKey]: { ...FISH_SPECIES[firstKey], baseHP: 9999 } };
        const tamperedManager = new ConfigHashManager({ weapons: WEAPONS, fishSpecies: tamperedFish });

        expect(tamperedManager.getHash()).not.toBe(originalHash);
    });

    test('hash is stable across multiple reads', () => {
        const manager = new ConfigHashManager({ weapons: WEAPONS, fishSpecies: FISH_SPECIES });
        const h1 = manager.getHash();
        const h2 = manager.getHash();
        const h3 = manager.getHash();
        expect(h1).toBe(h2);
        expect(h2).toBe(h3);
    });

    test('JSON.stringify key order does not affect hash (deep sort)', () => {
        const config1 = { weapons: { '1x': { cost: 1, rtp: 0.91 } } };
        const config2 = { weapons: { '1x': { rtp: 0.91, cost: 1 } } };
        const m1 = new ConfigHashManager(config1);
        const m2 = new ConfigHashManager(config2);
        expect(m1.getHash()).toBe(m2.getHash());
    });
});
