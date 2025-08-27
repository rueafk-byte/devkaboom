const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { game: gameRedis } = require('../config/redis');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { walletAuthMiddleware } = require('../middleware/auth');
const Web3Service = require('../services/web3Service');

// Initialize Web3 service
const web3Service = new Web3Service();

// Get all players (with pagination)
router.get('/', asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    const query = `
        SELECT * FROM players 
        ORDER BY total_score DESC
        LIMIT $1 OFFSET $2
    `;
    
    const result = await db.query(query, [limit, offset]);
    
    // Get total count
    const countResult = await db.query('SELECT COUNT(*) as total FROM players');
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
        players: result.rows,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    });
}));

// Get player by wallet address
router.get('/:walletAddress', asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    
    // Try to get from cache first
    const cachedPlayer = await gameRedis.getPlayerSession(walletAddress);
    if (cachedPlayer) {
        return res.json(cachedPlayer);
    }
    
    // Get from database
    const result = await db.query(
        'SELECT * FROM players WHERE wallet_address = $1',
        [walletAddress]
    );
    
    if (result.rows.length === 0) {
        throw new NotFoundError('Player not found');
    }
    
    const player = result.rows[0];
    
    // Cache player data
    await gameRedis.setPlayerSession(walletAddress, player, 3600);
    
    res.json(player);
}));

