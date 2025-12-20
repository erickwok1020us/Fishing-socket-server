/**
 * Game Configuration - Server Authoritative
 * 
 * This file contains all game configuration values as specified in the
 * Enhanced 3D Fish Shooting Game Technical Specification PDF.
 * 
 * These values are the SINGLE SOURCE OF TRUTH for the game.
 * Client should never override these values.
 */

/**
 * Weapon Configuration
 * RTP values from updated specification:
 * - 1x: 91%
 * - 3x: 93%
 * - 5x: 94%
 * - 8x: 95%
 * Note: 20x weapon removed per latest specification
 */
const WEAPONS = {
    '1x': {
        id: 1,
        key: '1x',
        multiplier: 1,
        cost: 1,
        cooldown: 200,
        damage: 1,
        rtp: 0.91,
        features: []
    },
    '3x': {
        id: 2,
        key: '3x',
        multiplier: 3,
        cost: 3,
        cooldown: 300,
        damage: 3,
        rtp: 0.93,
        features: []
    },
    '5x': {
        id: 3,
        key: '5x',
        multiplier: 5,
        cost: 5,
        cooldown: 400,
        damage: 5,
        rtp: 0.94,
        features: []
    },
    '8x': {
        id: 4,
        key: '8x',
        multiplier: 8,
        cost: 8,
        cooldown: 500,
        damage: 8,
        rtp: 0.95,
        features: []
    }
};

/**
 * Fish Species Configuration
 * HP ranges and rewards from PDF specification
 * 
 * 6-Tier System:
 * - Tier 1 (Small): HP 20-30, Reward 2-3x, Spawn 40%
 * - Tier 2 (Common): HP 50-80, Reward 5-8x, Spawn 30%
 * - Tier 3 (Medium): HP 100-150, Reward 10-15x, Spawn 15%
 * - Tier 4 (Large): HP 200-300, Reward 20-30x, Spawn 10%
 * - Tier 5 (Rare): HP 400-600, Reward 40-60x, Spawn 4%
 * - Tier 6 (Boss): HP 1000-2000, Reward 100-200x, Spawn 1%
 */
const FISH_SPECIES = {
    // Tier 1 - Small Fish (40% spawn rate)
    clownfish: {
        id: 1,
        tier: 1,
        name: 'Clownfish',
        health: 20,
        hpRange: [20, 30],
        multiplier: 2,
        rewardRange: [2, 3],
        size: 1,
        speed: 3,
        spawnWeight: 15
    },
    bluefish: {
        id: 2,
        tier: 1,
        name: 'Blue Fish',
        health: 25,
        hpRange: [20, 30],
        multiplier: 2,
        rewardRange: [2, 3],
        size: 1,
        speed: 3.5,
        spawnWeight: 15
    },
    yellowfish: {
        id: 3,
        tier: 1,
        name: 'Yellow Fish',
        health: 30,
        hpRange: [20, 30],
        multiplier: 3,
        rewardRange: [2, 3],
        size: 1,
        speed: 4,
        spawnWeight: 10
    },
    
    // Tier 2 - Common Fish (30% spawn rate)
    angelfish: {
        id: 4,
        tier: 2,
        name: 'Angelfish',
        health: 50,
        hpRange: [50, 80],
        multiplier: 5,
        rewardRange: [5, 8],
        size: 2,
        speed: 2.5,
        spawnWeight: 12
    },
    butterflyfish: {
        id: 5,
        tier: 2,
        name: 'Butterfly Fish',
        health: 60,
        hpRange: [50, 80],
        multiplier: 6,
        rewardRange: [5, 8],
        size: 2,
        speed: 2.8,
        spawnWeight: 10
    },
    parrotfish: {
        id: 6,
        tier: 2,
        name: 'Parrot Fish',
        health: 80,
        hpRange: [50, 80],
        multiplier: 8,
        rewardRange: [5, 8],
        size: 2,
        speed: 2.2,
        spawnWeight: 8
    },
    
    // Tier 3 - Medium Fish (15% spawn rate)
    lionfish: {
        id: 7,
        tier: 3,
        name: 'Lionfish',
        health: 100,
        hpRange: [100, 150],
        multiplier: 10,
        rewardRange: [10, 15],
        size: 3,
        speed: 2,
        spawnWeight: 6
    },
    pufferfish: {
        id: 8,
        tier: 3,
        name: 'Pufferfish',
        health: 120,
        hpRange: [100, 150],
        multiplier: 12,
        rewardRange: [10, 15],
        size: 3,
        speed: 1.8,
        spawnWeight: 5
    },
    seahorse: {
        id: 9,
        tier: 3,
        name: 'Seahorse',
        health: 150,
        hpRange: [100, 150],
        multiplier: 15,
        rewardRange: [10, 15],
        size: 2,
        speed: 1.5,
        spawnWeight: 4
    },
    
    // Tier 4 - Large Fish (10% spawn rate)
    swordfish: {
        id: 10,
        tier: 4,
        name: 'Swordfish',
        health: 200,
        hpRange: [200, 300],
        multiplier: 20,
        rewardRange: [20, 30],
        size: 5,
        speed: 3,
        spawnWeight: 4
    },
    manta: {
        id: 11,
        tier: 4,
        name: 'Manta Ray',
        health: 250,
        hpRange: [200, 300],
        multiplier: 25,
        rewardRange: [20, 30],
        size: 6,
        speed: 1.5,
        spawnWeight: 3
    },
    hammerhead: {
        id: 12,
        tier: 4,
        name: 'Hammerhead Shark',
        health: 300,
        hpRange: [200, 300],
        multiplier: 30,
        rewardRange: [20, 30],
        size: 6,
        speed: 2,
        spawnWeight: 3
    },
    
    // Tier 5 - Rare Fish (4% spawn rate)
    orca: {
        id: 13,
        tier: 5,
        name: 'Orca',
        health: 400,
        hpRange: [400, 600],
        multiplier: 40,
        rewardRange: [40, 60],
        size: 8,
        speed: 2,
        spawnWeight: 2
    },
    giantSquid: {
        id: 14,
        tier: 5,
        name: 'Giant Squid',
        health: 500,
        hpRange: [400, 600],
        multiplier: 50,
        rewardRange: [40, 60],
        size: 7,
        speed: 1.5,
        spawnWeight: 1.5
    },
    goldenDragon: {
        id: 15,
        tier: 5,
        name: 'Golden Dragon Fish',
        health: 600,
        hpRange: [400, 600],
        multiplier: 60,
        rewardRange: [40, 60],
        size: 6,
        speed: 2.5,
        spawnWeight: 0.5,
        isSpecial: true,
        specialType: 'golden'
    },
    
    // Tier 6 - Boss Fish (1% spawn rate)
    blueWhale: {
        id: 16,
        tier: 6,
        name: 'Blue Whale',
        health: 1000,
        hpRange: [1000, 2000],
        multiplier: 100,
        rewardRange: [100, 200],
        size: 15,
        speed: 0.8,
        spawnWeight: 0.7,
        isBoss: true
    },
    greatWhiteShark: {
        id: 17,
        tier: 6,
        name: 'Great White Shark',
        health: 1500,
        hpRange: [1000, 2000],
        multiplier: 150,
        rewardRange: [100, 200],
        size: 12,
        speed: 1.2,
        spawnWeight: 0.3,
        isBoss: true
    },
    
    // Special Fish
    bombFish: {
        id: 18,
        tier: 3,
        name: 'Bomb Fish',
        health: 80,
        hpRange: [80, 120],
        multiplier: 0,
        rewardRange: [0, 0],
        size: 3,
        speed: 1.5,
        spawnWeight: 2,
        isSpecial: true,
        specialType: 'bomb',
        explosionRadius: 15,
        explosionDamage: 50
    }
};

