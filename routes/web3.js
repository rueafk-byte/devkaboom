const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { game: gameRedis } = require('../config/redis');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { walletAuthMiddleware } = require('../middleware/auth');
const Web3Service = require('../services/web3Service');
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

// Initialize Web3 service
const web3Service = new Web3Service();

// Get blockchain status
router.get('/status', asyncHandler(async (req, res) => {
    const status = {
        connected: web3Service.isConnected(),
        network: process.env.SOLANA_NETWORK || 'unknown',
        rpcUrl: process.env.SOLANA_RPC_URL,
        contracts: web3Service.getContractAddresses(),
        health: await web3Service.healthCheck()
    };
    
    res.json({
        success: true,
        status
    });
}));

// Get wallet balance
router.get('/wallet/:walletAddress/balance', asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    
    if (!web3Service.isConnected()) {
        throw new Error('Web3 service not connected');
    }
    
    // Get SOL balance
    const solBalance = await web3Service.getSolBalance(walletAddress);
    
    // Get token balances
    const contractAddresses = web3Service.getContractAddresses();
    const tokenBalances = {};
    
    if (contractAddresses.boomToken) {
        tokenBalances.boom = await web3Service.getTokenBalance(walletAddress, contractAddresses.boomToken);
    }
    
    if (contractAddresses.pirateToken) {
        tokenBalances.pirate = await web3Service.getTokenBalance(walletAddress, contractAddresses.pirateToken);
    }
    
    if (contractAddresses.admiralToken) {
        tokenBalances.admiral = await web3Service.getTokenBalance(walletAddress, contractAddresses.admiralToken);
    }
    
    // Cache token balances
    for (const [tokenType, balance] of Object.entries(tokenBalances)) {
        await gameRedis.cacheTokenBalance(walletAddress, tokenType, balance);
    }
    
    res.json({
        success: true,
        walletAddress,
        balances: {
            sol: solBalance,
            tokens: tokenBalances
        }
    });
}));

// Get cached token balance
router.get('/wallet/:walletAddress/tokens/:tokenType', asyncHandler(async (req, res) => {
    const { walletAddress, tokenType } = req.params;
    
    if (!['boom', 'pirate', 'admiral'].includes(tokenType)) {
        throw new ValidationError('Invalid token type');
    }
    
    // Try cache first
    const cachedBalance = await gameRedis.getTokenBalance(walletAddress, tokenType);
    
    if (cachedBalance !== null) {
        return res.json({
            success: true,
            walletAddress,
            tokenType,
            balance: cachedBalance,
            source: 'cache'
        });
    }
    
    // Get from blockchain
    const contractAddresses = web3Service.getContractAddresses();
    const tokenAddress = contractAddresses[`${tokenType}Token`];
    
    if (!tokenAddress) {
        throw new Error(`Token contract not configured for ${tokenType}`);
    }
    
    const balance = await web3Service.getTokenBalance(walletAddress, tokenAddress);
    
    // Cache the balance
    await gameRedis.cacheTokenBalance(walletAddress, tokenType, balance);
    
    res.json({
        success: true,
        walletAddress,
        tokenType,
        balance,
        source: 'blockchain'
    });
}));

// Register player on blockchain
router.post('/register', walletAuthMiddleware, asyncHandler(async (req, res) => {
    const { walletAddress, username } = req.body;
    
    if (!walletAddress || !username) {
        throw new ValidationError('Wallet address and username are required');
    }
    
    if (!web3Service.isConnected()) {
        throw new Error('Web3 service not connected');
    }
    
    // Check if player already exists in database
    const existingPlayer = await db.query(`
        SELECT * FROM players WHERE wallet_address = $1
    `, [walletAddress]);
    
    if (existingPlayer.rows.length > 0) {
        return res.json({
            success: false,
            message: 'Player already registered',
            player: existingPlayer.rows[0]
        });
    }
    
    // Register on blockchain
    const registrationResult = await web3Service.registerPlayer(walletAddress, username);
    
    if (!registrationResult.success) {
        throw new Error(`Registration failed: ${registrationResult.error}`);
    }
    
    // Create player in database
    const insertQuery = `
        INSERT INTO players 
        (wallet_address, username, level, total_score, boom_tokens, lives, current_score)
        VALUES ($1, $2, 1, 0, 0, 3, 0)
        RETURNING *
    `;
    
    const result = await db.query(insertQuery, [walletAddress, username]);
    
    // Log transaction
    await db.query(`
        INSERT INTO blockchain_transactions 
        (wallet_address, transaction_hash, transaction_type, status, timestamp)
        VALUES ($1, $2, $3, $4, $5)
    `, [walletAddress, registrationResult.transactionHash, 'PLAYER_REGISTRATION', 'completed', new Date()]);
    
    res.status(201).json({
        success: true,
        message: 'Player registered successfully',
        player: result.rows[0],
        transactionHash: registrationResult.transactionHash
    });
}));

// Get player profile from blockchain
router.get('/player/:walletAddress/profile', asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    
    if (!web3Service.isConnected()) {
        throw new Error('Web3 service not connected');
    }
    
    const profile = await web3Service.getPlayerProfile(walletAddress);
    
    if (!profile) {
        throw new NotFoundError('Player profile not found on blockchain');
    }
    
    res.json({
        success: true,
        profile
    });
}));

