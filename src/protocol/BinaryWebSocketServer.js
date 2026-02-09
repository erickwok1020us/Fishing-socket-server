/**
 * Binary WebSocket Server - Version 2 (Certification Compliant)
 * 
 * Implements the secure binary WebSocket server as specified in PDF Section 4.3.
 * Runs alongside the existing Socket.IO server on a separate endpoint (/ws-game).
 * 
 * Features:
 * - ECDH (P-256) key exchange for session key establishment
 * - HKDF-SHA256 for key derivation (RFC 5869)
 * - AES-256-GCM encryption
 * - HMAC-SHA256 authentication
 * - Nonce validation (replay protection)
 * - Full security pipeline per PDF Section 6
 * 
 * Handshake Flow:
 * 1. Client sends HANDSHAKE_REQUEST with clientPublicKey (65 bytes) + clientNonce (32 bytes)
 * 2. Server generates ECDH keypair, computes shared secret
 * 3. Server derives session keys using HKDF
 * 4. Server sends HANDSHAKE_RESPONSE with serverPublicKey + serverNonce + salt
 * 5. Client derives same session keys using HKDF
 * 6. Both sides now have identical encryptionKey and hmacKey
 */

const WebSocket = require('ws');
const crypto = require('crypto');
const { PacketId, ErrorCodes, HEADER_SIZE, GCM_TAG_SIZE, HMAC_SIZE, PROTOCOL_VERSION } = require('./packets');
const { 
    serializePacket, 
    serializeHitResult, 
    serializeBalanceUpdate,
    serializeRoomSnapshot,
    serializeFishSpawn,
    serializeFishDeath,
    serializeBossSpawn,
    serializeBossDeath,
    serializePlayerJoin,
    serializePlayerLeave,
    serializeRoomState,
    serializeTimeSyncPong,
    serializeError
} = require('./serializer');
const { 
    deserializePacket, 
    DeserializationError,
    getPayloadParser
} = require('./deserializer');
const { performServerHandshake } = require('../security/HKDF');
const BinaryPayloads = require('./payloads/BinaryPayloads');
const Fish3DGameEngine = require('../../fish3DGameEngine');
const { sequenceTracker } = require('../modules/SequenceTracker');
const { validateTimestamp } = require('../modules/LagCompensation');
const { anomalyDetector, ESCALATION_LEVELS } = require('../modules/AnomalyDetector');
const { rateLimiter } = require('../security/RateLimiter');

class BinarySession {
    constructor(ws, sessionId) {
        this.ws = ws;
        this.sessionId = sessionId;
        this.playerId = null;
        this.roomCode = null;
        this.encryptionKey = null;
        this.hmacKey = null;
        this.lastClientNonce = 0;
        this.serverNonce = 0;
        this.createdAt = Date.now();
        this.lastActivity = Date.now();
        this.handshakeComplete = false;
        this.clientPublicKey = null;
        this.clientNonce = null;
        this.serverPublicKey = null;
        this.serverNonce32 = null;
        this.salt = null;
    }
    
    getNextNonce() {
        this.serverNonce++;
        return this.serverNonce;
    }
    
    updateClientNonce(nonce) {
        if (nonce <= this.lastClientNonce) {
            return false;
        }
        this.lastClientNonce = nonce;
        this.lastActivity = Date.now();
        return true;
    }
    
    send(packetId, payload) {
        if (this.ws.readyState !== WebSocket.OPEN) {
            return false;
        }
        
        try {
            const nonce = this.getNextNonce();
            const packet = serializePacket(packetId, payload, this.encryptionKey, this.hmacKey, nonce);
            this.ws.send(packet);
            return true;
        } catch (err) {
            console.error(`[BINARY-WS] Failed to send packet to ${this.sessionId}:`, err.message);
            return false;
        }
    }
    
    sendError(code, message) {
        return this.send(PacketId.ERROR, { code, message, timestamp: Date.now() });
    }
}

