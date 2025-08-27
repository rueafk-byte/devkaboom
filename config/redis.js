const redis = require('redis');
require('dotenv').config();

// Redis Configuration
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
            return new Error('The server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
            return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
    }
};

// Create Redis client
const client = redis.createClient(redisConfig);

// Redis event handlers
client.on('connect', () => {
    console.log('Connected to Redis');
});

client.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

client.on('ready', () => {
    console.log('Redis client ready');
});

client.on('end', () => {
    console.log('Redis client disconnected');
});

// Redis operations wrapper
const redisClient = {
    // Basic operations
    get: (key) => client.get(key),
    set: (key, value, ttl = null) => {
        if (ttl) {
            return client.setex(key, ttl, value);
        }
        return client.set(key, value);
    },
    del: (key) => client.del(key),
    exists: (key) => client.exists(key),
    
    // Hash operations
    hget: (key, field) => client.hget(key, field),
    hset: (key, field, value) => client.hset(key, field, value),
    hgetall: (key) => client.hgetall(key),
    hdel: (key, field) => client.hdel(key, field),
    
    // List operations
    lpush: (key, value) => client.lpush(key, value),
    rpush: (key, value) => client.rpush(key, value),
    lpop: (key) => client.lpop(key),
    rpop: (key) => client.rpop(key),
    lrange: (key, start, stop) => client.lrange(key, start, stop),
    
    // Set operations
    sadd: (key, member) => client.sadd(key, member),
    srem: (key, member) => client.srem(key, member),
    smembers: (key) => client.smembers(key),
    sismember: (key, member) => client.sismember(key, member),
    
    // Sorted set operations
    zadd: (key, score, member) => client.zadd(key, score, member),
    zrange: (key, start, stop, withscores = false) => client.zrange(key, start, stop, withscores ? 'WITHSCORES' : ''),
    zrevrange: (key, start, stop, withscores = false) => client.zrevrange(key, start, stop, withscores ? 'WITHSCORES' : ''),
    zscore: (key, member) => client.zscore(key, member),
    zrank: (key, member) => client.zrank(key, member),
    zrevrank: (key, member) => client.zrevrank(key, member),
    
    // Expiration
    expire: (key, seconds) => client.expire(key, seconds),
    ttl: (key) => client.ttl(key),
    
    // Utility
    flushdb: () => client.flushdb(),
    ping: () => client.ping(),
    
    // Close connection
    quit: () => client.quit(),
    
    // Health check
    healthCheck: async () => {
        try {
            const result = await client.ping();
            return { status: 'healthy', response: result };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }
};

// Game-specific Redis operations
const gameRedis = {
    // Player session management
    setPlayerSession: async (walletAddress, sessionData, ttl = 3600) => {
        const key = `session:${walletAddress}`;
        await redisClient.set(key, JSON.stringify(sessionData), ttl);
    },
    
    getPlayerSession: async (walletAddress) => {
        const key = `session:${walletAddress}`;
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    },
    
    // Leaderboard caching
    updateLeaderboard: async (type, walletAddress, score, level, tokens) => {
        const key = `leaderboard:${type}`;
        const member = JSON.stringify({
            wallet: walletAddress,
            score: score,
            level: level,
            tokens: tokens
        });
        await redisClient.zadd(key, score, member);
    },
    
    getLeaderboard: async (type, limit = 100) => {
        const key = `leaderboard:${type}`;
        const data = await redisClient.zrevrange(key, 0, limit - 1, true);
        return data.map((item, index) => {
            const member = JSON.parse(item);
            return {
                rank: index + 1,
                ...member
            };
        });
    },
    
    // Real-time player tracking
    addOnlinePlayer: async (walletAddress, playerData) => {
        const key = 'online_players';
        const member = JSON.stringify({
            wallet: walletAddress,
            ...playerData,
            timestamp: Date.now()
        });
        await redisClient.sadd(key, member);
        await redisClient.expire(key, 300); // 5 minutes TTL
    },
    
    removeOnlinePlayer: async (walletAddress) => {
        const key = 'online_players';
        const members = await redisClient.smembers(key);
        for (const member of members) {
            const data = JSON.parse(member);
            if (data.wallet === walletAddress) {
                await redisClient.srem(key, member);
                break;
            }
        }
    },
    
    getOnlinePlayers: async () => {
        const key = 'online_players';
        const members = await redisClient.smembers(key);
        return members.map(member => JSON.parse(member));
    },
    
    // Game state caching
    cacheGameState: async (walletAddress, gameState, ttl = 1800) => {
        const key = `gamestate:${walletAddress}`;
        await redisClient.set(key, JSON.stringify(gameState), ttl);
    },
    
    getGameState: async (walletAddress) => {
        const key = `gamestate:${walletAddress}`;
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    },
    
    // Rate limiting
    checkRateLimit: async (key, limit, window) => {
        const current = await redisClient.get(key);
        if (current && parseInt(current) >= limit) {
            return false;
        }
        await redisClient.incr(key);
        await redisClient.expire(key, window);
        return true;
    },
    
    // Token balance caching
    cacheTokenBalance: async (walletAddress, tokenType, balance, ttl = 300) => {
        const key = `tokens:${walletAddress}:${tokenType}`;
        await redisClient.set(key, balance.toString(), ttl);
    },
    
    getTokenBalance: async (walletAddress, tokenType) => {
        const key = `tokens:${walletAddress}:${tokenType}`;
        const balance = await redisClient.get(key);
        return balance ? parseInt(balance) : null;
    }
};

module.exports = {
    client: redisClient,
    game: gameRedis
};
