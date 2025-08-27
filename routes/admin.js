const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { game: gameRedis } = require('../config/redis');
const { asyncHandler, ValidationError, NotFoundError, ForbiddenError } = require('../middleware/errorHandler');
const { adminAuthMiddleware } = require('../middleware/auth');
const Web3Service = require('../services/web3Service');
const winston = require('winston');

// Initialize Web3 service
const web3Service = new Web3Service();

// Admin logger
const adminLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'admin-panel' },
    transports: [
        new winston.transports.File({ filename: 'logs/admin.log' })
    ]
});

// Apply admin authentication to all routes
router.use(adminAuthMiddleware);

// Get admin dashboard statistics
router.get('/dashboard', asyncHandler(async (req, res) => {
    const adminWallet = req.walletAddress;
    
    // Log admin access
    adminLogger.info('Admin dashboard accessed', { adminWallet });
    
    // Get overall statistics
    const overallStats = await db.query(`
        SELECT 
            COUNT(*) as total_players,
            COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as new_players_today,
            COUNT(CASE WHEN last_updated >= CURRENT_DATE THEN 1 END) as active_players_today,
            AVG(total_score) as avg_score,
            AVG(level) as avg_level,
            SUM(boom_tokens) as total_boom_tokens,
            SUM(pirate_tokens) as total_pirate_tokens,
            SUM(admiral_tokens) as total_admiral_tokens
        FROM players
    `);
    
    // Get game session statistics
    const sessionStats = await db.query(`
        SELECT 
            COUNT(*) as total_sessions,
            COUNT(CASE WHEN session_start >= CURRENT_DATE THEN 1 END) as sessions_today,
            COUNT(CASE WHEN session_start >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as sessions_this_week,
            SUM(score_earned) as total_score_earned,
            SUM(enemies_killed) as total_enemies_killed,
            SUM(levels_completed) as total_levels_completed,
            AVG(EXTRACT(EPOCH FROM (session_end - session_start))) as avg_session_time
        FROM game_sessions
    `);
    
    // Get recent activity
    const recentActivity = await db.query(`
        SELECT 
            'player_created' as type,
            wallet_address,
            username,
            created_at as timestamp
        FROM players
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        UNION ALL
        SELECT 
            'level_completed' as type,
            gs.wallet_address,
            p.username,
            gs.session_end as timestamp
        FROM game_sessions gs
        JOIN players p ON gs.wallet_address = p.wallet_address
        WHERE gs.session_end >= CURRENT_DATE - INTERVAL '7 days'
        AND gs.levels_completed > 0
        ORDER BY timestamp DESC
        LIMIT 50
    `);
    
    // Get system health
    const systemHealth = {
        database: await db.healthCheck(),
        redis: await gameRedis.healthCheck(),
        web3: web3Service.isConnected(),
        onlinePlayers: (await gameRedis.getOnlinePlayers()).length
    };
    
    res.json({
        success: true,
        adminWallet,
        overall: overallStats.rows[0],
        sessions: sessionStats.rows[0],
        recentActivity: recentActivity.rows,
        systemHealth,
        timestamp: new Date().toISOString()
    });
}));

