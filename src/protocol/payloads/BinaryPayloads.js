/**
 * Binary Payload Encoders/Decoders
 * Implements true binary struct encoding/decoding for all packet payloads.
 * NO JSON - all fields are fixed-size binary.
 */

const { BinaryFieldSizes, ReasonCodes } = require('../packets');

function writeString(buffer, offset, str, maxLength) {
    const bytes = Buffer.from(str || '', 'utf8').slice(0, maxLength);
    bytes.copy(buffer, offset);
    buffer.fill(0, offset + bytes.length, offset + maxLength);
    return offset + maxLength;
}

function readString(buffer, offset, maxLength) {
    const slice = buffer.slice(offset, offset + maxLength);
    const nullIndex = slice.indexOf(0);
    const end = nullIndex === -1 ? maxLength : nullIndex;
    return slice.slice(0, end).toString('utf8');
}

function writePlayerId(buffer, offset, playerId) {
    const idStr = (playerId || '').slice(0, 32);
    const bytes = Buffer.from(idStr, 'utf8').slice(0, BinaryFieldSizes.PLAYER_ID);
    bytes.copy(buffer, offset);
    buffer.fill(0, offset + bytes.length, offset + BinaryFieldSizes.PLAYER_ID);
    return offset + BinaryFieldSizes.PLAYER_ID;
}

function readPlayerId(buffer, offset) {
    return readString(buffer, offset, BinaryFieldSizes.PLAYER_ID);
}

function writeFloat32(buffer, offset, value) {
    buffer.writeFloatBE(value || 0, offset);
    return offset + 4;
}

function readFloat32(buffer, offset) {
    return buffer.readFloatBE(offset);
}

function writeUint64(buffer, offset, value) {
    const bigValue = BigInt(value || 0);
    buffer.writeBigUInt64BE(bigValue, offset);
    return offset + 8;
}

function readUint64(buffer, offset) {
    return Number(buffer.readBigUInt64BE(offset));
}

function encodeHandshakeRequest(data) {
    const buffer = Buffer.alloc(98);
    let offset = 0;
    const pubKey = data.clientPublicKey || Buffer.alloc(65);
    pubKey.copy(buffer, offset, 0, 65);
    offset += 65;
    const nonce = data.clientNonce || Buffer.alloc(32);
    nonce.copy(buffer, offset, 0, 32);
    offset += 32;
    buffer.writeUInt8(data.protocolVersion || 2, offset);
    return buffer;
}

function decodeHandshakeRequest(buffer) {
    return {
        clientPublicKey: buffer.slice(0, 65),
        clientNonce: buffer.slice(65, 97),
        protocolVersion: buffer.readUInt8(97)
    };
}

function encodeHandshakeResponse(data) {
    const buffer = Buffer.alloc(145);
    let offset = 0;
    const pubKey = data.serverPublicKey || Buffer.alloc(65);
    pubKey.copy(buffer, offset, 0, 65);
    offset += 65;
    const nonce = data.serverNonce || Buffer.alloc(32);
    nonce.copy(buffer, offset, 0, 32);
    offset += 32;
    const salt = data.salt || Buffer.alloc(32);
    salt.copy(buffer, offset, 0, 32);
    offset += 32;
    const sessionId = Buffer.from(data.sessionId || '', 'hex').slice(0, 16);
    sessionId.copy(buffer, offset);
    buffer.fill(0, offset + sessionId.length, offset + 16);
    return buffer;
}

function decodeHandshakeResponse(buffer) {
    return {
        serverPublicKey: buffer.slice(0, 65),
        serverNonce: buffer.slice(65, 97),
        salt: buffer.slice(97, 129),
        sessionId: buffer.slice(129, 145).toString('hex')
    };
}

