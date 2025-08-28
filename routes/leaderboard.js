const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { game: gameRedis } = require('../config/redis');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const cron = require('node-cron');

// Schedule leaderboard updates (disabled when no database)
if (process.env.DB_HOST) {
    cron.schedule('*/5 * * * *', async () => {
        try {
            await updateLeaderboardCache();
        } catch (error) {
            console.error('Leaderboard cache update failed:', error);
        }
    });
}

// Update leaderboard cache
async function updateLeaderboardCache() {
    // Global leaderboard
    const globalResult = await db.query(`
        SELECT wallet_address, username, level, total_score, boom_tokens, created_at
        FROM players
        ORDER BY total_score DESC
        LIMIT 100
    `);
    
    for (let i = 0; i < globalResult.rows.length; i++) {
        const player = globalResult.rows[i];
        await gameRedis.updateLeaderboard('global', player.wallet_address, player.total_score, player.level, player.boom_tokens);
    }
    
    // Level-specific leaderboards
    for (let level = 1; level <= 40; level++) {
        const levelResult = await db.query(`
            SELECT p.wallet_address, p.username, p.level, p.total_score, p.boom_tokens,
                   gs.score_earned, gs.session_start
            FROM players p
            JOIN game_sessions gs ON p.wallet_address = gs.wallet_address
            WHERE gs.game_data->>'level' = $1
            ORDER BY gs.score_earned DESC
            LIMIT 50
        `, [level.toString()]);
        
        for (let i = 0; i < levelResult.rows.length; i++) {
            const player = levelResult.rows[i];
            await gameRedis.updateLeaderboard(`level_${level}`, player.wallet_address, player.score_earned, player.level, player.boom_tokens);
        }
    }
    
    // Token leaderboards
    const tokenResult = await db.query(`
        SELECT wallet_address, username, boom_tokens, pirate_tokens, admiral_tokens
        FROM players
        ORDER BY boom_tokens DESC
        LIMIT 100
    `);
    
    for (let i = 0; i < tokenResult.rows.length; i++) {
        const player = tokenResult.rows[i];
        await gameRedis.updateLeaderboard('tokens_boom', player.wallet_address, player.boom_tokens, 0, player.boom_tokens);
        await gameRedis.updateLeaderboard('tokens_pirate', player.wallet_address, player.pirate_tokens, 0, player.pirate_tokens);
        await gameRedis.updateLeaderboard('tokens_admiral', player.wallet_address, player.admiral_tokens, 0, player.admiral_tokens);
    }
}

// Get global leaderboard
router.get('/global', asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    
    try {
        // Try cache first
        const cachedLeaderboard = await gameRedis.getLeaderboard('global', limit);
        if (cachedLeaderboard.length > 0) {
            return res.json({
                success: true,
                leaderboard: cachedLeaderboard.slice(offset, offset + limit),
                source: 'cache',
                pagination: {
                    page,
                    limit,
                    total: cachedLeaderboard.length,
                    pages: Math.ceil(cachedLeaderboard.length / limit)
                }
            });
        }
        
        // Get from database
        const result = await db.query(`
            SELECT wallet_address, username, level, total_score, boom_tokens, created_at
            FROM players
            ORDER BY total_score DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);
        
        // Get total count
        const countResult = await db.query('SELECT COUNT(*) as total FROM players');
        const total = parseInt(countResult.rows[0].total);
        
        res.json({
            success: true,
            leaderboard: result.rows,
            source: 'database',
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        // Fallback when database is not available
        console.log('Database not available, returning empty leaderboard');
        res.json({
            success: true,
            leaderboard: [],
            source: 'fallback',
            message: 'Leaderboard temporarily unavailable',
            pagination: {
                page,
                limit,
                total: 0,
                pages: 0
            }
        });
    }
}));

// Get level-specific leaderboard
router.get('/level/:level', asyncHandler(async (req, res) => {
    const { level } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    
    if (level < 1 || level > 40) {
        throw new ValidationError('Level must be between 1 and 40');
    }
    
    try {
        // Try cache first
        const cachedLeaderboard = await gameRedis.getLeaderboard(`level_${level}`, limit);
        if (cachedLeaderboard.length > 0) {
            return res.json({
                success: true,
                leaderboard: cachedLeaderboard.slice(offset, offset + limit),
                source: 'cache',
                level: parseInt(level),
                pagination: {
                    page,
                    limit,
                    total: cachedLeaderboard.length,
                    pages: Math.ceil(cachedLeaderboard.length / limit)
                }
            });
        }
        
        // Get from database
        const result = await db.query(`
            SELECT p.wallet_address, p.username, p.level, p.total_score, p.boom_tokens,
                   gs.score_earned, gs.session_start
            FROM players p
            JOIN game_sessions gs ON p.wallet_address = gs.wallet_address
            WHERE gs.game_data->>'level' = $1
            ORDER BY gs.score_earned DESC
            LIMIT $2 OFFSET $3
        `, [level, limit, offset]);
        
        // Get total count for this level
        const countResult = await db.query(`
            SELECT COUNT(DISTINCT p.wallet_address) as total
            FROM players p
            JOIN game_sessions gs ON p.wallet_address = gs.wallet_address
            WHERE gs.game_data->>'level' = $1
        `, [level]);
        const total = parseInt(countResult.rows[0].total);
        
        res.json({
            success: true,
            leaderboard: result.rows,
            source: 'database',
            level: parseInt(level),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        // Fallback when database is not available
        console.log('Database not available, returning empty level leaderboard');
        res.json({
            success: true,
            leaderboard: [],
            source: 'fallback',
            level: parseInt(level),
            message: 'Leaderboard temporarily unavailable',
            pagination: {
                page,
                limit,
                total: 0,
                pages: 0
            }
        });
    }
}));

// Get token leaderboard
router.get('/tokens/:tokenType', asyncHandler(async (req, res) => {
    const { tokenType } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    
    if (!['boom', 'pirate', 'admiral'].includes(tokenType)) {
        throw new ValidationError('Token type must be boom, pirate, or admiral');
    }
    
    // Try cache first
    const cachedLeaderboard = await gameRedis.getLeaderboard(`tokens_${tokenType}`, limit);
    if (cachedLeaderboard.length > 0) {
        return res.json({
            success: true,
            leaderboard: cachedLeaderboard.slice(offset, offset + limit),
            source: 'cache',
            tokenType,
            pagination: {
                page,
                limit,
                total: cachedLeaderboard.length,
                pages: Math.ceil(cachedLeaderboard.length / limit)
            }
        });
    }
    
    // Get from database
    const tokenColumn = `${tokenType}_tokens`;
    const result = await db.query(`
        SELECT wallet_address, username, level, total_score, ${tokenColumn} as tokens
        FROM players
        ORDER BY ${tokenColumn} DESC
        LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    // Get total count
    const countResult = await db.query('SELECT COUNT(*) as total FROM players');
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
        success: true,
        leaderboard: result.rows,
        source: 'database',
        tokenType,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    });
}));

