const database = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class PlayerController {
    // Get player by wallet address
    static async getPlayer(req, res) {
        try {
            const { walletAddress } = req.params;
            const db = database.getDatabase();

            const player = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT p.*, rt.lives_remaining, rt.is_recharging, rt.recharge_end_time,
                           COUNT(pa.id) as total_achievements,
                           COALESCE(SUM(CASE WHEN pa.is_claimed = 1 THEN a.reward_tokens ELSE 0 END), 0) as claimed_tokens
                    FROM players p
                    LEFT JOIN recharge_tracking rt ON p.wallet_address = rt.wallet_address
                    LEFT JOIN player_achievements pa ON p.wallet_address = pa.wallet_address
                    LEFT JOIN achievements a ON pa.achievement_id = a.id
                    WHERE p.wallet_address = ?
                    GROUP BY p.id
                `, [walletAddress], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!player) {
                return res.status(404).json({
                    success: false,
                    error: 'Player not found'
                });
            }

            // Get recent sessions
            const recentSessions = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT session_id, session_start, session_end, duration_minutes, 
                           levels_completed, score_earned, tokens_earned
                    FROM game_sessions 
                    WHERE wallet_address = ? 
                    ORDER BY session_start DESC 
                    LIMIT 5
                `, [walletAddress], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            res.json({
                success: true,
                data: {
                    player,
                    recent_sessions: recentSessions
                }
            });

        } catch (error) {
            console.error('Error getting player:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve player data'
            });
        }
    }

    // Create new player
    static async createPlayer(req, res) {
        try {
            const {
                wallet_address,
                username,
                email,
                level = 1,
                total_score = 0,
                boom_tokens = 0,
                lives = 3,
                preferred_difficulty = 'normal'
            } = req.body;

            const db = database.getDatabase();
            const referralCode = uuidv4().substring(0, 8).toUpperCase();

            // Check if player already exists
            const existingPlayer = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM players WHERE wallet_address = ?', [wallet_address], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (existingPlayer) {
                return res.status(409).json({
                    success: false,
                    error: 'Player already exists'
                });
            }

            // Create player
            const playerId = await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO players (
                        wallet_address, username, email, level, total_score, 
                        boom_tokens, lives, preferred_difficulty, referral_code,
                        ip_address, user_agent
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    wallet_address, username, email, level, total_score,
                    boom_tokens, lives, preferred_difficulty, referralCode,
                    req.ip, req.get('User-Agent')
                ], function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });

            // Create recharge tracking entry
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO recharge_tracking (wallet_address, lives_remaining, max_lives)
                    VALUES (?, ?, ?)
                `, [wallet_address, lives, 3], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Log admin action
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO admin_actions (
                        action_type, target_wallet, action_details, is_automated
                    ) VALUES (?, ?, ?, ?)
                `, [
                    'create',
                    wallet_address,
                    `Player created: ${username}`,
                    1
                ], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            res.status(201).json({
                success: true,
                message: 'Player created successfully',
                data: {
                    id: playerId,
                    wallet_address,
                    username,
                    referral_code: referralCode
                }
            });

        } catch (error) {
            console.error('Error creating player:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create player'
            });
        }
    }

    // Update player
    static async updatePlayer(req, res) {
        try {
            const { walletAddress } = req.params;
            const updates = req.body;
            const db = database.getDatabase();

            // Get current player data for logging
            const currentPlayer = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM players WHERE wallet_address = ?', [walletAddress], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!currentPlayer) {
                return res.status(404).json({
                    success: false,
                    error: 'Player not found'
                });
            }

            // Build dynamic update query
            const allowedFields = [
                'username', 'email', 'level', 'total_score', 'current_score',
                'boom_tokens', 'lives', 'experience_points', 'achievements_unlocked',
                'total_playtime_minutes', 'levels_completed', 'bosses_defeated',
                'enemies_killed', 'bombs_used', 'deaths', 'consecutive_wins',
                'best_streak', 'preferred_difficulty', 'player_rank'
            ];

            const updateFields = [];
            const updateValues = [];

            Object.keys(updates).forEach(key => {
                if (allowedFields.includes(key) && updates[key] !== undefined) {
                    updateFields.push(`${key} = ?`);
                    updateValues.push(updates[key]);
                }
            });

            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No valid fields to update'
                });
            }

            updateFields.push('last_updated = CURRENT_TIMESTAMP');
            updateValues.push(walletAddress);

            // Update player
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE players 
                    SET ${updateFields.join(', ')}
                    WHERE wallet_address = ?
                `, updateValues, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Log admin action
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO admin_actions (
                        action_type, target_wallet, action_details, 
                        old_values, new_values, is_automated
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    'update',
                    walletAddress,
                    `Player updated: ${Object.keys(updates).join(', ')}`,
                    JSON.stringify(currentPlayer),
                    JSON.stringify(updates),
                    1
                ], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            res.json({
                success: true,
                message: 'Player updated successfully'
            });

        } catch (error) {
            console.error('Error updating player:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update player'
            });
        }
    }

    // Get player leaderboard
    static async getLeaderboard(req, res) {
        try {
            const { 
                type = 'all_time', 
                category = 'score', 
                limit = 50,
                offset = 0 
            } = req.query;

            const db = database.getDatabase();

            let orderField;
            switch (category) {
                case 'tokens':
                    orderField = 'boom_tokens';
                    break;
                case 'level':
                    orderField = 'level';
                    break;
                case 'achievements':
                    orderField = 'achievements_unlocked';
                    break;
                case 'streak':
                    orderField = 'best_streak';
                    break;
                default:
                    orderField = 'total_score';
            }

            const leaderboard = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT 
                        ROW_NUMBER() OVER (ORDER BY ${orderField} DESC) as rank,
                        wallet_address,
                        username,
                        ${orderField} as value,
                        level,
                        player_rank,
                        last_updated
                    FROM players 
                    WHERE is_banned = 0
                    ORDER BY ${orderField} DESC
                    LIMIT ? OFFSET ?
                `, [parseInt(limit), parseInt(offset)], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            // Get total count
            const totalCount = await new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM players WHERE is_banned = 0', (err, row) => {
                    if (err) reject(err);
                    else resolve(row.count);
                });
            });

            res.json({
                success: true,
                data: {
                    leaderboard,
                    pagination: {
                        total: totalCount,
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
                    }
                }
            });

        } catch (error) {
            console.error('Error getting leaderboard:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve leaderboard'
            });
        }
    }

    // Search players
    static async searchPlayers(req, res) {
        try {
            const { q, limit = 20, offset = 0 } = req.query;
            const db = database.getDatabase();

            const searchTerm = `%${q}%`;
            
            const players = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT 
                        wallet_address,
                        username,
                        level,
                        total_score,
                        boom_tokens,
                        player_rank,
                        created_at
                    FROM players 
                    WHERE (username LIKE ? OR wallet_address LIKE ?) 
                    AND is_banned = 0
                    ORDER BY total_score DESC
                    LIMIT ? OFFSET ?
                `, [searchTerm, searchTerm, parseInt(limit), parseInt(offset)], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            res.json({
                success: true,
                data: players
            });

        } catch (error) {
            console.error('Error searching players:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to search players'
            });
        }
    }

    // Get player statistics
    static async getPlayerStats(req, res) {
        try {
            const { walletAddress } = req.params;
            const db = database.getDatabase();

            // Get comprehensive player stats
            const stats = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        p.*,
                        rt.lives_remaining,
                        rt.is_recharging,
                        rt.recharge_end_time,
                        COUNT(DISTINCT gs.id) as total_sessions,
                        COALESCE(SUM(gs.duration_minutes), 0) as total_playtime,
                        COUNT(DISTINCT pa.id) as total_achievements_unlocked,
                        COALESCE(SUM(CASE WHEN pa.is_claimed = 1 THEN a.reward_tokens ELSE 0 END), 0) as total_achievement_tokens
                    FROM players p
                    LEFT JOIN recharge_tracking rt ON p.wallet_address = rt.wallet_address
                    LEFT JOIN game_sessions gs ON p.wallet_address = gs.wallet_address
                    LEFT JOIN player_achievements pa ON p.wallet_address = pa.wallet_address
                    LEFT JOIN achievements a ON pa.achievement_id = a.id
                    WHERE p.wallet_address = ?
                    GROUP BY p.id
                `, [walletAddress], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!stats) {
                return res.status(404).json({
                    success: false,
                    error: 'Player not found'
                });
            }

            // Get recent token transactions
            const recentTransactions = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT transaction_type, amount, source, description, created_at
                    FROM token_transactions
                    WHERE wallet_address = ?
                    ORDER BY created_at DESC
                    LIMIT 10
                `, [walletAddress], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            // Calculate rank
            const rank = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT COUNT(*) + 1 as rank
                    FROM players
                    WHERE total_score > ? AND is_banned = 0
                `, [stats.total_score], (err, row) => {
                    if (err) reject(err);
                    else resolve(row.rank);
                });
            });

            res.json({
                success: true,
                data: {
                    ...stats,
                    current_rank: rank,
                    recent_transactions: recentTransactions
                }
            });

        } catch (error) {
            console.error('Error getting player stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve player statistics'
            });
        }
    }

    // Delete player (admin only)
    static async deletePlayer(req, res) {
        try {
            const { walletAddress } = req.params;
            const { reason } = req.body;
            const db = database.getDatabase();

            // Check if player exists
            const player = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM players WHERE wallet_address = ?', [walletAddress], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!player) {
                return res.status(404).json({
                    success: false,
                    error: 'Player not found'
                });
            }

            // Delete player (cascading deletes will handle related records)
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM players WHERE wallet_address = ?', [walletAddress], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Log admin action
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO admin_actions (
                        admin_wallet, action_type, target_wallet, 
                        action_details, old_values, reason
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    req.user?.wallet_address || 'system',
                    'delete',
                    walletAddress,
                    `Player deleted: ${player.username}`,
                    JSON.stringify(player),
                    reason || 'No reason provided'
                ], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            res.json({
                success: true,
                message: 'Player deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting player:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete player'
            });
        }
    }
}

module.exports = PlayerController;
