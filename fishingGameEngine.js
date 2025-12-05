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
 * Fish type definitions with casino-style rewards
 */
const FISH_TYPES = {
    // Common fish (60% spawn rate)
    SMALL_FISH: { id: 1, name: 'Small Fish', health: 1, baseReward: 2, speed: 30, size: 1.0, spawnWeight: 20 },
    CLOWNFISH: { id: 2, name: 'Clownfish', health: 1, baseReward: 3, speed: 35, size: 1.2, spawnWeight: 15 },
    ANGELFISH: { id: 3, name: 'Angelfish', health: 2, baseReward: 5, speed: 25, size: 1.5, spawnWeight: 15 },
    BUTTERFLY_FISH: { id: 4, name: 'Butterfly Fish', health: 2, baseReward: 6, speed: 28, size: 1.3, spawnWeight: 10 },
    
    // Uncommon fish (25% spawn rate)
    PUFFERFISH: { id: 5, name: 'Pufferfish', health: 3, baseReward: 10, speed: 20, size: 2.0, spawnWeight: 8 },
    LIONFISH: { id: 6, name: 'Lionfish', health: 4, baseReward: 15, speed: 22, size: 2.2, spawnWeight: 7 },
    SEAHORSE: { id: 7, name: 'Seahorse', health: 3, baseReward: 12, speed: 15, size: 1.8, spawnWeight: 6 },
    
    // Rare fish (12% spawn rate)
    SHARK: { id: 8, name: 'Shark', health: 8, baseReward: 30, speed: 40, size: 4.0, spawnWeight: 4 },
    MANTA_RAY: { id: 9, name: 'Manta Ray', health: 6, baseReward: 25, speed: 18, size: 3.5, spawnWeight: 3 },
    
    // Legendary fish (3% spawn rate) - Casino jackpot potential
    GOLDEN_DRAGON: { id: 10, name: 'Golden Dragon', health: 15, baseReward: 100, speed: 25, size: 5.0, spawnWeight: 1, isLegendary: true }
};

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
        this.COLLISION_RADIUS = 8; // Hit detection radius
        
        // Map bounds (ocean area)
        this.MAP_BOUNDS = { 
            minX: -80, maxX: 80, 
            minZ: -60, maxZ: 60 
        };
        
        // Turret positions (fixed positions for each player slot)
        this.TURRET_POSITIONS = [
            { x: 0, z: 55 },      // Bottom center
            { x: -40, z: 55 },    // Bottom left
            { x: 40, z: 55 },     // Bottom right
            { x: -60, z: 55 },    // Far left
            { x: 60, z: 55 },     // Far right
            { x: -20, z: 55 },    // Left of center
            { x: 20, z: 55 },     // Right of center
            { x: 0, z: -55 }      // Top center (for spectator/special)
        ];
        
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
    addPlayer(socketId, playerId) {
        const turretPosition = this.TURRET_POSITIONS[playerId - 1] || { x: 0, z: 55 };
        
        this.players.set(socketId, {
            socketId,
            playerId,
            coins: 10000, // Starting coins
            totalWinnings: 0,
            totalBets: 0,
            currentBet: 10, // Default bet amount
            turretX: turretPosition.x,
            turretZ: turretPosition.z,
            turretRotation: 0, // Facing up (toward fish)
            lastShotTime: 0,
            shotCooldown: 200, // 200ms between shots
            combo: 0,
            lastKillTime: 0
        });
        
        console.log(`[FISHING-ENGINE] Player ${playerId} added at turret position (${turretPosition.x}, ${turretPosition.z})`);
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
     * Spawn a new fish
     */
    spawnFish() {
        if (this.fish.size >= this.maxFish) return null;
        
        const fishType = this.getRandomFishType();
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
            health: fishType.health,
            maxHealth: fishType.health,
            baseReward: fishType.baseReward,
            speed: fishType.speed,
            size: fishType.size,
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
        
        if (fishType.isLegendary) {
            console.log(`[FISHING-ENGINE] LEGENDARY FISH SPAWNED: ${fishType.name} (ID: ${fishId})`);
        }
        
        return fish;
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
     */
    calculateReward(fish, player, betAmount) {
        let reward = fish.baseReward * betAmount;
        
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
        
        // Legendary fish jackpot chance
        let jackpotWin = 0;
        if (fish.isLegendary && Math.random() < 0.1) { // 10% chance on legendary kill
            jackpotWin = this.jackpot;
            this.jackpot = 1000; // Reset jackpot
        }
        
        return {
            baseReward: fish.baseReward * betAmount,
            comboMultiplier,
            combo: player.combo,
            finalReward: reward,
            jackpotWin
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
                const hit = this.lineCircleIntersection(
                    bullet.prevX, bullet.prevZ,
                    bullet.x, bullet.z,
                    fish.x, fish.z,
                    this.COLLISION_RADIUS * fish.size
                );
                
                if (hit) {
                    bullet.hasHit = true;
                    fish.health--;
                    
                    const player = this.players.get(bullet.ownerSocketId);
                    
                    // Broadcast hit effect
                    io.to(this.roomCode).emit('bulletHit', {
                        bulletId,
                        fishId,
                        hitX: bullet.x,
                        hitZ: bullet.z,
                        fishHealth: fish.health,
                        fishMaxHealth: fish.maxHealth
                    });
                    
                    // Check if fish is killed
                    if (fish.health <= 0) {
                        if (player) {
                            const reward = this.calculateReward(fish, player, bullet.betAmount);
                            player.coins += reward.finalReward + reward.jackpotWin;
                            player.totalWinnings += reward.finalReward + reward.jackpotWin;
                            
                            // Broadcast fish killed
                            io.to(this.roomCode).emit('fishKilled', {
                                fishId,
                                fishType: fish.typeName,
                                isLegendary: fish.isLegendary,
                                killerId: player.playerId,
                                reward: reward.finalReward,
                                combo: reward.combo,
                                comboMultiplier: reward.comboMultiplier,
                                jackpotWin: reward.jackpotWin,
                                x: fish.x,
                                z: fish.z
                            });
                            
                            // Send coin update to killer
                            io.to(bullet.ownerSocketId).emit('coinUpdate', {
                                coins: player.coins,
                                change: reward.finalReward + reward.jackpotWin,
                                reason: 'kill',
                                fishType: fish.typeName,
                                combo: reward.combo
                            });
                            
                            if (reward.jackpotWin > 0) {
                                io.to(this.roomCode).emit('jackpotWon', {
                                    playerId: player.playerId,
                                    amount: reward.jackpotWin,
                                    newJackpot: this.jackpot
                                });
                            }
                        }
                        
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
            health: f.health,
            maxHealth: f.maxHealth,
            size: f.size,
            isLegendary: f.isLegendary,
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
                rotation: b.rotation
            }));
        
        const playersArray = Array.from(this.players.values()).map(p => ({
            playerId: p.playerId,
            coins: p.coins,
            currentBet: p.currentBet,
            turretX: p.turretX,
            turretZ: p.turretZ,
            turretRotation: p.turretRotation,
            combo: p.combo
        }));
        
        io.to(this.roomCode).emit('serverGameState', {
            serverTick: this.serverTick,
            serverTime: Date.now(),
            fish: fishArray,
            bullets: bulletsArray,
            players: playersArray,
            jackpot: this.jackpot
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

module.exports = { FishingGameEngine, FISH_TYPES };
