/**
 * 3D Fish Shooting Game Engine - Server-Authoritative
 * Adapted for 3D aquarium fish shooting game with 1-4 players
 * 
 * Features:
 * - Server-authoritative fish spawning and movement (2D plane, Y is visual only)
 * - 4-player support with positioned cannons
 * - Last-hit-wins kill attribution
 * - Boss fish system
 * - Weapon multipliers (1x, 3x, 5x, 8x, 20x)
 * - Seeded RNG for deterministic fish spawning
 */

const { performance } = require('perf_hooks');

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
 * Fish Species Configuration - Matches 3D Game (game.js CONFIG.fishTiers)
 * Server uses 2D coordinates (x, z), client adds Y for visual depth
 */
const FISH_SPECIES = {
    // ==================== LARGE PREDATORS (Boss-tier) ====================
    blueWhale: {
        id: 1, name: 'Blue Whale', category: 'boss', tier: 'legendary',
        health: 100, multiplier: 500, speed: 25, size: 140,
        spawnWeight: 0.05, isBoss: true, isLegendary: true,
        color: 0x4477aa, movementPattern: 'cruise'
    },
    greatWhiteShark: {
        id: 2, name: 'Great White Shark', category: 'boss', tier: 'boss',
        health: 80, multiplier: 400, speed: 60, size: 100,
        spawnWeight: 0.1, isBoss: true,
        color: 0x667788, movementPattern: 'burstAttack'
    },
    marlin: {
        id: 3, name: 'Marlin', category: 'large', tier: 'large',
        health: 50, multiplier: 300, speed: 100, size: 80,
        spawnWeight: 0.3,
        color: 0x2266aa, movementPattern: 'burstSprint'
    },
    hammerheadShark: {
        id: 4, name: 'Hammerhead Shark', category: 'large', tier: 'large',
        health: 55, multiplier: 300, speed: 50, size: 85,
        spawnWeight: 0.3,
        color: 0x556677, movementPattern: 'sShape'
    },
    
    // ==================== MEDIUM-LARGE FISH ====================
    yellowfinTuna: {
        id: 5, name: 'Yellowfin Tuna', category: 'medium', tier: 'medium',
        health: 25, multiplier: 250, speed: 80, size: 50,
        spawnWeight: 1,
        color: 0x3355aa, movementPattern: 'synchronizedFast'
    },
    mahiMahi: {
        id: 6, name: 'Mahi-Mahi', category: 'medium', tier: 'medium',
        health: 20, multiplier: 200, speed: 70, size: 45,
        spawnWeight: 1.2,
        color: 0x44aa44, movementPattern: 'irregularTurns'
    },
    barracuda: {
        id: 7, name: 'Barracuda', category: 'medium', tier: 'medium',
        health: 22, multiplier: 200, speed: 90, size: 55,
        spawnWeight: 1,
        color: 0xaabbcc, movementPattern: 'ambush'
    },
    grouper: {
        id: 8, name: 'Grouper', category: 'medium', tier: 'medium',
        health: 30, multiplier: 180, speed: 30, size: 60,
        spawnWeight: 0.8,
        color: 0x886644, movementPattern: 'bottomBurst'
    },
    
    // ==================== REEF FISH ====================
    parrotfish: {
        id: 9, name: 'Parrotfish', category: 'small', tier: 'normal',
        health: 12, multiplier: 150, speed: 45, size: 35,
        spawnWeight: 2,
        color: 0x44ddaa, movementPattern: 'stopAndGo'
    },
    angelfish: {
        id: 10, name: 'Angelfish', category: 'small', tier: 'normal',
        health: 10, multiplier: 120, speed: 40, size: 30,
        spawnWeight: 2.5,
        color: 0xffdd44, movementPattern: 'elegantGlide'
    },
    butterflyfish: {
        id: 11, name: 'Butterflyfish', category: 'small', tier: 'normal',
        health: 8, multiplier: 100, speed: 50, size: 22,
        spawnWeight: 3,
        color: 0xffffaa, movementPattern: 'agileWeave'
    },
    blueTang: {
        id: 12, name: 'Blue Tang', category: 'small', tier: 'normal',
        health: 6, multiplier: 100, speed: 55, size: 20,
        spawnWeight: 3.5,
        color: 0x2288ff, movementPattern: 'groupCoordination'
    },
    
    // ==================== SMALL SCHOOLING FISH ====================
    sardine: {
        id: 13, name: 'Sardine', category: 'tiny', tier: 'normal',
        health: 2, multiplier: 50, speed: 90, size: 10,
        spawnWeight: 8,
        color: 0xccddee, movementPattern: 'waveFormation'
    },
    anchovy: {
        id: 14, name: 'Anchovy', category: 'tiny', tier: 'normal',
        health: 1, multiplier: 40, speed: 100, size: 8,
        spawnWeight: 10,
        color: 0xaabbcc, movementPattern: 'baitBall'
    },
    clownfish: {
        id: 15, name: 'Clownfish', category: 'small', tier: 'normal',
        health: 5, multiplier: 80, speed: 35, size: 15,
        spawnWeight: 4,
        color: 0xff6600, movementPattern: 'territorial'
    },
    damselfish: {
        id: 16, name: 'Damselfish', category: 'tiny', tier: 'normal',
        health: 4, multiplier: 60, speed: 60, size: 12,
        spawnWeight: 5,
        color: 0x6644ff, movementPattern: 'defensiveCharge'
    },
    
    // ==================== SPECIAL FORM FISH ====================
    mantaRay: {
        id: 17, name: 'Manta Ray', category: 'large', tier: 'large',
        health: 45, multiplier: 280, speed: 45, size: 90,
        spawnWeight: 0.4,
        color: 0x222233, movementPattern: 'wingGlide'
    },
    pufferfish: {
        id: 18, name: 'Pufferfish', category: 'small', tier: 'normal',
        health: 15, multiplier: 120, speed: 25, size: 25,
        spawnWeight: 2,
        color: 0xddcc88, movementPattern: 'slowRotation'
    },
    seahorse: {
        id: 19, name: 'Seahorse', category: 'small', tier: 'normal',
        health: 10, multiplier: 150, speed: 18, size: 20,
        spawnWeight: 1.5,
        color: 0xffaa44, movementPattern: 'verticalDrift'
    },
    flyingFish: {
        id: 20, name: 'Flying Fish', category: 'small', tier: 'normal',
        health: 8, multiplier: 100, speed: 120, size: 18,
        spawnWeight: 2,
        color: 0x4488cc, movementPattern: 'glideJump'
    },
    
    // ==================== SPECIAL ABILITY FISH ====================
    bombCrab: {
        id: 21, name: 'Bomb Crab', category: 'special', tier: 'special',
        health: 18, multiplier: 200, speed: 30, size: 35,
        spawnWeight: 0.5, isSpecial: true, specialType: 'bomb',
        color: 0xff4400, movementPattern: 'slowRotation',
        abilityRadius: 200, abilityDamage: 50
    },
    electricEel: {
        id: 22, name: 'Electric Eel', category: 'special', tier: 'special',
        health: 22, multiplier: 250, speed: 50, size: 50,
        spawnWeight: 0.4, isSpecial: true, specialType: 'chain',
        color: 0x00ffff, movementPattern: 'snakeWave',
        chainTargets: 3, chainDamage: 30
    }
};

