/**
 * 3D Fish Shooting Game Socket Server
 * Multiplayer server for 1-4 player fish shooting game
 * 
 * Features:
 * - Room management (create, join, leave)
 * - 4-player support with positioned cannons
 * - Real-time fish/bullet synchronization
 * - Last-hit-wins kill attribution
 * - Boss wave system
 * - Security architecture (CSPRNG, session management, nonce tracking)
 * 
 * Security Features (PDF Specification):
 * - Server-authoritative game state
 * - CSPRNG for all random outcomes
 * - Session management with nonce tracking
 * - RTP values: 1x=91%, 3x=93%, 5x=94%, 8x=95%
 */

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const { Fish3DGameEngine, FISH_SPECIES, WEAPONS } = require('./fish3DGameEngine');

// Security modules
const { sessionManager } = require('./src/session/SessionManager');
const { serverCSPRNG } = require('./src/rng/CSPRNG');
const { GAME_CONFIG } = require('./src/rng/HitMath');
const { rateLimiter } = require('./src/security/RateLimiter');

// Binary protocol modules (PDF Specification Section 4.3)
const { BinaryWebSocketServer } = require('./src/protocol/BinaryWebSocketServer');

// Governance Modules (M1-M6)
const { sequenceTracker } = require('./src/modules/SequenceTracker');
const { validateTimestamp } = require('./src/modules/LagCompensation');
const { anomalyDetector, ESCALATION_LEVELS } = require('./src/modules/AnomalyDetector');
const { ConfigHashManager } = require('./src/modules/ConfigHash');

const ENFORCEMENT_PHASE = 3;

process.on('uncaughtException', (err) => {
    console.error('[FATAL][uncaughtException]', err);
    console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL][unhandledRejection]', reason);
});

const app = express();
app.use(cors());

// Health check endpoint
app.get('/', (req, res) => {
    res.send('3D Fish Shooting Game Server is running');
});

app.get('/health', (req, res) => {
    // Get FISH_SPEED_SCALE from any active game engine, or create a temp one to check
    let fishSpeedScale = null;
    const activeEngines = Object.values(gameEngines);
    if (activeEngines.length > 0) {
        fishSpeedScale = activeEngines[0].FISH_SPEED_SCALE;
    } else {
        // Create a temporary engine to check the scale value
        const tempEngine = new Fish3DGameEngine('temp');
        fishSpeedScale = tempEngine.FISH_SPEED_SCALE;
    }
    
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        rooms: Object.keys(rooms).length,
        version: '4.0.0-governance-modules',
        governance: configHashManager.getInfo(),
        fishSpeedScale: fishSpeedScale,
        security: {
            sessionManagement: true,
            csprng: true,
            aesGcmEncryption: true,
            hmacVerification: true,
            rateLimiting: true,
            binaryProtocol: true,
            rtpValues: {
                '1x': '91%',
                '3x': '93%',
                '5x': '94%',
                '8x': '95%'
            }
        },
        activeSessions: sessionManager.getActiveSessionCount(),
        rateLimiter: rateLimiter.getStats(),
        endpoints: {
            socketIO: '/',
            binaryWebSocket: '/ws-game'
        }
    });
});

// API endpoint to get fish species
app.get('/api/fish-species', (req, res) => {
    res.json(FISH_SPECIES);
});

// API endpoint to get weapons
app.get('/api/weapons', (req, res) => {
    res.json(WEAPONS);
});

// M6: API endpoint for config hash and version
app.get('/api/governance', (req, res) => {
    res.json({
        rulesHash: configHashManager.getHash(),
        rulesVersion: configHashManager.getVersion(),
        modules: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'],
        phase: ENFORCEMENT_PHASE >= 3 ? 'full' : ENFORCEMENT_PHASE >= 2 ? 'soft' : 'shadow',
        enforcementPhase: ENFORCEMENT_PHASE
    });
});

