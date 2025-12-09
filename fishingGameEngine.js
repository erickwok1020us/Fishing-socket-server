/**
 * Fishing Game Engine - Server-Authoritative
 * Adapted from Pudge Wars GameEngine
 * 
 * Preserves:
 * - Server-authoritative architecture
 * - Snapshot interpolation for fish movement (like opponent movement)
 * - Bullet logic (adapted from knife logic)
 * - Lag compensation for hit detection
 * - Room/host/guest management
 * 
 * New Features:
 * - Fish spawning and movement system
 * - Coin/betting system (1-1000 per shot)
 * - Casino mechanics (jackpot, multipliers, special fish)
 */

const { monitorEventLoopDelay, performance } = require('perf_hooks');

/**
 * SCI-FI OCEAN UNIT CONFIGURATION
 * All units are sci-fi themed: drones, mech-fish, energy creatures, and bosses
 * 
 * Tiers:
 * - NORMAL: Small drones/energy orbs, low HP, high spawn rate, 2x-5x multiplier
 * - MEDIUM: Larger mech-fish, medium HP, interesting movement, 5x-20x multiplier  
 * - BOSS: Massive sci-fi creatures, high HP, special VFX, 50x-200x multiplier
 * 
 * Casino Structure:
 * - Bet levels: 1, 10, 100
 * - Reward = bet × multiplier
 */

/**
 * FISH SPECIES SYSTEM (Industry Standard - Ocean King / Jili Style)
 * Based on market research: Ocean King, Jili Jackpot Fishing, Fish Catch
 * 
 * Categories:
 * - SMALL: 2x-10x multiplier, 1-3 HP, 60% spawn rate
 * - MEDIUM: 15x-50x multiplier, 5-10 HP, 30% spawn rate
 * - LARGE: 60x-200x multiplier, 15-30 HP, 8% spawn rate
 * - BOSS: 250x-1000x multiplier, 50-100 HP, 2% spawn rate (or triggered)
 * - SPECIAL: Trigger special events and bonuses
 */

const FISH_SPECIES = {
    // ============ SMALL FISH (60% spawn rate) ============
    // Low value, high frequency - maintain player capital
    
    CLOWNFISH: {
        id: 1,
        name: 'Clownfish',
        category: 'small',
        tier: 'normal',
        health: 1,
        multiplier: 2,
        speed: 100,
        size: 0.8,
        spawnWeight: 20,
        color: 0xFF6600,  // Orange with white stripes
        movementPattern: 'straight',
        description: 'Common clownfish - easy target'
    },
    SARDINE: {
        id: 2,
        name: 'Sardine',
        category: 'small',
        tier: 'normal',
        health: 1,
        multiplier: 3,
        speed: 120,
        size: 0.6,
        spawnWeight: 18,
        color: 0xC0C0C0,  // Silver
        movementPattern: 'straight',
        description: 'Fast-swimming sardine'
    },
    MULLET: {
        id: 3,
        name: 'Mullet',
        category: 'small',
        tier: 'normal',
        health: 2,
        multiplier: 5,
        speed: 80,
        size: 1.0,
        spawnWeight: 15,
        color: 0x808080,  // Gray
        movementPattern: 'curve',
        description: 'Gray mullet with curved path'
    },
    BUTTERFLY_FISH: {
        id: 4,
        name: 'Butterfly Fish',
        category: 'small',
        tier: 'normal',
        health: 2,
        multiplier: 8,
        speed: 70,
        size: 1.0,
        spawnWeight: 12,
        color: 0xFFFF00,  // Yellow
        movementPattern: 'curve',
        description: 'Colorful butterfly fish'
    },
    ANGELFISH: {
        id: 5,
        name: 'Angelfish',
        category: 'small',
        tier: 'normal',
        health: 3,
        multiplier: 10,
        speed: 60,
        size: 1.2,
        spawnWeight: 10,
        color: 0x00BFFF,  // Deep sky blue
        movementPattern: 'curve',
        description: 'Elegant angelfish'
    },
    
    // ============ MEDIUM FISH (30% spawn rate) ============
    // Medium value, strategic targets
    
    LIONFISH: {
        id: 6,
        name: 'Lionfish',
        category: 'medium',
        tier: 'medium',
        health: 5,
        multiplier: 15,
        speed: 50,
        size: 1.8,
        spawnWeight: 8,
        color: 0xFF4500,  // Red-orange with stripes
        movementPattern: 's_curve',
        description: 'Venomous lionfish with spines'
    },
    FUGU: {
        id: 7,
        name: 'Fugu (Pufferfish)',
        category: 'medium',
        tier: 'medium',
        health: 6,
        multiplier: 20,
        speed: 40,
        size: 2.0,
        spawnWeight: 6,
        color: 0xFFA500,  // Orange
        movementPattern: 's_curve',
        description: 'Inflatable pufferfish'
    },
    BARRACUDA: {
        id: 8,
        name: 'Barracuda',
        category: 'medium',
        tier: 'medium',
        health: 10,
        multiplier: 50,
        speed: 90,
        size: 2.5,
        spawnWeight: 4,
        color: 0x4682B4,  // Steel blue
        movementPattern: 'straight_fast',
        description: 'Fast predatory barracuda'
    },
    
    // ============ LARGE FISH (8% spawn rate) ============
    // High value, low frequency - high-risk high-reward
    
    SHARK: {
        id: 9,
        name: 'Shark',
        category: 'large',
        tier: 'large',
        health: 15,
        multiplier: 60,
        speed: 55,
        size: 3.5,
        spawnWeight: 3,
        color: 0x708090,  // Slate gray
        movementPattern: 'wide_arc',
        description: 'Dangerous great white shark'
    },
    OCTOPUS: {
        id: 10,
        name: 'Octopus',
        category: 'large',
        tier: 'large',
        health: 20,
        multiplier: 100,
        speed: 35,
        size: 3.0,
        spawnWeight: 2,
        color: 0x800080,  // Purple
        movementPattern: 'zigzag',
        description: 'Eight-armed octopus'
    },
    MERMAID: {
        id: 11,
        name: 'Mermaid',
        category: 'large',
        tier: 'large',
        health: 25,
        multiplier: 150,
        speed: 45,
        size: 3.5,
        spawnWeight: 1.5,
        color: 0x00CED1,  // Dark cyan / teal
        movementPattern: 'graceful',
        description: 'Mythical mermaid - high value'
    },
    KILLER_WHALE: {
        id: 12,
        name: 'Killer Whale',
        category: 'large',
        tier: 'large',
        health: 30,
        multiplier: 200,
        speed: 50,
        size: 4.5,
        spawnWeight: 1,
        color: 0x000000,  // Black with white patches
        movementPattern: 'wide_arc',
        description: 'Massive orca - top predator'
    },
    
    // ============ BOSS FISH (2% spawn rate or triggered) ============
    // Ultra rare, massive rewards, jackpot potential
    
    GOLDEN_DRAGON: {
        id: 13,
        name: 'Golden Dragon',
        category: 'boss',
        tier: 'boss',
        health: 50,
        multiplier: 250,
        speed: 40,
        size: 6.0,
        spawnWeight: 0.3,
        isBoss: true,
        color: 0xFFD700,  // Gold
        movementPattern: 'complex',
        description: 'Legendary golden dragon'
    },
    GIANT_FISH_MONSTER: {
        id: 14,
        name: 'Giant Fish Monster',
        category: 'boss',
        tier: 'boss',
        health: 80,
        multiplier: 500,
        speed: 30,
        size: 8.0,
        spawnWeight: 0.15,
        isBoss: true,
        color: 0x8B0000,  // Dark red
        movementPattern: 'complex',
        description: 'Terrifying deep sea monster'
    },
    SEA_KING: {
        id: 15,
        name: 'Sea King',
        category: 'boss',
        tier: 'boss',
        health: 100,
        multiplier: 1000,
        speed: 25,
        size: 10.0,
        spawnWeight: 0.05,
        isBoss: true,
        isLegendary: true,
        color: 0x00FF7F,  // Spring green with crown
        movementPattern: 'majestic',
        description: 'JACKPOT BOSS - King of the Ocean'
    },
    
    // ============ SPECIAL FEATURE FISH ============
    // Trigger special events and bonuses
    
    BOMB_CRAB: {
        id: 16,
        name: 'Bomb Crab',
        category: 'special',
        tier: 'special',
        health: 5,
        multiplier: 30,
        speed: 25,
        size: 1.5,
        spawnWeight: 1,
        isSpecial: true,
        specialType: 'bomb',
        color: 0xFF0000,  // Red
        movementPattern: 'slow',
        description: 'Explodes and damages nearby fish'
    },
    LASER_CRAB: {
        id: 17,
        name: 'Laser Crab',
        category: 'special',
        tier: 'special',
        health: 6,
        multiplier: 35,
        speed: 20,
        size: 1.8,
        spawnWeight: 0.8,
        isSpecial: true,
        specialType: 'laser',
        color: 0x00FFFF,  // Cyan
        movementPattern: 'slow',
        description: 'Shoots laser across screen when killed'
    },
    GOLDFISH: {
        id: 18,
        name: 'Goldfish',
        category: 'special',
        tier: 'special',
        health: 3,
        multiplier: 250,
        speed: 80,
        size: 1.2,
        spawnWeight: 0.5,
        isSpecial: true,
        specialType: 'bonus',
        color: 0xFFD700,  // Gold
        movementPattern: 'erratic',
        description: 'Triggers bonus round when caught'
    }
};