class BinaryWebSocketServer {
    constructor(server, gameEngines, rooms, options = {}) {
        this.gameEngines = gameEngines;
        this.rooms = rooms;
        this.sessions = new Map();
        this.playerSessions = new Map();
        this.configHashManager = options.configHashManager || null;
        this.enforcementPhase = options.enforcementPhase || 1;
        
        this.wss = new WebSocket.Server({
            server,
            path: options.path || '/ws-game',
            verifyClient: this.verifyClient.bind(this)
        });
        
        this.wss.on('connection', this.handleConnection.bind(this));
        this.wss.on('error', (err) => {
            console.error('[BINARY-WS] Server error:', err);
        });
        
        this.cleanupInterval = setInterval(() => this.cleanupSessions(), 60000);
        
        console.log(`[BINARY-WS] Binary WebSocket server started on path: ${options.path || '/ws-game'}`);
    }
    
    verifyClient(info, callback) {
        callback(true);
    }
    
    handleConnection(ws, req) {
        const sessionId = crypto.randomBytes(16).toString('hex');
        const session = new BinarySession(ws, sessionId);
        this.sessions.set(sessionId, session);
        
        const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        session.clientIP = clientIP;
        
        sequenceTracker.initSession(sessionId);
        rateLimiter.registerConnection(sessionId, clientIP);
        
        console.log(`[BINARY-WS] New connection: ${sessionId} - awaiting ECDH handshake`);
        
        ws.on('message', (data) => this.handleMessage(session, data));
        ws.on('close', () => this.handleClose(session));
        ws.on('error', (err) => this.handleError(session, err));
    }
    
    sendHandshakeResponse(session, clientPublicKey, clientNonce) {
        try {
            const handshakeResult = performServerHandshake(clientPublicKey, clientNonce, PROTOCOL_VERSION);
            
            session.encryptionKey = handshakeResult.encryptionKey;
            session.hmacKey = handshakeResult.hmacKey;
            session.serverPublicKey = handshakeResult.serverPublicKey;
            session.serverNonce32 = handshakeResult.serverNonce;
            session.salt = handshakeResult.salt;
            session.clientPublicKey = clientPublicKey;
            session.clientNonce = clientNonce;
            session.handshakeComplete = true;
            
            const responsePayload = BinaryPayloads.encodeHandshakeResponse({
                serverPublicKey: handshakeResult.serverPublicKey,
                serverNonce: handshakeResult.serverNonce,
                salt: handshakeResult.salt,
                sessionId: session.sessionId
            });
            
            const header = Buffer.alloc(4);
            header.writeUInt8(PROTOCOL_VERSION, 0);
            header.writeUInt8(0, 1);
            header.writeUInt16BE(responsePayload.length, 2);
            
            const response = Buffer.concat([header, responsePayload]);
            session.ws.send(response);
            
            console.log(`[BINARY-WS] ECDH handshake complete for ${session.sessionId}`);
            return true;
        } catch (err) {
            console.error(`[BINARY-WS] Handshake failed for ${session.sessionId}:`, err.message);
            session.ws.close();
            return false;
        }
    }
    
    handleMessage(session, data) {
        try {
            const buffer = Buffer.from(data);
            
            if (buffer.length < 4) {
                console.error(`[BINARY-WS] Packet too small from ${session.sessionId}`);
                session.ws.close();
                return;
            }
            
            const protocolVersion = buffer.readUInt8(0);
            const packetIdOrReserved = buffer.readUInt8(1);
            
            if (!session.handshakeComplete) {
                if (buffer.length >= 98) {
                    this.handleHandshakeRequest(session, buffer);
                } else {
                    console.error(`[BINARY-WS] Invalid handshake request from ${session.sessionId}`);
                    session.ws.close();
                }
                return;
            }
            
            if (buffer.length < HEADER_SIZE) {
                session.sendError(ErrorCodes.INVALID_PACKET, 'Packet too small');
                return;
            }
            
            const result = deserializePacket(
                buffer, 
                session.encryptionKey, 
                session.hmacKey, 
                session.lastClientNonce
            );
            
            if (!session.updateClientNonce(result.nonce)) {
                session.sendError(ErrorCodes.INVALID_NONCE, 'Invalid nonce');
                session.ws.close();
                return;
            }
            
            this.dispatchPacket(session, result.packetId, result.payload);
            
        } catch (err) {
            if (err instanceof DeserializationError) {
                console.error(`[BINARY-WS] Deserialization error for ${session.sessionId}:`, err.message);
                if (session.handshakeComplete) {
                    session.sendError(err.code, err.message);
                }
                session.ws.close();
            } else {
                console.error(`[BINARY-WS] Unexpected error for ${session.sessionId}:`, err);
                if (session.handshakeComplete) {
                    session.sendError(ErrorCodes.INVALID_PACKET, 'Internal error');
                }
            }
        }
    }
    