app.get('/api/verify', (req, res) => {
    res.type('text/html').send(`<!DOCTYPE html>
<html><head><title>Fish3D Receipt Verifier</title>
<style>
body{font-family:monospace;max-width:800px;margin:40px auto;padding:0 20px;background:#0a0a1a;color:#00ff88}
h1{color:#00ccff}h2{color:#ffaa00}
.pass{color:#00ff88}.fail{color:#ff4444}
textarea{width:100%;height:200px;background:#111;color:#0f0;border:1px solid #333;font-family:monospace;padding:8px}
button{background:#00ccff;color:#000;border:none;padding:10px 24px;cursor:pointer;font-weight:bold;margin:8px 0}
button:hover{background:#00aadd}
#result{padding:16px;margin:16px 0;border:1px solid #333}
table{width:100%;border-collapse:collapse}td,th{border:1px solid #333;padding:6px;text-align:left}
</style></head><body>
<h1>Fish3D Receipt Chain Verifier</h1>
<p>Paste your receipts JSON array below, or fetch from server:</p>
<button onclick="fetchReceipts()">Fetch from Server</button>
<textarea id="input" placeholder='[{"type":"FISH_DEATH",...}]'></textarea>
<button onclick="verify()">Verify Chain</button>
<div id="result"></div>
<script>
async function sha256(str){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function verify(){
const el=document.getElementById('result');
try{
const receipts=JSON.parse(document.getElementById('input').value);
if(!Array.isArray(receipts)){el.innerHTML='<span class="fail">Input must be a JSON array</span>';return}
let prev='GENESIS';let html='<h2>Chain Verification</h2><table><tr><th>#</th><th>Type</th><th>Fish</th><th>Payout</th><th>Hash</th><th>Status</th></tr>';
for(let i=0;i<receipts.length;i++){
const r=receipts[i];
const chainOk=r.prevHash===prev;
const{hash,...rest}=r;
const computed=await sha256(JSON.stringify(rest));
const hashOk=computed===hash;
const ok=chainOk&&hashOk;
html+='<tr><td>'+i+'</td><td>'+r.type+'</td><td>'+(r.fish_type||'-')+'</td><td>'+(r.payout_total||0)+'</td><td>'+(hash?hash.substring(0,12)+'...':'-')+'</td><td class="'+(ok?'pass':'fail')+'">'+(ok?'PASS':'FAIL'+(chainOk?'':' chain')+(hashOk?'':' hash'))+'</td></tr>';
prev=hash}
html+='</table><p class="'+(prev?'pass':'fail')+'">Total: '+receipts.length+' receipts verified</p>';
el.innerHTML=html}catch(e){el.innerHTML='<span class="fail">Error: '+e.message+'</span>'}}
function fetchReceipts(){document.getElementById('result').innerHTML='<p>Connect via Socket.IO and emit requestReceipts event to get receipts</p>'}
</script></body></html>`);
});

// M5: Client-side receipt verifier (served as JS)
app.get('/api/verifier.js', (req, res) => {
    res.type('application/javascript').send(`
// Fish3D Receipt Chain Verifier
// Usage: verifyChain(receipts) => { valid: boolean, error?: string }
function sha256(str) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
        .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
}
async function verifyChain(receipts) {
    let expectedPrevHash = 'GENESIS';
    for (let i = 0; i < receipts.length; i++) {
        const r = receipts[i];
        if (r.prevHash !== expectedPrevHash) {
            return { valid: false, error: 'Chain broken at index ' + i, index: i };
        }
        const { hash, ...rest } = r;
        const computed = await sha256(JSON.stringify(rest));
        if (computed !== hash) {
            return { valid: false, error: 'Hash mismatch at index ' + i, index: i };
        }
        expectedPrevHash = hash;
    }
    return { valid: true, length: receipts.length };
}
if (typeof module !== 'undefined') module.exports = { verifyChain, sha256 };
`);
});

// API endpoint to list public rooms
app.get('/api/rooms', (req, res) => {
    const publicRooms = [];
    for (const [roomCode, room] of Object.entries(rooms)) {
        if (room.isPublic && room.state === 'lobby') {
            publicRooms.push({
                roomCode,
                playerCount: room.playerCount,
                maxPlayers: 4,
                hostName: room.hostName,
                createdAt: room.createdAt
            });
        }
    }
    res.json(publicRooms);
});

const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    pingInterval: 15000,
    pingTimeout: 5000
});

// Room storage
const rooms = {};
const gameEngines = {}; // roomCode -> Fish3DGameEngine instance
const playerRooms = {}; // socketId -> roomCode

// M6: Initialize config hash on startup
const configHashManager = new ConfigHashManager({
    WEAPONS,
    FISH_SPECIES
});

/**
 * Generate a random room code
 */
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

