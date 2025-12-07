/**
 * Fishing Game Socket Server
 * Adapted from Pudge Wars server.js
 * 
 * Preserves:
 * - Room management (create, join, host/guest)
 * - Redis adapter for scaling
 * - Socket.IO connection handling
 * - Time sync for interpolation
 * 
 * New Features:
 * - Fishing game events (shoot, bet change)
 * - Coin management
 * - Casino mechanics broadcasting
 */

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const { FishingGameEngine, FISH_TYPES } = require('./fishingGameEngine');

process.on('uncaughtException', (err) => {
    console.error('[FATAL][uncaughtException]', err);
    console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL][unhandledRejection]', reason);
    console.error('Promise:', promise);
});

const app = express();
app.use(cors());

app.get('/', (req, res) => {
    res.send('Fishing Game Socket Server is running');
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API endpoint to get fish types (for frontend reference)
app.get('/api/fish-types', (req, res) => {
    res.json(FISH_TYPES);
});

const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ["GET", "POST"]
    },
    transports: ['websocket'],
    allowUpgrades: false,
    pingInterval: 15000,
    pingTimeout: 5000
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let USE_REDIS = process.env.USE_REDIS !== 'false';

let redisClient = null;
let redisPubClient = null;
let redisSubClient = null;

async function initializeRedis() {
    if (!USE_REDIS) {
        console.log('[REDIS] Redis disabled via USE_REDIS=false, using in-memory state only');
        return;
    }

    try {
        console.log('[REDIS] Connecting to Redis at:', REDIS_URL.replace(/:[^:]*@/, ':****@'));
        
        redisPubClient = createClient({ 
            url: REDIS_URL,
            socket: {
                connectTimeout: 2000,
                reconnectStrategy: () => new Error('Redis connection failed')
            }
        });
        redisSubClient = redisPubClient.duplicate();
        
        redisClient = createClient({ 
            url: REDIS_URL,
            socket: {
                connectTimeout: 2000,
                reconnectStrategy: () => new Error('Redis connection failed')
            }
        });
        
        redisPubClient.on('error', (err) => console.error('[REDIS][PUB] Error:', err));
        redisSubClient.on('error', (err) => console.error('[REDIS][SUB] Error:', err));
        redisClient.on('error', (err) => console.error('[REDIS][CLIENT] Error:', err));
        
        const connectTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Redis connection timeout after 3s')), 3000)
        );
        
        await Promise.race([
            Promise.all([
                redisPubClient.connect(),
                redisSubClient.connect(),
                redisClient.connect()
            ]),
            connectTimeout
        ]);
        
        console.log('[REDIS] Successfully connected to Redis');
        
        io.adapter(createAdapter(redisPubClient, redisSubClient));
        console.log('[REDIS] Socket.IO Redis adapter configured');
        
    } catch (err) {
        console.error('[REDIS] Failed to connect to Redis:', err.message);
        console.error('[REDIS] Falling back to in-memory state (single instance only)');
        USE_REDIS = false;
        redisClient = null;
        redisPubClient = null;
        redisSubClient = null;
    }
}

const rooms = {};
const gameEngines = {}; // roomCode -> FishingGameEngine instance

async function saveRoomToRedis(roomCode, roomData) {
    if (!redisClient) return;
    try {
        await redisClient.set(`fishing:room:${roomCode}`, JSON.stringify(roomData), {
            EX: 3600 // Expire after 1 hour
        });
    } catch (err) {
        console.error('[REDIS] Failed to save room:', err);
    }
}

async function getRoomFromRedis(roomCode) {
    if (!redisClient) return null;
    try {
        const data = await redisClient.get(`fishing:room:${roomCode}`);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.error('[REDIS] Failed to get room:', err);
        return null;
    }
}

async function deleteRoomFromRedis(roomCode) {
    if (!redisClient) return;
    try {
        await redisClient.del(`fishing:room:${roomCode}`);
    } catch (err) {
        console.error('[REDIS] Failed to delete room:', err);
    }
}

