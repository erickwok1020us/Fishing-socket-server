const { ReceiptChain, createFishDeathReceipt } = require('../../src/modules/AuditReceipt');
const { ConfigHashManager } = require('../../src/modules/ConfigHash');
const { WEAPONS, FISH_SPECIES } = require('../../fish3DGameEngine');

describe('M6 Gate: Rules Hash in Receipts', () => {
    let configManager;
    let chain;

    beforeEach(() => {
        configManager = new ConfigHashManager({ weapons: WEAPONS, fishSpecies: FISH_SPECIES });
        chain = new ReceiptChain('test-room-ruleshash');
    });

    test('receipt includes rules_hash field', () => {
        const rulesHash = configManager.getHash();
        const receipt = createFishDeathReceipt(
            {
                fishId: 'fish-1',
                typeName: 'sardine',
                maxHealth: 25,
                damageByPlayer: new Map([['s1', 25]]),
                costByPlayer: new Map([['s1', 10]]),
                seedCommitment: 'commit-1'
            },
            [{ playerId: 1, socketId: 's1', cost: 10, percent: 100, reward: 9 }],
            9,
            rulesHash,
            configManager.getVersion(),
            'commit-1'
        );

        expect(receipt.rules_hash).toBe(rulesHash);
        expect(receipt.rules_hash.length).toBe(64);
    });

    test('receipt includes rules_version field', () => {
        const receipt = createFishDeathReceipt(
            {
                fishId: 'fish-1',
                typeName: 'sardine',
                maxHealth: 25,
                damageByPlayer: new Map([['s1', 25]]),
                costByPlayer: new Map([['s1', 10]]),
                seedCommitment: 'commit-1'
            },
            [{ playerId: 1, socketId: 's1', cost: 10, percent: 100, reward: 9 }],
            9,
            configManager.getHash(),
            configManager.getVersion(),
            'commit-1'
        );

        expect(receipt.rules_version).toBe(configManager.getVersion());
    });

    test('rules_hash changes if config changes', () => {
        const hash1 = configManager.getHash();
        const uniqueCost = Date.now() % 100000;
        configManager.updateConfig({ weapons: { '1x': { cost: uniqueCost } } });
        const hash2 = configManager.getHash();
        expect(hash1).not.toBe(hash2);
    });

    test('receipts with different rules_hash are distinguishable', () => {
        const hash1 = configManager.getHash();
        const uniqueCost = Date.now() % 100000 + 50000;
        configManager.updateConfig({ weapons: { '1x': { cost: uniqueCost } } });
        const hash2 = configManager.getHash();

        const r1 = createFishDeathReceipt(
            { fishId: 'f1', typeName: 'sardine', maxHealth: 25, damageByPlayer: new Map(), costByPlayer: new Map(), seedCommitment: 'c1' },
            [], 0, hash1, 1, 'c1'
        );
        const r2 = createFishDeathReceipt(
            { fishId: 'f2', typeName: 'sardine', maxHealth: 25, damageByPlayer: new Map(), costByPlayer: new Map(), seedCommitment: 'c2' },
            [], 0, hash2, 2, 'c2'
        );

        expect(r1.rules_hash).not.toBe(r2.rules_hash);
    });
});
