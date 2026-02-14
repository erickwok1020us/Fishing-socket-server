/**
 * 3D Fish Shooting Game Engine - Server-Authoritative
 * Adapted for 3D aquarium fish shooting game with 1-4 players
 * 
 * Features:
 * - Server-authoritative fish spawning and movement (2D plane, Y is visual only)
 * - 4-player support with positioned cannons
 * - Pure Contribution-Based reward system (rewards distributed by damage percentage)
 * - Boss fish system
 * - Weapon multipliers (1x, 3x, 5x, 8x)
 * - Seeded RNG for deterministic fish spawning
 */

const { performance } = require('perf_hooks');

// M3: Seed commitment for provably fair HP derivation
const { RoomSeedManager } = require('./src/modules/SeedCommitment');
// M5: Audit receipt chain
const { ReceiptChain, createFishDeathReceipt } = require('./src/modules/AuditReceipt');
// M4: Anomaly detection for hit rate tracking
const { anomalyDetector } = require('./src/modules/AnomalyDetector');
// RTP Phase 1: Probabilistic kill system
const { RTPPhase1, MONEY_SCALE, TIER_CONFIG } = require('./src/modules/RTPPhase1');

/**
 * Seeded Random Number Generator (Mulberry32)
 * Ensures all clients see the same fish spawns
 */
class SeededRNG {
    constructor(seed) {
        this.seed = seed;
    }
    