io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}, transport: ${socket.conn.transport.name}`);
    
    socket.conn.on('upgrade', (transport) => {
        console.log(`[SOCKET] ${socket.id} upgraded to: ${transport.name}`);
    });
    
    // Time sync for interpolation (preserved from Pudge Wars)
    socket.on('timeSyncPing', (data) => {
        const { seq, clientSendTime } = data;
        const serverTime = Date.now();
        
        socket.emit('timeSyncPong', {
            seq,
            serverTime,
            clientSendTime
        });
    });
    
    // Create a fishing game room
    socket.on('createRoom', async (data) => {
        const { roomCode } = data;
        
        if (!rooms[roomCode]) {
            rooms[roomCode] = {
                hostSocket: socket.id,
                players: {
                    [socket.id]: {
                        playerId: 1,
                        ready: false,
                        isHost: true,
                        loaded: false
                    }
                },
                playerCount: 1,
                maxPlayers: 8, // Fishing games can have more players
                gameStarted: false
            };
            
            gameEngines[roomCode] = new FishingGameEngine(roomCode);
            gameEngines[roomCode].addPlayer(socket.id, 1);
            
            socket.join(roomCode);
            socket.roomCode = roomCode;
            
            console.log(`[ROOM] Created fishing room: ${roomCode} by ${socket.id}`);
            socket.emit('roomCreated', { 
                roomCode, 
                playerId: 1,
                turretPosition: gameEngines[roomCode].TURRET_POSITIONS[0]
            });
            
            io.to(roomCode).emit('roomState', {
                players: rooms[roomCode].players,
                hostSocket: socket.id,
                gameStarted: false
            });
            
            saveRoomToRedis(roomCode, rooms[roomCode]).catch(err => {
                console.warn('[REDIS] Failed to save room:', err.message);
            });
        } else {
            socket.emit('roomExists', { message: 'Room already exists' });
        }
    });
    
    // Join a fishing game room
    socket.on('joinRoom', async (data) => {
        const { roomCode } = data;
        
        if (!rooms[roomCode]) {
            let redisRoom = null;
            try {
                redisRoom = await getRoomFromRedis(roomCode);
            } catch (err) {
                console.warn('[REDIS] Failed to get room:', err.message);
            }
            
            if (!redisRoom) {
                socket.emit('joinError', { message: 'Room does not exist' });
                return;
            }
            rooms[roomCode] = redisRoom;
        }
        
        if (rooms[roomCode].playerCount >= rooms[roomCode].maxPlayers) {
            socket.emit('roomFull', { message: 'Room is full' });
            return;
        }
        
        if (rooms[roomCode].gameStarted) {
            socket.emit('gameInProgress', { message: 'Game already in progress' });
            return;
        }
        
        const playerId = rooms[roomCode].playerCount + 1;
        
        rooms[roomCode].players[socket.id] = {
            playerId: playerId,
            ready: false,
            isHost: false,
            loaded: false
        };
        rooms[roomCode].playerCount++;
        
        if (gameEngines[roomCode]) {
            gameEngines[roomCode].addPlayer(socket.id, playerId);
        }
        
        socket.join(roomCode);
        socket.roomCode = roomCode;
        
        console.log(`[ROOM] Player ${socket.id} joined room ${roomCode} as Player ${playerId}`);
        
        socket.emit('joinSuccess', { 
            roomCode, 
            playerId: playerId,
            turretPosition: gameEngines[roomCode].TURRET_POSITIONS[playerId - 1]
        });
        
        io.to(rooms[roomCode].hostSocket).emit('playerJoined', { 
            roomCode, 
            playerId: playerId 
        });
        
        io.to(roomCode).emit('roomState', {
            players: rooms[roomCode].players,
            hostSocket: rooms[roomCode].hostSocket,
            gameStarted: rooms[roomCode].gameStarted
        });
    });
    
    // Player ready status
    socket.on('playerReady', (data) => {
        const { roomCode, ready } = data;
        
        if (rooms[roomCode] && rooms[roomCode].players[socket.id]) {
            rooms[roomCode].players[socket.id].ready = ready;
            
            io.to(roomCode).emit('playerReadyUpdate', {
                playerId: rooms[roomCode].players[socket.id].playerId,
                ready: ready
            });
            
            io.to(roomCode).emit('roomState', {
                players: rooms[roomCode].players,
                hostSocket: rooms[roomCode].hostSocket,
                gameStarted: rooms[roomCode].gameStarted
            });
        }
    });
    
    // Player loaded (assets loaded)
    socket.on('playerLoaded', (data) => {
        const { roomCode } = data;
        
        if (rooms[roomCode] && rooms[roomCode].players[socket.id]) {
            rooms[roomCode].players[socket.id].loaded = true;
            
            const playerLoadStatus = {};
            Object.entries(rooms[roomCode].players).forEach(([socketId, player]) => {
                playerLoadStatus[player.playerId] = player.loaded;
            });
            
            io.to(roomCode).emit('playerLoadUpdate', playerLoadStatus);
            
            const allLoaded = Object.values(rooms[roomCode].players).every(p => p.loaded);
            if (allLoaded) {
                io.to(roomCode).emit('allPlayersLoaded', { roomCode });
            }
        }
    });
    
    // Start the fishing game
    socket.on('startGame', (data) => {
        const { roomCode } = data;
        
        if (!rooms[roomCode]) {
            console.log(`[START-GAME] Room ${roomCode} not found`);
            return;
        }
        
        if (rooms[roomCode].hostSocket !== socket.id) {
            socket.emit('error', { message: 'Only host can start game' });
            return;
        }
        
        rooms[roomCode].gameStarted = true;
        
        // Reset loaded status
        Object.keys(rooms[roomCode].players).forEach(socketId => {
            rooms[roomCode].players[socketId].loaded = false;
        });
        
        console.log(`[START-GAME] Broadcasting gameStart to room ${roomCode}`);
        io.to(roomCode).emit('gameStart', { roomCode });
        
        if (gameEngines[roomCode]) {
            gameEngines[roomCode].startGameLoop(io);
        }
    });
    
    // ============ FISHING GAME SPECIFIC EVENTS ============
    
    // Start Single Player mode with AI turrets
    socket.on('startSinglePlayer', async (data) => {
        const roomCode = `single-${socket.id}-${Date.now()}`;
        
        rooms[roomCode] = {
            hostSocket: socket.id,
            players: {
                [socket.id]: {
                    playerId: 1,
                    ready: true,
                    isHost: true,
                    loaded: false
                }
            },
            playerCount: 1,
            maxPlayers: 8,
            gameStarted: true,
            isSinglePlayer: true
        };
        
        gameEngines[roomCode] = new FishingGameEngine(roomCode);
        gameEngines[roomCode].addPlayer(socket.id, 1);
        
        // Initialize 7 AI turrets for Single Player mode
        gameEngines[roomCode].initializeAITurrets();
        
        socket.join(roomCode);
        socket.roomCode = roomCode;
        
        console.log(`[SINGLE-PLAYER] Created single player room: ${roomCode} with 7 AI turrets`);
        
        socket.emit('singlePlayerStarted', { 
            roomCode, 
            playerId: 1,
            turretPosition: gameEngines[roomCode].TURRET_POSITIONS[0],
            aiTurretCount: 7
        });
        
        // Start the game loop immediately
        gameEngines[roomCode].startGameLoop(io);
    });
    
    // Player shoots a bullet
    socket.on('shoot', (data) => {
        const { roomCode, targetX, targetZ } = data;
        
        if (!gameEngines[roomCode]) return;
        
        gameEngines[roomCode].handleBulletShot(socket.id, targetX, targetZ, io);
    });
    
    // Player changes bet amount
    socket.on('setBet', (data) => {
        const { roomCode, amount } = data;
        
        if (!gameEngines[roomCode]) return;
        
        const success = gameEngines[roomCode].setBetAmount(socket.id, amount);
        
        if (success) {
            const player = gameEngines[roomCode].players.get(socket.id);
            socket.emit('betUpdated', { 
                currentBet: player.currentBet,
                coins: player.coins
            });
        }
    });
    
    // Player requests current state (for reconnection)
    socket.on('requestState', (data) => {
        const { roomCode } = data;
        
        if (!gameEngines[roomCode]) return;
        
        const player = gameEngines[roomCode].players.get(socket.id);
        if (player) {
            socket.emit('stateSync', {
                playerId: player.playerId,
                coins: player.coins,
                currentBet: player.currentBet,
                turretX: player.turretX,
                turretZ: player.turretZ,
                jackpot: gameEngines[roomCode].jackpot
            });
        }
    });
    
    // ============ DISCONNECT HANDLING ============
    
    socket.on('disconnect', async (reason) => {
        console.log(`[SOCKET] Client disconnected: ${socket.id}, reason: ${reason}`);
        
        if (socket.roomCode && rooms[socket.roomCode]) {
            const roomCode = socket.roomCode;
            const wasHost = rooms[roomCode].hostSocket === socket.id;
            
            console.log(`[DISCONNECT] Player ${socket.id} disconnected from room ${roomCode}, wasHost: ${wasHost}`);
            
            if (gameEngines[roomCode]) {
                gameEngines[roomCode].removePlayer(socket.id);
            }
            
            delete rooms[roomCode].players[socket.id];
            rooms[roomCode].playerCount--;
            
            if (wasHost) {
                console.log(`[DISCONNECT] Host disconnected, closing room ${roomCode}`);
                io.to(roomCode).emit('hostDisconnected', { 
                    message: 'Host has left the room. Room is now closed.' 
                });
                
                if (gameEngines[roomCode]) {
                    gameEngines[roomCode].stopGameLoop();
                    delete gameEngines[roomCode];
                }
                delete rooms[roomCode];
                await deleteRoomFromRedis(roomCode);
            } else {
                io.to(roomCode).emit('playerDisconnected', {
                    playerId: rooms[roomCode].players[socket.id]?.playerId
                });
                
                if (rooms[roomCode].playerCount === 0) {
                    if (gameEngines[roomCode]) {
                        gameEngines[roomCode].stopGameLoop();
                        delete gameEngines[roomCode];
                    }
                    delete rooms[roomCode];
                    await deleteRoomFromRedis(roomCode);
                } else {
                    io.to(roomCode).emit('roomState', {
                        players: rooms[roomCode].players,
                        hostSocket: rooms[roomCode].hostSocket,
                        gameStarted: rooms[roomCode].gameStarted
                    });
                }
            }
        }
    });
});

const PORT = Number(process.env.PORT) || 3000;

server.on('error', (err) => {
    console.error('[SERVER ERROR]', err);
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use.`);
        process.exit(1);
    }
});

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

async function startServer() {
    await initializeRedis();
    
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Fishing Game Socket Server running on port ${PORT}`);
        console.log(`Health check: http://0.0.0.0:${PORT}/health`);
        console.log(`Fish types API: http://0.0.0.0:${PORT}/api/fish-types`);
        console.log(`Process ID: ${process.pid}`);
    });
}

startServer().catch(err => {
    console.error('[FATAL] Failed to start server:', err);
    process.exit(1);
});