io.on('connection', (socket) => {
    // Get client IP for rate limiting
    const clientIP = socket.handshake.headers['x-forwarded-for'] || 
                     socket.handshake.address || 
                     'unknown';
    
    // Check handshake rate limit
    const handshakeCheck = rateLimiter.checkHandshake(clientIP);
    if (!handshakeCheck.allowed) {
        console.warn(`[RATE-LIMIT] Connection rejected for IP ${clientIP}: ${handshakeCheck.reason}`);
        socket.emit('error', { message: 'Too many connections. Please try again later.' });
        socket.disconnect(true);
        return;
    }
    
    console.log(`[SOCKET] Client connected: ${socket.id} from IP: ${clientIP}`);
    
    // Register connection with rate limiter
    rateLimiter.registerConnection(socket.id, clientIP);
    
    // M1: Initialize sequence tracker for anti-replay
    sequenceTracker.initSession(socket.id);
    
    // Create session for this connection (security feature)
    const playerId = `player-${socket.id.substring(0, 8)}`;
    const session = sessionManager.createSession(playerId, socket.id);
    console.log(`[SECURITY] Session created: ${session.sessionId} for socket ${socket.id}`);
    
    // Time sync for interpolation
    socket.on('timeSyncPing', (data) => {
        // Rate limit time sync
        const timeSyncCheck = rateLimiter.checkTimeSync(socket.id);
        if (!timeSyncCheck.allowed) return;
        
        const { seq, clientSendTime } = data;
        socket.emit('timeSyncPong', {
            seq,
            serverTime: Date.now(),
            clientSendTime
        });
    });
    
    // ============ ROOM MANAGEMENT ============
    
    // Create a new room
    socket.on('createRoom', (data) => {
        // Rate limit room operations
        const roomCheck = rateLimiter.checkRoomAction(socket.id, clientIP);
        if (!roomCheck.allowed) {
            socket.emit('error', { message: 'Rate limit exceeded. Please wait before creating a room.' });
            return;
        }
        
        const { playerName, isPublic = true } = data;
        
        let roomCode = generateRoomCode();
        while (rooms[roomCode]) {
            roomCode = generateRoomCode();
        }
        
        rooms[roomCode] = {
            roomCode,
            hostSocket: socket.id,
            hostName: playerName || 'Host',
            isPublic,
            players: {
                [socket.id]: {
                    playerId: 1,
                    playerName: playerName || 'Player 1',
                    ready: false,
                    isHost: true
                }
            },
            playerCount: 1,
            maxPlayers: 4,
            state: 'lobby', // 'lobby', 'playing', 'ended'
            createdAt: Date.now()
        };
        
        // Create game engine (M6: pass configHashManager)
        gameEngines[roomCode] = new Fish3DGameEngine(roomCode, { configHashManager });
        gameEngines[roomCode].addPlayer(socket.id, 1, playerName || 'Player 1');
        
        socket.join(roomCode);
        playerRooms[socket.id] = roomCode;
        
        console.log(`[ROOM] Created room: ${roomCode} by ${playerName || 'Host'}`);
        
        socket.emit('roomCreated', {
            roomCode,
            playerId: 1,
            slotIndex: 0,
            isHost: true,
            rulesHash: configHashManager.getHash(),
            rulesVersion: configHashManager.getVersion(),
            enforcementPhase: ENFORCEMENT_PHASE
        });
        
        broadcastRoomState(roomCode);
    });
    
    // Join an existing room
    socket.on('joinRoom', (data) => {
        // Rate limit room operations
        const roomCheck = rateLimiter.checkRoomAction(socket.id, clientIP);
        if (!roomCheck.allowed) {
            socket.emit('joinError', { message: 'Rate limit exceeded. Please wait before joining a room.' });
            return;
        }
        
        const { roomCode, playerName } = data;
        
        if (!rooms[roomCode]) {
            socket.emit('joinError', { message: 'Room does not exist' });
            return;
        }
        
        const room = rooms[roomCode];
        
        if (room.playerCount >= room.maxPlayers) {
            socket.emit('joinError', { message: 'Room is full' });
            return;
        }
        
        if (room.state !== 'lobby') {
            socket.emit('joinError', { message: 'Game already in progress' });
            return;
        }
        
        const playerId = room.playerCount + 1;
        const name = playerName || `Player ${playerId}`;
        
        room.players[socket.id] = {
            playerId,
            playerName: name,
            ready: false,
            isHost: false
        };
        room.playerCount++;
        
        // Add to game engine
        const playerData = gameEngines[roomCode].addPlayer(socket.id, playerId, name);
        
        socket.join(roomCode);
        playerRooms[socket.id] = roomCode;
        
        console.log(`[ROOM] Player ${name} joined room ${roomCode} as Player ${playerId}`);
        
        socket.emit('joinSuccess', {
            roomCode,
            playerId,
            slotIndex: playerData.slotIndex,
            isHost: false,
            rulesHash: configHashManager.getHash(),
            rulesVersion: configHashManager.getVersion(),
            enforcementPhase: ENFORCEMENT_PHASE
        });
        
        // Notify others
        socket.to(roomCode).emit('playerJoined', {
            playerId,
            playerName: name,
            slotIndex: playerData.slotIndex
        });
        
        broadcastRoomState(roomCode);
    });
    
    // Leave room
    socket.on('leaveRoom', () => {
        handlePlayerLeave(socket);
    });
    
    // Player ready status
    socket.on('playerReady', (data) => {
        // Rate limit room operations
        const roomCheck = rateLimiter.checkRoomAction(socket.id, clientIP);
        if (!roomCheck.allowed) return;
        
        const { ready } = data;
        const roomCode = playerRooms[socket.id];
        
        if (!roomCode || !rooms[roomCode]) return;
        
        const room = rooms[roomCode];
        if (room.players[socket.id]) {
            room.players[socket.id].ready = ready;
            
            io.to(roomCode).emit('playerReadyUpdate', {
                playerId: room.players[socket.id].playerId,
                ready
            });
            
            broadcastRoomState(roomCode);
        }
    });
    
    // Start game (host only)
    socket.on('startGame', () => {
        // Rate limit room operations
        const roomCheck = rateLimiter.checkRoomAction(socket.id, clientIP);
        if (!roomCheck.allowed) {
            socket.emit('error', { message: 'Rate limit exceeded. Please wait.' });
            return;
        }
        
        const roomCode = playerRooms[socket.id];
        
        if (!roomCode || !rooms[roomCode]) return;
        
        const room = rooms[roomCode];
        
        if (room.hostSocket !== socket.id) {
            socket.emit('error', { message: 'Only host can start game' });
            return;
        }
        
        // Check if all players are ready (or just start anyway for testing)
        room.state = 'playing';
        
        console.log(`[GAME] Starting game in room ${roomCode}`);
        
        io.to(roomCode).emit('gameStarting', {
            countdown: 3
        });
        
        // Start game after countdown
        setTimeout(() => {
            if (rooms[roomCode] && rooms[roomCode].state === 'playing') {
                io.to(roomCode).emit('gameStarted', {
                    roomCode,
                    seed: Date.now()
                });
                
                gameEngines[roomCode].startGameLoop(io);
            }
        }, 3000);
    });
    
    // ============ GAME ACTIONS ============
    
    // Player shoots
    socket.on('shoot', (data) => {
        // Rate limit shooting
        const shootCheck = rateLimiter.checkShoot(socket.id, clientIP);
        if (!shootCheck.allowed) {
            if (rateLimiter.shouldBanSession(socket.id)) {
                socket.emit('error', { message: 'Session banned for excessive rate limit violations.' });
                socket.disconnect(true);
                return;
            }
            // M4: RL-005 fix — explicit rejection instead of silent drop
            socket.emit('shootRejected', {
                reason: shootCheck.reason || 'RATE_LIMITED',
                timestamp: Date.now()
            });
            return;
        }
        
        const { targetX, targetZ, seq, clientTime } = data;
        const roomCode = playerRooms[socket.id];
        
        if (!roomCode || !gameEngines[roomCode]) return;
        
        if (typeof targetX !== 'number' || typeof targetZ !== 'number' ||
            !isFinite(targetX) || !isFinite(targetZ)) {
            socket.emit('shootRejected', {
                reason: 'INVALID_COORDINATES',
                timestamp: Date.now()
            });
            return;
        }
        
        // M4: Check if player is in anomaly cooldown
        if (anomalyDetector.isInCooldown(socket.id)) {
            socket.emit('shootRejected', {
                reason: 'ANOMALY_COOLDOWN',
                timestamp: Date.now()
            });
            return;
        }
        
        // M1: Anti-replay sequence validation (mandatory Phase 2+)
        if (ENFORCEMENT_PHASE >= 2 && typeof seq !== 'number') {
            socket.emit('shootRejected', {
                reason: 'SEQ_REQUIRED',
                timestamp: Date.now()
            });
            return;
        }
        if (typeof seq === 'number') {
            const seqResult = sequenceTracker.validate(socket.id, seq);
            if (!seqResult.valid) {
                socket.emit('shootRejected', {
                    reason: seqResult.reason,
                    timestamp: Date.now()
                });
                return;
            }
        }
        
        // M1: Lag compensation (mandatory Phase 3)
        if (ENFORCEMENT_PHASE >= 3 && typeof clientTime !== 'number') {
            socket.emit('shootRejected', {
                reason: 'CLIENT_TIME_REQUIRED',
                timestamp: Date.now()
            });
            return;
        }
        if (typeof clientTime === 'number') {
            const lagResult = validateTimestamp(clientTime);
            if (!lagResult.valid) {
                socket.emit('shootRejected', {
                    reason: lagResult.reason,
                    latency: lagResult.latency,
                    timestamp: Date.now()
                });
                return;
            }
        }
        
        // M4: Record shot for anomaly detection
        const player = gameEngines[roomCode].players.get(socket.id);
        if (player) {
            anomalyDetector.recordShot(socket.id, player.currentWeapon);
        }
        
        gameEngines[roomCode].handleShoot(socket.id, targetX, targetZ, io);
        
        // M4: Periodic anomaly check with escalation (every 100 shots)
        const stats = anomalyDetector.getPlayerStats(socket.id);
        if (stats && stats.getTotalShots() % 100 === 0) {
            const anomalies = anomalyDetector.checkAnomaly(socket.id);
            if (anomalies) {
                const level = anomalyDetector.getEscalationLevel(socket.id);
                console.warn(`[ANTI-CHEAT] Anomaly for ${socket.id}: level=${level} flags=${anomalies.length}`, JSON.stringify(anomalies));
                
                if (level >= ESCALATION_LEVELS.DISCONNECT) {
                    socket.emit('anomalyDisconnect', {
                        message: 'Disconnected: persistent anomaly detected',
                        flags: stats.getTotalFlags()
                    });
                    socket.disconnect(true);
                    return;
                } else if (level >= ESCALATION_LEVELS.COOLDOWN) {
                    anomalyDetector.applyCooldown(socket.id);
                    socket.emit('anomalyCooldown', {
                        message: 'Temporary cooldown applied due to anomaly',
                        durationMs: 10000,
                        flags: stats.getTotalFlags()
                    });
                } else {
                    socket.emit('anomalyWarning', {
                        message: 'Statistical anomaly detected in your play pattern',
                        flags: anomalies.length
                    });
                }
            }
        }
    });
    
    // Player changes weapon
    socket.on('changeWeapon', (data) => {
        // Rate limit weapon switch
        const weaponCheck = rateLimiter.checkWeaponSwitch(socket.id, clientIP);
        if (!weaponCheck.allowed) return;
        
        const { weapon } = data;
        const roomCode = playerRooms[socket.id];
        
        if (!roomCode || !gameEngines[roomCode]) return;
        
        gameEngines[roomCode].handleWeaponChange(socket.id, weapon, io);
    });
    
    // Player updates cannon rotation (for visual sync)
    socket.on('updateCannon', (data) => {
        // Rate limit movement updates
        const movementCheck = rateLimiter.checkMovement(socket.id, clientIP);
        if (!movementCheck.allowed) return;
        
        const { yaw, pitch } = data;
        const roomCode = playerRooms[socket.id];
        
        if (!roomCode || !gameEngines[roomCode]) return;
        
        const player = gameEngines[roomCode].players.get(socket.id);
        if (player) {
            player.cannonYaw = yaw;
            player.cannonPitch = pitch;
            
            // Broadcast to other players
            socket.to(roomCode).emit('playerCannonUpdate', {
                playerId: player.playerId,
                yaw,
                pitch
            });
        }
    });
    
    // Player toggles view mode
    socket.on('toggleView', (data) => {
        const { viewMode } = data;
        const roomCode = playerRooms[socket.id];
        
        if (!roomCode || !gameEngines[roomCode]) return;
        
        const player = gameEngines[roomCode].players.get(socket.id);
        if (player) {
            player.viewMode = viewMode;
        }
    });
    
    // Request current state (for reconnection)
    socket.on('requestState', () => {
        // Rate limit state requests
        const stateCheck = rateLimiter.checkStateRequest(socket.id);
        if (!stateCheck.allowed) return;
        
        const roomCode = playerRooms[socket.id];
        
        if (!roomCode || !gameEngines[roomCode]) return;
        
        const engine = gameEngines[roomCode];
        const player = engine.players.get(socket.id);
        
        if (player) {
            socket.emit('stateSync', {
                playerId: player.playerId,
                slotIndex: player.slotIndex,
                balance: player.balance,
                score: player.score,
                weapon: player.currentWeapon,
                snapshot: engine.getSnapshot()
            });
        }
    });
    
    // ============ SINGLE PLAYER MODE ============
    
    socket.on('startSinglePlayer', (data) => {
        // Rate limit room operations
        const roomCheck = rateLimiter.checkRoomAction(socket.id, clientIP);
        if (!roomCheck.allowed) {
            socket.emit('error', { message: 'Rate limit exceeded. Please wait.' });
            return;
        }
        
        const { playerName } = data || {};
        const roomCode = `single-${socket.id}-${Date.now()}`;
        
        rooms[roomCode] = {
            roomCode,
            hostSocket: socket.id,
            hostName: playerName || 'Player',
            isPublic: false,
            players: {
                [socket.id]: {
                    playerId: 1,
                    playerName: playerName || 'Player',
                    ready: true,
                    isHost: true
                }
            },
            playerCount: 1,
            maxPlayers: 1,
            state: 'playing',
            isSinglePlayer: true,
            mode: 'singleplayer',
            createdAt: Date.now()
        };
        
        // M6: Pass config hash manager to engine
        // M3: Engine creates its own RoomSeedManager internally
        gameEngines[roomCode] = new Fish3DGameEngine(roomCode, { configHashManager });
        gameEngines[roomCode].addPlayer(socket.id, 1, playerName || 'Player');
        
        socket.join(roomCode);
        playerRooms[socket.id] = roomCode;
        
        console.log(`[SINGLE-PLAYER] Started single player game: ${roomCode}`);
        
        // M3: Send seed commitment to client
        const seedInfo = gameEngines[roomCode].getSeedCommitment();
        
        socket.emit('singlePlayerStarted', {
            roomCode,
            playerId: 1,
            slotIndex: 0,
            rulesHash: configHashManager.getHash(),
            rulesVersion: configHashManager.getVersion(),
            seedCommitment: seedInfo ? seedInfo.currentCommitment : null,
            enforcementPhase: ENFORCEMENT_PHASE
        });
        
        gameEngines[roomCode].startGameLoop(io);
    });
    
    // ============ DISCONNECT HANDLING ============
    
    // M6: Client sends version check on game start
    socket.on('versionCheck', (data) => {
        const { rulesVersion } = data || {};
        const serverVersion = configHashManager.getVersion();
        if (rulesVersion !== serverVersion) {
            socket.emit('versionMismatch', {
                clientVersion: rulesVersion,
                serverVersion: serverVersion,
                action: 'REFRESH_REQUIRED'
            });
        } else {
            socket.emit('versionOk', { version: serverVersion });
        }
    });
    
    // M3: Client requests seed reveal (for fairness verification)
    socket.on('requestSeedReveal', () => {
        const seedRevealCheck = rateLimiter.checkStateRequest(socket.id);
        if (!seedRevealCheck.allowed) return;
        const roomCode = playerRooms[socket.id];
        if (!roomCode || !gameEngines[roomCode]) return;
        const reveal = gameEngines[roomCode].revealSeed();
        if (reveal) {
            const newCommitment = gameEngines[roomCode].getSeedCommitment();
            socket.emit('seedRevealed', {
                ...reveal,
                newCommitment: newCommitment ? newCommitment.currentCommitment : null
            });
        }
    });
    
    // M5: Client requests receipts for verification
    socket.on('requestReceipts', () => {
        const receiptsCheck = rateLimiter.checkStateRequest(socket.id);
        if (!receiptsCheck.allowed) return;
        const roomCode = playerRooms[socket.id];
        if (!roomCode || !gameEngines[roomCode]) return;
        const receipts = gameEngines[roomCode].getReceipts();
        socket.emit('receipts', {
            roomCode,
            receipts,
            chainValid: gameEngines[roomCode].verifyReceiptChain()
        });
    });
    
    socket.on('disconnect', (reason) => {
        console.log(`[SOCKET] Client disconnected: ${socket.id}, reason: ${reason}`);
        
        // Clean up rate limiter (security feature)
        rateLimiter.unregisterConnection(socket.id, clientIP);
        
        // Clean up session (security feature)
        sessionManager.destroySessionBySocket(socket.id);
        
        // M1: Clean up sequence tracker
        sequenceTracker.destroySession(socket.id);
        
        // M4: Clean up anomaly detector
        anomalyDetector.destroyPlayer(socket.id);
        
        handlePlayerLeave(socket);
    });
});