// Process level completion reward
router.post('/reward/level-completion', walletAuthMiddleware, asyncHandler(async (req, res) => {
    const { walletAddress, level, score, enemiesKilled, powerUpsCollected, completionTime, difficulty } = req.body;
    
    if (!walletAddress || !level || !score) {
        throw new ValidationError('Wallet address, level, and score are required');
    }
    
    if (!web3Service.isConnected()) {
        throw new Error('Web3 service not connected');
    }
    
    // Calculate rewards
    const baseReward = level * 10;
    const scoreBonus = Math.floor(score / 1000);
    const enemyBonus = enemiesKilled * 2;
    const powerUpBonus = powerUpsCollected * 5;
    const timeBonus = Math.max(0, 60 - completionTime) * 2;
    const difficultyMultiplier = difficulty === 'hard' ? 1.5 : difficulty === 'easy' ? 0.8 : 1;
    
    const totalReward = Math.floor((baseReward + scoreBonus + enemyBonus + powerUpBonus + timeBonus) * difficultyMultiplier);
    
    // Process reward on blockchain
    const rewardResult = await web3Service.processLevelReward(walletAddress, level, score, { boom: totalReward });
    
    if (!rewardResult.success) {
        throw new Error(`Reward processing failed: ${rewardResult.error}`);
    }
    
    // Update player stats in database
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
        
        // Update cache
        await gameRedis.cacheTokenBalance(walletAddress, 'boom', newBoomTokens);
    }
    
    // Log transaction
    await db.query(`
        INSERT INTO blockchain_transactions 
        (wallet_address, transaction_hash, transaction_type, token_type, amount, status, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [walletAddress, rewardResult.transactionHash, 'LEVEL_REWARD', 'boom', totalReward, 'completed', new Date()]);
    
    res.json({
        success: true,
        message: 'Level reward processed successfully',
        reward: {
            boom: totalReward,
            level: level,
            score: score
        },
        transactionHash: rewardResult.transactionHash
    });
}));

// Get transaction history
router.get('/transactions/:walletAddress', asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const result = await db.query(`
        SELECT * FROM blockchain_transactions 
        WHERE wallet_address = $1
        ORDER BY timestamp DESC
        LIMIT $2 OFFSET $3
    `, [walletAddress, limit, offset]);
    
    // Get total count
    const countResult = await db.query(`
        SELECT COUNT(*) as total FROM blockchain_transactions WHERE wallet_address = $1
    `, [walletAddress]);
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
        success: true,
        transactions: result.rows,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    });
}));

// Verify wallet signature
router.post('/verify-signature', asyncHandler(async (req, res) => {
    const { walletAddress, signature, message } = req.body;
    
    if (!walletAddress || !signature) {
        throw new ValidationError('Wallet address and signature are required');
    }
    
    const isValid = await web3Service.verifySignature(walletAddress, signature, message);
    
    res.json({
        success: true,
        isValid,
        walletAddress,
        message: message || 'Kaboom Game Authentication'
    });
}));

// Get contract addresses
router.get('/contracts', asyncHandler(async (req, res) => {
    const contracts = web3Service.getContractAddresses();
    
    res.json({
        success: true,
        contracts,
        network: process.env.SOLANA_NETWORK || 'unknown'
    });
}));

// Get blockchain network info
router.get('/network', asyncHandler(async (req, res) => {
    if (!web3Service.isConnected()) {
        throw new Error('Web3 service not connected');
    }
    
    const connection = web3Service.connection;
    const version = await connection.getVersion();
    const slot = await connection.getSlot();
    const blockTime = await connection.getBlockTime(slot);
    
    res.json({
        success: true,
        network: {
            name: process.env.SOLANA_NETWORK || 'unknown',
            rpcUrl: process.env.SOLANA_RPC_URL,
            version: version,
            currentSlot: slot,
            blockTime: blockTime,
            timestamp: new Date().toISOString()
        }
    });
}));

// Get token metadata
router.get('/tokens/:tokenType/metadata', asyncHandler(async (req, res) => {
    const { tokenType } = req.params;
    
    if (!['boom', 'pirate', 'admiral'].includes(tokenType)) {
        throw new ValidationError('Invalid token type');
    }
    
    const contractAddresses = web3Service.getContractAddresses();
    const tokenAddress = contractAddresses[`${tokenType}Token`];
    
    if (!tokenAddress) {
        throw new Error(`Token contract not configured for ${tokenType}`);
    }
    
    const metadata = {
        name: `${tokenType.toUpperCase()} Token`,
        symbol: tokenType.toUpperCase(),
        address: tokenAddress,
        decimals: 9,
        totalSupply: tokenType === 'boom' ? 1000000000 : tokenType === 'pirate' ? 1000000000 : 10000000,
        description: `${tokenType.toUpperCase()} tokens earned through gameplay`,
        network: process.env.SOLANA_NETWORK || 'unknown'
    };
    
    res.json({
        success: true,
        metadata
    });
}));

// Get recent blockchain transactions
router.get('/transactions/recent', asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    
    const result = await db.query(`
        SELECT * FROM blockchain_transactions 
        ORDER BY timestamp DESC
        LIMIT $1
    `, [limit]);
    
    res.json({
        success: true,
        transactions: result.rows
    });
}));

// Get transaction statistics
router.get('/transactions/stats', asyncHandler(async (req, res) => {
    const stats = await db.query(`
        SELECT 
            COUNT(*) as total_transactions,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_transactions,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
            SUM(CASE WHEN token_type = 'boom' THEN amount ELSE 0 END) as total_boom_tokens,
            SUM(CASE WHEN token_type = 'pirate' THEN amount ELSE 0 END) as total_pirate_tokens,
            SUM(CASE WHEN token_type = 'admiral' THEN amount ELSE 0 END) as total_admiral_tokens,
            COUNT(CASE WHEN transaction_type = 'LEVEL_REWARD' THEN 1 END) as level_rewards,
            COUNT(CASE WHEN transaction_type = 'PLAYER_REGISTRATION' THEN 1 END) as registrations
        FROM blockchain_transactions
    `);
    
    res.json({
        success: true,
        stats: stats.rows[0]
    });
}));

module.exports = router;