    next() {
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
    
    nextFloat(min, max) {
        return this.next() * (max - min) + min;
    }
    
    pick(array) {
        return array[Math.floor(this.next() * array.length)];
    }
}

/**
 * Fish Species Configuration - Matches PDF Specification (6-Tier System)
 * Server uses 2D coordinates (x, z), client adds Y for visual depth
 * 
 * PDF Specification HP Ranges:
 * - Tier 1 (Small): HP 20-30, Reward 2-3x, Spawn 40%
 * - Tier 2 (Common): HP 50-80, Reward 5-8x, Spawn 30%
 * - Tier 3 (Medium): HP 100-150, Reward 10-15x, Spawn 15%
 * - Tier 4 (Large): HP 200-300, Reward 20-30x, Spawn 10%
 * - Tier 5 (Rare): HP 400-600, Reward 40-60x, Spawn 4%
 * - Tier 6 (Boss): HP 1000-2000, Reward 100-200x, Spawn 1%
 */
/**
 * Fish Species Configuration - Casino-Grade RTP Compliance
 * 
 * RTP (Return to Player) is calculated as: reward / cost_to_kill
 * - reward = fish.multiplier * weapon.multiplier
 * - cost_to_kill = ceil(fish.health / weapon.damage) * weapon.cost
 * 
 * For 1x weapon (cost=1, damage=1, multiplier=1):
 * - RTP = fish.multiplier / fish.health
 * 
 * Target RTP by tier (per PDF specification):
 * - Tier 1 (Small): 91% RTP
 * - Tier 2 (Common): 92% RTP
 * - Tier 3 (Medium): 93% RTP
 * - Tier 4 (Large): 94% RTP
 * - Tier 5 (Rare): 94.5% RTP
 * - Tier 6 (Boss): 95% RTP
 * 
 * Multiplier formula: multiplier = floor(health * targetRTP)
 */
const FISH_SPECIES = {
    // ==================== TIER 6: BOSS (1% spawn rate, HP 1000-2000, 95% RTP) ====================
    blueWhale: {
        id: 1, name: 'Blue Whale', category: 'boss', tier: 6,
        health: 2000, hpRange: [1000, 2000], multiplier: 1900, rewardRange: [950, 1900],
        speed: 25, size: 140, spawnWeight: 0.7, isBoss: true, isLegendary: true,
        color: 0x4477aa, movementPattern: 'cruise'
    },
    greatWhiteShark: {
        id: 2, name: 'Great White Shark', category: 'boss', tier: 6,
        health: 1500, hpRange: [1000, 2000], multiplier: 1425, rewardRange: [950, 1900],
        speed: 60, size: 100, spawnWeight: 0.3, isBoss: true,
        color: 0x667788, movementPattern: 'burstAttack'
    },
    
    // ==================== TIER 5: RARE (4% spawn rate, HP 400-600, 94.5% RTP) ====================
    marlin: {
        id: 3, name: 'Marlin', category: 'rare', tier: 5,
        health: 500, hpRange: [400, 600], multiplier: 472, rewardRange: [378, 567],
        speed: 100, size: 80, spawnWeight: 1.5,
        color: 0x2266aa, movementPattern: 'burstSprint'
    },
    hammerheadShark: {
        id: 4, name: 'Hammerhead Shark', category: 'rare', tier: 5,
        health: 550, hpRange: [400, 600], multiplier: 520, rewardRange: [378, 567],
        speed: 50, size: 85, spawnWeight: 1.5,
        color: 0x556677, movementPattern: 'sShape'
    },
    
    // ==================== TIER 4: LARGE (10% spawn rate, HP 200-300, 94% RTP) ====================
    yellowfinTuna: {
        id: 5, name: 'Yellowfin Tuna', category: 'large', tier: 4,
        health: 250, hpRange: [200, 300], multiplier: 235, rewardRange: [188, 282],
        speed: 80, size: 50, spawnWeight: 4,
        color: 0x3355aa, movementPattern: 'synchronizedFast'
    },
    mahiMahi: {
        id: 6, name: 'Mahi-Mahi', category: 'large', tier: 4,
        health: 200, hpRange: [200, 300], multiplier: 188, rewardRange: [188, 282],
        speed: 70, size: 45, spawnWeight: 3,
        color: 0x44aa44, movementPattern: 'irregularTurns'
    },
    mantaRay: {
        id: 17, name: 'Manta Ray', category: 'large', tier: 4,
        health: 300, hpRange: [200, 300], multiplier: 282, rewardRange: [188, 282],
        speed: 45, size: 90, spawnWeight: 3,
        color: 0x222233, movementPattern: 'wingGlide'
    },
    
    // ==================== TIER 3: MEDIUM (15% spawn rate, HP 100-150, 93% RTP) ====================
    barracuda: {
        id: 7, name: 'Barracuda', category: 'medium', tier: 3,
        health: 120, hpRange: [100, 150], multiplier: 112, rewardRange: [93, 140],
        speed: 90, size: 55, spawnWeight: 5,
        color: 0xaabbcc, movementPattern: 'ambush'
    },
    grouper: {
        id: 8, name: 'Grouper', category: 'medium', tier: 3,
        health: 150, hpRange: [100, 150], multiplier: 140, rewardRange: [93, 140],
        speed: 30, size: 60, spawnWeight: 5,
        color: 0x886644, movementPattern: 'bottomBurst'
    },
    parrotfish: {
        id: 9, name: 'Parrotfish', category: 'medium', tier: 3,
        health: 100, hpRange: [100, 150], multiplier: 93, rewardRange: [93, 140],
        speed: 45, size: 35, spawnWeight: 5,
        color: 0x44ddaa, movementPattern: 'stopAndGo'
    },
    
    // ==================== TIER 2: COMMON (30% spawn rate, HP 50-80, 92% RTP) ====================
    angelfish: {
        id: 10, name: 'Angelfish', category: 'common', tier: 2,
        health: 60, hpRange: [50, 80], multiplier: 55, rewardRange: [46, 74],
        speed: 40, size: 30, spawnWeight: 10,
        color: 0xffdd44, movementPattern: 'elegantGlide'
    },
    butterflyfish: {
        id: 11, name: 'Butterflyfish', category: 'common', tier: 2,
        health: 50, hpRange: [50, 80], multiplier: 46, rewardRange: [46, 74],
        speed: 50, size: 22, spawnWeight: 10,
        color: 0xffffaa, movementPattern: 'agileWeave'
    },
    blueTang: {
        id: 12, name: 'Blue Tang', category: 'common', tier: 2,
        health: 70, hpRange: [50, 80], multiplier: 64, rewardRange: [46, 74],
        speed: 55, size: 20, spawnWeight: 10,
        color: 0x2288ff, movementPattern: 'groupCoordination'
    },
    
    // ==================== TIER 1: SMALL (40% spawn rate, HP 20-30, 91% RTP) ====================
    sardine: {
        id: 13, name: 'Sardine', category: 'small', tier: 1,
        health: 20, hpRange: [20, 30], multiplier: 18, rewardRange: [18, 27],
        speed: 90, size: 10, spawnWeight: 15,
        color: 0xccddee, movementPattern: 'waveFormation'
    },
    anchovy: {
        id: 14, name: 'Anchovy', category: 'small', tier: 1,
        health: 20, hpRange: [20, 30], multiplier: 18, rewardRange: [18, 27],
        speed: 100, size: 8, spawnWeight: 15,
        color: 0xaabbcc, movementPattern: 'baitBall'
    },
    clownfish: {
        id: 15, name: 'Clownfish', category: 'small', tier: 1,
        health: 25, hpRange: [20, 30], multiplier: 23, rewardRange: [18, 27],
        speed: 35, size: 15, spawnWeight: 10,
        color: 0xff6600, movementPattern: 'territorial'
    },
    damselfish: {
        id: 16, name: 'Damselfish', category: 'small', tier: 1,
        health: 30, hpRange: [20, 30], multiplier: 27, rewardRange: [18, 27],
        speed: 60, size: 12, spawnWeight: 10,
        color: 0x6644ff, movementPattern: 'defensiveCharge'
    },
    pufferfish: {
        id: 18, name: 'Pufferfish', category: 'small', tier: 1,
        health: 30, hpRange: [20, 30], multiplier: 27, rewardRange: [18, 27],
        speed: 25, size: 25, spawnWeight: 5,
        color: 0xddcc88, movementPattern: 'slowRotation'
    },
    seahorse: {
        id: 19, name: 'Seahorse', category: 'small', tier: 1,
        health: 25, hpRange: [20, 30], multiplier: 23, rewardRange: [18, 27],
        speed: 18, size: 20, spawnWeight: 5,
        color: 0xffaa44, movementPattern: 'verticalDrift'
    },
    
};

// Calculate total spawn weight
const TOTAL_SPAWN_WEIGHT = Object.values(FISH_SPECIES).reduce((sum, fish) => sum + fish.spawnWeight, 0);

const WEAPONS = {
    '1x': { multiplier: 1, cost: 1, cooldown: 200, damage: 1, type: 'projectile', features: [] },
    '3x': { multiplier: 3, cost: 3, cooldown: 300, damage: 3, type: 'spread', pellets: 3, pelletCost: 1, features: [] },
    '5x': { multiplier: 5, cost: 5, cooldown: 400, damage: 5, type: 'rocket', aoeRadius: 15, maxTargets: 8, features: [] },
    '8x': { multiplier: 8, cost: 8, cooldown: 500, damage: 8, type: 'laser', maxTargets: 6, features: ['penetrating'] }
};

const PENETRATING_DAMAGE_MULTIPLIERS = [1.0, 0.8, 0.6, 0.4, 0.2];

/**
 * 3D Fish Shooting Game Engine
 */
class Fish3DGameEngine {
    constructor(roomCode, options = {}) {
        this.roomCode = roomCode;
        const seed = (typeof options === 'number') ? options : null;
        this.rng = new SeededRNG(seed || Date.now());
        
        // M3: Seed commitment manager for provably fair HP
        this.seedManager = new RoomSeedManager(roomCode);
        
        // M5: Receipt chain for audit trail
        this.receiptChain = new ReceiptChain(roomCode);
        
        // M6: Config hash reference
        this.configHashManager = (options && options.configHashManager) || null;
        
        // M2: Finisher pool config (0% for single-player per DEC-M2-002)
        this.finisherPoolPercent = 0;
        
        // RTP Phase 1: Probabilistic kill settlement
        this.rtpEngine = new RTPPhase1();
        
        // Player management (max 4 players)
        this.players = new Map(); // socketId -> player data
        this.maxPlayers = 4;
        this.gameStarted = false;
        this.serverTick = 0;
        
        // Fish management
        this.fish = new Map(); // fishId -> fish data
        this.nextFishId = 1;
        this.maxFish = 40;
        this.fishSpawnInterval = 1500;
        this.lastFishSpawn = 0;
        
        // Fish speed scaling - reduces fish speed to keep them on screen longer
        // Original speeds caused fish to cross the map in 2-5 seconds
        // With 0.15 scale, fish stay on screen ~20-30 seconds
        this.FISH_SPEED_SCALE = 0.15;
        
        // Bullet management
        this.bullets = new Map(); // bulletId -> bullet data
        this.nextBulletId = 1;
        
        // Game constants
        this.BULLET_SPEED = 400;
        this.BULLET_LIFETIME = 4000;
        
        // Collision detection (2D plane)
        this.FISH_BASE_RADIUS = 2.5;
        this.BULLET_RADIUS = 0.5;
        
        // Map bounds (matches 3D aquarium scaled to 2D)
        // 3D aquarium: width=1800, depth=1200 -> 2D: x∈[-90,90], z∈[-60,60]
        this.MAP_BOUNDS = {
            minX: -90, maxX: 90,
            minZ: -60, maxZ: 60
        };
        
        // Cannon positions for 4 players (bottom edge, side by side)
        // Matches MULTIPLAYER_ARCHITECTURE.md design
        this.CANNON_POSITIONS = [
            { x: -60, z: 55, rotation: 0 },      // Slot 0: Left
            { x: -20, z: 55, rotation: 0 },      // Slot 1: Mid-left
            { x:  20, z: 55, rotation: 0 },      // Slot 2: Mid-right
            { x:  60, z: 55, rotation: 0 }       // Slot 3: Right
        ];
        
        // Boss wave system
        this.bossWaveActive = false;
        this.bossWaveStartTime = 0;
        this.bossWaveDuration = 30000;
        this.normalWaveDuration = 90000;
        this.lastWaveChange = 0;
        this.killsSinceLastBoss = 0;
        this.killsToTriggerBoss = 30;
        this.currentBoss = null;
        
        // Tick rates
        this.TICK_RATE = 60;
        this.NETWORK_UPDATE_RATE = 20;
        this.tickIntervalNs = BigInt(Math.floor(1_000_000_000 / this.TICK_RATE));
        this.netIntervalNs = BigInt(Math.floor(1_000_000_000 / this.NETWORK_UPDATE_RATE));
        
        this.loopRunning = false;
    }
    