// Backward compatibility alias
const SCI_FI_UNITS = FISH_SPECIES;

// Backward compatibility alias
const FISH_TYPES = SCI_FI_UNITS;

// Calculate total spawn weight for probability
const TOTAL_SPAWN_WEIGHT = Object.values(FISH_TYPES).reduce((sum, fish) => sum + fish.spawnWeight, 0);

/**
 * Global event loop monitoring (singleton)
 */
function ensureEventLoopMonitors() {
    if (!global.__EL_MON__) {
        try {
            const h = monitorEventLoopDelay({ resolution: 20 });
            h.enable();
            
            let eluPrev = null;
            if (performance && typeof performance.eventLoopUtilization === 'function') {
                eluPrev = performance.eventLoopUtilization();
            }
            
            const latest = { p50: 0, p95: 0, p99: 0, elu: 0 };
            const timer = setInterval(() => {
                const p50 = typeof h.percentile === 'function' ? h.percentile(50) / 1e6 : h.mean / 1e6;
                const p95 = typeof h.percentile === 'function' ? h.percentile(95) / 1e6 : Math.max(h.mean / 1e6, h.max / 1e6);
                const p99 = typeof h.percentile === 'function' ? h.percentile(99) / 1e6 : Math.max(h.mean / 1e6, h.max / 1e6);
                
                if (eluPrev !== null && performance && typeof performance.eventLoopUtilization === 'function') {
                    const eluNow = performance.eventLoopUtilization(eluPrev);
                    eluPrev = eluNow;
                    latest.elu = eluNow.utilization;
                }
                
                latest.p50 = p50;
                latest.p95 = p95;
                latest.p99 = p99;
                h.reset();
            }, 5000);
            global.__EL_MON__ = { h, latest, timer };
            console.log('[FISHING-ENGINE] Event loop monitoring initialized');
        } catch (err) {
            console.log('[FISHING-ENGINE] Event loop monitoring failed:', err.message);
            global.__EL_MON__ = { h: null, latest: { p50: 0, p95: 0, p99: 0, elu: 0 }, timer: null };
        }
    }
    return global.__EL_MON__;
}

