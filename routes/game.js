const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { game: gameRedis } = require('../config/redis');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { walletAuthMiddleware } = require('../middleware/auth');
const Web3Service = require('../services/web3Service');
const { v4: uuidv4 } = require('uuid');

// Initialize Web3 service
const web3Service = new Web3Service();

// Start new game session
router.post('/session/start', walletAuthMiddleware, asyncHandler(async (req, res) => {
    const { walletAddress, level, difficulty, gameMode } = req.body;
    
    if (!walletAddress || !level) {
        throw new ValidationError('Wallet address and level are required');
    }
    
    const sessionId = uuidv4();
    const sessionData = {
        sessionId,
        walletAddress,
        level: parseInt(level),
        difficulty: difficulty || 'normal',
        gameMode: gameMode || 'standard',
        startTime: new Date(),
        score: 0,
        lives: 3,
        bombs: 3,
        enemiesKilled: 0,
        powerUpsCollected: 0,
        gameState: 'active'
    };
    
    // Create session in database
    await db.query(`
        INSERT INTO game_sessions 
        (wallet_address, session_id, game_data)
        VALUES ($1, $2, $3)
    `, [walletAddress, sessionId, JSON.stringify(sessionData)]);
    
    // Cache session data
    await gameRedis.setPlayerSession(walletAddress, sessionData, 3600);
    
    res.status(201).json({
        success: true,
        sessionId,
        sessionData
    });
}));

// Update game state during gameplay
router.put('/session/:sessionId/update', walletAuthMiddleware, asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { walletAddress, score, lives, bombs, enemiesKilled, powerUpsCollected, gameState, position } = req.body;
    
    const updateData = {
        score: parseInt(score) || 0,
        lives: parseInt(lives) || 3,
        bombs: parseInt(bombs) || 3,
        enemiesKilled: parseInt(enemiesKilled) || 0,
        powerUpsCollected: parseInt(powerUpsCollected) || 0,
        gameState: gameState || 'active',
        position: position || { x: 0, y: 0 },
        lastUpdate: new Date()
    };
    
    // Update session in database
    await db.query(`
        UPDATE game_sessions 
        SET game_data = $1
        WHERE session_id = $2 AND wallet_address = $3
    `, [JSON.stringify(updateData), sessionId, walletAddress]);
    
    // Update cache
    await gameRedis.setPlayerSession(walletAddress, updateData, 3600);
    
    res.json({
        success: true,
        message: 'Game state updated',
        sessionData: updateData
    });
}));

// Complete level
router.post('/session/:sessionId/complete', walletAuthMiddleware, asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { walletAddress, level, score, enemiesKilled, powerUpsCollected, completionTime, difficulty } = req.body;
    
    // Calculate rewards
    const baseReward = level * 10;
    const scoreBonus = Math.floor(score / 1000);
    const enemyBonus = enemiesKilled * 2;
    const powerUpBonus = powerUpsCollected * 5;
    const timeBonus = Math.max(0, 60 - completionTime) * 2;
    const difficultyMultiplier = difficulty === 'hard' ? 1.5 : difficulty === 'easy' ? 0.8 : 1;
    
    const totalReward = Math.floor((baseReward + scoreBonus + enemyBonus + powerUpBonus + timeBonus) * difficultyMultiplier);
    
    // End session
    await db.query(`
        UPDATE game_sessions 
        SET session_end = CURRENT_TIMESTAMP, score_earned = $1, tokens_earned = $2,
            enemies_killed = $3, levels_completed = 1, game_data = $4
        WHERE session_id = $5 AND wallet_address = $6
    `, [score, JSON.stringify({ boom: totalReward }), enemiesKilled, JSON.stringify({ completed: true }), sessionId, walletAddress]);
    
    // Update player stats
    const playerResult = await db.query(`
        SELECT * FROM players WHERE wallet_address = $1
    `, [walletAddress]);
    
    if (playerResult.rows.length > 0) {
        const player = playerResult.rows[0];
        const newLevel = Math.max(player.level, level + 1);
        const newTotalScore = player.total_score + score;
        const newBoomTokens = player.boom_tokens + totalReward;
        
        await db.query(`
            UPDATE players 
            SET level = $1, total_score = $2, boom_tokens = $3, last_updated = CURRENT_TIMESTAMP
            WHERE wallet_address = $4
        `, [newLevel, newTotalScore, newBoomTokens, walletAddress]);
        
        // Update blockchain
        if (web3Service.isConnected()) {
            await web3Service.processLevelReward(walletAddress, level, score, { boom: totalReward });
        }
        
        // Update leaderboard
        await gameRedis.updateLeaderboard('score', walletAddress, newTotalScore, newLevel, newBoomTokens);
    }
    
    res.json({
        success: true,
        message: 'Level completed',
        rewards: {
            boom: totalReward,
            level: level,
            score: score
        },
        newStats: {
            level: newLevel,
            totalScore: newTotalScore,
            boomTokens: newBoomTokens
        }
    });
}));