/**
 * Handle player leaving a room
 */
function handlePlayerLeave(socket) {
    const roomCode = playerRooms[socket.id];
    
    if (!roomCode || !rooms[roomCode]) {
        delete playerRooms[socket.id];
        return;
    }
    
    const room = rooms[roomCode];
    const wasHost = room.hostSocket === socket.id;
    const player = room.players[socket.id];
    
    console.log(`[ROOM] Player ${player?.playerName || socket.id} left room ${roomCode}, wasHost: ${wasHost}`);
    
    // Remove from game engine
    if (gameEngines[roomCode]) {
        gameEngines[roomCode].removePlayer(socket.id);
    }
    
    delete room.players[socket.id];
    room.playerCount--;
    delete playerRooms[socket.id];
    
    if (wasHost || room.playerCount === 0) {
        // Close room if host leaves or room is empty
        console.log(`[ROOM] Closing room ${roomCode}`);
        
        io.to(roomCode).emit('roomClosed', {
            reason: wasHost ? 'Host left the room' : 'Room is empty'
        });
        
        if (gameEngines[roomCode]) {
            gameEngines[roomCode].stopGameLoop();
            delete gameEngines[roomCode];
        }
        delete rooms[roomCode];
    } else {
        // Notify remaining players
        io.to(roomCode).emit('playerLeft', {
            playerId: player?.playerId,
            playerName: player?.playerName
        });
        
        broadcastRoomState(roomCode);
    }
}

