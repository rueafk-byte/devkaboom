const NodeCache = require('node-cache');

class CacheManager {
    constructor() {
        // Different cache instances for different data types
        this.playerCache = new NodeCache({ 
            stdTTL: 300, // 5 minutes
            checkperiod: 60, // Check for expired keys every minute
            useClones: false
        });

        this.leaderboardCache = new NodeCache({ 
            stdTTL: 600, // 10 minutes
            checkperiod: 120,
            useClones: false
        });

        this.gameStatsCache = new NodeCache({ 
            stdTTL: 900, // 15 minutes
            checkperiod: 180,
            useClones: false
        });

        this.achievementCache = new NodeCache({ 
            stdTTL: 1800, // 30 minutes
            checkperiod: 300,
            useClones: false
        });

        this.sessionCache = new NodeCache({ 
            stdTTL: 180, // 3 minutes
            checkperiod: 60,
            useClones: false
        });

        // Setup cache event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        const caches = {
            player: this.playerCache,
            leaderboard: this.leaderboardCache,
            gameStats: this.gameStatsCache,
            achievement: this.achievementCache,
            session: this.sessionCache
        };

        Object.entries(caches).forEach(([name, cache]) => {
            cache.on('expired', (key, value) => {
                console.log(`🗑️  Cache expired: ${name}:${key}`);
            });

            cache.on('set', (key, value) => {
                console.log(`💾 Cache set: ${name}:${key}`);
            });
        });
    }

    // Player cache methods
    getPlayer(walletAddress) {
        return this.playerCache.get(`player:${walletAddress}`);
    }

    setPlayer(walletAddress, data, ttl = null) {
        const key = `player:${walletAddress}`;
        if (ttl) {
            return this.playerCache.set(key, data, ttl);
        }
        return this.playerCache.set(key, data);
    }

    invalidatePlayer(walletAddress) {
        const key = `player:${walletAddress}`;
        this.playerCache.del(key);
        console.log(`🔄 Invalidated player cache: ${walletAddress}`);
    }

    // Leaderboard cache methods
    getLeaderboard(type, category, limit, offset) {
        const key = `leaderboard:${type}:${category}:${limit}:${offset}`;
        return this.leaderboardCache.get(key);
    }

    setLeaderboard(type, category, limit, offset, data) {
        const key = `leaderboard:${type}:${category}:${limit}:${offset}`;
        return this.leaderboardCache.set(key, data);
    }

    invalidateLeaderboards() {
        this.leaderboardCache.flushAll();
        console.log('🔄 Invalidated all leaderboard cache');
    }

    // Game stats cache methods
    getGameStats() {
        return this.gameStatsCache.get('game:stats');
    }

    setGameStats(data) {
        return this.gameStatsCache.set('game:stats', data);
    }

    invalidateGameStats() {
        this.gameStatsCache.del('game:stats');
        console.log('🔄 Invalidated game stats cache');
    }

    // Achievement cache methods
    getAchievements(filters = {}) {
        const key = `achievements:${JSON.stringify(filters)}`;
        return this.achievementCache.get(key);
    }

    setAchievements(filters, data) {
        const key = `achievements:${JSON.stringify(filters)}`;
        return this.achievementCache.set(key, data);
    }

    getPlayerAchievements(walletAddress) {
        return this.achievementCache.get(`player_achievements:${walletAddress}`);
    }

    setPlayerAchievements(walletAddress, data) {
        return this.achievementCache.set(`player_achievements:${walletAddress}`, data);
    }

    invalidateAchievements() {
        this.achievementCache.flushAll();
        console.log('🔄 Invalidated all achievement cache');
    }

    // Session cache methods
    getSession(sessionId) {
        return this.sessionCache.get(`session:${sessionId}`);
    }

    setSession(sessionId, data) {
        return this.sessionCache.set(`session:${sessionId}`, data);
    }

    invalidateSession(sessionId) {
        this.sessionCache.del(`session:${sessionId}`);
        console.log(`🔄 Invalidated session cache: ${sessionId}`);
    }

    // Token balance cache methods
    getTokenBalance(walletAddress) {
        return this.playerCache.get(`tokens:${walletAddress}`);
    }

    setTokenBalance(walletAddress, balance) {
        return this.playerCache.set(`tokens:${walletAddress}`, balance, 120); // 2 minutes TTL
    }

    invalidateTokenBalance(walletAddress) {
        this.playerCache.del(`tokens:${walletAddress}`);
        console.log(`🔄 Invalidated token balance cache: ${walletAddress}`);
    }

    // Cache middleware factory
    cacheMiddleware(cacheType, keyGenerator, ttl = null) {
        return async (req, res, next) => {
            try {
                const cacheKey = keyGenerator(req);
                let cache;

                switch (cacheType) {
                    case 'player':
                        cache = this.playerCache;
                        break;
                    case 'leaderboard':
                        cache = this.leaderboardCache;
                        break;
                    case 'gameStats':
                        cache = this.gameStatsCache;
                        break;
                    case 'achievement':
                        cache = this.achievementCache;
                        break;
                    case 'session':
                        cache = this.sessionCache;
                        break;
                    default:
                        return next();
                }

                const cachedData = cache.get(cacheKey);
                
                if (cachedData) {
                    console.log(`⚡ Cache hit: ${cacheType}:${cacheKey}`);
                    return res.json({
                        success: true,
                        data: cachedData,
                        cached: true,
                        timestamp: new Date().toISOString()
                    });
                }

                // Store original res.json
                const originalJson = res.json;
                
                // Override res.json to cache successful responses
                res.json = function(data) {
                    if (data.success && data.data) {
                        if (ttl) {
                            cache.set(cacheKey, data.data, ttl);
                        } else {
                            cache.set(cacheKey, data.data);
                        }
                        console.log(`💾 Cached response: ${cacheType}:${cacheKey}`);
                    }
                    return originalJson.call(this, data);
                };

                next();
            } catch (error) {
                console.error('Cache middleware error:', error);
                next();
            }
        };
    }

    // Invalidation strategies
    invalidatePlayerRelatedData(walletAddress) {
        this.invalidatePlayer(walletAddress);
        this.invalidateTokenBalance(walletAddress);
        this.invalidateLeaderboards();
        this.invalidateGameStats();
        
        // Invalidate player achievements
        this.achievementCache.del(`player_achievements:${walletAddress}`);
    }

    invalidateGameRelatedData() {
        this.invalidateLeaderboards();
        this.invalidateGameStats();
    }

    // Cache warming methods
    async warmPlayerCache(walletAddress, playerData) {
        this.setPlayer(walletAddress, playerData);
        
        if (playerData.boom_tokens !== undefined) {
            this.setTokenBalance(walletAddress, playerData.boom_tokens);
        }
    }

    // Cache statistics
    getCacheStats() {
        return {
            player: {
                keys: this.playerCache.keys().length,
                hits: this.playerCache.getStats().hits,
                misses: this.playerCache.getStats().misses
            },
            leaderboard: {
                keys: this.leaderboardCache.keys().length,
                hits: this.leaderboardCache.getStats().hits,
                misses: this.leaderboardCache.getStats().misses
            },
            gameStats: {
                keys: this.gameStatsCache.keys().length,
                hits: this.gameStatsCache.getStats().hits,
                misses: this.gameStatsCache.getStats().misses
            },
            achievement: {
                keys: this.achievementCache.keys().length,
                hits: this.achievementCache.getStats().hits,
                misses: this.achievementCache.getStats().misses
            },
            session: {
                keys: this.sessionCache.keys().length,
                hits: this.sessionCache.getStats().hits,
                misses: this.sessionCache.getStats().misses
            }
        };
    }

    // Clear all caches
    clearAllCaches() {
        this.playerCache.flushAll();
        this.leaderboardCache.flushAll();
        this.gameStatsCache.flushAll();
        this.achievementCache.flushAll();
        this.sessionCache.flushAll();
        console.log('🧹 Cleared all caches');
    }

    // Memory usage monitoring
    getMemoryUsage() {
        const process = require('process');
        const memUsage = process.memoryUsage();
        
        return {
            rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100, // MB
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
            external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100, // MB
            cacheStats: this.getCacheStats()
        };
    }
}

// Create singleton instance
const cacheManager = new CacheManager();

// Export cache middleware helpers
const createCacheMiddleware = (cacheType, keyGenerator, ttl) => {
    return cacheManager.cacheMiddleware(cacheType, keyGenerator, ttl);
};

// Common key generators
const keyGenerators = {
    playerByWallet: (req) => req.params.walletAddress,
    leaderboard: (req) => `${req.query.type || 'all_time'}:${req.query.category || 'score'}:${req.query.limit || 50}:${req.query.offset || 0}`,
    gameStats: () => 'global',
    achievements: (req) => JSON.stringify(req.query),
    playerAchievements: (req) => req.params.walletAddress,
    sessionById: (req) => req.params.sessionId
};

module.exports = {
    cacheManager,
    createCacheMiddleware,
    keyGenerators
};