    /**
     * Add a player to the game
     */
    addPlayer(socketId, playerId, playerName = 'Player') {
        if (this.players.size >= this.maxPlayers) {
            return null;
        }
        
        const slotIndex = this.getNextSlot();
        if (slotIndex === -1) return null;
        
        const cannonPos = this.CANNON_POSITIONS[slotIndex];
        
        const playerData = {
            socketId,
            playerId,
            playerName,
            slotIndex,
            
            // Cannon state
            cannonX: cannonPos.x,
            cannonZ: cannonPos.z,
            cannonYaw: 0,
            cannonPitch: 0,
            
            // Weapon state
            currentWeapon: '1x',
            lastShotTime: 0,
            
            // Economy
            balance: 1000,
            score: 0,
            
            // Stats
            totalShots: 0,
            totalHits: 0,
            totalKills: 0,
            
            // Connection
            isConnected: true,
            viewMode: 'third-person'
        };
        
        this.players.set(socketId, playerData);
        console.log(`[FISH3D-ENGINE] Player ${playerId} (${playerName}) joined at slot ${slotIndex}`);
        
        return playerData;
    }
    
    /**
     * Get next available slot
     */
    getNextSlot() {
        const usedSlots = new Set([...this.players.values()].map(p => p.slotIndex));
        for (let i = 0; i < this.maxPlayers; i++) {
            if (!usedSlots.has(i)) return i;
        }
        return -1;
    }
    