// Game over
router.post('/session/:sessionId/gameover', walletAuthMiddleware, asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { walletAddress, finalScore, enemiesKilled, powerUpsCollected, gameTime } = req.body;
    
    // End session
    await db.query(`
        UPDATE game_sessions 
        SET session_end = CURRENT_TIMESTAMP, score_earned = $1, enemies_killed = $2,
            game_data = $3
        WHERE session_id = $4 AND wallet_address = $5
    `, [finalScore, enemiesKilled, JSON.stringify({ gameOver: true, gameTime }), sessionId, walletAddress]);
    
    // Remove from cache
    await gameRedis.del(`session:${walletAddress}`);
    
    res.json({
        success: true,
        message: 'Game over recorded',
        finalScore,
        enemiesKilled,
        gameTime
    });
}));

// Get current game session
router.get('/session/:sessionId', asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    
    const result = await db.query(`
        SELECT * FROM game_sessions WHERE session_id = $1
    `, [sessionId]);
    
    if (result.rows.length === 0) {
        throw new NotFoundError('Game session not found');
    }
    
    res.json({
        success: true,
        session: result.rows[0]
    });
}));

// Get player's active sessions
router.get('/sessions/active/:walletAddress', asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    
    const result = await db.query(`
        SELECT * FROM game_sessions 
        WHERE wallet_address = $1 AND session_end IS NULL
        ORDER BY session_start DESC
    `, [walletAddress]);
    
    res.json({
        success: true,
        activeSessions: result.rows
    });
}));

