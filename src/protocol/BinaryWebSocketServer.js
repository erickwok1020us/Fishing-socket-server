/**
 * Binary WebSocket Server
 * 
 * Implements the secure binary WebSocket server as specified in PDF Section 4.3.
 * Runs alongside the existing Socket.IO server on a separate endpoint (/ws-game).
 * 
 * Features:
 * - AES-256-GCM encryption
 * - HMAC-SHA256 authentication
 * - Nonce validation (replay protection)
 * - Full security pipeline per PDF Section 6
 */

const WebSocket = require('ws');
const crypto = require('crypto');
const { PacketId, ErrorCodes, HEADER_SIZE, GCM_TAG_SIZE, HMAC_SIZE } = require('./packets');
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

class BinarySession {
    constructor(ws, sessionId) {
        this.ws = ws;
        this.sessionId = sessionId;
        this.playerId = null;
        this.roomCode = null;
        this.encryptionKey = crypto.randomBytes(32);
        this.hmacKey = crypto.randomBytes(32);
        this.lastClientNonce = 0;
        this.serverNonce = 0;
        this.createdAt = Date.now();
        this.lastActivity = Date.now();
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
        
        console.log(`[BINARY-WS] New connection: ${sessionId}`);
        
        this.sendHandshakeResponse(session);
        
        ws.on('message', (data) => this.handleMessage(session, data));
        ws.on('close', () => this.handleClose(session));
        ws.on('error', (err) => this.handleError(session, err));
    }
    
    sendHandshakeResponse(session) {
        const payload = {
            sessionId: session.sessionId,
            encryptionKey: session.encryptionKey.toString('base64'),
            hmacKey: session.hmacKey.toString('base64'),
            serverTime: Date.now()
        };
        
        const response = Buffer.alloc(4 + JSON.stringify(payload).length);
        response.writeUInt8(1, 0);
        response.writeUInt8(PacketId.HANDSHAKE_RESPONSE, 1);
        response.writeUInt16BE(JSON.stringify(payload).length, 2);
        Buffer.from(JSON.stringify(payload)).copy(response, 4);
        
        session.ws.send(response);
        console.log(`[BINARY-WS] Sent handshake response to ${session.sessionId}`);
    }
    
    handleMessage(session, data) {
        try {
            const buffer = Buffer.from(data);
            
            if (buffer.length < HEADER_SIZE) {
                session.sendError(ErrorCodes.INVALID_PACKET, 'Packet too small');
                return;
            }
            
            const packetId = buffer.readUInt8(1);
            
            if (packetId === PacketId.HANDSHAKE_REQUEST) {
                this.handleHandshakeRequest(session, buffer);
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
                session.sendError(err.code, err.message);
                session.ws.close();
            } else {
                console.error(`[BINARY-WS] Unexpected error for ${session.sessionId}:`, err);
                session.sendError(ErrorCodes.INVALID_PACKET, 'Internal error');
            }
        }
    }
    
    handleHandshakeRequest(session, buffer) {
        console.log(`[BINARY-WS] Handshake request from ${session.sessionId}`);
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
        
        const room = this.rooms[session.roomCode];
        const engine = this.gameEngines[session.roomCode];
        
        if (!room || !engine) {
            session.sendError(ErrorCodes.INVALID_ROOM, 'Room not found');
            return;
        }
        
        const player = room.players[session.playerId];
        if (!player) {
            session.sendError(ErrorCodes.INVALID_SESSION, 'Player not in room');
            return;
        }
        
        const weapon = engine.WEAPONS[data.weaponId] || engine.WEAPONS['1x'];
        const cost = weapon.cost || 1;
        
        if (player.balance < cost) {
            session.send(PacketId.BALANCE_UPDATE, {
                playerId: session.playerId,
                balance: player.balance,
                change: 0,
                reason: 'insufficient_balance'
            });
            return;
        }
        
        player.balance -= cost;
        
        const hitResult = {
            shotSequenceId: data.shotSequenceId,
            hits: [],
            totalDamage: 0,
            totalReward: 0,
            newBalance: player.balance,
            fishRemovedIds: []
        };
        
        session.send(PacketId.HIT_RESULT, hitResult);
        
        this.broadcastToRoom(session.roomCode, PacketId.ROOM_SNAPSHOT, {
            roomId: session.roomCode,
            serverTime: Date.now(),
            players: this.getPlayersSnapshot(room)
        }, session.sessionId);
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
        
        console.log(`[BINARY-WS] Room created: ${roomCode} by ${session.playerId}`);
    }
    
    handleRoomJoin(session, data) {
        const room = this.rooms[data.roomCode];
        
        if (!room) {
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
        if (!room || room.hostId !== session.playerId) {
            session.sendError(ErrorCodes.INVALID_SESSION, 'Only host can start game');
            return;
        }
        
        room.state = 'playing';
        
        this.broadcastToRoom(session.roomCode, PacketId.ROOM_STATE, {
            roomId: session.roomCode,
            roomCode: session.roomCode,
            state: 'playing',
            players: Object.values(room.players),
            hostId: room.hostId,
            maxPlayers: 4
        });
        
        console.log(`[BINARY-WS] Game started in room ${session.roomCode}`);
    }
    
    handleClose(session) {
        console.log(`[BINARY-WS] Connection closed: ${session.sessionId}`);
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