    /**
     * Remove a player
     */
    removePlayer(socketId) {
        const player = this.players.get(socketId);
        if (player) {
            console.log(`[FISH3D-ENGINE] Player ${player.playerId} left`);
            this.rtpEngine.clearPlayerStates(socketId);
            this.players.delete(socketId);
        }
    }
    
    /**
     * Get random fish type based on spawn weights
     */
    getRandomFishType() {
        let roll = this.rng.next() * TOTAL_SPAWN_WEIGHT;
        
        for (const [typeName, fishType] of Object.entries(FISH_SPECIES)) {
            roll -= fishType.spawnWeight;
            if (roll <= 0) {
                return { typeName, ...fishType };
            }
        }
        
        // Fallback
        return { typeName: 'sardine', ...FISH_SPECIES.sardine };
    }
    
    /**
     * Generate fish movement path
     */
    generateFishPath(fishType) {
        const bounds = this.MAP_BOUNDS;
        const margin = 10;
        
        // Random start edge (0=left, 1=right, 2=top, 3=bottom)
        const startEdge = this.rng.nextInt(0, 3);
        let startX, startZ, endX, endZ;
        
        switch (startEdge) {
            case 0: // Left edge
                startX = bounds.minX - margin;
                startZ = this.rng.nextFloat(bounds.minZ, bounds.maxZ);
                endX = bounds.maxX + margin;
                endZ = this.rng.nextFloat(bounds.minZ, bounds.maxZ);
                break;
            case 1: // Right edge
                startX = bounds.maxX + margin;
                startZ = this.rng.nextFloat(bounds.minZ, bounds.maxZ);
                endX = bounds.minX - margin;
                endZ = this.rng.nextFloat(bounds.minZ, bounds.maxZ);
                break;
            case 2: // Top edge
                startX = this.rng.nextFloat(bounds.minX, bounds.maxX);
                startZ = bounds.minZ - margin;
                endX = this.rng.nextFloat(bounds.minX, bounds.maxX);
                endZ = bounds.maxZ + margin;
                break;
            case 3: // Bottom edge
                startX = this.rng.nextFloat(bounds.minX, bounds.maxX);
                startZ = bounds.maxZ + margin;
                endX = this.rng.nextFloat(bounds.minX, bounds.maxX);
                endZ = bounds.minZ - margin;
                break;
        }
        
        // Calculate velocity
        const dx = endX - startX;
        const dz = endZ - startZ;
        const distance = Math.sqrt(dx * dx + dz * dz);
        // Apply speed scale to keep fish on screen longer (original speeds were too fast)
        const baseSpeed = fishType.speed * this.FISH_SPEED_SCALE;
        const speed = baseSpeed * (0.8 + this.rng.next() * 0.4); // ±20% speed variation
        
        return {
            startX, startZ,
            velocityX: (dx / distance) * speed,
            velocityZ: (dz / distance) * speed,
            rotation: Math.atan2(dx, dz)
        };
    }
    
    /**
     * Spawn a fish
     */
    spawnFish(forceBoss = false) {
        if (this.fish.size >= this.maxFish && !forceBoss) return null;
        
        let fishType;
        if (forceBoss) {
            // Spawn a boss
            const bossTypes = ['blueWhale', 'greatWhiteShark'];
            const bossTypeName = this.rng.pick(bossTypes);
            fishType = { typeName: bossTypeName, ...FISH_SPECIES[bossTypeName] };
        } else {
            fishType = this.getRandomFishType();
        }
        
        const path = this.generateFishPath(fishType);
        const fishId = this.nextFishId++;
        
        // M3: Derive HP from seed commitment if hpRange is available
        let fishHP = fishType.health;
        let seedCommitment = null;
        let spawnIdx = null;
        if (fishType.hpRange && fishType.hpRange.length === 2) {
            const hpResult = this.seedManager.getFishHP(
                fishType.typeName,
                fishType.hpRange[0],
                fishType.hpRange[1]
            );
            fishHP = hpResult.hp;
            seedCommitment = hpResult.commitment;
            spawnIdx = hpResult.spawnIndex;
        }
        
        const fish = {
            fishId,
            typeName: fishType.typeName,
            speciesId: fishType.id,
            
            // Position (2D plane)
            x: path.startX,
            z: path.startZ,
            prevX: path.startX,
            prevZ: path.startZ,
            
            // Movement
            velocityX: path.velocityX,
            velocityZ: path.velocityZ,
            rotation: path.rotation,
            speed: fishType.speed,
            
            // Stats (M3: HP derived from seed commitment)
            health: fishHP,
            maxHealth: fishHP,
            multiplier: fishType.multiplier,
            size: fishType.size,
            
            // Damage tracking (for last-hit-wins)
            lastHitBy: null,
            damageByPlayer: new Map(),
            costByPlayer: new Map(),
            
            // RTP Phase 1 tier
            tier: fishType.tier,
            
            // Flags
            isBoss: fishType.isBoss || false,
            isAlive: true,
            
            // M3: Seed commitment data
            seedCommitment: seedCommitment,
            spawnIndex: spawnIdx,
            
            // Timing
            spawnTime: Date.now()
        };
        
        this.fish.set(fishId, fish);
        
        if (fish.isBoss) {
            this.currentBoss = fishId;
            console.log(`[FISH3D-ENGINE] BOSS SPAWNED: ${fishType.typeName} (ID: ${fishId})`);
        }
        
        return fish;
    }
    
