/**
 * Binary Protocol Packet Definitions - Version 2 (Certification Compliant)
 * 
 * Based on PDF Technical Specification Section 4.3 & 6
 * All client-server communication uses secure WebSocket (wss://) and custom binary protocol.
 * JSON communication is strictly forbidden for real-time game state and actions.
 * 
 * Packet Structure (V2):
 * [Header (20 bytes)] + [Encrypted Payload] + [GCM Tag (16 bytes)] + [HMAC (32 bytes)]
 * 
 * Header Structure (20 bytes):
 * - protocolVersion: uint8 (1 byte)
 * - reserved: uint8 (1 byte, for alignment)
 * - packetId: uint16 (2 bytes, big-endian) - Changed from uint8 per PDF spec
 * - payloadLength: uint32 (4 bytes, big-endian)
 * - checksum: uint32 (4 bytes, CRC32)
 * - nonce: uint64 (8 bytes, big-endian) - Changed from uint48 per PDF spec
 * 
 * Security Pipeline (Section 6):
 * 1. Read Raw Bytes
 * 2. Extract Header
 * 3. Validate Payload Size and PacketId Whitelist
 * 4. Verify CRC32 Checksum
 * 5. Verify HMAC-SHA256
 * 6. Decrypt AES-256-GCM Payload
 * 7. Validate Nonce (Monotonically Increasing)
 * 8. Dispatch by PacketId
 */

const PROTOCOL_VERSION = 2;

const PacketId = {
    // Handshake & Session (0x0001 - 0x000F)
    HANDSHAKE_REQUEST: 0x0001,
    HANDSHAKE_RESPONSE: 0x0002,
    SESSION_INIT: 0x0003,
    SESSION_ACK: 0x0004,
    
    // Game Actions (0x0010 - 0x001F)
    SHOT_FIRED: 0x0010,
    HIT_RESULT: 0x0011,
    BALANCE_UPDATE: 0x0012,
    WEAPON_SWITCH: 0x0013,
    
    // Fish State (0x0020 - 0x002F)
    ROOM_SNAPSHOT: 0x0020,
    FISH_SPAWN: 0x0021,
    FISH_DEATH: 0x0022,
    FISH_UPDATE: 0x0023,
    
    // Boss Events (0x0030 - 0x003F)
    BOSS_SPAWN: 0x0030,
    BOSS_DEATH: 0x0031,
    BOSS_DAMAGE: 0x0032,
    
    // Player Events (0x0040 - 0x004F)
    PLAYER_JOIN: 0x0040,
    PLAYER_LEAVE: 0x0041,
    PLAYER_MOVEMENT: 0x0042,
    
    // Room Management (0x0050 - 0x005F)
    ROOM_CREATE: 0x0050,
    ROOM_JOIN: 0x0051,
    ROOM_LEAVE: 0x0052,
    ROOM_STATE: 0x0053,
    GAME_START: 0x0054,
    
    // Time Sync (0x0060 - 0x006F)
    TIME_SYNC_PING: 0x0060,
    TIME_SYNC_PONG: 0x0061,
    
    // System (0x00F0 - 0x00FF)
    ERROR: 0x00F0,
    DISCONNECT: 0x00FF
};

const PacketIdWhitelist = new Set(Object.values(PacketId));

/**
 * Binary Payload Field Sizes (in bytes)
 * All payloads use fixed-size binary fields, no JSON
 */
const BinaryFieldSizes = {
    PLAYER_ID: 16,
    ROOM_CODE: 6,
    PLAYER_NAME: 32,
    FISH_ID: 8,
    WEAPON_ID: 1,
    FLOAT32: 4,
    FLOAT64: 8,
    UINT8: 1,
    UINT16: 2,
    UINT32: 4,
    UINT64: 8,
    INT32: 4,
    INT64: 8,
    TIMESTAMP: 8
};