    handleHandshakeRequest(session, buffer) {
        console.log(`[BINARY-WS] Processing ECDH handshake request from ${session.sessionId}`);
        
        try {
            // Skip the 4-byte header: [version (1)] + [reserved (1)] + [payloadLength (2)]
            // The payload starts at offset 4
            const payload = buffer.slice(4);
            const handshakeData = BinaryPayloads.decodeHandshakeRequest(payload);
            
            if (handshakeData.protocolVersion !== PROTOCOL_VERSION) {
                console.error(`[BINARY-WS] Protocol version mismatch: expected ${PROTOCOL_VERSION}, got ${handshakeData.protocolVersion}`);
                session.ws.close();
                return;
            }
            
            this.sendHandshakeResponse(session, handshakeData.clientPublicKey, handshakeData.clientNonce);
        } catch (err) {
            console.error(`[BINARY-WS] Failed to process handshake request from ${session.sessionId}:`, err.message);
            session.ws.close();
        }
    }
    
    dispatchPacket(session, packetId, payload) {
        const parser = getPayloadParser(packetId);
        const parsedPayload = parser(payload);
        
        switch (packetId) {
            case PacketId.SHOT_FIRED:
                this.handleShotFired(session, parsedPayload);
                break;
            case PacketId.WEAPON_SWITCH:
                this.handleWeaponSwitch(session, parsedPayload);
                break;
            case PacketId.ROOM_CREATE:
                this.handleRoomCreate(session, parsedPayload);
                break;
            case PacketId.ROOM_JOIN:
                this.handleRoomJoin(session, parsedPayload);
                break;
            case PacketId.ROOM_LEAVE:
                this.handleRoomLeave(session, parsedPayload);
                break;
            case PacketId.PLAYER_MOVEMENT:
                this.handlePlayerMovement(session, parsedPayload);
                break;
            case PacketId.TIME_SYNC_PING:
                this.handleTimeSyncPing(session, parsedPayload);
                break;
            case PacketId.GAME_START:
                this.handleGameStart(session, parsedPayload);
                break;
            default:
                console.warn(`[BINARY-WS] Unhandled packet type: ${packetId}`);
        }
    }
    
