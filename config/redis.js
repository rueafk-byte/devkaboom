const redis = require('redis');
require('dotenv').config();

// Mock Redis client for when Redis is not available
const createMockRedisClient = () => {
    const mockData = new Map();
    
    return {
        get: (key) => Promise.resolve(mockData.get(key) || null),
        set: (key, value, ttl = null) => {
            mockData.set(key, value);
            return Promise.resolve('OK');
        },
        setex: (key, ttl, value) => {
            mockData.set(key, value);
            return Promise.resolve('OK');
        },
        del: (key) => {
            const deleted = mockData.delete(key);
            return Promise.resolve(deleted ? 1 : 0);
        },
        exists: (key) => Promise.resolve(mockData.has(key) ? 1 : 0),
        hget: (key, field) => Promise.resolve(null),
        hset: (key, field, value) => Promise.resolve(1),
        hgetall: (key) => Promise.resolve({}),
        hdel: (key, field) => Promise.resolve(0),
        lpush: (key, value) => Promise.resolve(1),
        rpush: (key, value) => Promise.resolve(1),
        lpop: (key) => Promise.resolve(null),
        rpop: (key) => Promise.resolve(null),
        lrange: (key, start, stop) => Promise.resolve([]),
        sadd: (key, member) => Promise.resolve(1),
        srem: (key, member) => Promise.resolve(0),
        smembers: (key) => Promise.resolve([]),
        sismember: (key, member) => Promise.resolve(0),
        zadd: (key, score, member) => Promise.resolve(1),
        zrange: (key, start, stop, withscores = false) => Promise.resolve([]),
        zrevrange: (key, start, stop, withscores = false) => Promise.resolve([]),
        zscore: (key, member) => Promise.resolve(null),
        zrank: (key, member) => Promise.resolve(null),
        zrevrank: (key, member) => Promise.resolve(null),
        expire: (key, seconds) => Promise.resolve(1),
        ttl: (key) => Promise.resolve(-1),
        flushdb: () => {
            mockData.clear();
            return Promise.resolve('OK');
        },
        ping: () => Promise.resolve('PONG'),
        quit: () => Promise.resolve('OK'),
        on: (event, callback) => {
            if (event === 'connect') callback();
            if (event === 'ready') callback();
            if (event === 'end') callback();
        }
    };
};

let client;
let useMockRedis = false;

// Try to create Redis client
try {
    // Redis Configuration
    const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        retry_strategy: (options) => {
            if (options.error && options.error.code === 'ECONNREFUSED') {
                console.warn('Redis connection refused, using mock Redis client');
                useMockRedis = true;
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

    client = redis.createClient(redisConfig);

    // Redis event handlers
    client.on('connect', () => {
        console.log('Connected to Redis');
    });

    client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        if (err.code === 'ECONNREFUSED') {
            console.warn('Redis not available, switching to mock Redis client');
            useMockRedis = true;
            client = createMockRedisClient();
        }
    });

    client.on('ready', () => {
        console.log('Redis client ready');
    });

    client.on('end', () => {
        console.log('Redis client disconnected');
    });

} catch (error) {
    console.warn('Failed to create Redis client, using mock Redis:', error.message);
    useMockRedis = true;
    client = createMockRedisClient();
}

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
    zadd: (key, score, member) => client.zAdd(key, { score: score, value: member }),
    zrange: (key, start, stop, withscores = false) => client.zRange(key, start, stop, { ...(withscores && { WITHSCORES: true }) }),
    zrevrange: (key, start, stop, withscores = false) => client.zRange(key, start, stop, { REV: true, ...(withscores && { WITHSCORES: true }) }),
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
            return { 
                status: useMockRedis ? 'mock' : 'healthy', 
                response: result,
                mock: useMockRedis
            };
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