function encodeShotFired(data) {
    const buffer = Buffer.alloc(53);
    let offset = 0;
    offset = writePlayerId(buffer, offset, data.playerId);
    buffer.writeUInt8(data.weaponId || 1, offset); offset += 1;
    offset = writeFloat32(buffer, offset, data.targetX);
    offset = writeFloat32(buffer, offset, data.targetY);
    offset = writeFloat32(buffer, offset, data.targetZ);
    offset = writeFloat32(buffer, offset, data.directionX);
    offset = writeFloat32(buffer, offset, data.directionY);
    offset = writeFloat32(buffer, offset, data.directionZ);
    buffer.writeUInt32BE(data.shotSequenceId || 0, offset); offset += 4;
    writeUint64(buffer, offset, data.timestamp || Date.now());
    return buffer;
}

function decodeShotFired(buffer) {
    let offset = 0;
    const playerId = readPlayerId(buffer, offset); offset += BinaryFieldSizes.PLAYER_ID;
    const weaponId = buffer.readUInt8(offset); offset += 1;
    const targetX = readFloat32(buffer, offset); offset += 4;
    const targetY = readFloat32(buffer, offset); offset += 4;
    const targetZ = readFloat32(buffer, offset); offset += 4;
    const directionX = readFloat32(buffer, offset); offset += 4;
    const directionY = readFloat32(buffer, offset); offset += 4;
    const directionZ = readFloat32(buffer, offset); offset += 4;
    const shotSequenceId = buffer.readUInt32BE(offset); offset += 4;
    const timestamp = readUint64(buffer, offset);
    return { playerId, weaponId, targetX, targetY, targetZ, directionX, directionY, directionZ, shotSequenceId, timestamp };
}

function encodeHitResult(data) {
    const hits = data.hits || [];
    const buffer = Buffer.alloc(30 + hits.length * 20);
    let offset = 0;
    buffer.writeUInt32BE(data.shotSequenceId || 0, offset); offset += 4;
    buffer.writeUInt16BE(hits.length, offset); offset += 2;
    buffer.writeUInt32BE(data.totalDamage || 0, offset); offset += 4;
    buffer.writeUInt32BE(data.totalReward || 0, offset); offset += 4;
    offset = writeUint64(buffer, offset, data.newBalance || 0);
    offset = writeUint64(buffer, offset, data.timestamp || Date.now());
    for (const hit of hits) {
        offset = writeUint64(buffer, offset, hit.fishId || 0);
        buffer.writeUInt32BE(hit.damage || 0, offset); offset += 4;
        buffer.writeUInt32BE(hit.reward || 0, offset); offset += 4;
        buffer.writeUInt8(hit.killed ? 1 : 0, offset); offset += 1;
        buffer.fill(0, offset, offset + 3); offset += 3;
    }
    return buffer;
}

function decodeHitResult(buffer) {
    let offset = 0;
    const shotSequenceId = buffer.readUInt32BE(offset); offset += 4;
    const hitCount = buffer.readUInt16BE(offset); offset += 2;
    const totalDamage = buffer.readUInt32BE(offset); offset += 4;
    const totalReward = buffer.readUInt32BE(offset); offset += 4;
    const newBalance = readUint64(buffer, offset); offset += 8;
    const timestamp = readUint64(buffer, offset); offset += 8;
    const hits = [];
    for (let i = 0; i < hitCount; i++) {
        const fishId = readUint64(buffer, offset); offset += 8;
        const damage = buffer.readUInt32BE(offset); offset += 4;
        const reward = buffer.readUInt32BE(offset); offset += 4;
        const killed = buffer.readUInt8(offset) === 1; offset += 4;
        hits.push({ fishId, damage, reward, killed });
    }
    return { shotSequenceId, hitCount, totalDamage, totalReward, newBalance, timestamp, hits };
}

function encodeBalanceUpdate(data) {
    const buffer = Buffer.alloc(37);
    let offset = 0;
    offset = writePlayerId(buffer, offset, data.playerId);
    offset = writeUint64(buffer, offset, data.balance || 0);
    buffer.writeInt32BE(data.change || 0, offset); offset += 4;
    buffer.writeUInt8(data.reason || ReasonCodes.BALANCE_INITIAL, offset); offset += 1;
    writeUint64(buffer, offset, data.timestamp || Date.now());
    return buffer;
}

