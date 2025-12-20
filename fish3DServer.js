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
 * - RTP values: 1x=91.5%, 3x=94.5%, 5x=97.5%, 8x=99.5%
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
        version: '3.5.0-rate-limiting',
        fishSpeedScale: fishSpeedScale,
        security: {
            sessionManagement: true,
            csprng: true,
            aesGcmEncryption: true,
            hmacVerification: true,
            rateLimiting: true,
            rtpValues: {
                '1x': '91.5%',
                '3x': '94.5%',
                '5x': '97.5%',
                '8x': '99.5%'
            }
        },
        activeSessions: sessionManager.getActiveSessionCount(),
        rateLimiter: rateLimiter.getStats()
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
        
        // Create game engine
        gameEngines[roomCode] = new Fish3DGameEngine(roomCode);
        gameEngines[roomCode].addPlayer(socket.id, 1, playerName || 'Player 1');
        
        socket.join(roomCode);
        playerRooms[socket.id] = roomCode;
        
        console.log(`[ROOM] Created room: ${roomCode} by ${playerName || 'Host'}`);
        
        socket.emit('roomCreated', {
            roomCode,
            playerId: 1,
            slotIndex: 0,
            isHost: true
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
            isHost: false
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
            // Check if session should be banned for too many violations
            if (rateLimiter.shouldBanSession(socket.id)) {
                socket.emit('error', { message: 'Session banned for excessive rate limit violations.' });
                socket.disconnect(true);
                return;
            }
            return; // Silently drop excess shots
        }
        
        const { targetX, targetZ } = data;
        const roomCode = playerRooms[socket.id];
        
        if (!roomCode || !gameEngines[roomCode]) return;
        
        gameEngines[roomCode].handleShoot(socket.id, targetX, targetZ, io);
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
            createdAt: Date.now()
        };
        
        gameEngines[roomCode] = new Fish3DGameEngine(roomCode);
        gameEngines[roomCode].addPlayer(socket.id, 1, playerName || 'Player');
        
        socket.join(roomCode);
        playerRooms[socket.id] = roomCode;
        
        console.log(`[SINGLE-PLAYER] Started single player game: ${roomCode}`);
        
        socket.emit('singlePlayerStarted', {
            roomCode,
            playerId: 1,
            slotIndex: 0
        });
        
        gameEngines[roomCode].startGameLoop(io);
    });
    
    // ============ DISCONNECT HANDLING ============
    
    socket.on('disconnect', (reason) => {
        console.log(`[SOCKET] Client disconnected: ${socket.id}, reason: ${reason}`);
        
        // Clean up rate limiter (security feature)
        rateLimiter.unregisterConnection(socket.id, clientIP);
        
        // Clean up session (security feature)
        sessionManager.destroySessionBySocket(socket.id);
        console.log(`[SECURITY] Session destroyed for socket ${socket.id}`);
        
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

server.listen(PORT, '0.0.0.0', () => {
    console.log(`3D Fish Shooting Game Server running on port ${PORT}`);
    console.log(`Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`Fish species API: http://0.0.0.0:${PORT}/api/fish-species`);
    console.log(`Weapons API: http://0.0.0.0:${PORT}/api/weapons`);
    console.log(`Rooms API: http://0.0.0.0:${PORT}/api/rooms`);
});