/**
 * Broadcast room state to all players in room
 */
function broadcastRoomState(roomCode) {
    if (!rooms[roomCode]) return;
    
    const room = rooms[roomCode];
    const playerList = [];
    
    for (const [socketId, player] of Object.entries(room.players)) {
        const enginePlayer = gameEngines[roomCode]?.players.get(socketId);
        playerList.push({
            playerId: player.playerId,
            playerName: player.playerName,
            slotIndex: enginePlayer?.slotIndex ?? player.playerId - 1,
            ready: player.ready,
            isHost: player.isHost
        });
    }
    
    io.to(roomCode).emit('roomState', {
        roomCode,
        hostSocket: room.hostSocket,
        state: room.state,
        playerCount: room.playerCount,
        maxPlayers: room.maxPlayers,
        players: playerList
    });
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('[SERVER] Received SIGINT, shutting down...');
    server.close(() => {
        Object.keys(gameEngines).forEach(roomCode => {
            if (gameEngines[roomCode]) {
                gameEngines[roomCode].stopGameLoop();
            }
        });
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('[SERVER] Received SIGTERM, shutting down...');
    server.close(() => {
        Object.keys(gameEngines).forEach(roomCode => {
            if (gameEngines[roomCode]) {
                gameEngines[roomCode].stopGameLoop();
            }
        });
        process.exit(0);
    });
});

const PORT = Number(process.env.PORT) || 3000;

// Initialize Binary WebSocket Server (PDF Specification Section 4.3)
// Runs alongside Socket.IO on /ws-game endpoint
let binaryWsServer = null;
try {
    binaryWsServer = new BinaryWebSocketServer(server, gameEngines, rooms, {
        path: '/ws-game',
        configHashManager,
        enforcementPhase: ENFORCEMENT_PHASE
    });
    console.log('[BINARY-WS] Binary WebSocket server initialized on /ws-game');
} catch (err) {
    console.error('[BINARY-WS] Failed to initialize Binary WebSocket server:', err.message);
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`3D Fish Shooting Game Server running on port ${PORT}`);
    console.log(`Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`Fish species API: http://0.0.0.0:${PORT}/api/fish-species`);
    console.log(`Weapons API: http://0.0.0.0:${PORT}/api/weapons`);
    console.log(`Rooms API: http://0.0.0.0:${PORT}/api/rooms`);
    console.log(`Binary WebSocket: ws://0.0.0.0:${PORT}/ws-game`);
});
