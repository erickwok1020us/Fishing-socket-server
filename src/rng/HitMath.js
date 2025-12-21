/**
 * HitMath - Server-Side Authoritative Hit Calculation
 * 
 * Contains all RTP calculation and hit determination logic.
 * This module is the ONLY place where shot outcomes are determined.
 * 
 * Security Requirements:
 * - All calculations use CSPRNG
 * - Client input never influences random outcomes
 * - RTP values are server-authoritative
 */

const { secureRandom } = require('./CSPRNG');

/**
 * Game Configuration - Server Authoritative
 * These values match the PDF specification
 */
const GAME_CONFIG = {
    // Weapon RTP values - Updated configuration
    // 1x: 91%, 3x: 93%, 5x: 94%, 8x: 95%
    WEAPONS: [
        { id: 1, key: '1x', multiplier: 1, cost: 1, rtp: 0.91, damage: 1, features: [] },
        { id: 2, key: '3x', multiplier: 3, cost: 3, rtp: 0.93, damage: 3, features: [] },
        { id: 3, key: '5x', multiplier: 5, cost: 5, rtp: 0.94, damage: 5, features: [] },
        { id: 4, key: '8x', multiplier: 8, cost: 8, rtp: 0.95, damage: 8, features: [] }
    ],
    
    // Fish types from PDF specification
    FISH_TYPES: [
        { type: 'small', id: 1, hpRange: [20, 30], rewardRange: [2, 3], spawnRate: 0.40, speed: 'fast' },
        { type: 'common', id: 2, hpRange: [50, 80], rewardRange: [5, 8], spawnRate: 0.30, speed: 'medium' },
        { type: 'medium', id: 3, hpRange: [100, 150], rewardRange: [10, 15], spawnRate: 0.15, speed: 'slow' },
        { type: 'large', id: 4, hpRange: [200, 300], rewardRange: [20, 30], spawnRate: 0.10, speed: 'slow' },
        { type: 'rare', id: 5, hpRange: [400, 600], rewardRange: [40, 60], spawnRate: 0.04, speed: 'medium' },
        { type: 'boss', id: 6, hpRange: [1000, 2000], rewardRange: [100, 200], spawnRate: 0.01, speed: 'slow' }
    ],
    
    // Scene configuration
    SCENE: {
        SIZE: { width: 100, depth: 100, height: 30 },
        MIN_FISH_COUNT: 40,
        MAX_FISH_COUNT: 60,
        TARGET_FISH_COUNT: 50,
        RESPAWN_COOLDOWN_MS: 2000,
        MAX_BATCH_RESPAWN: 10
    },
    
    // Boss system
    BOSS_SYSTEM: {
        SPAWN_INTERVAL_SECONDS: 60,
        DEFAULT_BOSS_HP_RANGE: [1000, 2000],
        DEFAULT_BOSS_REWARD_RANGE: [100, 200]
    },
    
    // RTP adjustment (dynamic balancing)
    RTP_ADJUSTMENT: {
        ENABLED: true,
        THRESHOLD_PERCENT: 5,
        ADJUSTMENT_RATE_PER_SHOT: 0.001
    },
    
    // Penetrating damage multipliers (for future use)
    PENETRATING_DAMAGE_MULTIPLIERS: [1.0, 0.8, 0.6, 0.4, 0.2]
};

/**
 * Get weapon configuration by key
 * @param {string} weaponKey - Weapon key (e.g., '1x', '3x', etc.)
 * @returns {Object|null} Weapon configuration
 */
function getWeaponConfig(weaponKey) {
    return GAME_CONFIG.WEAPONS.find(w => w.key === weaponKey) || null;
}

/**
 * Get fish type configuration
 * @param {string} fishType - Fish type (e.g., 'small', 'common', etc.)
 * @returns {Object|null} Fish type configuration
 */
function getFishTypeConfig(fishType) {
    return GAME_CONFIG.FISH_TYPES.find(f => f.type === fishType) || null;
}

/**
 * Calculate authoritative hit determination
 * This is the core RTP calculation function - MUST use CSPRNG
 * 
 * @param {number} weaponRTP - Weapon's base RTP (0-1)
 * @param {number} fishDistance - Distance from cannon to fish
 * @param {number} maxDistance - Maximum possible distance
 * @param {number} fishSize - Size of the fish
 * @param {number} maxFishSize - Maximum fish size
 * @param {number} playerRTPAdjustment - Dynamic RTP adjustment for player (-0.05 to +0.05)
 * @returns {boolean} Whether the shot is a hit
 */
