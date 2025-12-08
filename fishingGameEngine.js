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

const SCI_FI_UNITS = {
    // ============ NORMAL TIER (70% spawn rate during normal waves) ============
    // Small, fast, easy to kill - bread and butter targets
    
    SCOUT_DRONE: { 
        id: 1, 
        name: 'Scout Drone', 
        tier: 'normal',
        health: 1, 
        multiplier: 2,  // 2x bet reward
        speed: 35, 
        size: 0.8, 
        spawnWeight: 25,
        color: 0x00FFFF,  // Cyan
        description: 'Small reconnaissance drone'
    },
    ENERGY_ORB: { 
        id: 2, 
        name: 'Energy Orb', 
        tier: 'normal',
        health: 1, 
        multiplier: 3, 
        speed: 40, 
        size: 0.6, 
        spawnWeight: 20,
        color: 0xFF00FF,  // Magenta
        description: 'Floating energy sphere'
    },
    NANO_SWARM: { 
        id: 3, 
        name: 'Nano Swarm', 
        tier: 'normal',
        health: 2, 
        multiplier: 4, 
        speed: 30, 
        size: 1.0, 
        spawnWeight: 15,
        color: 0x00FF00,  // Green
        description: 'Cluster of nanobots'
    },
    PLASMA_FISH: { 
        id: 4, 
        name: 'Plasma Fish', 
        tier: 'normal',
        health: 2, 
        multiplier: 5, 
        speed: 28, 
        size: 1.2, 
        spawnWeight: 10,
        color: 0xFFFF00,  // Yellow
        description: 'Bio-mechanical fish with plasma core'
    },
    
    // ============ MEDIUM TIER (25% spawn rate during normal waves) ============
    // Larger targets, more HP, better rewards
    
    MECH_SHARK: { 
        id: 5, 
        name: 'Mech Shark', 
        tier: 'medium',
        health: 5, 
        multiplier: 10, 
        speed: 45, 
        size: 2.5, 
        spawnWeight: 6,
        color: 0x708090,  // Steel gray
        description: 'Armored mechanical predator'
    },
    CYBER_JELLYFISH: { 
        id: 6, 
        name: 'Cyber Jellyfish', 
        tier: 'medium',
        health: 4, 
        multiplier: 8, 
        speed: 15, 
        size: 2.0, 
        spawnWeight: 5,
        color: 0x9400D3,  // Purple
        description: 'Floating cyber organism with tentacles'
    },
    TORPEDO_RAY: { 
        id: 7, 
        name: 'Torpedo Ray', 
        tier: 'medium',
        health: 6, 
        multiplier: 12, 
        speed: 50, 
        size: 2.8, 
        spawnWeight: 4,
        color: 0x4169E1,  // Royal blue
        description: 'High-speed manta-shaped drone'
    },
    CRYSTAL_CRAB: { 
        id: 8, 
        name: 'Crystal Crab', 
        tier: 'medium',
        health: 8, 
        multiplier: 15, 
        speed: 12, 
        size: 2.2, 
        spawnWeight: 3,
        color: 0x00CED1,  // Dark cyan
        description: 'Armored crab with crystal shell'
    },
    VOID_SERPENT: { 
        id: 9, 
        name: 'Void Serpent', 
        tier: 'medium',
        health: 7, 
        multiplier: 20, 
        speed: 25, 
        size: 3.0, 
        spawnWeight: 2,
        color: 0x8B008B,  // Dark magenta
        description: 'Long serpentine energy creature'
    },
    
    // ============ BOSS TIER (Only spawn during boss waves) ============
    // Massive HP, huge rewards, special VFX triggers
    
    MECHA_KRAKEN: { 
        id: 10, 
        name: 'Mecha Kraken', 
        tier: 'boss',
        health: 50, 
        multiplier: 50, 
        speed: 8, 
        size: 6.0, 
        spawnWeight: 0,  // Only spawns during boss waves
        isBoss: true,
        color: 0xFF4500,  // Orange red
        description: 'Massive mechanical squid with laser tentacles'
    },
    ENERGY_DRAGON: { 
        id: 11, 
        name: 'Energy Dragon', 
        tier: 'boss',
        health: 80, 
        multiplier: 100, 
        speed: 15, 
        size: 8.0, 
        spawnWeight: 0,
        isBoss: true,
        color: 0xFFD700,  // Gold
        description: 'Ancient energy being in dragon form'
    },
    REACTOR_CORE: { 
        id: 12, 
        name: 'Reactor Core', 
        tier: 'boss',
        health: 100, 
        multiplier: 150, 
        speed: 5, 
        size: 5.0, 
        spawnWeight: 0,
        isBoss: true,
        color: 0x00FF7F,  // Spring green
        description: 'Unstable fusion reactor - massive explosion on death'
    },
    QUANTUM_LEVIATHAN: { 
        id: 13, 
        name: 'Quantum Leviathan', 
        tier: 'boss',
        health: 150, 
        multiplier: 200, 
        speed: 10, 
        size: 10.0, 
        spawnWeight: 0,
        isBoss: true,
        isLegendary: true,
        color: 0xE6E6FA,  // Lavender (shifts colors)
        description: 'Reality-warping cosmic entity - JACKPOT BOSS'
    }
};

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
        
        // Turret positions at the very edge of the pool (8 positions)
        // Each turret faces toward the center of the pool
        // Pool bounds: x∈[-80,80], z∈[-60,42] - turrets placed at edge with small margin
        const EDGE_MARGIN = 2; // Small margin from absolute edge
        this.TURRET_POSITIONS = [
            { x: 0, z: this.MAP_BOUNDS.maxZ - EDGE_MARGIN },       // Position 1: Bottom center (player default)
            { x: -50, z: this.MAP_BOUNDS.maxZ - EDGE_MARGIN },     // Position 2: Bottom left
            { x: 50, z: this.MAP_BOUNDS.maxZ - EDGE_MARGIN },      // Position 3: Bottom right
            { x: this.MAP_BOUNDS.minX + EDGE_MARGIN, z: 0 },       // Position 4: Left side
            { x: this.MAP_BOUNDS.maxX - EDGE_MARGIN, z: 0 },       // Position 5: Right side
            { x: -50, z: this.MAP_BOUNDS.minZ + EDGE_MARGIN },     // Position 6: Top left
            { x: 0, z: this.MAP_BOUNDS.minZ + EDGE_MARGIN },       // Position 7: Top center
            { x: 50, z: this.MAP_BOUNDS.minZ + EDGE_MARGIN }       // Position 8: Top right
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
        this.bossTypes = ['MECHA_KRAKEN', 'ENERGY_DRAGON', 'REACTOR_CORE', 'QUANTUM_LEVIATHAN'];
        
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
     * Creates 7 AI turrets at positions 2-8 (player is at position 1)
     */
    initializeAITurrets() {
        this.isSinglePlayer = true;
        
        // Add 7 AI turrets at positions 2-8
        for (let i = 2; i <= 8; i++) {
            this.addPlayer(null, i, true);
        }
        
        console.log(`[FISHING-ENGINE] Initialized 7 AI turrets for Single Player mode`);
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
        
        return FISH_TYPES.SMALL_FISH; // Fallback
    }
    
    /**
     * Generate random fish path (movement pattern)
     */
    generateFishPath() {
        const patterns = ['straight', 'sine', 'zigzag', 'circle'];
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        
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
        
        return { startX, startZ, targetX, targetZ, pattern };
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
            fishType = SCI_FI_UNITS[bossKey];
            this.currentBoss = this.nextFishId; // Track boss ID
            console.log(`[FISHING-ENGINE] BOSS WAVE: Spawning ${fishType.name}!`);
        } else {
            fishType = this.getRandomFishType();
        }
        
        const path = this.generateFishPath();
        const fishId = this.nextFishId++;
        
        const dx = path.targetX - path.startX;
        const dz = path.targetZ - path.startZ;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const normalizedDx = dx / distance;
        const normalizedDz = dz / distance;
        
        const fish = {
            fishId,
            typeId: fishType.id,
            typeName: fishType.name,
            tier: fishType.tier || 'normal',
            health: fishType.health,
            maxHealth: fishType.health,
            multiplier: fishType.multiplier || fishType.baseReward || 2,
            baseReward: fishType.multiplier || fishType.baseReward || 2, // Backward compatibility
            speed: fishType.speed,
            size: fishType.size,
            color: fishType.color || 0x00FFFF,
            isBoss: fishType.isBoss || false,
            isLegendary: fishType.isLegendary || false,
            
            // Position and movement
            x: path.startX,
            z: path.startZ,
            targetX: path.targetX,
            targetZ: path.targetZ,
            velocityX: normalizedDx * fishType.speed,
            velocityZ: normalizedDz * fishType.speed,
            rotation: Math.atan2(dx, dz),
            
            // Path pattern
            pattern: path.pattern,
            patternPhase: Math.random() * Math.PI * 2,
            patternAmplitude: 5 + Math.random() * 10,
            
            spawnTime: Date.now()
        };
        
        this.fish.set(fishId, fish);
        
        if (fishType.isBoss) {
            console.log(`[FISHING-ENGINE] BOSS SPAWNED: ${fishType.name} (ID: ${fishId}, HP: ${fishType.health}, Multiplier: ${fishType.multiplier}x)`);
        } else if (fishType.isLegendary) {
            console.log(`[FISHING-ENGINE] LEGENDARY SPAWNED: ${fishType.name} (ID: ${fishId})`);
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
                bulletsToRemove.push(bulletId);
                continue;
            }
            
            // Check lifetime
            if (now - bullet.spawnTime > this.BULLET_LIFETIME) {
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