    /**
     * Handle player shooting
     * Client sends target coordinates (targetX, targetZ) in server 2D space
     * Server calculates bullet direction from cannon position to target
     */
    handleShoot(socketId, targetX, targetZ, io) {
        const player = this.players.get(socketId);
        if (!player) return null;
        
        const now = Date.now();
        const weapon = WEAPONS[player.currentWeapon];
        
        if (now - player.lastShotTime < weapon.cooldown) {
            return null;
        }
        
        if (player.balance < weapon.cost) {
            io.to(socketId).emit('insufficientBalance', {
                required: weapon.cost,
                current: player.balance
            });
            return null;
        }
        
        player.balance -= weapon.cost;
        player.lastShotTime = now;
        player.totalShots++;
        
        const dx = targetX - player.cannonX;
        const dz = targetZ - player.cannonZ;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < 0.1) return null;
        
        const normalizedDx = dx / distance;
        const normalizedDz = dz / distance;
        
        player.cannonYaw = Math.atan2(normalizedDx, -normalizedDz);
        
        const bullets = [];
        
        if (weapon.type === 'spread') {
            const spreadAngle = 15 * (Math.PI / 180);
            const pelletOffsets = [0, spreadAngle, -spreadAngle];
            
            for (let i = 0; i < weapon.pellets; i++) {
                const angle = pelletOffsets[i];
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const pdx = normalizedDx * cos - normalizedDz * sin;
                const pdz = normalizedDx * sin + normalizedDz * cos;
                
                const bulletId = this.nextBulletId++;
                const pellet = {
                    bulletId,
                    ownerId: player.playerId,
                    ownerSocketId: socketId,
                    weapon: player.currentWeapon,
                    damage: 1,
                    cost: weapon.pelletCost,
                    pelletIndex: i,
                    
                    x: player.cannonX,
                    z: player.cannonZ,
                    prevX: player.cannonX,
                    prevZ: player.cannonZ,
                    velocityX: pdx * this.BULLET_SPEED,
                    velocityZ: pdz * this.BULLET_SPEED,
                    rotation: Math.atan2(pdx, -pdz),
                    
                    spawnTime: now,
                    hasHit: false
                };
                
                this.bullets.set(bulletId, pellet);
                bullets.push(pellet);
                
                io.to(this.roomCode).emit('bulletSpawned', {
                    bulletId,
                    ownerId: player.playerId,
                    weapon: player.currentWeapon,
                    x: pellet.x,
                    z: pellet.z,
                    velocityX: pellet.velocityX,
                    velocityZ: pellet.velocityZ,
                    rotation: pellet.rotation,
                    pelletIndex: i
                });
            }
        } else {
            const bulletId = this.nextBulletId++;
            const bullet = {
                bulletId,
                ownerId: player.playerId,
                ownerSocketId: socketId,
                weapon: player.currentWeapon,
                damage: weapon.damage,
                cost: weapon.cost,
                
                x: player.cannonX,
                z: player.cannonZ,
                prevX: player.cannonX,
                prevZ: player.cannonZ,
                velocityX: normalizedDx * this.BULLET_SPEED,
                velocityZ: normalizedDz * this.BULLET_SPEED,
                rotation: player.cannonYaw,
                
                spawnTime: now,
                hasHit: false
            };
            
            this.bullets.set(bulletId, bullet);
            bullets.push(bullet);
            
            io.to(this.roomCode).emit('bulletSpawned', {
                bulletId,
                ownerId: player.playerId,
                weapon: player.currentWeapon,
                x: bullet.x,
                z: bullet.z,
                velocityX: bullet.velocityX,
                velocityZ: bullet.velocityZ,
                rotation: bullet.rotation
            });
        }
        
        io.to(socketId).emit('balanceUpdate', {
            balance: player.balance,
            change: -weapon.cost,
            reason: 'shot'
        });
        
        return bullets.length === 1 ? bullets[0] : bullets;
    }
    
    /**
     * Handle weapon change
     */
    handleWeaponChange(socketId, weaponType, io) {
        const player = this.players.get(socketId);
        if (!player) return false;
        
        if (!WEAPONS[weaponType]) return false;
        
        player.currentWeapon = weaponType;
        
        io.to(this.roomCode).emit('playerWeaponChanged', {
            playerId: player.playerId,
            weapon: weaponType
        });
        
        return true;
    }
    
    /**
     * Start game loop
     */
    startGameLoop(io) {
        if (this.loopRunning) {
            console.log(`[FISH3D-ENGINE] Game loop already running for room ${this.roomCode}`);
            return;
        }
        
        this.gameStarted = true;
        this.loopRunning = true;
        this.lastWaveChange = Date.now();
        
        // Spawn initial fish
        for (let i = 0; i < 15; i++) {
            this.spawnFish();
        }
        
        const now = process.hrtime.bigint();
        this.nextTickNs = now;
        this.nextNetNs = now;
        
        console.log(`[FISH3D-ENGINE] Starting game loop for room ${this.roomCode}`);
        this.runGameLoop(io);
    }
    