// Get leaderboard for current level
router.get('/leaderboard/level/:level', asyncHandler(async (req, res) => {
    const { level } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    // Try cache first
    const cachedLeaderboard = await gameRedis.getLeaderboard(`level_${level}`, limit);
    if (cachedLeaderboard.length > 0) {
        return res.json({
            success: true,
            leaderboard: cachedLeaderboard,
            source: 'cache'
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
        LIMIT $2
    `, [level, limit]);
    
    res.json({
        success: true,
        leaderboard: result.rows,
        source: 'database'
    });
}));

// Get global leaderboard
router.get('/leaderboard/global', asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    
    // Try cache first
    const cachedLeaderboard = await gameRedis.getLeaderboard('global', limit);
    if (cachedLeaderboard.length > 0) {
        return res.json({
            success: true,
            leaderboard: cachedLeaderboard,
            source: 'cache'
        });
    }
    
    // Get from database
    const result = await db.query(`
        SELECT wallet_address, username, level, total_score, boom_tokens, created_at
        FROM players
        ORDER BY total_score DESC
        LIMIT $1
    `, [limit]);
    
    res.json({
        success: true,
        leaderboard: result.rows,
        source: 'database'
    });
}));

// Get player statistics
router.get('/stats/:walletAddress', asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    
    // Get player data
    const playerResult = await db.query(`
        SELECT * FROM players WHERE wallet_address = $1
    `, [walletAddress]);
    
    if (playerResult.rows.length === 0) {
        throw new NotFoundError('Player not found');
    }
    
    const player = playerResult.rows[0];
    
    // Get game statistics
    const statsResult = await db.query(`
        SELECT 
            COUNT(*) as total_sessions,
            SUM(score_earned) as total_score_earned,
            SUM(enemies_killed) as total_enemies_killed,
            SUM(levels_completed) as total_levels_completed,
            AVG(EXTRACT(EPOCH FROM (session_end - session_start))) as avg_session_time,
            MAX(score_earned) as highest_score,
            COUNT(CASE WHEN session_end IS NOT NULL THEN 1 END) as completed_sessions
        FROM game_sessions 
        WHERE wallet_address = $1
    `, [walletAddress]);
    
    // Get achievements
    const achievementsResult = await db.query(`
        SELECT * FROM player_achievements 
        WHERE wallet_address = $1 
        ORDER BY unlocked_at DESC
    `, [walletAddress]);
    
    // Get recent sessions
    const sessionsResult = await db.query(`
        SELECT * FROM game_sessions 
        WHERE wallet_address = $1 
        ORDER BY session_start DESC 
        LIMIT 10
    `, [walletAddress]);
    
    res.json({
        success: true,
        player: player,
        statistics: statsResult.rows[0],
        achievements: achievementsResult.rows,
        recentSessions: sessionsResult.rows
    });
}));

// Get online players
router.get('/online', asyncHandler(async (req, res) => {
    const onlinePlayers = await gameRedis.getOnlinePlayers();
    
    res.json({
        success: true,
        onlinePlayers: onlinePlayers,
        count: onlinePlayers.length
    });
}));

// Get game configuration
router.get('/config', asyncHandler(async (req, res) => {
    const config = {
        maxLevel: 40,
        maxLives: 3,
        maxBombs: 3,
        difficultyLevels: ['easy', 'normal', 'hard'],
        gameModes: ['standard', 'speedrun', 'survival'],
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
        leaderboardUpdateInterval: 300000, // 5 minutes
        sessionTimeout: 3600000 // 1 hour
    };
    
    res.json({
        success: true,
        config
    });
}));

// Submit score for leaderboard
router.post('/score/submit', walletAuthMiddleware, asyncHandler(async (req, res) => {
    const { walletAddress, level, score, difficulty, gameMode, completionTime } = req.body;
    
    // Validate score
    if (!score || score < 0) {
        throw new ValidationError('Invalid score');
    }
    
    // Check if this is a new high score
    const existingScoreResult = await db.query(`
        SELECT MAX(score_earned) as highest_score
        FROM game_sessions 
        WHERE wallet_address = $1 AND game_data->>'level' = $2
    `, [walletAddress, level]);
    
    const isNewHighScore = !existingScoreResult.rows[0].highest_score || 
                          score > existingScoreResult.rows[0].highest_score;
    
    // Update leaderboard
    await gameRedis.updateLeaderboard('score', walletAddress, score, level, 0);
    
    // Check for achievements
    const achievements = [];
    
    if (isNewHighScore) {
        achievements.push({
            id: 'new_high_score',
            name: 'New High Score',
            description: `Achieved new high score on level ${level}`,
            rewardTokens: { boom: 25 }
        });
    }
    
    if (completionTime && completionTime < 60) {
        achievements.push({
            id: 'speed_runner',
            name: 'Speed Runner',
            description: `Completed level ${level} in under 60 seconds`,
            rewardTokens: { boom: 50 }
        });
    }
    
    res.json({
        success: true,
        scoreSubmitted: true,
        isNewHighScore,
        achievements,
        message: 'Score submitted successfully'
    });
}));

module.exports = router;