function calculateAuthoritativeHit(weaponRTP, fishDistance, maxDistance, fishSize, maxFishSize, playerRTPAdjustment = 0) {
    // Use CSPRNG for the random roll
    const random = secureRandom();
    
    // Base hit chance from weapon RTP
    const baseHitChance = weaponRTP;
    
    // Distance modifier: closer = higher hit chance (max 20% reduction at max distance)
    const distanceModifier = 1 - (fishDistance / maxDistance) * 0.2;
    
    // Size modifier: larger fish = easier to hit
    const sizeModifier = Math.min(1.0, fishSize / maxFishSize);
    
    // Apply player-specific RTP adjustment (for dynamic balancing)
    const adjustedRTP = Math.max(0.1, Math.min(1.0, baseHitChance + playerRTPAdjustment));
    
    // Calculate final hit chance
    const finalHitChance = adjustedRTP * Math.max(0.1, Math.min(1.0, distanceModifier * sizeModifier));
    
    // Determine hit
    const isHit = random < finalHitChance;
    
    return isHit;
}

/**
 * Calculate penetrating damage for 20x weapon
 * @param {number} baseDamage - Base damage of the weapon
 * @param {Array} hitFish - Array of fish entities hit (in order)
 * @returns {Array<{fishId: string, damage: number}>} Damage to apply to each fish
 */
function calculatePenetratingDamage(baseDamage, hitFish) {
    const damagesApplied = [];
    const maxPenetrations = 5;
    
    for (let i = 0; i < Math.min(hitFish.length, maxPenetrations); i++) {
        const multiplier = GAME_CONFIG.PENETRATING_DAMAGE_MULTIPLIERS[i];
        const damage = Math.floor(baseDamage * multiplier);
        damagesApplied.push({
            fishId: hitFish[i].id || hitFish[i].fishId,
            damage: damage,
            penetrationIndex: i
        });
    }
    
    return damagesApplied;
}

/**
 * Calculate player's actual RTP based on their history
 * @param {Object} playerStats - Player's game statistics
 * @returns {number} Actual RTP (0-1)
 */
function calculateActualRTP(playerStats) {
    if (!playerStats || playerStats.totalBets === 0) return 0;
    return playerStats.totalWins / playerStats.totalBets;
}

/**
 * Calculate RTP adjustment for a player
 * If player's actual RTP is below target, increase hit chance slightly
 * If player's actual RTP is above target, decrease hit chance slightly
 * 
 * @param {number} targetRTP - Target RTP for the weapon
 * @param {number} actualRTP - Player's actual RTP
 * @returns {number} Adjustment value (-0.05 to +0.05)
 */
function calculateRTPAdjustment(targetRTP, actualRTP) {
    if (!GAME_CONFIG.RTP_ADJUSTMENT.ENABLED) return 0;
    
    const deviation = actualRTP - targetRTP;
    const threshold = GAME_CONFIG.RTP_ADJUSTMENT.THRESHOLD_PERCENT / 100;
    
    // Only adjust if deviation exceeds threshold
    if (Math.abs(deviation) < threshold) return 0;
    
    // Calculate adjustment (opposite of deviation, capped at ±5%)
    const adjustment = -deviation * GAME_CONFIG.RTP_ADJUSTMENT.ADJUSTMENT_RATE_PER_SHOT;
    return Math.max(-0.05, Math.min(0.05, adjustment));
}

/**
 * Distribute boss rewards based on damage contribution
 * @param {number} bossReward - Total reward for killing the boss
 * @param {Array<{playerId: string, damage: number}>} playersDamage - Damage dealt by each player
 * @returns {Array<{playerId: string, reward: number}>} Rewards for each player
 */
function distributeBossRewards(bossReward, playersDamage) {
    const totalDamage = playersDamage.reduce((sum, p) => sum + p.damage, 0);
    const distributedRewards = [];
    
    if (totalDamage === 0) return [];
    
    playersDamage.forEach(player => {
        const contribution = player.damage / totalDamage;
        const reward = Math.floor(bossReward * contribution);
        distributedRewards.push({
            playerId: player.playerId,
            reward: reward,
            contribution: contribution
        });
    });
    
    return distributedRewards;
}

/**
 * Validate shot request from client
 * @param {Object} shotData - Shot data from client
 * @param {Object} playerState - Current player state
 * @param {Object} gameState - Current game state
 * @returns {{valid: boolean, error?: string}} Validation result
 */
function validateShotRequest(shotData, playerState, gameState) {
    // Check if player exists
    if (!playerState) {
        return { valid: false, error: 'Player not found' };
    }
    
    // Check weapon validity
    const weapon = getWeaponConfig(shotData.weaponKey);
    if (!weapon) {
        return { valid: false, error: 'Invalid weapon' };
    }
    
    // Check balance
    if (playerState.balance < weapon.cost) {
        return { valid: false, error: 'Insufficient balance' };
    }
    
    // Check cooldown (if applicable)
    const now = Date.now();
    if (playerState.lastShotTime && (now - playerState.lastShotTime) < weapon.cooldown) {
        return { valid: false, error: 'Weapon on cooldown' };
    }
    
    return { valid: true };
}

module.exports = {
    GAME_CONFIG,
    getWeaponConfig,
    getFishTypeConfig,
    calculateAuthoritativeHit,
    calculatePenetratingDamage,
    calculateActualRTP,
    calculateRTPAdjustment,
    distributeBossRewards,
    validateShotRequest
};