// Get all players with pagination and filtering
router.get('/players', asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const sortBy = req.query.sortBy || 'total_score';
    const sortOrder = req.query.sortOrder || 'DESC';
    
    let whereClause = '';
    let params = [];
    
    if (search) {
        whereClause = 'WHERE wallet_address ILIKE $1 OR username ILIKE $1';
        params.push(`%${search}%`);
    }
    
    const query = `
        SELECT * FROM players 
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    const result = await db.query(query, [...params, limit, offset]);
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM players ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
        success: true,
        players: result.rows,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    });
}));

// Get player details
router.get('/players/:walletAddress', asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    
    // Get player data
    const playerResult = await db.query(`
        SELECT * FROM players WHERE wallet_address = $1
    `, [walletAddress]);
    
    if (playerResult.rows.length === 0) {
        throw new NotFoundError('Player not found');
    }
    
    const player = playerResult.rows[0];
    
    // Get player sessions
    const sessionsResult = await db.query(`
        SELECT * FROM game_sessions 
        WHERE wallet_address = $1 
        ORDER BY session_start DESC 
        LIMIT 20
    `, [walletAddress]);
    
    // Get player achievements
    const achievementsResult = await db.query(`
        SELECT * FROM player_achievements 
        WHERE wallet_address = $1 
        ORDER BY unlocked_at DESC
    `, [walletAddress]);
    
    // Get blockchain transactions
    const transactionsResult = await db.query(`
        SELECT * FROM blockchain_transactions 
        WHERE wallet_address = $1 
        ORDER BY timestamp DESC 
        LIMIT 20
    `, [walletAddress]);
    
    res.json({
        success: true,
        player,
        sessions: sessionsResult.rows,
        achievements: achievementsResult.rows,
        transactions: transactionsResult.rows
    });
}));

// Update player data
router.put('/players/:walletAddress', asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    const { username, level, totalScore, boomTokens, pirateTokens, admiralTokens, lives } = req.body;
    const adminWallet = req.walletAddress;
    
    // Check if player exists
    const existingPlayer = await db.query(`
        SELECT * FROM players WHERE wallet_address = $1
    `, [walletAddress]);
    
    if (existingPlayer.rows.length === 0) {
        throw new NotFoundError('Player not found');
    }
    
    // Update player
    const updateQuery = `
        UPDATE players 
        SET username = $1, level = $2, total_score = $3, boom_tokens = $4, 
            pirate_tokens = $5, admiral_tokens = $6, lives = $7, last_updated = CURRENT_TIMESTAMP
        WHERE wallet_address = $8
        RETURNING *
    `;
    
    const result = await db.query(updateQuery, [
        username, level, totalScore, boomTokens, pirateTokens, admiralTokens, lives, walletAddress
    ]);
    
    // Log admin action
    await db.query(`
        INSERT INTO admin_actions (admin_wallet, action_type, target_wallet, action_details)
        VALUES ($1, $2, $3, $4)
    `, [adminWallet, 'UPDATE_PLAYER', walletAddress, JSON.stringify(req.body)]);
    
    // Update cache
    await gameRedis.setPlayerSession(walletAddress, result.rows[0], 3600);
    
    adminLogger.info('Player updated by admin', { adminWallet, targetWallet: walletAddress, changes: req.body });
    
    res.json({
        success: true,
        message: 'Player updated successfully',
        player: result.rows[0]
    });
}));

// Reset player progress
router.post('/players/:walletAddress/reset', asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    const { resetType = 'full' } = req.body;
    const adminWallet = req.walletAddress;
    
    // Check if player exists
    const existingPlayer = await db.query(`
        SELECT * FROM players WHERE wallet_address = $1
    `, [walletAddress]);
    
    if (existingPlayer.rows.length === 0) {
        throw new NotFoundError('Player not found');
    }
    
    let updateQuery;
    let resetData;
    
    switch (resetType) {
        case 'progress':
            updateQuery = `
                UPDATE players 
                SET level = 1, total_score = 0, last_updated = CURRENT_TIMESTAMP
                WHERE wallet_address = $1
                RETURNING *
            `;
            resetData = { level: 1, totalScore: 0 };
            break;
            
        case 'tokens':
            updateQuery = `
                UPDATE players 
                SET boom_tokens = 0, pirate_tokens = 0, admiral_tokens = 0, last_updated = CURRENT_TIMESTAMP
                WHERE wallet_address = $1
                RETURNING *
            `;
            resetData = { boomTokens: 0, pirateTokens: 0, admiralTokens: 0 };
            break;
            
        case 'full':
            updateQuery = `
                UPDATE players 
                SET level = 1, total_score = 0, boom_tokens = 0, pirate_tokens = 0, 
                    admiral_tokens = 0, lives = 3, last_updated = CURRENT_TIMESTAMP
                WHERE wallet_address = $1
                RETURNING *
            `;
            resetData = { level: 1, totalScore: 0, boomTokens: 0, pirateTokens: 0, admiralTokens: 0, lives: 3 };
            break;
            
        default:
            throw new ValidationError('Invalid reset type');
    }
    
    const result = await db.query(updateQuery, [walletAddress]);
    
    // Log admin action
    await db.query(`
        INSERT INTO admin_actions (admin_wallet, action_type, target_wallet, action_details)
        VALUES ($1, $2, $3, $4)
    `, [adminWallet, 'RESET_PLAYER', walletAddress, JSON.stringify({ resetType, resetData })]);
    
    // Clear cache
    await gameRedis.del(`session:${walletAddress}`);
    
    adminLogger.warn('Player reset by admin', { adminWallet, targetWallet: walletAddress, resetType });
    
    res.json({
        success: true,
        message: `Player ${resetType} reset successfully`,
        player: result.rows[0]
    });
}));

// Delete player
router.delete('/players/:walletAddress', asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    const adminWallet = req.walletAddress;
    
    // Check if player exists
    const existingPlayer = await db.query(`
        SELECT * FROM players WHERE wallet_address = $1
    `, [walletAddress]);
    
    if (existingPlayer.rows.length === 0) {
        throw new NotFoundError('Player not found');
    }
    
    // Delete player data
    await db.query('DELETE FROM player_achievements WHERE wallet_address = $1', [walletAddress]);
    await db.query('DELETE FROM game_sessions WHERE wallet_address = $1', [walletAddress]);
    await db.query('DELETE FROM blockchain_transactions WHERE wallet_address = $1', [walletAddress]);
    await db.query('DELETE FROM players WHERE wallet_address = $1', [walletAddress]);
    
    // Log admin action
    await db.query(`
        INSERT INTO admin_actions (admin_wallet, action_type, target_wallet, action_details)
        VALUES ($1, $2, $3, $4)
    `, [adminWallet, 'DELETE_PLAYER', walletAddress, JSON.stringify({ reason: 'Admin deletion' })]);
    
    // Clear cache
    await gameRedis.del(`session:${walletAddress}`);
    
    adminLogger.error('Player deleted by admin', { adminWallet, targetWallet: walletAddress });
    
    res.json({
        success: true,
        message: 'Player deleted successfully'
    });
}));

// Get admin action log
router.get('/actions', asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const actionType = req.query.actionType || '';
    const adminWallet = req.query.adminWallet || '';
    
    let whereClause = '';
    let params = [];
    
    if (actionType) {
        whereClause += whereClause ? ' AND ' : 'WHERE ';
        whereClause += 'action_type = $' + (params.length + 1);
        params.push(actionType);
    }
    
    if (adminWallet) {
        whereClause += whereClause ? ' AND ' : 'WHERE ';
        whereClause += 'admin_wallet = $' + (params.length + 1);
        params.push(adminWallet);
    }
    
    const query = `
        SELECT * FROM admin_actions 
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    const result = await db.query(query, [...params, limit, offset]);
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM admin_actions ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
        success: true,
        actions: result.rows,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    });
}));