class FishingGameEngine {
    constructor(roomCode) {
        this.roomCode = roomCode;
        
        // Player management (turrets)
        this.players = new Map(); // socketId -> player data
        this.gameStarted = false;
        this.serverTick = 0;
        
        // Fish management
        this.fish = new Map(); // fishId -> fish data
        this.nextFishId = 1;
        this.maxFish = 30; // Maximum fish on screen
        this.fishSpawnInterval = 2000; // Spawn new fish every 2 seconds
        this.lastFishSpawn = 0;
        
        // Bullet management (adapted from knife logic)
        this.bullets = new Map(); // bulletId -> bullet data
        this.nextBulletId = 1;
        
        // Casino mechanics
        this.jackpot = 1000; // Starting jackpot
        this.jackpotContribution = 0.05; // 5% of bets go to jackpot
        this.comboMultipliers = new Map(); // playerId -> { combo: number, lastKillTime: number }
        this.comboTimeout = 3000; // Combo resets after 3 seconds
        
        // Game constants (adapted from Pudge Wars)
        this.BULLET_SPEED = 275; // Same as knife speed
        this.BULLET_LIFETIME = 5000; // Bullets last 5 seconds
        
        // Collision detection - derived from actual mesh dimensions
        // Fish body: SphereGeometry(1.5 * scale) then scaled by (1.5, 0.8, 1) = effective radius ~2.25 * scale
        // Bullet: SphereGeometry(0.5) = radius 0.5
        this.FISH_BASE_RADIUS = 2.25; // Matches Three.js fish body geometry
        this.BULLET_RADIUS = 0.5;     // Matches Three.js bullet geometry
        this.COLLISION_FUDGE = 0.3;   // Small buffer for network/timestep issues
        
        // Map bounds (ocean area)
        // Z range reduced by 30% from bottom (maxZ: 60 -> 42) to create gap above BET panel
        this.MAP_BOUNDS = { 
            minX: -80, maxX: 80, 
            minZ: -60, maxZ: 42 
        };
        
        // Turret positions at the edge of the pool (4 positions - arcade cabinet style)
        // Each turret faces toward the center of the pool
        // Pool bounds: x∈[-80,80], z∈[-60,42] - turrets placed at edge with small margin
        // Layout: Top, Left, Right, Bottom (player at bottom)
        const EDGE_MARGIN = 2; // Small margin from absolute edge
        this.TURRET_POSITIONS = [
            { x: 0, z: this.MAP_BOUNDS.maxZ - EDGE_MARGIN },       // Position 1: Bottom center (player default)
            { x: 0, z: this.MAP_BOUNDS.minZ + EDGE_MARGIN },       // Position 2: Top center (AI)
            { x: this.MAP_BOUNDS.minX + EDGE_MARGIN, z: -10 },     // Position 3: Left side (AI)
            { x: this.MAP_BOUNDS.maxX - EDGE_MARGIN, z: -10 }      // Position 4: Right side (AI)
        ];
        
        // AI turret management for Single Player mode
        this.aiTurrets = new Map(); // playerId -> AI turret data
        this.isSinglePlayer = false;
        this.AI_ACCURACY = 0.6; // 60% accurate shots (50-70% effective hit rate)
        this.AI_MISS_ANGLE_MIN = 8; // Minimum miss angle in degrees
        this.AI_MISS_ANGLE_MAX = 20; // Maximum miss angle in degrees
        this.AI_SHOT_INTERVAL_MIN = 800; // Minimum time between AI shots (ms)
        this.AI_SHOT_INTERVAL_MAX = 2000; // Maximum time between AI shots (ms)
        
        // ============ BOSS WAVE SYSTEM ============
        // Boss waves trigger periodically and spawn powerful bosses
        this.bossWaveActive = false;
        this.bossWaveStartTime = 0;
        this.bossWaveDuration = 30000; // Boss wave lasts 30 seconds
        this.normalWaveDuration = 60000; // Normal wave lasts 60 seconds before boss wave
        this.lastWaveChange = 0;
        this.killsSinceLastBoss = 0;
        this.killsToTriggerBoss = 50; // Trigger boss wave after 50 kills
        this.currentBoss = null; // Track active boss
        this.bossTypes = ['GOLDEN_DRAGON', 'GIANT_FISH_MONSTER', 'SEA_KING'];
        
        ensureEventLoopMonitors();
        
        // Tick rates (same as Pudge Wars for consistency)
        this.TICK_RATE = 60;
        this.NETWORK_UPDATE_RATE = 20;
        
        this.tickIntervalNs = BigInt(Math.floor(1_000_000_000 / this.TICK_RATE));
        this.netIntervalNs = BigInt(Math.floor(1_000_000_000 / this.NETWORK_UPDATE_RATE));
        this.nextTickNs = 0n;
        this.nextNetNs = 0n;
        
        this.loopRunning = false;
        this.gameLoopInterval = null;
        
        console.log(`[FISHING-ENGINE] Room ${roomCode} initialized - Tick: ${this.TICK_RATE}Hz, Network: ${this.NETWORK_UPDATE_RATE}Hz`);
    }
    
    /**
     * Add a player (turret) to the game
     */
    addPlayer(socketId, playerId, isAI = false) {
        const turretPosition = this.TURRET_POSITIONS[playerId - 1] || { x: 0, z: 55 };
        
        // Calculate rotation to face center of pool (0, 0)
        const turretRotation = Math.atan2(-turretPosition.x, -turretPosition.z);
        
        const playerData = {
            socketId: isAI ? `ai-${playerId}` : socketId,
            playerId,
            isAI,
            coins: 10000, // Starting coins
            totalWinnings: 0,
            totalBets: 0,
            currentBet: 10, // Default bet amount
            turretX: turretPosition.x,
            turretZ: turretPosition.z,
            turretRotation: turretRotation, // Face toward center
            lastShotTime: 0,
            shotCooldown: isAI ? 500 : 200, // AI has slightly longer cooldown
            combo: 0,
            lastKillTime: 0,
            // AI-specific properties
            nextShotTime: isAI ? Date.now() + Math.random() * 2000 : 0
        };
        
        if (isAI) {
            this.aiTurrets.set(playerId, playerData);
        } else {
            this.players.set(socketId, playerData);
        }
        
        console.log(`[FISHING-ENGINE] ${isAI ? 'AI' : 'Player'} ${playerId} added at turret position (${turretPosition.x}, ${turretPosition.z})`);
    }
    
    /**
     * Initialize AI turrets for Single Player mode
     * Creates 3 AI turrets at positions 2-4 (player is at position 1)
     * Layout: Player at bottom, AI at top, left, right
     */
    initializeAITurrets() {
        this.isSinglePlayer = true;
        
        // Add 3 AI turrets at positions 2-4 (top, left, right)
        for (let i = 2; i <= 4; i++) {
            this.addPlayer(null, i, true);
        }
        
        console.log(`[FISHING-ENGINE] Initialized 3 AI turrets for Single Player mode (4-seat arcade style)`);
    }
    
    /**
     * Remove all AI turrets (when switching to multiplayer)
     */
    removeAITurrets() {
        this.aiTurrets.clear();
        this.isSinglePlayer = false;
        console.log(`[FISHING-ENGINE] Removed all AI turrets`);
    }
    