function decodeBalanceUpdate(buffer) {
    let offset = 0;
    const playerId = readPlayerId(buffer, offset); offset += BinaryFieldSizes.PLAYER_ID;
    const balance = readUint64(buffer, offset); offset += 8;
    const change = buffer.readInt32BE(offset); offset += 4;
    const reason = buffer.readUInt8(offset); offset += 1;
    const timestamp = readUint64(buffer, offset);
    return { playerId, balance, change, reason, timestamp };
}

function encodeWeaponSwitch(data) {
    const buffer = Buffer.alloc(25);
    let offset = 0;
    offset = writePlayerId(buffer, offset, data.playerId);
    buffer.writeUInt8(data.weaponId || 1, offset); offset += 1;
    writeUint64(buffer, offset, data.timestamp || Date.now());
    return buffer;
}

function decodeWeaponSwitch(buffer) {
    let offset = 0;
    const playerId = readPlayerId(buffer, offset); offset += BinaryFieldSizes.PLAYER_ID;
    const weaponId = buffer.readUInt8(offset); offset += 1;
    const timestamp = readUint64(buffer, offset);
    return { playerId, weaponId, timestamp };
}

function encodeFishSpawn(data) {
    const buffer = Buffer.alloc(54);
    let offset = 0;
    offset = writeUint64(buffer, offset, data.fishId || 0);
    buffer.writeUInt8(data.fishType || 0, offset); offset += 1;
    offset = writeFloat32(buffer, offset, data.x);
    offset = writeFloat32(buffer, offset, data.y);
    offset = writeFloat32(buffer, offset, data.z);
    buffer.writeUInt32BE(data.hp || 0, offset); offset += 4;
    buffer.writeUInt32BE(data.maxHp || 0, offset); offset += 4;
    buffer.writeUInt32BE(data.reward || 0, offset); offset += 4;
    offset = writeFloat32(buffer, offset, data.velocityX);
    offset = writeFloat32(buffer, offset, data.velocityY);
    offset = writeFloat32(buffer, offset, data.velocityZ);
    buffer.writeUInt8(data.isBoss ? 1 : 0, offset); offset += 1;
    writeUint64(buffer, offset, data.timestamp || Date.now());
    return buffer;
}

function decodeFishSpawn(buffer) {
    let offset = 0;
    const fishId = readUint64(buffer, offset); offset += 8;
    const fishType = buffer.readUInt8(offset); offset += 1;
    const x = readFloat32(buffer, offset); offset += 4;
    const y = readFloat32(buffer, offset); offset += 4;
    const z = readFloat32(buffer, offset); offset += 4;
    const hp = buffer.readUInt32BE(offset); offset += 4;
    const maxHp = buffer.readUInt32BE(offset); offset += 4;
    const reward = buffer.readUInt32BE(offset); offset += 4;
    const velocityX = readFloat32(buffer, offset); offset += 4;
    const velocityY = readFloat32(buffer, offset); offset += 4;
    const velocityZ = readFloat32(buffer, offset); offset += 4;
    const isBoss = buffer.readUInt8(offset) === 1; offset += 1;
    const timestamp = readUint64(buffer, offset);
    return { fishId, fishType, x, y, z, hp, maxHp, reward, velocityX, velocityY, velocityZ, isBoss, timestamp };
}

function encodeFishDeath(data) {
    const buffer = Buffer.alloc(36);
    let offset = 0;
    offset = writeUint64(buffer, offset, data.fishId || 0);
    offset = writePlayerId(buffer, offset, data.killedBy);
    buffer.writeUInt32BE(data.reward || 0, offset); offset += 4;
    writeUint64(buffer, offset, data.timestamp || Date.now());
    return buffer;
}

function decodeFishDeath(buffer) {
    let offset = 0;
    const fishId = readUint64(buffer, offset); offset += 8;
    const killedBy = readPlayerId(buffer, offset); offset += BinaryFieldSizes.PLAYER_ID;
    const reward = buffer.readUInt32BE(offset); offset += 4;
    const timestamp = readUint64(buffer, offset);
    return { fishId, killedBy, reward, timestamp };
}