    /**
     * Stop game loop
     */
    stopGameLoop() {
        this.loopRunning = false;
        this.gameStarted = false;
        console.log(`[FISH3D-ENGINE] Game loop stopped for room ${this.roomCode}`);
    }
    
    /**
     * Main game loop
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
                
                // DEBUG: Log fish count every 60 ticks (1 second at 60 tick rate)
                if (this.serverTick % 60 === 0) {
                    const fishTypes = {};
                    let movingFish = 0;
                    for (const [id, fish] of this.fish) {
                        fishTypes[fish.typeName] = (fishTypes[fish.typeName] || 0) + 1;
                        if (fish.velocityX !== 0 || fish.velocityZ !== 0) movingFish++;
                    }
                    console.log(`[FISH3D-ENGINE] Room ${this.roomCode} tick=${this.serverTick}: fish=${this.fish.size} (moving=${movingFish}), bullets=${this.bullets.size}, players=${this.players.size}`);
                }
                
                // Update fish positions
                this.updateFish(fixedDt, io);
                
                // Update bullet positions
                this.updateBullets(fixedDt, io);
                
                // Check collisions
                this.checkCollisions(io);
                
                // Update boss wave state
                this.updateBossWaveState(io);
                
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
            console.error(`[FISH3D-ENGINE] Game loop error:`, err);
            setImmediate(() => this.runGameLoop(io));
        }
    }
    
    /**
     * Update fish positions
     */
    updateFish(dt, io) {
        const bounds = this.MAP_BOUNDS;
        const margin = 20;
        
        for (const [fishId, fish] of this.fish) {
            if (!fish.isAlive) continue;
            
            fish.prevX = fish.x;
            fish.prevZ = fish.z;
            
            fish.x += fish.velocityX * dt;
            fish.z += fish.velocityZ * dt;
            
            // Remove fish that leave bounds
            if (fish.x < bounds.minX - margin || fish.x > bounds.maxX + margin ||
                fish.z < bounds.minZ - margin || fish.z > bounds.maxZ + margin) {
                this.fish.delete(fishId);
            }
        }
    }
    
    /**
     * Update bullet positions
     */
    updateBullets(dt, io) {
        const now = Date.now();
        const bounds = this.MAP_BOUNDS;
        const margin = 10;
        
        for (const [bulletId, bullet] of this.bullets) {
            if (bullet.hasHit) continue;
            
            bullet.prevX = bullet.x;
            bullet.prevZ = bullet.z;
            
            bullet.x += bullet.velocityX * dt;
            bullet.z += bullet.velocityZ * dt;
            
            // Remove expired or out-of-bounds bullets
            if (now - bullet.spawnTime > this.BULLET_LIFETIME ||
                bullet.x < bounds.minX - margin || bullet.x > bounds.maxX + margin ||
                bullet.z < bounds.minZ - margin || bullet.z > bounds.maxZ + margin) {
                this.bullets.delete(bulletId);
            }
        }
    }
    
