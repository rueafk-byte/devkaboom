const express = require('express');
const router = express.Router();

// Controllers
const PlayerController = require('../controllers/playerController');
const GameController = require('../controllers/gameController');
const TokenController = require('../controllers/tokenController');

// Middleware
const {
    rateLimiters,
    verifyToken,
    verifyAdmin,
    verifyWalletSignature,
    sanitizeInput
} = require('../middleware/security');

const {
    walletAddressValidation,
    createPlayerValidation,
    updatePlayerValidation,
    createSessionValidation,
    updateSessionValidation,
    rechargeValidation,
    tokenTransactionValidation,
    searchValidation,
    paginationValidation,
    adminActionValidation
} = require('../middleware/validation');

// Apply sanitization to all routes
router.use(sanitizeInput);

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

// ==================== PLAYER ROUTES ====================

// Get player by wallet address
router.get('/players/:walletAddress', 
    rateLimiters.general,
    walletAddressValidation,
    PlayerController.getPlayer
);

// Create new player
router.post('/players',
    rateLimiters.playerUpdate,
    createPlayerValidation,
    PlayerController.createPlayer
);

// Update player
router.put('/players/:walletAddress',
    rateLimiters.playerUpdate,
    updatePlayerValidation,
    PlayerController.updatePlayer
);

// Get player statistics
router.get('/players/:walletAddress/stats',
    rateLimiters.general,
    walletAddressValidation,
    PlayerController.getPlayerStats
);

// Search players
router.get('/players/search',
    rateLimiters.general,
    searchValidation,
    PlayerController.searchPlayers
);

// Get leaderboard
router.get('/leaderboard',
    rateLimiters.general,
    paginationValidation,
    PlayerController.getLeaderboard
);

// Delete player (admin only)
router.delete('/players/:walletAddress',
    rateLimiters.admin,
    verifyAdmin,
    walletAddressValidation,
    PlayerController.deletePlayer
);

// ==================== GAME SESSION ROUTES ====================

// Create game session
router.post('/sessions',
    rateLimiters.gameSession,
    createSessionValidation,
    GameController.createSession
);

// Get game session
router.get('/sessions/:sessionId',
    rateLimiters.general,
    GameController.getSession
);

// Update game session
router.put('/sessions/:sessionId',
    rateLimiters.gameSession,
    updateSessionValidation,
    GameController.updateSession
);

// End game session
router.post('/sessions/:sessionId/end',
    rateLimiters.gameSession,
    GameController.endSession
);

// Get player sessions
router.get('/players/:walletAddress/sessions',
    rateLimiters.general,
    walletAddressValidation,
    paginationValidation,
    GameController.getPlayerSessions
);

// Get active sessions (admin only)
router.get('/admin/sessions/active',
    rateLimiters.admin,
    verifyAdmin,
    paginationValidation,
    GameController.getActiveSessions
);

// Get game statistics
router.get('/stats/game',
    rateLimiters.general,
    GameController.getGameStats
);

// ==================== TOKEN ROUTES ====================

// Get token balance
router.get('/tokens/:walletAddress/balance',
    rateLimiters.general,
    walletAddressValidation,
    TokenController.getBalance
);

// Process token transaction
router.post('/tokens/transaction',
    rateLimiters.tokenTransaction,
    tokenTransactionValidation,
    TokenController.processTransaction
);

// Get transaction history
router.get('/tokens/:walletAddress/history',
    rateLimiters.general,
    walletAddressValidation,
    paginationValidation,
    TokenController.getTransactionHistory
);

// Award achievement tokens
router.post('/tokens/achievement-reward',
    rateLimiters.tokenTransaction,
    TokenController.awardAchievementTokens
);

// Get token statistics
router.get('/stats/tokens',
    rateLimiters.general,
    TokenController.getTokenStats
);

// Admin: Grant tokens
router.post('/admin/tokens/grant',
    rateLimiters.admin,
    verifyAdmin,
    TokenController.grantTokens
);

// Admin: Revoke tokens
router.post('/admin/tokens/revoke',
    rateLimiters.admin,
    verifyAdmin,
    TokenController.revokeTokens
);

// ==================== RECHARGE ROUTES ====================