function encodeRoomCreate(data) {
    const buffer = Buffer.alloc(41);
    let offset = 0;
    offset = writeString(buffer, offset, data.playerName, BinaryFieldSizes.PLAYER_NAME);
    buffer.writeUInt8(data.isPublic ? 1 : 0, offset); offset += 1;
    writeUint64(buffer, offset, data.timestamp || Date.now());
    return buffer;
}

function decodeRoomCreate(buffer) {
    let offset = 0;
    const playerName = readString(buffer, offset, BinaryFieldSizes.PLAYER_NAME); offset += BinaryFieldSizes.PLAYER_NAME;
    const isPublic = buffer.readUInt8(offset) === 1; offset += 1;
    const timestamp = readUint64(buffer, offset);
    return { playerName, isPublic, timestamp };
}

function encodeRoomJoin(data) {
    const buffer = Buffer.alloc(46);
    let offset = 0;
    offset = writeString(buffer, offset, data.roomCode, BinaryFieldSizes.ROOM_CODE);
    offset = writeString(buffer, offset, data.playerName, BinaryFieldSizes.PLAYER_NAME);
    writeUint64(buffer, offset, data.timestamp || Date.now());
    return buffer;
}

function decodeRoomJoin(buffer) {
    let offset = 0;
    const roomCode = readString(buffer, offset, BinaryFieldSizes.ROOM_CODE); offset += BinaryFieldSizes.ROOM_CODE;
    const playerName = readString(buffer, offset, BinaryFieldSizes.PLAYER_NAME); offset += BinaryFieldSizes.PLAYER_NAME;
    const timestamp = readUint64(buffer, offset);
    return { roomCode, playerName, timestamp };
}

function encodeRoomState(data) {
    const players = data.players || [];
    const buffer = Buffer.alloc(33 + players.length * 58);
    let offset = 0;
    offset = writeString(buffer, offset, data.roomCode, BinaryFieldSizes.ROOM_CODE);
    buffer.writeUInt8(data.state || 0, offset); offset += 1;
    offset = writePlayerId(buffer, offset, data.hostId);
    buffer.writeUInt8(data.maxPlayers || 4, offset); offset += 1;
    buffer.writeUInt8(players.length, offset); offset += 1;
    offset = writeUint64(buffer, offset, data.timestamp || Date.now());
    for (const player of players) {
        offset = writePlayerId(buffer, offset, player.id || player.playerId);
        offset = writeString(buffer, offset, player.name || player.playerName, BinaryFieldSizes.PLAYER_NAME);
        buffer.writeUInt8(player.position || 0, offset); offset += 1;
        offset = writeUint64(buffer, offset, player.balance || 0);
        buffer.writeUInt8(player.weaponId || player.weapon || 1, offset); offset += 1;
    }
    return buffer;
}

function decodeRoomState(buffer) {
    let offset = 0;
    const roomCode = readString(buffer, offset, BinaryFieldSizes.ROOM_CODE); offset += BinaryFieldSizes.ROOM_CODE;
    const state = buffer.readUInt8(offset); offset += 1;
    const hostId = readPlayerId(buffer, offset); offset += BinaryFieldSizes.PLAYER_ID;
    const maxPlayers = buffer.readUInt8(offset); offset += 1;
    const playerCount = buffer.readUInt8(offset); offset += 1;
    const timestamp = readUint64(buffer, offset); offset += 8;
    const players = [];
    for (let i = 0; i < playerCount; i++) {
        const playerId = readPlayerId(buffer, offset); offset += BinaryFieldSizes.PLAYER_ID;
        const playerName = readString(buffer, offset, BinaryFieldSizes.PLAYER_NAME); offset += BinaryFieldSizes.PLAYER_NAME;
        const position = buffer.readUInt8(offset); offset += 1;
        const balance = readUint64(buffer, offset); offset += 8;
        const weaponId = buffer.readUInt8(offset); offset += 1;
        players.push({ playerId, playerName, position, balance, weaponId });
    }
    return { roomCode, state, hostId, maxPlayers, playerCount, timestamp, players };
}

function encodeTimeSyncPing(data) {
    const buffer = Buffer.alloc(12);
    buffer.writeUInt32BE(data.seq || 0, 0);
    writeUint64(buffer, 4, data.clientSendTime || Date.now());
    return buffer;
}