/**
 * Scene Configuration
 */
const SCENE_CONFIG = {
    SIZE: {
        width: 100,
        depth: 100,
        height: 30
    },
    FISH_COUNTS: {
        MIN: 40,
        MAX: 60,
        TARGET: 50
    },
    RESPAWN: {
        COOLDOWN_MS: 2000,
        MAX_BATCH: 10
    },
    BOUNDS: {
        minX: -50,
        maxX: 50,
        minZ: -50,
        maxZ: 50
    }
};

/**
 * Boss System Configuration
 */
const BOSS_CONFIG = {
    SPAWN_INTERVAL_SECONDS: 60,
    WAVE_DURATION_SECONDS: 120,
    HP_MULTIPLIER: 1.5,
    REWARD_MULTIPLIER: 2.0
};

/**
 * RTP Adjustment Configuration (Dynamic Balancing)
 */
const RTP_ADJUSTMENT_CONFIG = {
    ENABLED: true,
    THRESHOLD_PERCENT: 5,
    ADJUSTMENT_RATE_PER_SHOT: 0.001,
    MAX_ADJUSTMENT: 0.05
};

/**
 * Security Configuration
 */
const SECURITY_CONFIG = {
    SESSION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
    NONCE_WINDOW_SIZE: 1000,
    MAX_PACKETS_PER_SECOND: 60,
    RATE_LIMIT_WINDOW_MS: 1000
};

/**
 * Network Configuration
 */
const NETWORK_CONFIG = {
    TICK_RATE: 60,
    NET_RATE: 20,
    BULLET_SPEED: 80,
    BULLET_LIFETIME: 3000,
    FISH_SPEED_SCALE: 0.15
};

/**
 * Get weapon by key
 */
function getWeapon(key) {
    return WEAPONS[key] || null;
}

/**
 * Get fish species by name
 */
function getFishSpecies(name) {
    return FISH_SPECIES[name] || null;
}

/**
 * Get all fish species as array
 */
function getAllFishSpecies() {
    return Object.entries(FISH_SPECIES).map(([key, value]) => ({
        ...value,
        typeName: key
    }));
}

/**
 * Get fish species by tier
 */
function getFishByTier(tier) {
    return Object.entries(FISH_SPECIES)
        .filter(([_, fish]) => fish.tier === tier)
        .map(([key, value]) => ({
            ...value,
            typeName: key
        }));
}

/**
 * Calculate spawn weights for weighted random selection
 */
function getSpawnWeights() {
    const weights = [];
    for (const [typeName, fish] of Object.entries(FISH_SPECIES)) {
        if (!fish.isBoss) { // Bosses spawn separately
            weights.push({
                item: { ...fish, typeName },
                weight: fish.spawnWeight
            });
        }
    }
    return weights;
}

module.exports = {
    WEAPONS,
    FISH_SPECIES,
    SCENE_CONFIG,
    BOSS_CONFIG,
    RTP_ADJUSTMENT_CONFIG,
    SECURITY_CONFIG,
    NETWORK_CONFIG,
    getWeapon,
    getFishSpecies,
    getAllFishSpecies,
    getFishByTier,
    getSpawnWeights
};