// Create or update player
router.post('/', walletAuthMiddleware, asyncHandler(async (req, res) => {
    const { walletAddress, username, level, totalScore, boomTokens, lives, currentScore } = req.body;
    
    if (!walletAddress) {
        throw new ValidationError('Wallet address is required');
    }
    
    // Check if player exists
    const existingPlayer = await db.query(
        'SELECT * FROM players WHERE wallet_address = $1',
        [walletAddress]
    );
    
    if (existingPlayer.rows.length > 0) {
        // Update existing player
        const updateQuery = `
            UPDATE players 
            SET username = $1, level = $2, total_score = $3, boom_tokens = $4, 
                lives = $5, current_score = $6, last_updated = CURRENT_TIMESTAMP
            WHERE wallet_address = $7
            RETURNING *
        `;
        
        const result = await db.query(updateQuery, [
            username, level, totalScore, boomTokens, lives, currentScore, walletAddress
        ]);
        
        // Update cache
        await gameRedis.setPlayerSession(walletAddress, result.rows[0], 3600);
        
        res.json({
            success: true,
            message: 'Player updated successfully',
            player: result.rows[0]
        });
    } else {
        // Create new player
        const insertQuery = `
            INSERT INTO players 
            (wallet_address, username, level, total_score, boom_tokens, lives, current_score)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        
        const result = await db.query(insertQuery, [
            walletAddress, username, level, totalScore, boomTokens, lives, currentScore
        ]);
        
        // Register on blockchain
        if (web3Service.isConnected()) {
            await web3Service.registerPlayer(walletAddress, username);
        }
        
        // Cache player data
        await gameRedis.setPlayerSession(walletAddress, result.rows[0], 3600);
        
        res.status(201).json({
            success: true,
            message: 'Player created successfully',
            player: result.rows[0]
        });
    }
}));

// Update player progress
router.put('/:walletAddress/progress', walletAuthMiddleware, asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    const { level, totalScore, boomTokens, lives, currentScore } = req.body;
    
    const query = `
        UPDATE players 
        SET level = $1, total_score = $2, boom_tokens = $3, lives = $4, 
            current_score = $5, last_updated = CURRENT_TIMESTAMP
        WHERE wallet_address = $6
        RETURNING *
    `;
    
    const result = await db.query(query, [
        level, totalScore, boomTokens, lives, currentScore, walletAddress
    ]);
    
    if (result.rows.length === 0) {
        throw new NotFoundError('Player not found');
    }
    
    // Update blockchain
    if (web3Service.isConnected()) {
        await web3Service.updatePlayerStats(walletAddress, {
            level,
            totalScore,
            tokensEarned: boomTokens
        });
    }
    
    // Update cache
    await gameRedis.setPlayerSession(walletAddress, result.rows[0], 3600);
    
    // Update leaderboard
    await gameRedis.updateLeaderboard('score', walletAddress, totalScore, level, boomTokens);
    
    res.json({
        success: true,
        message: 'Player progress updated',
        player: result.rows[0]
    });
}));

// Get player achievements
router.get('/:walletAddress/achievements', asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    
    const result = await db.query(
        'SELECT * FROM player_achievements WHERE wallet_address = $1 ORDER BY unlocked_at DESC',
        [walletAddress]
    );
    
    res.json({
        walletAddress,
        achievements: result.rows,
        total: result.rows.length
    });
}));

// Add player achievement
router.post('/:walletAddress/achievements', walletAuthMiddleware, asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    const { achievementId, achievementName, achievementDescription, rewardTokens } = req.body;
    
    const query = `
        INSERT INTO player_achievements 
        (wallet_address, achievement_id, achievement_name, achievement_description, reward_tokens)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (wallet_address, achievement_id) DO NOTHING
        RETURNING *
    `;
    
    const result = await db.query(query, [
        walletAddress, achievementId, achievementName, achievementDescription, JSON.stringify(rewardTokens)
    ]);
    
    if (result.rows.length > 0) {
        res.status(201).json({
            success: true,
            message: 'Achievement unlocked',
            achievement: result.rows[0]
        });
    } else {
        res.json({
            success: false,
            message: 'Achievement already unlocked'
        });
    }
}));

// Get player game sessions
router.get('/:walletAddress/sessions', asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const query = `
        SELECT * FROM game_sessions 
        WHERE wallet_address = $1 
        ORDER BY session_start DESC
        LIMIT $2 OFFSET $3
    `;
    
    const result = await db.query(query, [walletAddress, limit, offset]);
    
    // Get total count
    const countResult = await db.query(
        'SELECT COUNT(*) as total FROM game_sessions WHERE wallet_address = $1',
        [walletAddress]
    );
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
        sessions: result.rows,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    });
}));

// Create game session
router.post('/:walletAddress/sessions', walletAuthMiddleware, asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    const { sessionId, gameData } = req.body;
    
    const query = `
        INSERT INTO game_sessions 
        (wallet_address, session_id, game_data)
        VALUES ($1, $2, $3)
        RETURNING *
    `;
    
    const result = await db.query(query, [
        walletAddress, sessionId, JSON.stringify(gameData)
    ]);
    
    res.status(201).json({
        success: true,
        message: 'Game session created',
        session: result.rows[0]
    });
}));

// End game session
router.put('/:walletAddress/sessions/:sessionId/end', walletAuthMiddleware, asyncHandler(async (req, res) => {
    const { walletAddress, sessionId } = req.params;
    const { scoreEarned, tokensEarned, enemiesKilled, levelsCompleted } = req.body;
    
    const query = `
        UPDATE game_sessions 
        SET session_end = CURRENT_TIMESTAMP, score_earned = $1, tokens_earned = $2,
            enemies_killed = $3, levels_completed = $4
        WHERE wallet_address = $5 AND session_id = $6
        RETURNING *
    `;
    
    const result = await db.query(query, [
        scoreEarned, JSON.stringify(tokensEarned), enemiesKilled, levelsCompleted,
        walletAddress, sessionId
    ]);
    
    if (result.rows.length === 0) {
        throw new NotFoundError('Game session not found');
    }
    
    res.json({
        success: true,
        message: 'Game session ended',
        session: result.rows[0]
    });
}));

// Search players
router.get('/search/:query', asyncHandler(async (req, res) => {
    const { query } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    
    const searchQuery = `
        SELECT * FROM players 
        WHERE wallet_address ILIKE $1 OR username ILIKE $1
        ORDER BY total_score DESC
        LIMIT $2
    `;
    
    const result = await db.query(searchQuery, [`%${query}%`, limit]);
    
    res.json({
        query,
        players: result.rows,
        total: result.rows.length
    });
}));

module.exports = router;