    handleShotFired(session, data) {
        if (!session.roomCode || !session.playerId) {
            session.sendError(ErrorCodes.INVALID_SESSION, 'Not in a room');
            return;
        }
        
        const shootCheck = rateLimiter.checkShoot(session.sessionId, session.clientIP);
        if (!shootCheck.allowed) {
            if (rateLimiter.shouldBanSession(session.sessionId)) {
                session.sendError(ErrorCodes.RATE_LIMITED, 'Session banned for excessive rate limit violations.');
                session.ws.close();
                return;
            }
            session.sendError(ErrorCodes.RATE_LIMITED, shootCheck.reason || 'RATE_LIMITED');
            return;
        }
        
        const room = this.rooms[session.roomCode];
        const engine = this.gameEngines[session.roomCode];
        
        if (!room || !engine) {
            session.sendError(ErrorCodes.INVALID_ROOM, 'Room not found');
            return;
        }
        
        if (!engine.gameStarted) {
            session.sendError(ErrorCodes.INVALID_SESSION, 'Game not started');
            return;
        }
        
        const targetX = data.targetX || 0;
        const targetZ = data.targetZ || data.targetY || 0;
        
        if (typeof targetX !== 'number' || typeof targetZ !== 'number' ||
            !isFinite(targetX) || !isFinite(targetZ)) {
            session.sendError(ErrorCodes.INVALID_PACKET, 'INVALID_COORDINATES');
            return;
        }
        
        if (anomalyDetector.isInCooldown(session.sessionId)) {
            session.sendError(ErrorCodes.RATE_LIMITED, 'ANOMALY_COOLDOWN');
            return;
        }
        
        const seq = data.shotSequenceId;
        const clientTime = data.timestamp;
        
        if (this.enforcementPhase >= 2 && typeof seq !== 'number') {
            session.sendError(ErrorCodes.INVALID_PACKET, 'SEQ_REQUIRED');
            return;
        }
        if (typeof seq === 'number') {
            const seqResult = sequenceTracker.validate(session.sessionId, seq);
            if (!seqResult.valid) {
                session.sendError(ErrorCodes.INVALID_NONCE, seqResult.reason);
                return;
            }
        }
        
        if (this.enforcementPhase >= 3 && typeof clientTime !== 'number') {
            session.sendError(ErrorCodes.INVALID_PACKET, 'CLIENT_TIME_REQUIRED');
            return;
        }
        if (typeof clientTime === 'number') {
            const lagResult = validateTimestamp(clientTime);
            if (!lagResult.valid) {
                session.sendError(ErrorCodes.INVALID_PACKET, lagResult.reason);
                return;
            }
        }
        
        const enginePlayer = engine.players.get(session.sessionId);
        if (!enginePlayer) {
            session.sendError(ErrorCodes.INVALID_SESSION, 'Player not in engine');
            return;
        }
        
        anomalyDetector.recordShot(session.sessionId, enginePlayer.currentWeapon);
        
        const weaponKey = data.weaponId ? String(data.weaponId) + 'x' : enginePlayer.currentWeapon;
        const weapon = engine.WEAPONS ? engine.WEAPONS[weaponKey] : { cost: 1, damage: 1, multiplier: 1 };
        const cost = weapon ? weapon.cost : 1;
        
        if (enginePlayer.balance < cost) {
            session.send(PacketId.BALANCE_UPDATE, {
                playerId: session.playerId,
                balance: enginePlayer.balance,
                change: 0,
                reason: 'insufficient_balance',
                timestamp: Date.now()
            });
            return;
        }
        
        enginePlayer.balance -= cost;
        enginePlayer.lastShotTime = Date.now();
        enginePlayer.totalShots++;
        
        const dx = targetX - enginePlayer.cannonX;
        const dz = targetZ - enginePlayer.cannonZ;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < 0.1) {
            session.send(PacketId.BALANCE_UPDATE, {
                playerId: session.playerId,
                balance: enginePlayer.balance,
                change: -cost,
                reason: 'shot',
                timestamp: Date.now()
            });
            return;
        }
        
        const normalizedDx = dx / distance;
        const normalizedDz = dz / distance;
        
        const bulletId = engine.nextBulletId++;
        const bullet = {
            bulletId,
            ownerId: enginePlayer.playerId,
            ownerSocketId: session.sessionId,
            weapon: weaponKey,
            damage: weapon ? weapon.damage : 1,
            cost: cost,
            x: enginePlayer.cannonX,
            z: enginePlayer.cannonZ,
            prevX: enginePlayer.cannonX,
            prevZ: enginePlayer.cannonZ,
            velocityX: normalizedDx * engine.BULLET_SPEED,
            velocityZ: normalizedDz * engine.BULLET_SPEED,
            rotation: Math.atan2(normalizedDx, -normalizedDz),
            spawnTime: Date.now(),
            hasHit: false,
            shotSequenceId: data.shotSequenceId
        };
        