    /**
     * Update AI turrets - called each game tick
     * AI turrets automatically shoot at fish with 60% accuracy
     */
    updateAITurrets(io) {
        if (!this.isSinglePlayer || this.aiTurrets.size === 0) return;
        
        const now = Date.now();
        
        for (const [playerId, ai] of this.aiTurrets.entries()) {
            // Check if it's time for this AI to shoot
            if (now < ai.nextShotTime) continue;
            
            // Check if AI has enough coins
            if (ai.coins < ai.currentBet) continue;
            
            // Find a target fish
            const targetFish = this.findAITarget(ai);
            if (!targetFish) continue;
            
            // Determine if this shot is accurate or a miss
            const isAccurate = Math.random() < this.AI_ACCURACY;
            
            let targetX, targetZ;
            
            if (isAccurate) {
                // Accurate shot - aim directly at fish with slight lead
                const leadTime = 0.3; // Lead the target slightly
                targetX = targetFish.x + targetFish.velocityX * leadTime;
                targetZ = targetFish.z + targetFish.velocityZ * leadTime;
            } else {
                // Miss shot - add angle drift
                const missAngleDeg = this.AI_MISS_ANGLE_MIN + 
                    Math.random() * (this.AI_MISS_ANGLE_MAX - this.AI_MISS_ANGLE_MIN);
                const missAngleRad = (missAngleDeg * Math.PI / 180) * (Math.random() < 0.5 ? 1 : -1);
                
                // Calculate direction to fish
                const dx = targetFish.x - ai.turretX;
                const dz = targetFish.z - ai.turretZ;
                const baseAngle = Math.atan2(dx, dz);
                
                // Apply miss angle
                const missedAngle = baseAngle + missAngleRad;
                const distance = Math.sqrt(dx * dx + dz * dz);
                
                targetX = ai.turretX + Math.sin(missedAngle) * distance;
                targetZ = ai.turretZ + Math.cos(missedAngle) * distance;
            }
            
            // Fire the AI bullet
            this.fireAIBullet(ai, targetX, targetZ, io);
            
            // Schedule next shot with random interval
            const nextInterval = this.AI_SHOT_INTERVAL_MIN + 
                Math.random() * (this.AI_SHOT_INTERVAL_MAX - this.AI_SHOT_INTERVAL_MIN);
            ai.nextShotTime = now + nextInterval;
        }
    }
    
    /**
     * Find a target fish for AI to shoot at
     * Prefers closer fish and higher value fish
     */
    findAITarget(ai) {
        if (this.fish.size === 0) return null;
        
        let bestTarget = null;
        let bestScore = -Infinity;
        
        for (const fish of this.fish.values()) {
            // Calculate distance from AI turret to fish
            const dx = fish.x - ai.turretX;
            const dz = fish.z - ai.turretZ;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            // Skip fish that are too far or behind the turret
            if (distance > 120) continue;
            
            // Score based on distance (closer is better) and reward (higher is better)
            // Also consider fish health (prefer fish that can be killed with fewer shots)
            const distanceScore = 100 - distance;
            const rewardScore = fish.baseReward * 2;
            const healthScore = (fish.maxHealth - fish.health + 1) * 10; // Prefer damaged fish
            
            const totalScore = distanceScore + rewardScore + healthScore + Math.random() * 20;
            
            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestTarget = fish;
            }
        }
        