    /**
     * Check bullet-fish collisions (2D line-circle intersection)
     * Supports penetrating weapons (20x) that can hit up to 5 fish with damage reduction
     */
    checkCollisions(io) {
        for (const [bulletId, bullet] of this.bullets) {
            if (bullet.hasHit) continue;
            
            const weapon = WEAPONS[bullet.weapon];
            const isLaser = weapon.type === 'laser';
            const isRocket = weapon.type === 'rocket';
            const isMultiTarget = isLaser || isRocket;
            const maxPenetrations = isLaser ? (weapon.maxTargets || 6) : 1;
            let penetrationCount = bullet.penetrationCount || 0;
            
            const fishHitThisTick = [];
            
            for (const [fishId, fish] of this.fish) {
                if (!fish.isAlive) continue;
                if (bullet.fishAlreadyHit && bullet.fishAlreadyHit.has(fishId)) continue;
                
                const fishRadius = (fish.size / 10) * this.FISH_BASE_RADIUS;
                const combinedRadius = fishRadius + this.BULLET_RADIUS;
                
                const distToFish = Math.sqrt(
                    Math.pow(bullet.x - fish.x, 2) + Math.pow(bullet.z - fish.z, 2)
                );
                
                let hit = false;
                if (isRocket) {
                    hit = distToFish <= (weapon.aoeRadius || 15);
                } else {
                    hit = this.lineCircleIntersection(
                        bullet.prevX, bullet.prevZ,
                        bullet.x, bullet.z,
                        fish.x, fish.z,
                        combinedRadius
                    );
                }
                
                if (hit) {
                    fishHitThisTick.push({ fishId, fish, distToFish });
                }
            }
            
            fishHitThisTick.sort((a, b) => a.distToFish - b.distToFish);
            
            if (isRocket && fishHitThisTick.length > 0) {
                const trimmed = fishHitThisTick.slice(0, weapon.maxTargets || 8);
                const hitList = trimmed.map(h => ({
                    fishId: h.fishId,
                    tier: h.fish.tier,
                    distance: h.distToFish
                }));
                
                const results = this.rtpEngine.handleMultiTargetHit(
                    bullet.ownerSocketId,
                    hitList,
                    bullet.cost * MONEY_SCALE,
                    'aoe'
                );
                
                const shooter = this.players.get(bullet.ownerSocketId);
                if (shooter) {
                    shooter.totalHits++;
                    anomalyDetector.recordHit(bullet.ownerSocketId, bullet.weapon);
                }
                
                for (const result of results) {
                    const hitEntry = trimmed.find(h => h.fishId === result.fishId);
                    if (!hitEntry) continue;
                    
                    io.to(this.roomCode).emit('fishHit', {
                        fishId: result.fishId,
                        bulletId,
                        damage: 0,
                        newHealth: hitEntry.fish.health,
                        maxHealth: hitEntry.fish.maxHealth,
                        hitByPlayerId: shooter ? shooter.playerId : null,
                        isAOE: true
                    });
                    
                    if (result.kill) {
                        this.handleFishKill(hitEntry.fish, bullet, io, result);
                    }
                }
                
                bullet.hasHit = true;
                this.bullets.delete(bulletId);
                continue;
            }
            
            for (const { fishId, fish, distToFish } of fishHitThisTick) {
                if (penetrationCount >= maxPenetrations) break;
                
                const shooter = this.players.get(bullet.ownerSocketId);
                if (shooter) {
                    shooter.totalHits++;
                    anomalyDetector.recordHit(bullet.ownerSocketId, bullet.weapon);
                }
                
                if (!bullet.fishAlreadyHit) bullet.fishAlreadyHit = new Set();
                bullet.fishAlreadyHit.add(fishId);
                penetrationCount++;
                bullet.penetrationCount = penetrationCount;
                
                const currentCost = fish.costByPlayer.get(bullet.ownerSocketId) || 0;
                fish.costByPlayer.set(bullet.ownerSocketId, currentCost + bullet.cost);
                
                fish.lastHitBy = bullet.ownerSocketId;
                
                if (isLaser) {
                    const hitList = [{
                        fishId,
                        tier: fish.tier,
                        distance: distToFish
                    }];
                    
                    const results = this.rtpEngine.handleMultiTargetHit(
                        bullet.ownerSocketId,
                        hitList,
                        bullet.cost * MONEY_SCALE,
                        'laser'
                    );
                    
                    io.to(this.roomCode).emit('fishHit', {
                        fishId,
                        bulletId,
                        damage: 0,
                        newHealth: fish.health,
                        maxHealth: fish.maxHealth,
                        hitByPlayerId: shooter ? shooter.playerId : null,
                        isPenetrating: true,
                        penetrationIndex: penetrationCount - 1
                    });
                    
                    if (results.length > 0 && results[0].kill) {
                        this.handleFishKill(fish, bullet, io, results[0]);
                    }
                } else {
                    const costFp = bullet.cost * MONEY_SCALE;
                    const result = this.rtpEngine.handleSingleTargetHit(
                        bullet.ownerSocketId,
                        fishId,
                        costFp,
                        fish.tier
                    );
                    
                    io.to(this.roomCode).emit('fishHit', {
                        fishId,
                        bulletId,
                        damage: 0,
                        newHealth: fish.health,
                        maxHealth: fish.maxHealth,
                        hitByPlayerId: shooter ? shooter.playerId : null
                    });
                    
                    if (result.kill) {
                        this.handleFishKill(fish, bullet, io, result);
                    }
                }
                
                if (!isLaser) {
                    bullet.hasHit = true;
                    this.bullets.delete(bulletId);
                    break;
                }
            }
            
            if (isLaser && penetrationCount >= maxPenetrations) {
                bullet.hasHit = true;
                this.bullets.delete(bulletId);
            }
        }
    }
    
    handleFishKill(fish, bullet, io, rtpResult) {
        fish.isAlive = false;
        
        const killerSocketId = bullet.ownerSocketId;
        const killer = this.players.get(killerSocketId);
        const totalReward = rtpResult.reward;
        
        const rewardDistribution = [];
        
        if (killer && totalReward > 0) {
            killer.balance += totalReward;
            killer.score += totalReward;
            killer.totalKills++;
            
            rewardDistribution.push({
                playerId: killer.playerId,
                socketId: killerSocketId,
                cost: fish.costByPlayer.get(killerSocketId) || 0,
                percent: 100,
                reward: totalReward
            });
            
            io.to(killerSocketId).emit('balanceUpdate', {
                balance: killer.balance,
                change: totalReward,
                reason: 'fishKill',
                fishType: fish.typeName,
                killEventId: rtpResult.killEventId
            });
        }
        
        if (fish.isBoss) {
            this.killsSinceLastBoss = 0;
            if (fish.fishId === this.currentBoss) {
                this.currentBoss = null;
            }
        } else {
            this.killsSinceLastBoss++;
        }
        
        const rulesHash = this.configHashManager ? this.configHashManager.getHash() : null;
        const rulesVersion = this.configHashManager ? this.configHashManager.getVersion() : null;
        
        io.to(this.roomCode).emit('fishKilled', {
            fishId: fish.fishId,
            typeName: fish.typeName,
            topContributorId: killer ? killer.playerId : null,
            totalReward: totalReward,
            rewardDistribution: rewardDistribution,
            isBoss: fish.isBoss,
            position: { x: fish.x, z: fish.z },
            seedCommitment: fish.seedCommitment,
            rulesHash: rulesHash,
            killEventId: rtpResult.killEventId,
            killReason: rtpResult.reason
        });
        
        const receipt = createFishDeathReceipt(
            fish,
            rewardDistribution,
            totalReward,
            rulesHash,
            rulesVersion,
            fish.seedCommitment
        );
        this.receiptChain.addReceipt(receipt);
        
        this.rtpEngine.clearFishStates(fish.fishId);
        this.fish.delete(fish.fishId);
    }
    