        engine.bullets.set(bulletId, bullet);
        
        session.send(PacketId.BALANCE_UPDATE, {
            playerId: session.playerId,
            balance: enginePlayer.balance,
            change: -cost,
            reason: 'shot',
            timestamp: Date.now()
        });
        
        if (room.players[session.playerId]) {
            room.players[session.playerId].balance = enginePlayer.balance;
        }
        
        const stats = anomalyDetector.getPlayerStats(session.sessionId);
        if (stats && stats.getTotalShots() % 100 === 0) {
            const anomalies = anomalyDetector.checkAnomaly(session.sessionId);
            if (anomalies) {
                const level = anomalyDetector.getEscalationLevel(session.sessionId);
                console.warn(`[BINARY-WS][ANTI-CHEAT] Anomaly for ${session.sessionId}: level=${level} flags=${anomalies.length}`, JSON.stringify(anomalies));
                
                if (level >= ESCALATION_LEVELS.DISCONNECT) {
                    session.sendError(ErrorCodes.RATE_LIMITED, 'Disconnected: persistent anomaly detected');
                    session.ws.close();
                    return;
                } else if (level >= ESCALATION_LEVELS.COOLDOWN) {
                    anomalyDetector.applyCooldown(session.sessionId);
                    session.sendError(ErrorCodes.RATE_LIMITED, 'ANOMALY_COOLDOWN:10000');
                } else {
                    session.sendError(ErrorCodes.RATE_LIMITED, 'ANOMALY_WARNING');
                }
            }
        }
        
