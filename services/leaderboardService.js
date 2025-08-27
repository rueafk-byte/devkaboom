const db = require('../config/database');
const { game: gameRedis } = require('../config/redis');
const winston = require('winston');
const cron = require('node-cron');

class LeaderboardService {
    constructor() {
        // Initialize logger
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'leaderboard-service' },
            transports: [
                new winston.transports.File({ filename: 'logs/leaderboard.log' })
            ]
        });

        // Schedule automatic updates
        this.scheduleUpdates();
    }

    // Schedule automatic leaderboard updates
    scheduleUpdates() {
        // Update every 5 minutes
        cron.schedule('*/5 * * * *', async () => {
            try {
                await this.updateAllLeaderboards();
                this.logger.info('Scheduled leaderboard update completed');
            } catch (error) {
                this.logger.error('Scheduled leaderboard update failed', { error: error.message });
            }
        });

        // Update cache every minute
        cron.schedule('* * * * *', async () => {
            try {
                await this.updateLeaderboardCache();
                this.logger.info('Leaderboard cache update completed');
            } catch (error) {
                this.logger.error('Leaderboard cache update failed', { error: error.message });
            }
        });
    }

    // Update all leaderboards
    async updateAllLeaderboards() {
        try {
            // Global leaderboard
            await this.updateGlobalLeaderboard();
            
            // Level-specific leaderboards
            for (let level = 1; level <= 40; level++) {
                await this.updateLevelLeaderboard(level);
            }
            
            // Token leaderboards
            await this.updateTokenLeaderboards();
            
            // Achievement leaderboard
            await this.updateAchievementLeaderboard();
            
            this.logger.info('All leaderboards updated successfully');
        } catch (error) {
            this.logger.error('Failed to update all leaderboards', { error: error.message });
            throw error;
        }
    }

    // Update global leaderboard
    async updateGlobalLeaderboard() {
        try {
            const result = await db.query(`
                SELECT wallet_address, username, level, total_score, boom_tokens, created_at
                FROM players
                ORDER BY total_score DESC
                LIMIT 1000
            `);

            // Clear existing leaderboard
            await gameRedis.client.del('leaderboard:global');

            // Update with new data
            for (let i = 0; i < result.rows.length; i++) {
                const player = result.rows[i];
                await gameRedis.updateLeaderboard('global', player.wallet_address, player.total_score, player.level, player.boom_tokens);
            }

            this.logger.info('Global leaderboard updated', { count: result.rows.length });
        } catch (error) {
            this.logger.error('Failed to update global leaderboard', { error: error.message });
            throw error;
        }
    }

    // Update level-specific leaderboard
    async updateLevelLeaderboard(level) {
        try {
            const result = await db.query(`
                SELECT p.wallet_address, p.username, p.level, p.total_score, p.boom_tokens,
                       gs.score_earned, gs.session_start
                FROM players p
                JOIN game_sessions gs ON p.wallet_address = gs.wallet_address
                WHERE gs.game_data->>'level' = $1
                ORDER BY gs.score_earned DESC
                LIMIT 500
            `, [level.toString()]);

            // Clear existing leaderboard
            await gameRedis.client.del(`leaderboard:level_${level}`);

            // Update with new data
            for (let i = 0; i < result.rows.length; i++) {
                const player = result.rows[i];
                await gameRedis.updateLeaderboard(`level_${level}`, player.wallet_address, player.score_earned, player.level, player.boom_tokens);
            }

            this.logger.info(`Level ${level} leaderboard updated`, { count: result.rows.length });
        } catch (error) {
            this.logger.error(`Failed to update level ${level} leaderboard`, { error: error.message });
            throw error;
        }
    }

    // Update token leaderboards
    async updateTokenLeaderboards() {
        try {
            const tokenTypes = ['boom', 'pirate', 'admiral'];
            
            for (const tokenType of tokenTypes) {
                const tokenColumn = `${tokenType}_tokens`;
                const result = await db.query(`
                    SELECT wallet_address, username, level, total_score, ${tokenColumn} as tokens
                    FROM players
                    ORDER BY ${tokenColumn} DESC
                    LIMIT 1000
                `);

                // Clear existing leaderboard
                await gameRedis.client.del(`leaderboard:tokens_${tokenType}`);

                // Update with new data
                for (let i = 0; i < result.rows.length; i++) {
                    const player = result.rows[i];
                    await gameRedis.updateLeaderboard(`tokens_${tokenType}`, player.wallet_address, player.tokens, player.level, player.tokens);
                }

                this.logger.info(`${tokenType} token leaderboard updated`, { count: result.rows.length });
            }
        } catch (error) {
            this.logger.error('Failed to update token leaderboards', { error: error.message });
            throw error;
        }
    }

    // Update achievement leaderboard
    async updateAchievementLeaderboard() {
        try {
            const result = await db.query(`
                SELECT p.wallet_address, p.username, p.level, p.total_score,
                       COUNT(pa.achievement_id) as achievement_count,
                       MAX(pa.unlocked_at) as latest_achievement
                FROM players p
                LEFT JOIN player_achievements pa ON p.wallet_address = pa.wallet_address
                GROUP BY p.wallet_address, p.username, p.level, p.total_score
                ORDER BY achievement_count DESC, p.total_score DESC
                LIMIT 500
            `);

            // Clear existing leaderboard
            await gameRedis.client.del('leaderboard:achievements');

            // Update with new data
            for (let i = 0; i < result.rows.length; i++) {
                const player = result.rows[i];
                await gameRedis.updateLeaderboard('achievements', player.wallet_address, player.achievement_count, player.level, player.total_score);
            }

            this.logger.info('Achievement leaderboard updated', { count: result.rows.length });
        } catch (error) {
            this.logger.error('Failed to update achievement leaderboard', { error: error.message });
            throw error;
        }
    }

    // Update leaderboard cache
    async updateLeaderboardCache() {
        try {
            // Update database cache table
            await this.updateDatabaseCache();
            
            // Update Redis cache
            await this.updateRedisCache();
            
            this.logger.info('Leaderboard cache updated successfully');
        } catch (error) {
            this.logger.error('Failed to update leaderboard cache', { error: error.message });
            throw error;
        }
    }

    // Update database cache
    async updateDatabaseCache() {
        try {
            // Clear existing cache
            await db.query('DELETE FROM leaderboard_cache');

            // Global leaderboard cache
            const globalResult = await db.query(`
                SELECT wallet_address, username, level, total_score, boom_tokens
                FROM players
                ORDER BY total_score DESC
                LIMIT 100
            `);

            for (let i = 0; i < globalResult.rows.length; i++) {
                const player = globalResult.rows[i];
                await db.query(`
                    INSERT INTO leaderboard_cache 
                    (leaderboard_type, rank, wallet_address, username, score, level, tokens)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, ['global', i + 1, player.wallet_address, player.username, player.total_score, player.level, player.boom_tokens]);
            }

            // Level-specific caches
            for (let level = 1; level <= 40; level++) {
                const levelResult = await db.query(`
                    SELECT p.wallet_address, p.username, p.level, p.total_score, p.boom_tokens,
                           gs.score_earned
                    FROM players p
                    JOIN game_sessions gs ON p.wallet_address = gs.wallet_address
                    WHERE gs.game_data->>'level' = $1
                    ORDER BY gs.score_earned DESC
                    LIMIT 50
                `, [level.toString()]);

                for (let i = 0; i < levelResult.rows.length; i++) {
                    const player = levelResult.rows[i];
                    await db.query(`
                        INSERT INTO leaderboard_cache 
                        (leaderboard_type, rank, wallet_address, username, score, level, tokens)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [`level_${level}`, i + 1, player.wallet_address, player.username, player.score_earned, player.level, player.boom_tokens]);
                }
            }

            this.logger.info('Database leaderboard cache updated');
        } catch (error) {
            this.logger.error('Failed to update database cache', { error: error.message });
            throw error;
        }
    }

    // Update Redis cache
    async updateRedisCache() {
        try {
            // Get cached data from database
            const cacheResult = await db.query(`
                SELECT * FROM leaderboard_cache 
                ORDER BY leaderboard_type, rank
            `);

            // Group by leaderboard type
            const leaderboards = {};
            for (const row of cacheResult.rows) {
                if (!leaderboards[row.leaderboard_type]) {
                    leaderboards[row.leaderboard_type] = [];
                }
                leaderboards[row.leaderboard_type].push(row);
            }

            // Update Redis for each leaderboard type
            for (const [type, players] of Object.entries(leaderboards)) {
                // Clear existing
                await gameRedis.client.del(`leaderboard:${type}`);

                // Add new data
                for (const player of players) {
                    await gameRedis.updateLeaderboard(type, player.wallet_address, player.score, player.level, player.tokens);
                }
            }

            this.logger.info('Redis leaderboard cache updated');
        } catch (error) {
            this.logger.error('Failed to update Redis cache', { error: error.message });
            throw error;
        }
    }

    // Get leaderboard data
    async getLeaderboard(type, limit = 100, page = 1) {
        try {
            const offset = (page - 1) * limit;

            // Try cache first
            const cachedLeaderboard = await gameRedis.getLeaderboard(type, limit);
            if (cachedLeaderboard.length > 0) {
                return {
                    success: true,
                    leaderboard: cachedLeaderboard.slice(offset, offset + limit),
                    source: 'cache',
                    pagination: {
                        page,
                        limit,
                        total: cachedLeaderboard.length,
                        pages: Math.ceil(cachedLeaderboard.length / limit)
                    }
                };
            }

            // Get from database cache
            const result = await db.query(`
                SELECT * FROM leaderboard_cache 
                WHERE leaderboard_type = $1
                ORDER BY rank
                LIMIT $2 OFFSET $3
            `, [type, limit, offset]);

            // Get total count
            const countResult = await db.query(`
                SELECT COUNT(*) as total FROM leaderboard_cache WHERE leaderboard_type = $1
            `, [type]);
            const total = parseInt(countResult.rows[0].total);

            return {
                success: true,
                leaderboard: result.rows,
                source: 'database',
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            this.logger.error('Failed to get leaderboard', { error: error.message, type });
            throw error;
        }
    }

    // Get player rank
    async getPlayerRank(walletAddress, type = 'global') {
        try {
            let rank = 0;
            let totalPlayers = 0;

            switch (type) {
                case 'global':
                    const globalResult = await db.query(`
                        SELECT COUNT(*) as rank
                        FROM players
                        WHERE total_score > (SELECT total_score FROM players WHERE wallet_address = $1)
                    `, [walletAddress]);
                    rank = parseInt(globalResult.rows[0].rank) + 1;

                    const totalResult = await db.query('SELECT COUNT(*) as total FROM players');
                    totalPlayers = parseInt(totalResult.rows[0].total);
                    break;

                case 'level':
                    const { level } = req.query;
                    if (!level) {
                        throw new Error('Level parameter required for level ranking');
                    }

                    const levelResult = await db.query(`
                        SELECT COUNT(DISTINCT p.wallet_address) as rank
                        FROM players p
                        JOIN game_sessions gs ON p.wallet_address = gs.wallet_address
                        WHERE gs.game_data->>'level' = $1
                        AND gs.score_earned > (
                            SELECT MAX(gs2.score_earned)
                            FROM game_sessions gs2
                            WHERE gs2.wallet_address = $2 AND gs2.game_data->>'level' = $1
                        )
                    `, [level, walletAddress]);
                    rank = parseInt(levelResult.rows[0].rank) + 1;

                    const levelTotalResult = await db.query(`
                        SELECT COUNT(DISTINCT p.wallet_address) as total
                        FROM players p
                        JOIN game_sessions gs ON p.wallet_address = gs.wallet_address
                        WHERE gs.game_data->>'level' = $1
                    `, [level]);
                    totalPlayers = parseInt(levelTotalResult.rows[0].total);
                    break;

                default:
                    throw new Error('Invalid ranking type');
            }

            return {
                success: true,
                walletAddress,
                rank,
                totalPlayers,
                type,
                percentile: totalPlayers > 0 ? Math.round(((totalPlayers - rank) / totalPlayers) * 100) : 0
            };
        } catch (error) {
            this.logger.error('Failed to get player rank', { error: error.message, walletAddress, type });
            throw error;
        }
    }

    // Get leaderboard statistics
    async getLeaderboardStats() {
        try {
            // Get overall statistics
            const overallStats = await db.query(`
                SELECT 
                    COUNT(*) as total_players,
                    AVG(total_score) as avg_score,
                    AVG(level) as avg_level,
                    AVG(boom_tokens) as avg_boom_tokens,
                    MAX(total_score) as highest_score,
                    MAX(level) as highest_level,
                    MAX(boom_tokens) as most_tokens
                FROM players
            `);

            // Get daily active players
            const dailyActive = await db.query(`
                SELECT COUNT(DISTINCT wallet_address) as daily_active
                FROM game_sessions
                WHERE session_start >= CURRENT_DATE
            `);

            // Get weekly active players
            const weeklyActive = await db.query(`
                SELECT COUNT(DISTINCT wallet_address) as weekly_active
                FROM game_sessions
                WHERE session_start >= CURRENT_DATE - INTERVAL '7 days'
            `);

            // Get monthly active players
            const monthlyActive = await db.query(`
                SELECT COUNT(DISTINCT wallet_address) as monthly_active
                FROM game_sessions
                WHERE session_start >= CURRENT_DATE - INTERVAL '30 days'
            `);

            // Get top players by category
            const topScorers = await db.query(`
                SELECT wallet_address, username, total_score
                FROM players
                ORDER BY total_score DESC
                LIMIT 10
            `);

            const topLevels = await db.query(`
                SELECT wallet_address, username, level
                FROM players
                ORDER BY level DESC
                LIMIT 10
            `);

            const topTokenHolders = await db.query(`
                SELECT wallet_address, username, boom_tokens
                FROM players
                ORDER BY boom_tokens DESC
                LIMIT 10
            `);

            return {
                success: true,
                overall: overallStats.rows[0],
                activePlayers: {
                    daily: parseInt(dailyActive.rows[0].daily_active),
                    weekly: parseInt(weeklyActive.rows[0].weekly_active),
                    monthly: parseInt(monthlyActive.rows[0].monthly_active)
                },
                topPlayers: {
                    scorers: topScorers.rows,
                    levels: topLevels.rows,
                    tokenHolders: topTokenHolders.rows
                }
            };
        } catch (error) {
            this.logger.error('Failed to get leaderboard stats', { error: error.message });
            throw error;
        }
    }

    // Force update leaderboard
    async forceUpdate() {
        try {
            await this.updateAllLeaderboards();
            await this.updateLeaderboardCache();
            
            this.logger.info('Leaderboard force update completed');
            
            return {
                success: true,
                message: 'Leaderboard updated successfully'
            };
        } catch (error) {
            this.logger.error('Leaderboard force update failed', { error: error.message });
            throw error;
        }
    }
}

module.exports = LeaderboardService;