        return bestTarget;
    }
    
    /**
     * Fire a bullet from an AI turret
     */
    fireAIBullet(ai, targetX, targetZ, io) {
        const now = Date.now();
        
        // Deduct bet from AI
        ai.coins -= ai.currentBet;
        ai.totalBets += ai.currentBet;
        
        // Contribute to jackpot
        const jackpotContrib = Math.floor(ai.currentBet * this.jackpotContribution);
        this.jackpot += jackpotContrib;
        
        ai.lastShotTime = now;
        
        // Calculate bullet direction
        const dx = targetX - ai.turretX;
        const dz = targetZ - ai.turretZ;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < 0.1) return null;
        
        const normalizedDx = dx / distance;
        const normalizedDz = dz / distance;
        
        // Update turret rotation
        ai.turretRotation = Math.atan2(dx, dz);
        
        const bulletId = this.nextBulletId++;
        const bullet = {
            bulletId,
            ownerId: ai.playerId,
            ownerSocketId: ai.socketId, // ai-X format
            betAmount: ai.currentBet,
            isAIBullet: true,
            
            x: ai.turretX,
            z: ai.turretZ,
            prevX: ai.turretX,
            prevZ: ai.turretZ,
            velocityX: normalizedDx * this.BULLET_SPEED,
            velocityZ: normalizedDz * this.BULLET_SPEED,
            rotation: ai.turretRotation,
            
            spawnTime: now,
            hasHit: false
        };
        
        this.bullets.set(bulletId, bullet);
        
        // DEBUG: Log AI bullet creation
        console.log(`[DEBUG-AI-SHOT] bulletId=${bulletId} ai=${ai.playerId} start=(${bullet.x.toFixed(1)},${bullet.z.toFixed(1)}) target=(${targetX.toFixed(1)},${targetZ.toFixed(1)}) vel=(${bullet.velocityX.toFixed(1)},${bullet.velocityZ.toFixed(1)})`);
        
        // Broadcast bullet spawn to all players
        io.to(this.roomCode).emit('bulletSpawned', {
            bulletId,
            ownerId: ai.playerId,
            x: bullet.x,
            z: bullet.z,
            velocityX: bullet.velocityX,
            velocityZ: bullet.velocityZ,
            rotation: bullet.rotation,
            betAmount: bullet.betAmount,
            isAI: true
        });
        
        return bullet;
    }
    
    /**
     * Remove a player from the game
     */
    removePlayer(socketId) {
        const player = this.players.get(socketId);
        if (player) {
            console.log(`[FISHING-ENGINE] Player ${player.playerId} removed - Final coins: ${player.coins}`);
            this.players.delete(socketId);
        }
    }
    
    /**
     * Update player socket ID on reconnect
     */
    updatePlayerSocket(oldSocketId, newSocketId) {
        const player = this.players.get(oldSocketId);
        if (player) {
            this.players.delete(oldSocketId);
            this.players.set(newSocketId, player);
            console.log(`[FISHING-ENGINE] Player ${player.playerId} socket updated`);
        }
    }
    
    /**
     * Set player's bet amount (1-1000)
     */
    setBetAmount(socketId, amount) {
        const player = this.players.get(socketId);
        if (!player) return false;
        
        const betAmount = Math.max(1, Math.min(1000, Math.floor(amount)));
        player.currentBet = betAmount;
        
        console.log(`[FISHING-ENGINE] Player ${player.playerId} set bet to ${betAmount}`);
        return true;
    }
    
    /**
     * Get random fish type based on spawn weights
     */
    getRandomFishType() {
        let random = Math.random() * TOTAL_SPAWN_WEIGHT;
        
        for (const fishType of Object.values(FISH_TYPES)) {
            random -= fishType.spawnWeight;
            if (random <= 0) {
                return fishType;
            }
        }
        
        return FISH_SPECIES.CLOWNFISH; // Fallback
    }
    
    /**
     * Generate fish path based on movement pattern
     * Supports: straight, curve, s_curve, zigzag, wide_arc, graceful, complex, majestic, erratic, slow
     */
    generateFishPath(movementPattern = 'straight') {
        // Fish enter from sides or top, swim across
        const enterSide = Math.random();
        let startX, startZ, targetX, targetZ;
        
        if (enterSide < 0.4) {
            // Enter from left
            startX = this.MAP_BOUNDS.minX - 10;
            startZ = Math.random() * (this.MAP_BOUNDS.maxZ - this.MAP_BOUNDS.minZ) + this.MAP_BOUNDS.minZ;
            targetX = this.MAP_BOUNDS.maxX + 10;
            targetZ = Math.random() * (this.MAP_BOUNDS.maxZ - this.MAP_BOUNDS.minZ) + this.MAP_BOUNDS.minZ;
        } else if (enterSide < 0.8) {
            // Enter from right
            startX = this.MAP_BOUNDS.maxX + 10;
            startZ = Math.random() * (this.MAP_BOUNDS.maxZ - this.MAP_BOUNDS.minZ) + this.MAP_BOUNDS.minZ;
            targetX = this.MAP_BOUNDS.minX - 10;
            targetZ = Math.random() * (this.MAP_BOUNDS.maxZ - this.MAP_BOUNDS.minZ) + this.MAP_BOUNDS.minZ;
        } else {
            // Enter from top
            startX = Math.random() * (this.MAP_BOUNDS.maxX - this.MAP_BOUNDS.minX) + this.MAP_BOUNDS.minX;
            startZ = this.MAP_BOUNDS.minZ - 10;
            targetX = Math.random() * (this.MAP_BOUNDS.maxX - this.MAP_BOUNDS.minX) + this.MAP_BOUNDS.minX;
            targetZ = this.MAP_BOUNDS.maxZ + 10;
        }
        
        // Movement pattern parameters
        let amplitude = 0;      // Wave amplitude for sine/curve patterns
        let frequency = 0;      // Wave frequency
        let speedModifier = 1;  // Speed adjustment
        
        switch (movementPattern) {
            case 'straight':
            case 'straight_fast':
                amplitude = 0;
                frequency = 0;
                speedModifier = movementPattern === 'straight_fast' ? 1.5 : 1;
                break;
            case 'curve':
                amplitude = 15 + Math.random() * 10;
                frequency = 0.5 + Math.random() * 0.3;
                break;
            case 's_curve':
                amplitude = 20 + Math.random() * 15;
                frequency = 1 + Math.random() * 0.5;
                break;
            case 'zigzag':
                amplitude = 25 + Math.random() * 15;
                frequency = 2 + Math.random() * 1;
                break;
            case 'wide_arc':
                amplitude = 40 + Math.random() * 20;
                frequency = 0.3 + Math.random() * 0.2;
                speedModifier = 0.8;
                break;
            case 'graceful':
                amplitude = 30 + Math.random() * 10;
                frequency = 0.4 + Math.random() * 0.2;
                speedModifier = 0.7;
                break;
            case 'complex':
                amplitude = 35 + Math.random() * 20;
                frequency = 0.8 + Math.random() * 0.4;
                speedModifier = 0.6;
                break;
            case 'majestic':
                amplitude = 50 + Math.random() * 20;
                frequency = 0.2 + Math.random() * 0.1;
                speedModifier = 0.5;
                break;
            case 'erratic':
                amplitude = 20 + Math.random() * 30;
                frequency = 3 + Math.random() * 2;
                speedModifier = 1.2;
                break;
            case 'slow':
                amplitude = 10 + Math.random() * 10;
                frequency = 0.3 + Math.random() * 0.2;
                speedModifier = 0.5;
                break;
            default:
                amplitude = 0;
                frequency = 0;
        }
        
        return { 
            startX, startZ, targetX, targetZ, 
            pattern: movementPattern,
            amplitude,
            frequency,
            speedModifier
        };
    }
    
    /**
     * Spawn a new fish/unit
     * During boss waves, spawns boss units instead of normal units
     */
    spawnFish(forceBoss = false) {
        if (this.fish.size >= this.maxFish) return null;
        
        // Determine unit type based on wave state
        let fishType;
        if (forceBoss || (this.bossWaveActive && !this.currentBoss)) {
            // Spawn a boss during boss wave
            const bossKey = this.bossTypes[Math.floor(Math.random() * this.bossTypes.length)];
            fishType = FISH_SPECIES[bossKey];
            this.currentBoss = this.nextFishId; // Track boss ID
            console.log(`[FISHING-ENGINE] BOSS WAVE: Spawning ${fishType.name}!`);
        } else {
            fishType = this.getRandomFishType();
        }
        
        // Generate path based on fish's movement pattern
        const movementPattern = fishType.movementPattern || 'straight';
        const path = this.generateFishPath(movementPattern);
        const fishId = this.nextFishId++;
        
        const dx = path.targetX - path.startX;
        const dz = path.targetZ - path.startZ;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const normalizedDx = dx / distance;
        const normalizedDz = dz / distance;
        
        // Apply speed modifier from movement pattern
        const effectiveSpeed = fishType.speed * (path.speedModifier || 1);
        
        const fish = {
            fishId,
            typeId: fishType.id,
            typeName: fishType.name,
            category: fishType.category || 'small',
            tier: fishType.tier || 'normal',
            health: fishType.health,
            maxHealth: fishType.health,
            multiplier: fishType.multiplier || fishType.baseReward || 2,
            baseReward: fishType.multiplier || fishType.baseReward || 2, // Backward compatibility
            speed: effectiveSpeed,
            size: fishType.size,
            color: fishType.color || 0x00FFFF,
            isBoss: fishType.isBoss || false,
            isLegendary: fishType.isLegendary || false,
            isSpecial: fishType.isSpecial || false,
            specialType: fishType.specialType || null,
            
            // Position and movement
            x: path.startX,
            z: path.startZ,
            targetX: path.targetX,
            targetZ: path.targetZ,
            velocityX: normalizedDx * effectiveSpeed,
            velocityZ: normalizedDz * effectiveSpeed,
            rotation: Math.atan2(dx, dz),
            
            // Path pattern with new parameters
            pattern: path.pattern,
            patternPhase: Math.random() * Math.PI * 2,
            patternAmplitude: path.amplitude || 5 + Math.random() * 10,
            patternFrequency: path.frequency || 0.5,
            
            spawnTime: Date.now()
        };
        
        this.fish.set(fishId, fish);
        
        if (fishType.isBoss) {
            console.log(`[FISHING-ENGINE] BOSS SPAWNED: ${fishType.name} (ID: ${fishId}, HP: ${fishType.health}, Multiplier: ${fishType.multiplier}x)`);
        } else if (fishType.isLegendary) {
            console.log(`[FISHING-ENGINE] LEGENDARY SPAWNED: ${fishType.name} (ID: ${fishId})`);
        } else if (fishType.isSpecial) {
            console.log(`[FISHING-ENGINE] SPECIAL FISH: ${fishType.name} (ID: ${fishId}, Type: ${fishType.specialType})`);
        }
        
        return fish;
    }
    
    /**
     * Check and update boss wave state
     * Called every game tick
     */
    updateBossWaveState() {
        const now = Date.now();
        
        // Initialize wave timer on first call
        if (this.lastWaveChange === 0) {
            this.lastWaveChange = now;
        }
        
        if (this.bossWaveActive) {
            // Check if boss wave should end
            if (now - this.bossWaveStartTime > this.bossWaveDuration || !this.currentBoss) {
                this.endBossWave();
            }
        } else {
            // Check if boss wave should start
            const timeSinceLastWave = now - this.lastWaveChange;
            const shouldTriggerByTime = timeSinceLastWave > this.normalWaveDuration;
            const shouldTriggerByKills = this.killsSinceLastBoss >= this.killsToTriggerBoss;
            
            if (shouldTriggerByTime || shouldTriggerByKills) {
                this.startBossWave();
            }
        }
    }
    
    /**
     * Start a boss wave
     */
    startBossWave() {
        this.bossWaveActive = true;
        this.bossWaveStartTime = Date.now();
        this.killsSinceLastBoss = 0;
        console.log('[FISHING-ENGINE] === BOSS WAVE STARTED ===');
        
        // Spawn the boss immediately
        this.spawnFish(true);
    }
    
    /**
     * End the boss wave
     */
    endBossWave() {
        this.bossWaveActive = false;
        this.currentBoss = null;
        this.lastWaveChange = Date.now();
        console.log('[FISHING-ENGINE] === BOSS WAVE ENDED ===');
    }
    
    /**
     * Track kills for boss wave trigger
     */
    onFishKilled(fish) {
        if (!fish.isBoss) {
            this.killsSinceLastBoss++;
        } else {
            // Boss was killed - end boss wave
            if (fish.fishId === this.currentBoss) {
                console.log(`[FISHING-ENGINE] BOSS DEFEATED: ${fish.typeName}!`);
                this.currentBoss = null;
            }
        }
    }
    
    /**
     * Handle bullet shot from player (adapted from knife throw)
     */
    handleBulletShot(socketId, targetX, targetZ, io) {
        const player = this.players.get(socketId);
        if (!player) return null;
        
        const now = Date.now();
        
        // Check cooldown
        if (now - player.lastShotTime < player.shotCooldown) {
            return null;
        }
        
        // Check if player has enough coins
        if (player.coins < player.currentBet) {
            io.to(socketId).emit('insufficientCoins', {
                required: player.currentBet,
                current: player.coins
            });
            return null;
        }
        
        // Deduct bet from player
        player.coins -= player.currentBet;
        player.totalBets += player.currentBet;
        
        // Contribute to jackpot
        const jackpotContrib = Math.floor(player.currentBet * this.jackpotContribution);
        this.jackpot += jackpotContrib;
        
        player.lastShotTime = now;
        
        // Calculate bullet direction (from turret to target)
        const dx = targetX - player.turretX;
        const dz = targetZ - player.turretZ;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < 0.1) return null;
        
        const normalizedDx = dx / distance;
        const normalizedDz = dz / distance;
        
        // Update turret rotation
        player.turretRotation = Math.atan2(dx, dz);
        
        const bulletId = this.nextBulletId++;
        const bullet = {
            bulletId,
            ownerId: player.playerId,
            ownerSocketId: socketId,
            betAmount: player.currentBet,
            
            x: player.turretX,
            z: player.turretZ,
            prevX: player.turretX,
            prevZ: player.turretZ,
            velocityX: normalizedDx * this.BULLET_SPEED,
            velocityZ: normalizedDz * this.BULLET_SPEED,
            rotation: player.turretRotation,
            
            spawnTime: now,
            hasHit: false
        };
        
        this.bullets.set(bulletId, bullet);
        
        // DEBUG: Log bullet creation
        console.log(`[DEBUG-SHOT] bulletId=${bulletId} owner=${player.playerId} start=(${bullet.x.toFixed(1)},${bullet.z.toFixed(1)}) target=(${targetX.toFixed(1)},${targetZ.toFixed(1)}) vel=(${bullet.velocityX.toFixed(1)},${bullet.velocityZ.toFixed(1)})`);
        
        // Broadcast bullet spawn to all players
        io.to(this.roomCode).emit('bulletSpawned', {
            bulletId,
            ownerId: player.playerId,
            x: bullet.x,
            z: bullet.z,
            velocityX: bullet.velocityX,
            velocityZ: bullet.velocityZ,
            rotation: bullet.rotation,
            betAmount: bullet.betAmount
        });
        
        // Send coin update to shooter
        io.to(socketId).emit('coinUpdate', {
            coins: player.coins,
            change: -player.currentBet,
            reason: 'shot'
        });
        
        return bullet;
    }
    
    /**
     * Calculate reward with multipliers
     * Uses new sci-fi unit multiplier system: reward = bet × multiplier
     */
    calculateReward(fish, player, betAmount) {
        // Use multiplier field (sci-fi units) or fallback to baseReward (legacy)
        const unitMultiplier = fish.multiplier || fish.baseReward || 2;
        let reward = unitMultiplier * betAmount;
        
        // Combo multiplier
        const now = Date.now();
        if (now - player.lastKillTime < this.comboTimeout) {
            player.combo++;
        } else {
            player.combo = 1;
        }
        player.lastKillTime = now;
        
        // Combo bonus: 1.1x at 2 combo, 1.2x at 3, etc. Max 2x at 10+ combo
        const comboMultiplier = Math.min(2.0, 1 + (player.combo - 1) * 0.1);
        reward = Math.floor(reward * comboMultiplier);
        
        // Boss kill bonus - extra jackpot contribution
        let jackpotWin = 0;
        if (fish.isBoss) {
            // Bosses always have a chance to trigger jackpot
            const jackpotChance = fish.isLegendary ? 0.25 : 0.1; // 25% for legendary boss, 10% for regular boss
            if (Math.random() < jackpotChance) {
                jackpotWin = this.jackpot;
                this.jackpot = 1000; // Reset jackpot
            }
        }
        
        return {
            baseReward: unitMultiplier * betAmount,
            multiplier: unitMultiplier,
            comboMultiplier,
            combo: player.combo,
            finalReward: reward,
            jackpotWin,
            isBossKill: fish.isBoss || false
        };
    }
    
    /**
     * Start the game loop
     */
    startGameLoop(io) {
        if (this.loopRunning) {
            console.log(`[FISHING-ENGINE] Game loop already running for room ${this.roomCode}`);
            return;
        }
        
        this.gameStarted = true;
        this.loopRunning = true;
        
        // Spawn initial fish
        for (let i = 0; i < 10; i++) {
            this.spawnFish();
        }
        
        const now = process.hrtime.bigint();
        this.nextTickNs = now;
        this.nextNetNs = now;
        
        console.log(`[FISHING-ENGINE] Starting game loop for room ${this.roomCode}`);
        this.runGameLoop(io);
    }
    
    /**
     * Stop the game loop
     */
    stopGameLoop() {
        this.loopRunning = false;
        this.gameStarted = false;
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
        console.log(`[FISHING-ENGINE] Game loop stopped for room ${this.roomCode}`);
    }
    
    /**
     * Main game loop (adapted from Pudge Wars precise loop)
     */
    runGameLoop(io) {
        if (!this.loopRunning) return;
        
        try {
            const now = process.hrtime.bigint();
            const maxCatchUpTicks = 8;
            
            let tickLoops = 0;
            while (now >= this.nextTickNs && tickLoops < maxCatchUpTicks) {
                const fixedDt = 1 / this.TICK_RATE;
                this.serverTick++;
                
                // Update fish positions
                this.updateFish(fixedDt, io);
                
                // Update bullet positions
                this.updateBullets(fixedDt, io);
                
                // Check bullet-fish collisions
                this.checkCollisions(io);
                
                // Update AI turrets (Single Player mode)
                this.updateAITurrets(io);
                
                // Update boss wave state
                this.updateBossWaveState();
                
                // Spawn new fish periodically
                const nowMs = Date.now();
                if (nowMs - this.lastFishSpawn > this.fishSpawnInterval) {
                    this.spawnFish();
                    this.lastFishSpawn = nowMs;
                }
                
                this.nextTickNs += this.tickIntervalNs;
                tickLoops++;
            }
            
            // Clamp if too far behind
            if (now >= this.nextTickNs && tickLoops >= maxCatchUpTicks) {
                this.nextTickNs = now + this.tickIntervalNs;
            }
            
            // Network broadcast
            while (now >= this.nextNetNs) {
                this.broadcastGameState(io);
                this.nextNetNs += this.netIntervalNs;
            }
            
            // Schedule next iteration
            setImmediate(() => this.runGameLoop(io));
            
        } catch (err) {
            console.error(`[FISHING-ENGINE] Game loop error:`, err);
            setImmediate(() => this.runGameLoop(io));
        }
    }
    
    /**
     * Update fish positions with movement patterns
     */
    updateFish(dt, io) {
        const fishToRemove = [];
        
        for (const [fishId, fish] of this.fish.entries()) {
            // Base movement
            fish.x += fish.velocityX * dt;
            fish.z += fish.velocityZ * dt;
            
            // Apply movement pattern
            if (fish.pattern === 'sine') {
                fish.patternPhase += dt * 2;
                const offset = Math.sin(fish.patternPhase) * fish.patternAmplitude * dt;
                // Perpendicular offset
                fish.x += -fish.velocityZ / fish.speed * offset;
                fish.z += fish.velocityX / fish.speed * offset;
            } else if (fish.pattern === 'zigzag') {
                fish.patternPhase += dt * 3;
                if (Math.floor(fish.patternPhase) % 2 === 0) {
                    fish.x += fish.patternAmplitude * dt * 0.5;
                } else {
                    fish.x -= fish.patternAmplitude * dt * 0.5;
                }
            }
            
            // Remove fish that exit the map
            if (fish.x < this.MAP_BOUNDS.minX - 20 || fish.x > this.MAP_BOUNDS.maxX + 20 ||
                fish.z < this.MAP_BOUNDS.minZ - 20 || fish.z > this.MAP_BOUNDS.maxZ + 20) {
                fishToRemove.push(fishId);
            }
        }
        
        // Remove exited fish
        for (const fishId of fishToRemove) {
            this.fish.delete(fishId);
        }
    }
    
    /**
     * Update bullet positions (adapted from knife update)
     */
    updateBullets(dt, io) {
        const now = Date.now();
        const bulletsToRemove = [];
        
        for (const [bulletId, bullet] of this.bullets.entries()) {
            if (bullet.hasHit) {
                // DEBUG: Log bullet removal due to hit
                console.log(`[DEBUG-DESTROY] bulletId=${bulletId} reason=HIT pos=(${bullet.x.toFixed(1)},${bullet.z.toFixed(1)})`);
                bulletsToRemove.push(bulletId);
                continue;
            }
            
            // Check lifetime
            if (now - bullet.spawnTime > this.BULLET_LIFETIME) {
                // DEBUG: Log bullet removal due to lifetime
                console.log(`[DEBUG-DESTROY] bulletId=${bulletId} reason=LIFETIME pos=(${bullet.x.toFixed(1)},${bullet.z.toFixed(1)}) age=${now - bullet.spawnTime}ms`);
                bulletsToRemove.push(bulletId);
                continue;
            }
            
            // Store previous position for swept collision
            bullet.prevX = bullet.x;
            bullet.prevZ = bullet.z;
            
            // Update position
            bullet.x += bullet.velocityX * dt;
            bullet.z += bullet.velocityZ * dt;
            
            // Remove if out of bounds
            if (Math.abs(bullet.x) > 100 || Math.abs(bullet.z) > 80) {
                // DEBUG: Log bullet removal due to out of bounds
                console.log(`[DEBUG-DESTROY] bulletId=${bulletId} reason=OUT_OF_BOUNDS pos=(${bullet.x.toFixed(1)},${bullet.z.toFixed(1)})`);
                bulletsToRemove.push(bulletId);
            }
        }
        
        // Remove expired bullets
        for (const bulletId of bulletsToRemove) {
            this.bullets.delete(bulletId);
            io.to(this.roomCode).emit('bulletDestroyed', { bulletId });
        }
    }
    
    /**
     * Check bullet-fish collisions (adapted from knife collision)
     */
    checkCollisions(io) {
        for (const [bulletId, bullet] of this.bullets.entries()) {
            if (bullet.hasHit) continue;
            
            for (const [fishId, fish] of this.fish.entries()) {
                // Swept collision detection (line-circle intersection)
                // Hit radius = fish visual radius + bullet radius + small fudge
                const hitRadius = this.FISH_BASE_RADIUS * fish.size + this.BULLET_RADIUS + this.COLLISION_FUDGE;
                const hit = this.lineCircleIntersection(
                    bullet.prevX, bullet.prevZ,
                    bullet.x, bullet.z,
                    fish.x, fish.z,
                    hitRadius
                );
                
                if (hit) {
                    // DEBUG: Log hit detection
                    console.log(`[DEBUG-HIT] bulletId=${bulletId} fishId=${fishId} bullet=(${bullet.x.toFixed(1)},${bullet.z.toFixed(1)}) fish=(${fish.x.toFixed(1)},${fish.z.toFixed(1)}) hitRadius=${hitRadius.toFixed(2)} isAI=${bullet.isAIBullet || false}`);
                    
                    bullet.hasHit = true;
                    fish.health--;
                    
                    // Get owner - could be human player or AI turret
                    let owner = this.players.get(bullet.ownerSocketId);
                    if (!owner && bullet.isAIBullet) {
                        owner = this.aiTurrets.get(bullet.ownerId);
                    }
                    
                    // Broadcast hit effect
                    io.to(this.roomCode).emit('bulletHit', {
                        bulletId,
                        fishId,
                        hitX: bullet.x,
                        hitZ: bullet.z,
                        fishHealth: fish.health,
                        fishMaxHealth: fish.maxHealth,
                        isAI: bullet.isAIBullet || false
                    });
                    
                    // Check if fish is killed
                    if (fish.health <= 0) {
                        if (owner) {
                            const reward = this.calculateReward(fish, owner, bullet.betAmount);
                            owner.coins += reward.finalReward + reward.jackpotWin;
                            owner.totalWinnings += reward.finalReward + reward.jackpotWin;
                            
                            // Broadcast fish killed with sci-fi unit info
                            io.to(this.roomCode).emit('fishKilled', {
                                fishId,
                                fishType: fish.typeName,
                                tier: fish.tier || 'normal',
                                multiplier: reward.multiplier,
                                isBoss: fish.isBoss || false,
                                isLegendary: fish.isLegendary || false,
                                killerId: owner.playerId,
                                reward: reward.finalReward,
                                combo: reward.combo,
                                comboMultiplier: reward.comboMultiplier,
                                jackpotWin: reward.jackpotWin,
                                x: fish.x,
                                z: fish.z,
                                isAI: owner.isAI || false
                            });
                            
                            // Send coin update to killer (only for human players)
                            if (!owner.isAI) {
                                io.to(bullet.ownerSocketId).emit('coinUpdate', {
                                    coins: owner.coins,
                                    change: reward.finalReward + reward.jackpotWin,
                                    reason: 'kill',
                                    fishType: fish.typeName,
                                    combo: reward.combo
                                });
                            }
                            
                            if (reward.jackpotWin > 0) {
                                io.to(this.roomCode).emit('jackpotWon', {
                                    playerId: owner.playerId,
                                    amount: reward.jackpotWin,
                                    newJackpot: this.jackpot,
                                    isAI: owner.isAI || false
                                });
                            }
                        }
                        
                        // Track kill for boss wave system
                        this.onFishKilled(fish);
                        
                        this.fish.delete(fishId);
                    }
                    
                    break; // Bullet can only hit one fish
                }
            }
        }
    }
    
    /**
     * Line-circle intersection for swept collision (from Pudge Wars)
     */
    lineCircleIntersection(x1, z1, x2, z2, cx, cz, r) {
        const dx = cx - x1;
        const dz = cz - z1;
        
        const lx = x2 - x1;
        const lz = z2 - z1;
        
        const lineLength = Math.sqrt(lx * lx + lz * lz);
        if (lineLength < 0.001) {
            const dist = Math.sqrt(dx * dx + dz * dz);
            return dist < r;
        }
        
        const nx = lx / lineLength;
        const nz = lz / lineLength;
        
        const projection = dx * nx + dz * nz;
        const t = Math.max(0, Math.min(lineLength, projection));
        
        const closestX = x1 + nx * t;
        const closestZ = z1 + nz * t;
        
        const distX = cx - closestX;
        const distZ = cz - closestZ;
        const distance = Math.sqrt(distX * distX + distZ * distZ);
        
        return distance < r;
    }
    
    /**
     * Broadcast game state to all clients (like Pudge Wars serverGameState)
     */
    broadcastGameState(io) {
        const fishArray = Array.from(this.fish.values()).map(f => ({
            fishId: f.fishId,
            typeId: f.typeId,
            typeName: f.typeName,
            tier: f.tier || 'normal',
            health: f.health,
            maxHealth: f.maxHealth,
            multiplier: f.multiplier || f.baseReward || 2,
            size: f.size,
            color: f.color || 0x00FFFF,
            isBoss: f.isBoss || false,
            isLegendary: f.isLegendary || false,
            x: f.x,
            z: f.z,
            velocityX: f.velocityX,
            velocityZ: f.velocityZ,
            rotation: f.rotation
        }));
        
        const bulletsArray = Array.from(this.bullets.values())
            .filter(b => !b.hasHit)
            .map(b => ({
                bulletId: b.bulletId,
                ownerId: b.ownerId,
                x: b.x,
                z: b.z,
                velocityX: b.velocityX,
                velocityZ: b.velocityZ,
                rotation: b.rotation,
                isAI: b.isAIBullet || false
            }));
        
        // Include both human players and AI turrets in the players array
        const humanPlayers = Array.from(this.players.values()).map(p => ({
            playerId: p.playerId,
            coins: p.coins,
            currentBet: p.currentBet,
            turretX: p.turretX,
            turretZ: p.turretZ,
            turretRotation: p.turretRotation,
            combo: p.combo,
            isAI: false
        }));
        
        const aiPlayers = Array.from(this.aiTurrets.values()).map(p => ({
            playerId: p.playerId,
            coins: p.coins,
            currentBet: p.currentBet,
            turretX: p.turretX,
            turretZ: p.turretZ,
            turretRotation: p.turretRotation,
            combo: p.combo,
            isAI: true
        }));
        
        const playersArray = [...humanPlayers, ...aiPlayers];
        
        io.to(this.roomCode).emit('serverGameState', {
            serverTick: this.serverTick,
            serverTime: Date.now(),
            fish: fishArray,
            bullets: bulletsArray,
            players: playersArray,
            jackpot: this.jackpot,
            isSinglePlayer: this.isSinglePlayer,
            bossWaveActive: this.bossWaveActive,
            killsSinceLastBoss: this.killsSinceLastBoss,
            killsToTriggerBoss: this.killsToTriggerBoss
        });
    }
    
    /**
     * Get current game snapshot
     */
    getSnapshot() {
        return {
            serverTick: this.serverTick,
            serverTime: Date.now(),
            fishCount: this.fish.size,
            bulletCount: this.bullets.size,
            playerCount: this.players.size,
            jackpot: this.jackpot
        };
    }
}

module.exports = { FishingGameEngine, FISH_TYPES, SCI_FI_UNITS };