// Get recharge status
router.get('/recharge/:walletAddress',
    rateLimiters.general,
    walletAddressValidation,
    async (req, res) => {
        try {
            const { walletAddress } = req.params;
            const database = require('../config/database');
            const db = database.getDatabase();

            const rechargeData = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT rt.*, p.username, p.max_lives
                    FROM recharge_tracking rt
                    LEFT JOIN players p ON rt.wallet_address = p.wallet_address
                    WHERE rt.wallet_address = ?
                `, [walletAddress], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!rechargeData) {
                return res.status(404).json({
                    success: false,
                    error: 'Recharge data not found'
                });
            }

            // Calculate remaining time
            let remainingTime = 0;
            if (rechargeData.is_recharging && rechargeData.recharge_end_time) {
                const endTime = new Date(rechargeData.recharge_end_time);
                const now = new Date();
                remainingTime = Math.max(0, Math.ceil((endTime - now) / 1000));
            }

            res.json({
                success: true,
                data: {
                    ...rechargeData,
                    remaining_time_seconds: remainingTime,
                    can_recharge: !rechargeData.is_recharging && rechargeData.lives_remaining < rechargeData.max_lives
                }
            });

        } catch (error) {
            console.error('Error getting recharge status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve recharge status'
            });
        }
    }
);

// Start recharge
router.post('/recharge/:walletAddress/start',
    rateLimiters.playerUpdate,
    rechargeValidation,
    async (req, res) => {
        try {
            const { walletAddress } = req.params;
            const { cooldown_duration_minutes = 45 } = req.body;
            const database = require('../config/database');
            const db = database.getDatabase();

            // Check current status
            const currentStatus = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT * FROM recharge_tracking 
                    WHERE wallet_address = ?
                `, [walletAddress], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!currentStatus) {
                return res.status(404).json({
                    success: false,
                    error: 'Player not found'
                });
            }

            if (currentStatus.is_recharging) {
                return res.status(409).json({
                    success: false,
                    error: 'Recharge already in progress'
                });
            }

            if (currentStatus.lives_remaining >= currentStatus.max_lives) {
                return res.status(409).json({
                    success: false,
                    error: 'Lives already at maximum'
                });
            }

            const rechargeEndTime = new Date(Date.now() + (cooldown_duration_minutes * 60 * 1000));

            // Start recharge
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE recharge_tracking 
                    SET is_recharging = 1,
                        recharge_start_time = CURRENT_TIMESTAMP,
                        recharge_end_time = ?,
                        cooldown_duration_minutes = ?,
                        recharge_count = recharge_count + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE wallet_address = ?
                `, [rechargeEndTime.toISOString(), cooldown_duration_minutes, walletAddress], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            res.json({
                success: true,
                message: 'Recharge started successfully',
                data: {
                    recharge_end_time: rechargeEndTime.toISOString(),
                    duration_minutes: cooldown_duration_minutes
                }
            });

        } catch (error) {
            console.error('Error starting recharge:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to start recharge'
            });
        }
    }
);

// Complete recharge
router.post('/recharge/:walletAddress/complete',
    rateLimiters.playerUpdate,
    walletAddressValidation,
    async (req, res) => {
        try {
            const { walletAddress } = req.params;
            const database = require('../config/database');
            const db = database.getDatabase();

            // Check recharge status
            const rechargeStatus = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT rt.*, p.max_lives
                    FROM recharge_tracking rt
                    LEFT JOIN players p ON rt.wallet_address = p.wallet_address
                    WHERE rt.wallet_address = ?
                `, [walletAddress], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!rechargeStatus) {
                return res.status(404).json({
                    success: false,
                    error: 'Player not found'
                });
            }

            if (!rechargeStatus.is_recharging) {
                return res.status(409).json({
                    success: false,
                    error: 'No recharge in progress'
                });
            }

            // Check if recharge time has elapsed
            const now = new Date();
            const endTime = new Date(rechargeStatus.recharge_end_time);

            if (now < endTime) {
                const remainingSeconds = Math.ceil((endTime - now) / 1000);
                return res.status(409).json({
                    success: false,
                    error: 'Recharge not yet complete',
                    remaining_time_seconds: remainingSeconds
                });
            }

            const newLives = Math.min(rechargeStatus.max_lives, rechargeStatus.lives_remaining + 1);

            // Complete recharge
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE recharge_tracking 
                    SET is_recharging = 0,
                        lives_remaining = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE wallet_address = ?
                `, [newLives, walletAddress], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Update player lives
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE players 
                    SET lives = ?, last_updated = CURRENT_TIMESTAMP
                    WHERE wallet_address = ?
                `, [newLives, walletAddress], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            res.json({
                success: true,
                message: 'Recharge completed successfully',
                data: {
                    new_lives: newLives,
                    max_lives: rechargeStatus.max_lives
                }
            });

        } catch (error) {
            console.error('Error completing recharge:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to complete recharge'
            });
        }
    }
);