const PayloadSizeLimits = {
    [PacketId.HANDSHAKE_REQUEST]: { min: 65, max: 256, fixed: false },
    [PacketId.HANDSHAKE_RESPONSE]: { min: 97, max: 512, fixed: false },
    [PacketId.SESSION_INIT]: { min: 16, max: 128, fixed: false },
    [PacketId.SESSION_ACK]: { min: 8, max: 64, fixed: false },
    
    [PacketId.SHOT_FIRED]: { min: 53, max: 64, fixed: true, size: 53 },
    [PacketId.HIT_RESULT]: { min: 30, max: 2048, fixed: false },
    [PacketId.BALANCE_UPDATE]: { min: 37, max: 48, fixed: true, size: 37 },
    [PacketId.WEAPON_SWITCH]: { min: 25, max: 32, fixed: true, size: 25 },
    
    [PacketId.ROOM_SNAPSHOT]: { min: 32, max: 65536, fixed: false },
    [PacketId.FISH_SPAWN]: { min: 54, max: 64, fixed: true, size: 54 },
    [PacketId.FISH_DEATH]: { min: 36, max: 256, fixed: false },
    [PacketId.FISH_UPDATE]: { min: 16, max: 8192, fixed: false },
    
    [PacketId.BOSS_SPAWN]: { min: 54, max: 64, fixed: true, size: 54 },
    [PacketId.BOSS_DEATH]: { min: 20, max: 512, fixed: false },
    [PacketId.BOSS_DAMAGE]: { min: 40, max: 48, fixed: true, size: 40 },
    
    [PacketId.PLAYER_JOIN]: { min: 66, max: 80, fixed: true, size: 66 },
    [PacketId.PLAYER_LEAVE]: { min: 25, max: 32, fixed: true, size: 25 },
    [PacketId.PLAYER_MOVEMENT]: { min: 32, max: 40, fixed: true, size: 32 },
    
    [PacketId.ROOM_CREATE]: { min: 41, max: 48, fixed: true, size: 41 },
    [PacketId.ROOM_JOIN]: { min: 46, max: 56, fixed: true, size: 46 },
    [PacketId.ROOM_LEAVE]: { min: 8, max: 16, fixed: true, size: 8 },
    [PacketId.ROOM_STATE]: { min: 32, max: 4096, fixed: false },
    [PacketId.GAME_START]: { min: 8, max: 16, fixed: true, size: 8 },
    
    [PacketId.TIME_SYNC_PING]: { min: 12, max: 16, fixed: true, size: 12 },
    [PacketId.TIME_SYNC_PONG]: { min: 20, max: 24, fixed: true, size: 20 },
    
    [PacketId.ERROR]: { min: 4, max: 256, fixed: false },
    [PacketId.DISCONNECT]: { min: 9, max: 16, fixed: true, size: 9 }
};

const HEADER_SIZE = 20;
const GCM_TAG_SIZE = 16;
const HMAC_SIZE = 32;
const NONCE_SIZE = 12;

const ErrorCodes = {
    INVALID_PACKET: 0x0001,
    INVALID_CHECKSUM: 0x0002,
    INVALID_HMAC: 0x0003,
    DECRYPTION_FAILED: 0x0004,
    INVALID_NONCE: 0x0005,
    INVALID_SESSION: 0x0006,
    INSUFFICIENT_BALANCE: 0x0007,
    INVALID_WEAPON: 0x0008,
    INVALID_ROOM: 0x0009,
    ROOM_FULL: 0x000A,
    RATE_LIMITED: 0x000B,
    UNKNOWN_PACKET_ID: 0x000C,
    PAYLOAD_TOO_LARGE: 0x000D,
    PAYLOAD_TOO_SMALL: 0x000E,
    INVALID_HANDSHAKE: 0x000F,
    KEY_DERIVATION_FAILED: 0x0010
};

const ReasonCodes = {
    BALANCE_SHOT_COST: 0x01,
    BALANCE_FISH_REWARD: 0x02,
    BALANCE_BOSS_REWARD: 0x03,
    BALANCE_INITIAL: 0x04,
    BALANCE_INSUFFICIENT: 0x05,
    LEAVE_DISCONNECT: 0x01,
    LEAVE_KICKED: 0x02,
    LEAVE_TIMEOUT: 0x03,
    LEAVE_VOLUNTARY: 0x04,
    DISCONNECT_NORMAL: 0x01,
    DISCONNECT_ERROR: 0x02,
    DISCONNECT_TIMEOUT: 0x03,
    DISCONNECT_BANNED: 0x04
};

function isValidPacketId(packetId) {
    return PacketIdWhitelist.has(packetId);
}

function getPayloadSizeLimits(packetId) {
    return PayloadSizeLimits[packetId] || { min: 0, max: 65536, fixed: false };
}

function isValidPayloadSize(packetId, size) {
    const limits = getPayloadSizeLimits(packetId);
    return size >= limits.min && size <= limits.max;
}

function getFixedPayloadSize(packetId) {
    const limits = PayloadSizeLimits[packetId];
    return limits && limits.fixed ? limits.size : null;
}

module.exports = {
    PROTOCOL_VERSION,
    PacketId,
    PacketIdWhitelist,
    PayloadSizeLimits,
    BinaryFieldSizes,
    HEADER_SIZE,
    GCM_TAG_SIZE,
    HMAC_SIZE,
    NONCE_SIZE,
    ErrorCodes,
    ReasonCodes,
    isValidPacketId,
    getPayloadSizeLimits,
    isValidPayloadSize,
    getFixedPayloadSize
};
