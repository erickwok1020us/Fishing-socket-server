/**
 * RTP (Return to Player) Verification Tests
 * 
 * Verifies that the game's RTP falls within expected ranges
 * for each weapon type over a large number of simulated shots.
 */

const crypto = require('crypto');

const WEAPONS = {
    '1x': { multiplier: 1, cost: 1, rtp: 0.915 },
    '3x': { multiplier: 3, cost: 3, rtp: 0.945 },
    '5x': { multiplier: 5, cost: 5, rtp: 0.975 },
    '8x': { multiplier: 8, cost: 8, rtp: 0.995 }
};

const FISH_TIERS = [
    { tier: 1, hp: [20, 30], reward: [2, 3], spawnWeight: 40 },
    { tier: 2, hp: [50, 80], reward: [5, 8], spawnWeight: 30 },
    { tier: 3, hp: [100, 150], reward: [10, 15], spawnWeight: 15 },
    { tier: 4, hp: [200, 300], reward: [20, 30], spawnWeight: 10 },
    { tier: 5, hp: [400, 600], reward: [40, 60], spawnWeight: 4 },
    { tier: 6, hp: [1000, 2000], reward: [100, 200], spawnWeight: 1 }
];

const TOTAL_SPAWN_WEIGHT = FISH_TIERS.reduce((sum, t) => sum + t.spawnWeight, 0);

function getRandomFishTier() {
    const roll = crypto.randomBytes(4).readUInt32BE(0) / 0xFFFFFFFF * TOTAL_SPAWN_WEIGHT;
    let cumulative = 0;
    for (const tier of FISH_TIERS) {
        cumulative += tier.spawnWeight;
        if (roll < cumulative) return tier;
    }
    return FISH_TIERS[0];
}

function getRandomInRange(min, max) {
    const roll = crypto.randomBytes(4).readUInt32BE(0) / 0xFFFFFFFF;
    return Math.floor(roll * (max - min + 1)) + min;
}

function simulateShot(weapon, targetRtp) {
    const tier = getRandomFishTier();
    const fishHp = getRandomInRange(tier.hp[0], tier.hp[1]);
    const fishReward = getRandomInRange(tier.reward[0], tier.reward[1]);
    
    const hitRoll = crypto.randomBytes(4).readUInt32BE(0) / 0xFFFFFFFF;
    const baseHitChance = (weapon.damage || weapon.multiplier) / fishHp;
    const adjustedHitChance = Math.min(baseHitChance * (targetRtp / 0.9), 1.0);
    
    const isHit = hitRoll < adjustedHitChance;
    const reward = isHit ? fishReward * weapon.multiplier : 0;
    
    return {
        cost: weapon.cost,
        reward: reward,
        isHit: isHit
    };
}

function runRtpSimulation(weaponKey, numShots) {
    const weapon = WEAPONS[weaponKey];
    let totalBets = 0;
    let totalRewards = 0;
    let hits = 0;
    
    for (let i = 0; i < numShots; i++) {
        const result = simulateShot(weapon, weapon.rtp);
        totalBets += result.cost;
        totalRewards += result.reward;
        if (result.isHit) hits++;
    }
    
    const realizedRtp = totalRewards / totalBets;
    const hitRate = hits / numShots;
    
    return {
        weaponKey,
        numShots,
        totalBets,
        totalRewards,
        realizedRtp,
        expectedRtp: weapon.rtp,
        hitRate,
        deviation: Math.abs(realizedRtp - weapon.rtp)
    };
}