function decodeTimeSyncPing(buffer) {
    return { seq: buffer.readUInt32BE(0), clientSendTime: readUint64(buffer, 4) };
}

function encodeTimeSyncPong(data) {
    const buffer = Buffer.alloc(20);
    buffer.writeUInt32BE(data.seq || 0, 0);
    writeUint64(buffer, 4, data.serverTime || Date.now());
    writeUint64(buffer, 12, data.clientSendTime || 0);
    return buffer;
}

function decodeTimeSyncPong(buffer) {
    return { seq: buffer.readUInt32BE(0), serverTime: readUint64(buffer, 4), clientSendTime: readUint64(buffer, 12) };
}

function encodeError(data) {
    const message = data.message || '';
    const msgBytes = Buffer.from(message, 'utf8').slice(0, 252);
    const buffer = Buffer.alloc(4 + msgBytes.length);
    buffer.writeUInt16BE(data.code || 0, 0);
    buffer.writeUInt16BE(msgBytes.length, 2);
    msgBytes.copy(buffer, 4);
    return buffer;
}

function decodeError(buffer) {
    const code = buffer.readUInt16BE(0);
    const messageLength = buffer.readUInt16BE(2);
    const message = buffer.slice(4, 4 + messageLength).toString('utf8');
    return { code, message };
}

function encodePlayerJoin(data) {
    const buffer = Buffer.alloc(66);
    let offset = 0;
    offset = writePlayerId(buffer, offset, data.playerId);
    offset = writeString(buffer, offset, data.playerName, BinaryFieldSizes.PLAYER_NAME);
    buffer.writeUInt8(data.position || 0, offset); offset += 1;
    offset = writeUint64(buffer, offset, data.balance || 0);
    buffer.writeUInt8(data.weaponId || 1, offset); offset += 1;
    writeUint64(buffer, offset, data.timestamp || Date.now());
    return buffer;
}

function decodePlayerJoin(buffer) {
    let offset = 0;
    const playerId = readPlayerId(buffer, offset); offset += BinaryFieldSizes.PLAYER_ID;
    const playerName = readString(buffer, offset, BinaryFieldSizes.PLAYER_NAME); offset += BinaryFieldSizes.PLAYER_NAME;
    const position = buffer.readUInt8(offset); offset += 1;
    const balance = readUint64(buffer, offset); offset += 8;
    const weaponId = buffer.readUInt8(offset); offset += 1;
    const timestamp = readUint64(buffer, offset);
    return { playerId, playerName, position, balance, weaponId, timestamp };
}

function encodePlayerLeave(data) {
    const buffer = Buffer.alloc(25);
    let offset = 0;
    offset = writePlayerId(buffer, offset, data.playerId);
    buffer.writeUInt8(data.reason || ReasonCodes.LEAVE_DISCONNECT, offset); offset += 1;
    writeUint64(buffer, offset, data.timestamp || Date.now());
    return buffer;
}

function decodePlayerLeave(buffer) {
    let offset = 0;
    const playerId = readPlayerId(buffer, offset); offset += BinaryFieldSizes.PLAYER_ID;
    const reason = buffer.readUInt8(offset); offset += 1;
    const timestamp = readUint64(buffer, offset);
    return { playerId, reason, timestamp };
}

function encodeGameStart(data) {
    const buffer = Buffer.alloc(8);
    writeUint64(buffer, 0, data.timestamp || Date.now());
    return buffer;
}

function decodeGameStart(buffer) {
    return { timestamp: readUint64(buffer, 0) };
}