// ==================== ACHIEVEMENT ROUTES ====================

// Get all achievements
router.get('/achievements',
    rateLimiters.general,
    async (req, res) => {
        try {
            const { category, difficulty, is_active = true } = req.query;
            const database = require('../config/database');
            const db = database.getDatabase();

            let whereClause = 'WHERE 1=1';
            const queryParams = [];

            if (category) {
                whereClause += ' AND category = ?';
                queryParams.push(category);
            }

            if (difficulty) {
                whereClause += ' AND difficulty = ?';
                queryParams.push(difficulty);
            }

            if (is_active !== 'false') {
                whereClause += ' AND is_active = 1';
            }

            const achievements = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT * FROM achievements 
                    ${whereClause}
                    ORDER BY category, difficulty, name
                `, queryParams, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            res.json({
                success: true,
                data: achievements
            });

        } catch (error) {
            console.error('Error getting achievements:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve achievements'
            });
        }
    }
);

// Get player achievements
router.get('/players/:walletAddress/achievements',
    rateLimiters.general,
    walletAddressValidation,
    async (req, res) => {
        try {
            const { walletAddress } = req.params;
            const database = require('../config/database');
            const db = database.getDatabase();

            const achievements = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT 
                        a.*,
                        pa.unlocked_at,
                        pa.progress_value,
                        pa.is_claimed,
                        pa.claimed_at
                    FROM achievements a
                    LEFT JOIN player_achievements pa ON a.id = pa.achievement_id 
                        AND pa.wallet_address = ?
                    WHERE a.is_active = 1
                    ORDER BY pa.unlocked_at DESC, a.category, a.name
                `, [walletAddress], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            const unlocked = achievements.filter(a => a.unlocked_at);
            const locked = achievements.filter(a => !a.unlocked_at);

            res.json({
                success: true,
                data: {
                    unlocked,
                    locked,
                    total_unlocked: unlocked.length,
                    total_available: achievements.length
                }
            });

        } catch (error) {
            console.error('Error getting player achievements:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve player achievements'
            });
        }
    }
);

// ==================== ADMIN ROUTES ====================

// Get admin dashboard stats
router.get('/admin/dashboard',
    rateLimiters.admin,
    verifyAdmin,
    async (req, res) => {
        try {
            const database = require('../config/database');
            const db = database.getDatabase();

            const stats = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        COUNT(DISTINCT p.wallet_address) as total_players,
                        COUNT(DISTINCT CASE WHEN p.last_login >= datetime('now', '-1 day') THEN p.wallet_address END) as daily_active_users,
                        COUNT(DISTINCT CASE WHEN p.last_login >= datetime('now', '-7 days') THEN p.wallet_address END) as weekly_active_users,
                        COUNT(DISTINCT gs.session_id) as total_sessions,
                        COUNT(DISTINCT CASE WHEN gs.session_start >= datetime('now', '-1 day') THEN gs.session_id END) as daily_sessions,
                        COALESCE(SUM(p.boom_tokens), 0) as total_tokens_in_circulation,
                        COUNT(DISTINCT tt.transaction_id) as total_transactions,
                        COUNT(DISTINCT pa.id) as total_achievements_unlocked
                    FROM players p
                    LEFT JOIN game_sessions gs ON p.wallet_address = gs.wallet_address
                    LEFT JOIN token_transactions tt ON p.wallet_address = tt.wallet_address
                    LEFT JOIN player_achievements pa ON p.wallet_address = pa.wallet_address
                    WHERE p.is_banned = 0
                `, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            // Get recent admin actions
            const recentActions = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT action_type, target_wallet, action_details, timestamp
                    FROM admin_actions
                    ORDER BY timestamp DESC
                    LIMIT 10
                `, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            res.json({
                success: true,
                data: {
                    ...stats,
                    recent_actions: recentActions,
                    server_uptime: process.uptime(),
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error getting admin dashboard:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve admin dashboard'
            });
        }
    }
);

// Error handling middleware
router.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        requestId: req.requestId
    });
});

module.exports = router;
