const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VERSION_FILE = path.join(process.env.DATA_DIR || path.join(__dirname, '../../data'), 'config-versions.jsonl');

function computeConfigHash(configObj) {
    const sorted = JSON.stringify(configObj, Object.keys(configObj).sort());
    return crypto.createHash('sha256').update(sorted).digest('hex');
}

function sortObjectDeep(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortObjectDeep);
    const sorted = {};
    for (const key of Object.keys(obj).sort()) {
        sorted[key] = sortObjectDeep(obj[key]);
    }
    return sorted;
}

class ConfigHashManager {
    constructor(gameConfig) {
        this.configHash = null;
        this.version = 0;
        this.history = [];
        this.initialize(gameConfig);
    }

    initialize(gameConfig) {
        const sorted = sortObjectDeep(gameConfig);
        this.configHash = computeConfigHash(sorted);

        const dataDir = path.dirname(VERSION_FILE);
        try {
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
        } catch (e) {
            console.warn('[CONFIG-HASH] Cannot create data directory:', e.message);
        }

        this.loadHistory();

        if (this.history.length === 0) {
            this.version = 1;
            this.appendVersion();
        } else {
            const lastEntry = this.history[this.history.length - 1];
            if (lastEntry.hash !== this.configHash) {
                this.version = lastEntry.version + 1;
                this.appendVersion();
                console.log(`[CONFIG-HASH] Config changed! Version bumped: ${lastEntry.version} -> ${this.version}`);
            } else {
                this.version = lastEntry.version;
            }
        }

        console.log(`[CONFIG-HASH] Hash=${this.configHash.substring(0, 16)}... Version=${this.version}`);
    }

    loadHistory() {
        try {
            if (fs.existsSync(VERSION_FILE)) {
                const content = fs.readFileSync(VERSION_FILE, 'utf8').trim();
                if (content) {
                    this.history = content.split('\n').map(line => JSON.parse(line));
                }
            }
        } catch (e) {
            console.warn('[CONFIG-HASH] Cannot load version history:', e.message);
            this.history = [];
        }
    }

    appendVersion() {
        const entry = {
            version: this.version,
            hash: this.configHash,
            timestamp: new Date().toISOString()
        };
        this.history.push(entry);

        try {
            fs.appendFileSync(VERSION_FILE, JSON.stringify(entry) + '\n');
        } catch (e) {
            console.warn('[CONFIG-HASH] Cannot write version file:', e.message);
        }
    }

    getHash() {
        return this.configHash;
    }

    getVersion() {
        return this.version;
    }

    getInfo() {
        return {
            hash: this.configHash,
            version: this.version,
            historyLength: this.history.length
        };
    }
}

module.exports = { ConfigHashManager, computeConfigHash, sortObjectDeep };