        console.log(`[BINARY-WS] Shot fired: room=${session.roomCode} player=${session.playerId} bullet=${bulletId} target=(${targetX.toFixed(1)},${targetZ.toFixed(1)})`);
    }
    
    handleWeaponSwitch(session, data) {
        if (!session.roomCode || !session.playerId) {
            return;
        }
        
        const room = this.rooms[session.roomCode];
        if (!room) return;
        
        const player = room.players[session.playerId];
        if (!player) return;
        
        player.weapon = data.weaponId;
        
        this.broadcastToRoom(session.roomCode, PacketId.ROOM_SNAPSHOT, {
            roomId: session.roomCode,
            serverTime: Date.now(),
            players: this.getPlayersSnapshot(room)
        });
    }
    
    handleRoomCreate(session, data) {
        const roomCode = this.generateRoomCode();
        
        session.playerId = `player-${session.sessionId.substring(0, 8)}`;
        session.roomCode = roomCode;
        this.playerSessions.set(session.playerId, session);
        
        const engineOpts = this.configHashManager ? { configHashManager: this.configHashManager } : {};
        const engine = new Fish3DGameEngine(roomCode, engineOpts);
        this.gameEngines[roomCode] = engine;
        
        engine.addPlayer(session.sessionId, session.playerId, data.playerName || 'Player');
        
        this.rooms[roomCode] = {
            roomCode,
            hostId: session.playerId,
            hostName: data.playerName || 'Player',
            players: {
                [session.playerId]: {
                    id: session.playerId,
                    name: data.playerName || 'Player',
                    position: 0,
                    balance: 1000,
                    weapon: '1x',
                    isHost: true
                }
            },
            playerCount: 1,
            state: 'lobby',
            isPublic: data.isPublic !== false,
            createdAt: Date.now()
        };
        
        session.send(PacketId.ROOM_STATE, {
            roomId: roomCode,
            roomCode: roomCode,
            state: 'lobby',
            players: [this.rooms[roomCode].players[session.playerId]],
            hostId: session.playerId,
            maxPlayers: 4
        });
        
        console.log(`[BINARY-WS] Room created: ${roomCode} by ${session.playerId} with game engine`);
    }
    
    handleRoomJoin(session, data) {
        const room = this.rooms[data.roomCode];
        const engine = this.gameEngines[data.roomCode];
        
        if (!room || !engine) {
            session.sendError(ErrorCodes.INVALID_ROOM, 'Room not found');
            return;
        }
        
        if (room.playerCount >= 4) {
            session.sendError(ErrorCodes.ROOM_FULL, 'Room is full');
            return;
        }
        
        session.playerId = `player-${session.sessionId.substring(0, 8)}`;
        session.roomCode = data.roomCode;
        this.playerSessions.set(session.playerId, session);
        
        engine.addPlayer(session.sessionId, session.playerId, data.playerName || 'Player');
        
        const position = room.playerCount;
        room.players[session.playerId] = {
            id: session.playerId,
            name: data.playerName || 'Player',
            position: position,
            balance: 1000,
            weapon: '1x',
            isHost: false
        };
        room.playerCount++;
        
        session.send(PacketId.ROOM_STATE, {
            roomId: data.roomCode,
            roomCode: data.roomCode,
            state: room.state,
            players: Object.values(room.players),
            hostId: room.hostId,
            maxPlayers: 4
        });
        
        this.broadcastToRoom(data.roomCode, PacketId.PLAYER_JOIN, {
            playerId: session.playerId,
            playerName: data.playerName || 'Player',
            position: position,
            balance: 1000,
            weapon: '1x'
        }, session.sessionId);
        
        console.log(`[BINARY-WS] Player ${session.playerId} joined room ${data.roomCode}`);
    }
    
    handleRoomLeave(session, data) {
        this.removePlayerFromRoom(session);
    }
    
    handlePlayerMovement(session, data) {
    }
    
    handleTimeSyncPing(session, data) {
        session.send(PacketId.TIME_SYNC_PONG, {
            seq: data.seq,
            serverTime: Date.now(),
            clientSendTime: data.clientSendTime
        });
    }
    
    handleGameStart(session, data) {
        if (!session.roomCode || !session.playerId) {
            return;
        }
        
        const room = this.rooms[session.roomCode];
        const engine = this.gameEngines[session.roomCode];
        
        if (!room || !engine) {
            session.sendError(ErrorCodes.INVALID_ROOM, 'Room not found');
            return;
        }
        
        if (room.hostId !== session.playerId) {
            session.sendError(ErrorCodes.INVALID_SESSION, 'Only host can start game');
            return;
        }
        
        room.state = 'playing';
        
        const binaryIO = this.createBinaryIOAdapter(session.roomCode);
        engine.startGameLoop(binaryIO);
        
        this.broadcastToRoom(session.roomCode, PacketId.ROOM_STATE, {
            roomId: session.roomCode,
            roomCode: session.roomCode,
            state: 'playing',
            players: Object.values(room.players),
            hostId: room.hostId,
            maxPlayers: 4
        });
        
        console.log(`[BINARY-WS] Game started in room ${session.roomCode} with engine game loop`);
    }
    
    createBinaryIOAdapter(roomCode) {
        const self = this;
        return {
            to: (target) => ({
                emit: (eventName, data) => {
                    self.handleEngineEvent(roomCode, target, eventName, data);
                }
            })
        };
    }
    
    handleEngineEvent(roomCode, target, eventName, data) {
        const room = this.rooms[roomCode];
        if (!room) return;
        
        switch (eventName) {
            case 'fishHit':
                if (target === roomCode) {
                    this.broadcastToRoom(roomCode, PacketId.HIT_RESULT, {
                        shotSequenceId: data.bulletId,
                        hits: [{
                            fishId: data.fishId,
                            damage: data.damage,
                            newHealth: data.newHealth,
                            maxHealth: data.maxHealth
                        }],
                        totalDamage: data.damage,
                        totalReward: 0,
                        newBalance: 0,
                        fishRemovedIds: [],
                        timestamp: Date.now()
                    });
                }
                break;
                
            case 'fishKilled':
                if (target === roomCode) {
                    this.broadcastToRoom(roomCode, PacketId.FISH_DEATH, {
                        fishId: data.fishId,
                        killedBy: data.topContributorId,
                        reward: data.totalReward,
                        timestamp: Date.now()
                    });
                }
                break;
                
            case 'balanceUpdate':
                const playerSession = this.findSessionBySocketId(target);
                if (playerSession) {
                    playerSession.send(PacketId.BALANCE_UPDATE, {
                        playerId: playerSession.playerId,
                        balance: data.balance,
                        change: data.change,
                        reason: data.reason,
                        timestamp: Date.now()
                    });
                    if (room.players[playerSession.playerId]) {
                        room.players[playerSession.playerId].balance = data.balance;
                    }
                }
                break;
                
            case 'gameState':
                if (target === roomCode) {
                    this.broadcastToRoom(roomCode, PacketId.ROOM_SNAPSHOT, {
                        roomId: roomCode,
                        serverTime: Date.now(),
                        bossTimer: data.bossTimer || 0,
                        fish: data.fish || [],
                        players: data.players || [],
                        bullets: data.bullets || []
                    });
                }
                break;
                
            default:
                break;
        }
    }
    
    findSessionBySocketId(socketId) {
        for (const [sessionId, session] of this.sessions) {
            if (session.sessionId === socketId) {
                return session;
            }
        }
        return null;
    }
    
    handleClose(session) {
        console.log(`[BINARY-WS] Connection closed: ${session.sessionId}`);
        rateLimiter.unregisterConnection(session.sessionId, session.clientIP);
        sequenceTracker.destroySession(session.sessionId);
        anomalyDetector.destroyPlayer(session.sessionId);
        this.removePlayerFromRoom(session);
        this.sessions.delete(session.sessionId);
        if (session.playerId) {
            this.playerSessions.delete(session.playerId);
        }
    }
    
    handleError(session, err) {
        console.error(`[BINARY-WS] Connection error for ${session.sessionId}:`, err.message);
    }
    
    removePlayerFromRoom(session) {
        if (!session.roomCode || !session.playerId) {
            return;
        }
        
        const room = this.rooms[session.roomCode];
        if (!room) return;
        
        delete room.players[session.playerId];
        room.playerCount--;
        
        this.broadcastToRoom(session.roomCode, PacketId.PLAYER_LEAVE, {
            playerId: session.playerId,
            reason: 'disconnect'
        });
        
        if (room.playerCount <= 0) {
            delete this.rooms[session.roomCode];
            if (this.gameEngines[session.roomCode]) {
                delete this.gameEngines[session.roomCode];
            }
            console.log(`[BINARY-WS] Room ${session.roomCode} deleted (empty)`);
        } else if (room.hostId === session.playerId) {
            const newHost = Object.keys(room.players)[0];
            if (newHost) {
                room.hostId = newHost;
                room.players[newHost].isHost = true;
                room.hostName = room.players[newHost].name;
            }
        }
        
        session.roomCode = null;
    }
    
    broadcastToRoom(roomCode, packetId, payload, excludeSessionId = null) {
        const room = this.rooms[roomCode];
        if (!room) return;
        
        for (const playerId of Object.keys(room.players)) {
            const playerSession = this.playerSessions.get(playerId);
            if (playerSession && playerSession.sessionId !== excludeSessionId) {
                playerSession.send(packetId, payload);
            }
        }
    }
    
    getPlayersSnapshot(room) {
        return Object.values(room.players).map(p => ({
            id: p.id,
            name: p.name,
            position: p.position,
            balance: p.balance,
            weapon: p.weapon
        }));
    }
    
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    
    cleanupSessions() {
        const now = Date.now();
        const timeout = 30 * 60 * 1000;
        
        for (const [sessionId, session] of this.sessions) {
            if (now - session.lastActivity > timeout) {
                console.log(`[BINARY-WS] Cleaning up inactive session: ${sessionId}`);
                session.ws.close();
                this.handleClose(session);
            }
        }
    }
    
    close() {
        clearInterval(this.cleanupInterval);
        this.wss.close();
        console.log('[BINARY-WS] Binary WebSocket server closed');
    }
}

module.exports = { BinaryWebSocketServer, BinarySession };