// Calculate total spawn weight
const TOTAL_SPAWN_WEIGHT = Object.values(FISH_SPECIES).reduce((sum, fish) => sum + fish.spawnWeight, 0);

/**
 * Weapon Configuration - Matches 3D Game
 */
const WEAPONS = {
    '1x': { multiplier: 1, cost: 1, cooldown: 200, damage: 1 },
    '3x': { multiplier: 3, cost: 3, cooldown: 300, damage: 3 },
    '5x': { multiplier: 5, cost: 5, cooldown: 400, damage: 5 },
    '8x': { multiplier: 8, cost: 8, cooldown: 500, damage: 8 },
    '20x': { multiplier: 20, cost: 200, cooldown: 1000, damage: 20 }
};

/**
 * 3D Fish Shooting Game Engine
 */
class Fish3DGameEngine {
    constructor(roomCode, seed = null) {
        this.roomCode = roomCode;
        this.rng = new SeededRNG(seed || Date.now());
        
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
        const speed = fishType.speed * (0.8 + this.rng.next() * 0.4); // ±20% speed variation
        
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
            
            // Stats
            health: fishType.health,
            maxHealth: fishType.health,
            multiplier: fishType.multiplier,
            size: fishType.size,
            
            // Damage tracking (for last-hit-wins)
            lastHitBy: null,
            damageByPlayer: new Map(),
            
            // Flags
            isBoss: fishType.isBoss || false,
            isSpecial: fishType.isSpecial || false,
            specialType: fishType.specialType || null,
            isAlive: true,
            
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
     */
    handleShoot(socketId, targetX, targetZ, io) {
        const player = this.players.get(socketId);
        if (!player) return null;
        
        const now = Date.now();
        const weapon = WEAPONS[player.currentWeapon];
        
        // Check cooldown
        if (now - player.lastShotTime < weapon.cooldown) {
            return null;
        }
        
        // Check balance
        if (player.balance < weapon.cost) {
            io.to(socketId).emit('insufficientBalance', {
                required: weapon.cost,
                current: player.balance
            });
            return null;
        }
        
        // Deduct cost
        player.balance -= weapon.cost;
        player.lastShotTime = now;
        player.totalShots++;
        
        // Calculate bullet direction
        const dx = targetX - player.cannonX;
        const dz = targetZ - player.cannonZ;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < 0.1) return null;
        
        const normalizedDx = dx / distance;
        const normalizedDz = dz / distance;
        
        // Update cannon rotation
        player.cannonYaw = Math.atan2(dx, -dz);
        
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
        
        // Broadcast bullet spawn
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
        
        // Send balance update to shooter
        io.to(socketId).emit('balanceUpdate', {
            balance: player.balance,
            change: -weapon.cost,
            reason: 'shot'
        });
        
        return bullet;
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
     */
    checkCollisions(io) {
        for (const [bulletId, bullet] of this.bullets) {
            if (bullet.hasHit) continue;
            
            for (const [fishId, fish] of this.fish) {
                if (!fish.isAlive) continue;
                
                // Line-circle intersection test
                const fishRadius = (fish.size / 10) * this.FISH_BASE_RADIUS;
                const hit = this.lineCircleIntersection(
                    bullet.prevX, bullet.prevZ,
                    bullet.x, bullet.z,
                    fish.x, fish.z,
                    fishRadius + this.BULLET_RADIUS
                );
                
                if (hit) {
                    bullet.hasHit = true;
                    this.bullets.delete(bulletId);
                    
                    // Apply damage
                    const damage = bullet.damage;
                    fish.health -= damage;
                    fish.lastHitBy = bullet.ownerSocketId;
                    
                    // Track damage per player
                    const currentDamage = fish.damageByPlayer.get(bullet.ownerSocketId) || 0;
                    fish.damageByPlayer.set(bullet.ownerSocketId, currentDamage + damage);
                    
                    // Update player stats
                    const shooter = this.players.get(bullet.ownerSocketId);
                    if (shooter) {
                        shooter.totalHits++;
                    }
                    
                    // Broadcast hit
                    io.to(this.roomCode).emit('fishHit', {
                        fishId,
                        bulletId,
                        damage,
                        newHealth: fish.health,
                        maxHealth: fish.maxHealth,
                        hitByPlayerId: shooter ? shooter.playerId : null
                    });
                    
                    // Check if fish is killed
                    if (fish.health <= 0) {
                        this.handleFishKill(fish, bullet, io);
                    }
                    
                    break; // Bullet can only hit one fish
                }
            }
        }
    }
    
    /**
     * Handle fish kill (last-hit-wins)
     */
    handleFishKill(fish, bullet, io) {
        fish.isAlive = false;
        
        const killer = this.players.get(fish.lastHitBy);
        if (!killer) {
            this.fish.delete(fish.fishId);
            return;
        }
        
        // Calculate reward: multiplier * weapon cost
        const weapon = WEAPONS[bullet.weapon];
        const reward = fish.multiplier * weapon.multiplier;
        
        // Award to killer
        killer.balance += reward;
        killer.score += reward;
        killer.totalKills++;
        
        // Track boss kills
        if (fish.isBoss) {
            this.killsSinceLastBoss = 0;
            if (fish.fishId === this.currentBoss) {
                this.currentBoss = null;
            }
            console.log(`[FISH3D-ENGINE] BOSS KILLED: ${fish.typeName} by Player ${killer.playerId} for ${reward} coins!`);
        } else {
            this.killsSinceLastBoss++;
        }
        
        // Broadcast kill
        io.to(this.roomCode).emit('fishKilled', {
            fishId: fish.fishId,
            typeName: fish.typeName,
            killedByPlayerId: killer.playerId,
            killedBySocketId: fish.lastHitBy,
            reward,
            isBoss: fish.isBoss,
            position: { x: fish.x, z: fish.z }
        });
        
        // Send balance update to killer
        io.to(fish.lastHitBy).emit('balanceUpdate', {
            balance: killer.balance,
            change: reward,
            reason: 'kill',
            fishType: fish.typeName
        });
        
        // Handle special fish abilities
        if (fish.isSpecial && fish.specialType === 'bomb') {
            this.handleBombExplosion(fish, killer, io);
        }
        
        this.fish.delete(fish.fishId);
    }
    
    /**
     * Handle bomb crab explosion
     */
    handleBombExplosion(bombFish, killer, io) {
        const explosionRadius = 15; // 2D radius
        const explosionDamage = 30;
        
        const affectedFish = [];
        
        for (const [fishId, fish] of this.fish) {
            if (!fish.isAlive || fishId === bombFish.fishId) continue;
            
            const dx = fish.x - bombFish.x;
            const dz = fish.z - bombFish.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance <= explosionRadius) {
                fish.health -= explosionDamage;
                fish.lastHitBy = killer.socketId;
                
                affectedFish.push({
                    fishId,
                    newHealth: fish.health,
                    killed: fish.health <= 0
                });
                
                if (fish.health <= 0) {
                    // Create a fake bullet for the kill attribution
                    const fakeBullet = {
                        weapon: killer.currentWeapon,
                        ownerSocketId: killer.socketId
                    };
                    this.handleFishKill(fish, fakeBullet, io);
                }
            }
        }
        
        io.to(this.roomCode).emit('bombExplosion', {
            position: { x: bombFish.x, z: bombFish.z },
            radius: explosionRadius,
            affectedFish
        });
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
                rot: bullet.rotation
            });
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
}

module.exports = { Fish3DGameEngine, FISH_SPECIES, WEAPONS, SeededRNG };