    /**
     * Line-circle intersection test
     */
    lineCircleIntersection(x1, z1, x2, z2, cx, cz, r) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const fx = x1 - cx;
        const fz = z1 - cz;
        
        const a = dx * dx + dz * dz;
        const b = 2 * (fx * dx + fz * dz);
        const c = fx * fx + fz * fz - r * r;
        
        let discriminant = b * b - 4 * a * c;
        
        if (discriminant < 0) return false;
        
        discriminant = Math.sqrt(discriminant);
        const t1 = (-b - discriminant) / (2 * a);
        const t2 = (-b + discriminant) / (2 * a);
        
        return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
    }
    
    /**
     * Update boss wave state
     */
    updateBossWaveState(io) {
        const now = Date.now();
        
        if (this.bossWaveActive) {
            // Check if boss wave should end
            if (now - this.bossWaveStartTime > this.bossWaveDuration || this.currentBoss === null) {
                this.endBossWave(io);
            }
        } else {
            // Check if boss wave should start
            if (this.killsSinceLastBoss >= this.killsToTriggerBoss ||
                now - this.lastWaveChange > this.normalWaveDuration) {
                this.startBossWave(io);
            }
        }
    }
    
    /**
     * Start boss wave
     */
    startBossWave(io) {
        this.bossWaveActive = true;
        this.bossWaveStartTime = Date.now();
        this.killsSinceLastBoss = 0;
        
        console.log(`[FISH3D-ENGINE] === BOSS WAVE STARTED ===`);
        
        io.to(this.roomCode).emit('bossWaveStarted', {
            duration: this.bossWaveDuration
        });
        
        // Spawn boss
        this.spawnFish(true);
    }
    
    /**
     * End boss wave
     */
    endBossWave(io) {
        this.bossWaveActive = false;
        this.currentBoss = null;
        this.lastWaveChange = Date.now();
        
        console.log(`[FISH3D-ENGINE] === BOSS WAVE ENDED ===`);
        
        io.to(this.roomCode).emit('bossWaveEnded', {});
    }
    
    /**
     * Broadcast game state to all players
     */
    broadcastGameState(io) {
        const fishArray = [];
        for (const [fishId, fish] of this.fish) {
            if (!fish.isAlive) continue;
            fishArray.push({
                id: fish.fishId,
                type: fish.typeName,
                x: fish.x,
                z: fish.z,
                vx: fish.velocityX,
                vz: fish.velocityZ,
                rot: fish.rotation,
                hp: fish.health,
                maxHp: fish.maxHealth,
                size: fish.size,
                isBoss: fish.isBoss
            });
        }
        
        const bulletsArray = [];
        for (const [bulletId, bullet] of this.bullets) {
            if (bullet.hasHit) continue;
            bulletsArray.push({
                id: bullet.bulletId,
                owner: bullet.ownerId,
                x: bullet.x,
                z: bullet.z,
                vx: bullet.velocityX,
                vz: bullet.velocityZ,
                rot: bullet.rotation,
                weapon: bullet.weapon  // Add weapon for visual sync
            });
        }
        
        // Debug: Log bullet count periodically
        if (bulletsArray.length > 0 && this.serverTick % 20 === 0) {
            console.log(`[FISH3D-ENGINE] Broadcasting ${bulletsArray.length} bullets to room ${this.roomCode}`);
        }
        
        const playersArray = [];
        for (const [socketId, player] of this.players) {
            playersArray.push({
                id: player.playerId,
                slot: player.slotIndex,
                name: player.playerName,
                x: player.cannonX,
                z: player.cannonZ,
                yaw: player.cannonYaw,
                weapon: player.currentWeapon,
                balance: player.balance,
                score: player.score
            });
        }
        
        io.to(this.roomCode).emit('gameState', {
            tick: this.serverTick,
            timestamp: Date.now(),
            fish: fishArray,
            bullets: bulletsArray,
            players: playersArray,
            bossWave: this.bossWaveActive
        });
    }
    
    /**
     * Get current game snapshot
     */
    getSnapshot() {
        return {
            roomCode: this.roomCode,
            playerCount: this.players.size,
            fishCount: this.fish.size,
            bulletCount: this.bullets.size,
            bossWaveActive: this.bossWaveActive,
            serverTick: this.serverTick
        };
    }
    
    // M3: Get current seed commitment info
    getSeedCommitment() {
        return this.seedManager.getInfo();
    }
    
    // M3: Reveal current seed for verification
    revealSeed() {
        const reveal = this.seedManager.revealCurrentSeed();
        this.seedManager.rotateSeed();
        return reveal;
    }
    
    // M5: Get all receipts for this room
    getReceipts() {
        return this.receiptChain.getReceipts();
    }
    
    // M5: Verify the receipt chain integrity
    verifyReceiptChain() {
        return this.receiptChain.verifyChain();
    }
}

module.exports = { Fish3DGameEngine, FISH_SPECIES, WEAPONS, SeededRNG };