function encodeRoomSnapshot(data) {
    const fish = data.fish || [];
    const players = data.players || [];
    const buffer = Buffer.alloc(21 + fish.length * 37 + players.length * 33);
    let offset = 0;
    offset = writeString(buffer, offset, data.roomCode || data.roomId, BinaryFieldSizes.ROOM_CODE);
    offset = writeUint64(buffer, offset, data.serverTime || Date.now());
    buffer.writeUInt32BE(data.bossTimer || 0, offset); offset += 4;
    buffer.writeUInt16BE(fish.length, offset); offset += 2;
    buffer.writeUInt8(players.length, offset); offset += 1;
    for (const f of fish) {
        offset = writeUint64(buffer, offset, f.id || f.fishId || 0);
        buffer.writeUInt8(f.type || f.fishType || 0, offset); offset += 1;
        offset = writeFloat32(buffer, offset, f.x || 0);
        offset = writeFloat32(buffer, offset, f.y || 0);
        offset = writeFloat32(buffer, offset, f.z || 0);
        buffer.writeUInt32BE(f.hp || 0, offset); offset += 4;
        offset = writeFloat32(buffer, offset, f.velocityX || f.vx || 0);
        offset = writeFloat32(buffer, offset, f.velocityY || f.vy || 0);
        offset = writeFloat32(buffer, offset, f.velocityZ || f.vz || 0);
    }
    for (const p of players) {
        offset = writePlayerId(buffer, offset, p.id || p.playerId);
        offset = writeUint64(buffer, offset, p.balance || 0);
        buffer.writeUInt8(p.weaponId || p.weapon || 1, offset); offset += 1;
        offset = writeFloat32(buffer, offset, p.yaw || 0);
        offset = writeFloat32(buffer, offset, p.pitch || 0);
    }
    return buffer;
}

function decodeRoomSnapshot(buffer) {
    let offset = 0;
    const roomCode = readString(buffer, offset, BinaryFieldSizes.ROOM_CODE); offset += BinaryFieldSizes.ROOM_CODE;
    const serverTime = readUint64(buffer, offset); offset += 8;
    const bossTimer = buffer.readUInt32BE(offset); offset += 4;
    const fishCount = buffer.readUInt16BE(offset); offset += 2;
    const playerCount = buffer.readUInt8(offset); offset += 1;
    const fish = [];
    for (let i = 0; i < fishCount; i++) {
        const fishId = readUint64(buffer, offset); offset += 8;
        const fishType = buffer.readUInt8(offset); offset += 1;
        const x = readFloat32(buffer, offset); offset += 4;
        const y = readFloat32(buffer, offset); offset += 4;
        const z = readFloat32(buffer, offset); offset += 4;
        const hp = buffer.readUInt32BE(offset); offset += 4;
        const velocityX = readFloat32(buffer, offset); offset += 4;
        const velocityY = readFloat32(buffer, offset); offset += 4;
        const velocityZ = readFloat32(buffer, offset); offset += 4;
        fish.push({ fishId, fishType, x, y, z, hp, velocityX, velocityY, velocityZ });
    }
    const players = [];
    for (let i = 0; i < playerCount; i++) {
        const playerId = readPlayerId(buffer, offset); offset += BinaryFieldSizes.PLAYER_ID;
        const balance = readUint64(buffer, offset); offset += 8;
        const weaponId = buffer.readUInt8(offset); offset += 1;
        const yaw = readFloat32(buffer, offset); offset += 4;
        const pitch = readFloat32(buffer, offset); offset += 4;
        players.push({ playerId, balance, weaponId, yaw, pitch });
    }
    return { roomCode, serverTime, bossTimer, fishCount, playerCount, fish, players };
}

module.exports = {
    encodeHandshakeRequest, decodeHandshakeRequest,
    encodeHandshakeResponse, decodeHandshakeResponse,
    encodeShotFired, decodeShotFired,
    encodeHitResult, decodeHitResult,
    encodeBalanceUpdate, decodeBalanceUpdate,
    encodeWeaponSwitch, decodeWeaponSwitch,
    encodeFishSpawn, decodeFishSpawn,
    encodeFishDeath, decodeFishDeath,
    encodeRoomCreate, decodeRoomCreate,
    encodeRoomJoin, decodeRoomJoin,
    encodeRoomState, decodeRoomState,
    encodeTimeSyncPing, decodeTimeSyncPing,
    encodeTimeSyncPong, decodeTimeSyncPong,
    encodeError, decodeError,
    encodePlayerJoin, decodePlayerJoin,
    encodePlayerLeave, decodePlayerLeave,
    encodeGameStart, decodeGameStart,
    encodeRoomSnapshot, decodeRoomSnapshot
};