// Get system statistics
router.get('/system/stats', asyncHandler(async (req, res) => {
    // Database statistics
    const dbStats = await db.query(`
        SELECT 
            schemaname,
            tablename,
            attname,
            n_distinct,
            correlation
        FROM pg_stats 
        WHERE schemaname = 'public'
        ORDER BY tablename, attname
    `);
    
    // Table sizes
    const tableSizes = await db.query(`
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
            pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);
    
    // Redis statistics
    const redisInfo = await gameRedis.client.info();
    
    // System information
    const systemInfo = {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        pid: process.pid
    };
    
    res.json({
        success: true,
        database: {
            stats: dbStats.rows,
            tableSizes: tableSizes.rows
        },
        redis: redisInfo,
        system: systemInfo
    });
}));

// Get game configuration
router.get('/config', asyncHandler(async (req, res) => {
    const config = {
        game: {
            maxLevel: 40,
            maxLives: 3,
            maxBombs: 3,
            difficultyLevels: ['easy', 'normal', 'hard'],
            gameModes: ['standard', 'speedrun', 'survival']
        },
        rewards: {
            levelCompletion: {
                base: 10,
                scoreMultiplier: 0.001,
                enemyBonus: 2,
                powerUpBonus: 5,
                timeBonus: 2
            },
            achievements: {
                firstWin: 50,
                scoreMilestone: 100,
                levelMaster: 200,
                speedRunner: 150
            }
        },
        system: {
            leaderboardUpdateInterval: 300000,
            sessionTimeout: 3600000,
            maxPlayersPerSession: 1000
        }
    };
    
    res.json({
        success: true,
        config
    });
}));

// Update game configuration
router.put('/config', asyncHandler(async (req, res) => {
    const { config } = req.body;
    const adminWallet = req.walletAddress;
    
    // Validate configuration
    if (!config || typeof config !== 'object') {
        throw new ValidationError('Invalid configuration');
    }
    
    // Log configuration change
    await db.query(`
        INSERT INTO admin_actions (admin_wallet, action_type, target_wallet, action_details)
        VALUES ($1, $2, $3, $4)
    `, [adminWallet, 'UPDATE_CONFIG', null, JSON.stringify(config)]);
    
    adminLogger.info('Game configuration updated', { adminWallet, config });
    
    res.json({
        success: true,
        message: 'Configuration updated successfully',
        config
    });
}));

// Get blockchain status
router.get('/blockchain/status', asyncHandler(async (req, res) => {
    const status = {
        connected: web3Service.isConnected(),
        network: process.env.SOLANA_NETWORK || 'unknown',
        contracts: web3Service.getContractAddresses(),
        health: await web3Service.healthCheck()
    };
    
    res.json({
        success: true,
        status
    });
}));

// Force leaderboard update
router.post('/leaderboard/update', asyncHandler(async (req, res) => {
    const adminWallet = req.walletAddress;
    
    // Import and call leaderboard update function
    const leaderboardRoutes = require('./leaderboard');
    await leaderboardRoutes.updateLeaderboardCache();
    
    adminLogger.info('Leaderboard cache updated manually', { adminWallet });
    
    res.json({
        success: true,
        message: 'Leaderboard cache updated successfully'
    });
}));

// Get online players
router.get('/online', asyncHandler(async (req, res) => {
    const onlinePlayers = await gameRedis.getOnlinePlayers();
    
    res.json({
        success: true,
        onlinePlayers,
        count: onlinePlayers.length
    });
}));

// Kick player from game
router.post('/players/:walletAddress/kick', asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    const adminWallet = req.walletAddress;
    
    // Remove from online players
    await gameRedis.removeOnlinePlayer(walletAddress);
    
    // Clear session cache
    await gameRedis.del(`session:${walletAddress}`);
    
    // Log admin action
    await db.query(`
        INSERT INTO admin_actions (admin_wallet, action_type, target_wallet, action_details)
        VALUES ($1, $2, $3, $4)
    `, [adminWallet, 'KICK_PLAYER', walletAddress, JSON.stringify({ reason: 'Admin kick' })]);
    
    adminLogger.warn('Player kicked by admin', { adminWallet, targetWallet: walletAddress });
    
    res.json({
        success: true,
        message: 'Player kicked successfully'
    });
}));

module.exports = router;