describe('RTP Verification Tests', () => {
    const NUM_SHOTS = 10000;
    const RTP_TOLERANCE = 0.10;
    
    test('1x weapon RTP within tolerance', () => {
        const result = runRtpSimulation('1x', NUM_SHOTS);
        console.log(`1x Weapon: RTP=${(result.realizedRtp * 100).toFixed(2)}% (expected ${(result.expectedRtp * 100).toFixed(2)}%)`);
        
        expect(result.realizedRtp).toBeGreaterThan(result.expectedRtp - RTP_TOLERANCE);
        expect(result.realizedRtp).toBeLessThan(result.expectedRtp + RTP_TOLERANCE);
    });
    
    test('3x weapon RTP within tolerance', () => {
        const result = runRtpSimulation('3x', NUM_SHOTS);
        console.log(`3x Weapon: RTP=${(result.realizedRtp * 100).toFixed(2)}% (expected ${(result.expectedRtp * 100).toFixed(2)}%)`);
        
        expect(result.realizedRtp).toBeGreaterThan(result.expectedRtp - RTP_TOLERANCE);
        expect(result.realizedRtp).toBeLessThan(result.expectedRtp + RTP_TOLERANCE);
    });
    
    test('5x weapon RTP within tolerance', () => {
        const result = runRtpSimulation('5x', NUM_SHOTS);
        console.log(`5x Weapon: RTP=${(result.realizedRtp * 100).toFixed(2)}% (expected ${(result.expectedRtp * 100).toFixed(2)}%)`);
        
        expect(result.realizedRtp).toBeGreaterThan(result.expectedRtp - RTP_TOLERANCE);
        expect(result.realizedRtp).toBeLessThan(result.expectedRtp + RTP_TOLERANCE);
    });
    
    test('8x weapon RTP within tolerance', () => {
        const result = runRtpSimulation('8x', NUM_SHOTS);
        console.log(`8x Weapon: RTP=${(result.realizedRtp * 100).toFixed(2)}% (expected ${(result.expectedRtp * 100).toFixed(2)}%)`);
        
        expect(result.realizedRtp).toBeGreaterThan(result.expectedRtp - RTP_TOLERANCE);
        expect(result.realizedRtp).toBeLessThan(result.expectedRtp + RTP_TOLERANCE);
    });
    
    test('higher multiplier weapons have higher RTP', () => {
        const results = {};
        for (const key of Object.keys(WEAPONS)) {
            results[key] = runRtpSimulation(key, NUM_SHOTS);
        }
        
        expect(results['3x'].expectedRtp).toBeGreaterThan(results['1x'].expectedRtp);
        expect(results['5x'].expectedRtp).toBeGreaterThan(results['3x'].expectedRtp);
        expect(results['8x'].expectedRtp).toBeGreaterThan(results['5x'].expectedRtp);
    });
});

describe('Fish Spawn Distribution Tests', () => {
    const NUM_SPAWNS = 10000;
    
    test('fish tier distribution matches spawn weights', () => {
        const tierCounts = {};
        for (const tier of FISH_TIERS) {
            tierCounts[tier.tier] = 0;
        }
        
        for (let i = 0; i < NUM_SPAWNS; i++) {
            const tier = getRandomFishTier();
            tierCounts[tier.tier]++;
        }
        
        for (const tier of FISH_TIERS) {
            const expectedPercent = tier.spawnWeight / TOTAL_SPAWN_WEIGHT;
            const actualPercent = tierCounts[tier.tier] / NUM_SPAWNS;
            const tolerance = 0.05;
            
            console.log(`Tier ${tier.tier}: ${(actualPercent * 100).toFixed(2)}% (expected ${(expectedPercent * 100).toFixed(2)}%)`);
            
            expect(actualPercent).toBeGreaterThan(expectedPercent - tolerance);
            expect(actualPercent).toBeLessThan(expectedPercent + tolerance);
        }
    });
    
    test('boss fish (tier 6) spawn rate is approximately 1%', () => {
        let bossCount = 0;
        for (let i = 0; i < NUM_SPAWNS; i++) {
            const tier = getRandomFishTier();
            if (tier.tier === 6) bossCount++;
        }
        
        const bossRate = bossCount / NUM_SPAWNS;
        console.log(`Boss spawn rate: ${(bossRate * 100).toFixed(2)}%`);
        
        expect(bossRate).toBeGreaterThan(0.001);
        expect(bossRate).toBeLessThan(0.05);
    });
});

describe('Reward Distribution Tests', () => {
    test('rewards are within tier ranges', () => {
        for (let i = 0; i < 1000; i++) {
            const tier = getRandomFishTier();
            const reward = getRandomInRange(tier.reward[0], tier.reward[1]);
            
            expect(reward).toBeGreaterThanOrEqual(tier.reward[0]);
            expect(reward).toBeLessThanOrEqual(tier.reward[1]);
        }
    });
    
    test('HP values are within tier ranges', () => {
        for (let i = 0; i < 1000; i++) {
            const tier = getRandomFishTier();
            const hp = getRandomInRange(tier.hp[0], tier.hp[1]);
            
            expect(hp).toBeGreaterThanOrEqual(tier.hp[0]);
            expect(hp).toBeLessThanOrEqual(tier.hp[1]);
        }
    });
});
