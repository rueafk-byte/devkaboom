const database = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class GameController {
    // Create new game session
    static async createSession(req, res) {
        try {
            const {
                session_id,
                wallet_address,
                session_type = 'pve',
                device_type = 'desktop'
            } = req.body;

            const db = database.getDatabase();

            // Check if session already exists
            const existingSession = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM game_sessions WHERE session_id = ?', [session_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (existingSession) {
                return res.status(409).json({
                    success: false,
                    error: 'Session already exists'
                });
            }

            // Create session
            const sessionDbId = await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO game_sessions (
                        session_id, wallet_address, session_type, device_type,
                        ip_address, user_agent
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    session_id, wallet_address, session_type, device_type,
                    req.ip, req.get('User-Agent')
                ], function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });

            res.status(201).json({
                success: true,
                message: 'Game session created successfully',
                data: {
                    id: sessionDbId,
                    session_id,
                    wallet_address,
                    session_type,
                    device_type
                }
            });

        } catch (error) {
            console.error('Error creating game session:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create game session'
            });
        }
    }

    // Update game session
    static async updateSession(req, res) {
        try {
            const { sessionId } = req.params;
            const updates = req.body;
            const db = database.getDatabase();

            // Get current session
            const currentSession = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM game_sessions WHERE session_id = ?', [sessionId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!currentSession) {
                return res.status(404).json({
                    success: false,
                    error: 'Game session not found'
                });
            }

            // Build dynamic update query
            const allowedFields = [
                'levels_attempted', 'levels_completed', 'score_earned', 'tokens_earned',
                'enemies_killed', 'bombs_used', 'deaths', 'achievements_unlocked',
                'highest_level_reached', 'is_completed'
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

            // Add session end time if marking as completed
            if (updates.is_completed) {
                updateFields.push('session_end = CURRENT_TIMESTAMP');
                updateFields.push(`duration_minutes = (
                    (julianday(CURRENT_TIMESTAMP) - julianday(session_start)) * 24 * 60
                )`);
            }

            updateValues.push(sessionId);

            // Update session
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE game_sessions 
                    SET ${updateFields.join(', ')}
                    WHERE session_id = ?
                `, updateValues, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // If session completed, update player stats
            if (updates.is_completed) {
                await this.updatePlayerStatsFromSession(currentSession.wallet_address, updates);
            }

            res.json({
                success: true,
                message: 'Game session updated successfully'
            });

        } catch (error) {
            console.error('Error updating game session:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update game session'
            });
        }
    }

    // Get game session
    static async getSession(req, res) {
        try {
            const { sessionId } = req.params;
            const db = database.getDatabase();

            const session = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT gs.*, p.username, p.level as player_level
                    FROM game_sessions gs
                    LEFT JOIN players p ON gs.wallet_address = p.wallet_address
                    WHERE gs.session_id = ?
                `, [sessionId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!session) {
                return res.status(404).json({
                    success: false,
                    error: 'Game session not found'
                });
            }

            res.json({
                success: true,
                data: session
            });

        } catch (error) {
            console.error('Error getting game session:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve game session'
            });
        }
    }

    // Get player sessions
    static async getPlayerSessions(req, res) {
        try {
            const { walletAddress } = req.params;
            const { limit = 20, offset = 0, completed_only = false } = req.query;
            const db = database.getDatabase();

            let whereClause = 'WHERE wallet_address = ?';
            const queryParams = [walletAddress];

            if (completed_only === 'true') {
                whereClause += ' AND is_completed = 1';
            }

            const sessions = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT 
                        session_id, session_start, session_end, duration_minutes,
                        levels_attempted, levels_completed, score_earned, tokens_earned,
                        enemies_killed, bombs_used, deaths, achievements_unlocked,
                        highest_level_reached, session_type, device_type, is_completed
                    FROM game_sessions 
                    ${whereClause}
                    ORDER BY session_start DESC
                    LIMIT ? OFFSET ?
                `, [...queryParams, parseInt(limit), parseInt(offset)], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            // Get total count
            const totalCount = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT COUNT(*) as count 
                    FROM game_sessions 
                    ${whereClause}
                `, queryParams, (err, row) => {
                    if (err) reject(err);
                    else resolve(row.count);
                });
            });

            res.json({
                success: true,
                data: {
                    sessions,
                    pagination: {
                        total: totalCount,
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
                    }
                }
            });

        } catch (error) {
            console.error('Error getting player sessions:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve player sessions'
            });
        }
    }

    // Get game statistics
    static async getGameStats(req, res) {
        try {
            const db = database.getDatabase();

            // Get comprehensive game statistics
            const stats = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        COUNT(DISTINCT p.wallet_address) as total_players,
                        COUNT(DISTINCT gs.session_id) as total_sessions,
                        COUNT(DISTINCT CASE WHEN gs.is_completed = 1 THEN gs.session_id END) as completed_sessions,
                        COALESCE(SUM(gs.duration_minutes), 0) as total_playtime_minutes,
                        COALESCE(SUM(gs.score_earned), 0) as total_score_earned,
                        COALESCE(SUM(gs.tokens_earned), 0) as total_tokens_earned,
                        COALESCE(SUM(gs.enemies_killed), 0) as total_enemies_killed,
                        COALESCE(SUM(gs.bombs_used), 0) as total_bombs_used,
                        COALESCE(AVG(gs.duration_minutes), 0) as avg_session_duration,
                        COUNT(DISTINCT pa.id) as total_achievements_unlocked
                    FROM players p
                    LEFT JOIN game_sessions gs ON p.wallet_address = gs.wallet_address
                    LEFT JOIN player_achievements pa ON p.wallet_address = pa.wallet_address
                    WHERE p.is_banned = 0
                `, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            // Get daily active users (last 24 hours)
            const dailyActiveUsers = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT COUNT(DISTINCT wallet_address) as dau
                    FROM game_sessions
                    WHERE session_start >= datetime('now', '-1 day')
                `, (err, row) => {
                    if (err) reject(err);
                    else resolve(row.dau);
                });
            });

            // Get level distribution
            const levelDistribution = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT level, COUNT(*) as player_count
                    FROM players
                    WHERE is_banned = 0
                    GROUP BY level
                    ORDER BY level
                `, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            // Get top performers
            const topPlayers = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT username, total_score, level, boom_tokens, player_rank
                    FROM players
                    WHERE is_banned = 0
                    ORDER BY total_score DESC
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
                    daily_active_users: dailyActiveUsers,
                    level_distribution: levelDistribution,
                    top_players: topPlayers
                }
            });

        } catch (error) {
            console.error('Error getting game stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve game statistics'
            });
        }
    }

    // Helper method to update player stats from completed session
    static async updatePlayerStatsFromSession(walletAddress, sessionData) {
        try {
            const db = database.getDatabase();

            const updates = [];
            const values = [];

            if (sessionData.score_earned) {
                updates.push('total_score = total_score + ?');
                values.push(sessionData.score_earned);
            }

            if (sessionData.tokens_earned) {
                updates.push('boom_tokens = boom_tokens + ?');
                values.push(sessionData.tokens_earned);
            }

            if (sessionData.levels_completed) {
                updates.push('levels_completed = levels_completed + ?');
                values.push(sessionData.levels_completed);
            }

            if (sessionData.enemies_killed) {
                updates.push('enemies_killed = enemies_killed + ?');
                values.push(sessionData.enemies_killed);
            }

            if (sessionData.bombs_used) {
                updates.push('bombs_used = bombs_used + ?');
                values.push(sessionData.bombs_used);
            }

            if (sessionData.deaths) {
                updates.push('deaths = deaths + ?');
                values.push(sessionData.deaths);
            }

            if (sessionData.achievements_unlocked) {
                updates.push('achievements_unlocked = achievements_unlocked + ?');
                values.push(sessionData.achievements_unlocked);
            }

            if (sessionData.highest_level_reached) {
                updates.push('level = MAX(level, ?)');
                values.push(sessionData.highest_level_reached);
            }

            if (updates.length > 0) {
                updates.push('last_updated = CURRENT_TIMESTAMP');
                values.push(walletAddress);

                await new Promise((resolve, reject) => {
                    db.run(`
                        UPDATE players 
                        SET ${updates.join(', ')}
                        WHERE wallet_address = ?
                    `, values, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

        } catch (error) {
            console.error('Error updating player stats from session:', error);
        }
    }

    // End active session (for cleanup)
    static async endSession(req, res) {
        try {
            const { sessionId } = req.params;
            const db = database.getDatabase();

            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE game_sessions 
                    SET session_end = CURRENT_TIMESTAMP,
                        duration_minutes = (julianday(CURRENT_TIMESTAMP) - julianday(session_start)) * 24 * 60,
                        is_completed = 1
                    WHERE session_id = ? AND session_end IS NULL
                `, [sessionId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            res.json({
                success: true,
                message: 'Game session ended successfully'
            });

        } catch (error) {
            console.error('Error ending game session:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to end game session'
            });
        }
    }

    // Get active sessions (admin)
    static async getActiveSessions(req, res) {
        try {
            const { limit = 50, offset = 0 } = req.query;
            const db = database.getDatabase();

            const activeSessions = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT 
                        gs.session_id, gs.wallet_address, gs.session_start,
                        gs.session_type, gs.device_type, gs.ip_address,
                        p.username, p.level,
                        (julianday(CURRENT_TIMESTAMP) - julianday(gs.session_start)) * 24 * 60 as duration_minutes
                    FROM game_sessions gs
                    LEFT JOIN players p ON gs.wallet_address = p.wallet_address
                    WHERE gs.session_end IS NULL
                    ORDER BY gs.session_start DESC
                    LIMIT ? OFFSET ?
                `, [parseInt(limit), parseInt(offset)], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            const totalActive = await new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM game_sessions WHERE session_end IS NULL', (err, row) => {
                    if (err) reject(err);
                    else resolve(row.count);
                });
            });

            res.json({
                success: true,
                data: {
                    active_sessions: activeSessions,
                    total_active: totalActive,
                    pagination: {
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        hasMore: (parseInt(offset) + parseInt(limit)) < totalActive
                    }
                }
            });

        } catch (error) {
            console.error('Error getting active sessions:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve active sessions'
            });
        }
    }
}

module.exports = GameController;