// Get achievement leaderboard
router.get('/achievements', asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    
    const result = await db.query(`
        SELECT p.wallet_address, p.username, p.level, p.total_score,
               COUNT(pa.achievement_id) as achievement_count,
               MAX(pa.unlocked_at) as latest_achievement
        FROM players p
        LEFT JOIN player_achievements pa ON p.wallet_address = pa.wallet_address
        GROUP BY p.wallet_address, p.username, p.level, p.total_score
        ORDER BY achievement_count DESC, p.total_score DESC
        LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    // Get total count
    const countResult = await db.query('SELECT COUNT(*) as total FROM players');
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
        success: true,
        leaderboard: result.rows,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    });
}));

// Get player's rank
router.get('/player/:walletAddress/rank', asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    const { type = 'global' } = req.query;
    
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
                throw new ValidationError('Level parameter required for level ranking');
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
            throw new ValidationError('Invalid ranking type');
    }
    
    res.json({
        success: true,
        walletAddress,
        rank,
        totalPlayers,
        type,
        percentile: totalPlayers > 0 ? Math.round(((totalPlayers - rank) / totalPlayers) * 100) : 0
    });
}));

// Get leaderboard statistics
router.get('/stats', asyncHandler(async (req, res) => {
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
    
    res.json({
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
    });
}));

// Get leaderboard history (for charts)
router.get('/history/:type', asyncHandler(async (req, res) => {
    const { type } = req.params;
    const days = parseInt(req.query.days) || 30;
    
    if (!['players', 'scores', 'tokens'].includes(type)) {
        throw new ValidationError('Type must be players, scores, or tokens');
    }
    
    let result;
    
    switch (type) {
        case 'players':
            result = await db.query(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as new_players
                FROM players
                WHERE created_at >= CURRENT_DATE - INTERVAL '$1 days'
                GROUP BY DATE(created_at)
                ORDER BY date
            `, [days]);
            break;
            
        case 'scores':
            result = await db.query(`
                SELECT 
                    DATE(session_start) as date,
                    SUM(score_earned) as total_score,
                    COUNT(*) as sessions
                FROM game_sessions
                WHERE session_start >= CURRENT_DATE - INTERVAL '$1 days'
                GROUP BY DATE(session_start)
                ORDER BY date
            `, [days]);
            break;
            
        case 'tokens':
            result = await db.query(`
                SELECT 
                    DATE(last_updated) as date,
                    SUM(boom_tokens) as total_boom_tokens
                FROM players
                WHERE last_updated >= CURRENT_DATE - INTERVAL '$1 days'
                GROUP BY DATE(last_updated)
                ORDER BY date
            `, [days]);
            break;
    }
    
    res.json({
        success: true,
        type,
        days,
        history: result.rows
    });
}));

// Force update leaderboard cache
router.post('/update-cache', asyncHandler(async (req, res) => {
    await updateLeaderboardCache();
    
    res.json({
        success: true,
        message: 'Leaderboard cache updated successfully'
    });
}));

module.exports = router;
