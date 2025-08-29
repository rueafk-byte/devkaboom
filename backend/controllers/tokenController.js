const database = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class TokenController {
    // Process token transaction
    static async processTransaction(req, res) {
        try {
            const {
                wallet_address,
                transaction_type,
                amount,
                source,
                source_id,
                description,
                metadata,
                blockchain_tx_hash
            } = req.body;

            const db = database.getDatabase();

            // Get current player balance
            const player = await new Promise((resolve, reject) => {
                db.get('SELECT boom_tokens FROM players WHERE wallet_address = ?', [wallet_address], (err, row) => {
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

            const currentBalance = parseFloat(player.boom_tokens);
            let newBalance;

            // Calculate new balance based on transaction type
            switch (transaction_type) {
                case 'earned':
                case 'bonus':
                    newBalance = currentBalance + parseFloat(amount);
                    break;
                case 'spent':
                case 'penalty':
                    newBalance = Math.max(0, currentBalance - parseFloat(amount));
                    break;
                case 'transferred':
                    // For transfers, amount can be positive or negative
                    newBalance = Math.max(0, currentBalance + parseFloat(amount));
                    break;
                default:
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid transaction type'
                    });
            }

            const transactionId = uuidv4();

            // Start transaction
            await new Promise((resolve, reject) => {
                db.run('BEGIN TRANSACTION', (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            try {
                // Insert transaction record
                await new Promise((resolve, reject) => {
                    db.run(`
                        INSERT INTO token_transactions (
                            transaction_id, wallet_address, transaction_type, amount,
                            balance_before, balance_after, source, source_id,
                            description, metadata, blockchain_tx_hash
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        transactionId, wallet_address, transaction_type, amount,
                        currentBalance, newBalance, source, source_id,
                        description, metadata ? JSON.stringify(metadata) : null,
                        blockchain_tx_hash
                    ], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                // Update player balance
                await new Promise((resolve, reject) => {
                    db.run(`
                        UPDATE players 
                        SET boom_tokens = ?, last_updated = CURRENT_TIMESTAMP
                        WHERE wallet_address = ?
                    `, [newBalance, wallet_address], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                // Commit transaction
                await new Promise((resolve, reject) => {
                    db.run('COMMIT', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                res.status(201).json({
                    success: true,
                    message: 'Token transaction processed successfully',
                    data: {
                        transaction_id: transactionId,
                        balance_before: currentBalance,
                        balance_after: newBalance,
                        amount: parseFloat(amount)
                    }
                });

            } catch (error) {
                // Rollback on error
                await new Promise((resolve) => {
                    db.run('ROLLBACK', () => resolve());
                });
                throw error;
            }

        } catch (error) {
            console.error('Error processing token transaction:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process token transaction'
            });
        }
    }

    // Get player token balance
    static async getBalance(req, res) {
        try {
            const { walletAddress } = req.params;
            const db = database.getDatabase();

            const player = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT boom_tokens, last_updated
                    FROM players 
                    WHERE wallet_address = ?
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

            res.json({
                success: true,
                data: {
                    wallet_address: walletAddress,
                    balance: parseFloat(player.boom_tokens),
                    last_updated: player.last_updated
                }
            });

        } catch (error) {
            console.error('Error getting token balance:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve token balance'
            });
        }
    }

    // Get transaction history
    static async getTransactionHistory(req, res) {
        try {
            const { walletAddress } = req.params;
            const { 
                limit = 50, 
                offset = 0, 
                transaction_type, 
                source,
                start_date,
                end_date 
            } = req.query;

            const db = database.getDatabase();

            // Build dynamic query
            let whereClause = 'WHERE wallet_address = ?';
            const queryParams = [walletAddress];

            if (transaction_type) {
                whereClause += ' AND transaction_type = ?';
                queryParams.push(transaction_type);
            }

            if (source) {
                whereClause += ' AND source = ?';
                queryParams.push(source);
            }

            if (start_date) {
                whereClause += ' AND created_at >= ?';
                queryParams.push(start_date);
            }

            if (end_date) {
                whereClause += ' AND created_at <= ?';
                queryParams.push(end_date);
            }

            const transactions = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT 
                        transaction_id, transaction_type, amount, balance_before, 
                        balance_after, source, source_id, description, 
                        blockchain_tx_hash, is_confirmed, created_at
                    FROM token_transactions 
                    ${whereClause}
                    ORDER BY created_at DESC
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
                    FROM token_transactions 
                    ${whereClause}
                `, queryParams, (err, row) => {
                    if (err) reject(err);
                    else resolve(row.count);
                });
            });

            // Get summary statistics
            const summary = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        COALESCE(SUM(CASE WHEN transaction_type IN ('earned', 'bonus') THEN amount ELSE 0 END), 0) as total_earned,
                        COALESCE(SUM(CASE WHEN transaction_type IN ('spent', 'penalty') THEN amount ELSE 0 END), 0) as total_spent,
                        COUNT(*) as total_transactions
                    FROM token_transactions 
                    ${whereClause}
                `, queryParams, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            res.json({
                success: true,
                data: {
                    transactions,
                    summary,
                    pagination: {
                        total: totalCount,
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
                    }
                }
            });

        } catch (error) {
            console.error('Error getting transaction history:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve transaction history'
            });
        }
    }

    // Award tokens for achievement
    static async awardAchievementTokens(req, res) {
        try {
            const { wallet_address, achievement_id, tokens_awarded } = req.body;
            const db = database.getDatabase();

            // Get achievement details
            const achievement = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM achievements WHERE id = ?', [achievement_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!achievement) {
                return res.status(404).json({
                    success: false,
                    error: 'Achievement not found'
                });
            }

            // Check if already claimed
            const existingClaim = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT is_claimed FROM player_achievements 
                    WHERE wallet_address = ? AND achievement_id = ?
                `, [wallet_address, achievement_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (existingClaim?.is_claimed) {
                return res.status(409).json({
                    success: false,
                    error: 'Achievement tokens already claimed'
                });
            }

            const tokensToAward = tokens_awarded || achievement.reward_tokens;

            if (tokensToAward <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No tokens to award for this achievement'
                });
            }

            // Process token transaction
            const transactionResult = await this.processTransaction({
                body: {
                    wallet_address,
                    transaction_type: 'earned',
                    amount: tokensToAward,
                    source: 'achievement',
                    source_id: achievement_id.toString(),
                    description: `Achievement reward: ${achievement.name}`,
                    metadata: {
                        achievement_key: achievement.achievement_key,
                        achievement_name: achievement.name
                    }
                }
            }, { 
                status: () => ({ json: () => {} }),
                json: () => {}
            });

            // Mark achievement as claimed
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE player_achievements 
                    SET is_claimed = 1, claimed_at = CURRENT_TIMESTAMP
                    WHERE wallet_address = ? AND achievement_id = ?
                `, [wallet_address, achievement_id], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            res.json({
                success: true,
                message: 'Achievement tokens awarded successfully',
                data: {
                    achievement_name: achievement.name,
                    tokens_awarded: tokensToAward
                }
            });

        } catch (error) {
            console.error('Error awarding achievement tokens:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to award achievement tokens'
            });
        }
    }

    // Get token statistics
    static async getTokenStats(req, res) {
        try {
            const db = database.getDatabase();

            const stats = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        COALESCE(SUM(boom_tokens), 0) as total_tokens_in_circulation,
                        COUNT(*) as total_players_with_tokens,
                        COALESCE(AVG(boom_tokens), 0) as average_balance,
                        COALESCE(MAX(boom_tokens), 0) as highest_balance,
                        COUNT(CASE WHEN boom_tokens > 0 THEN 1 END) as players_with_positive_balance
                    FROM players 
                    WHERE is_banned = 0
                `, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            // Get transaction statistics
            const transactionStats = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        COUNT(*) as total_transactions,
                        COALESCE(SUM(CASE WHEN transaction_type IN ('earned', 'bonus') THEN amount ELSE 0 END), 0) as total_tokens_earned,
                        COALESCE(SUM(CASE WHEN transaction_type IN ('spent', 'penalty') THEN amount ELSE 0 END), 0) as total_tokens_spent,
                        COUNT(DISTINCT wallet_address) as unique_transacting_players
                    FROM token_transactions
                `, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            // Get daily transaction volume (last 30 days)
            const dailyVolume = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as transaction_count,
                        COALESCE(SUM(amount), 0) as volume
                    FROM token_transactions
                    WHERE created_at >= datetime('now', '-30 days')
                    GROUP BY DATE(created_at)
                    ORDER BY date DESC
                `, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            // Get top token holders
            const topHolders = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT username, boom_tokens, level, player_rank
                    FROM players
                    WHERE is_banned = 0 AND boom_tokens > 0
                    ORDER BY boom_tokens DESC
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
                    ...transactionStats,
                    daily_volume: dailyVolume,
                    top_holders: topHolders
                }
            });

        } catch (error) {
            console.error('Error getting token statistics:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve token statistics'
            });
        }
    }

    // Admin: Grant tokens to player
    static async grantTokens(req, res) {
        try {
            const { wallet_address, amount, reason } = req.body;
            const adminWallet = req.user?.wallet_address || 'admin';

            if (amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Amount must be positive'
                });
            }

            // Process transaction
            const result = await this.processTransaction({
                body: {
                    wallet_address,
                    transaction_type: 'bonus',
                    amount,
                    source: 'admin',
                    description: `Admin grant: ${reason || 'No reason provided'}`,
                    metadata: {
                        admin_wallet: adminWallet,
                        grant_reason: reason
                    }
                }
            }, res);

            // Log admin action
            const db = database.getDatabase();
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO admin_actions (
                        admin_wallet, action_type, target_wallet, 
                        action_details, new_values, reason
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    adminWallet,
                    'grant_tokens',
                    wallet_address,
                    `Granted ${amount} tokens`,
                    JSON.stringify({ tokens_granted: amount }),
                    reason || 'No reason provided'
                ], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

        } catch (error) {
            console.error('Error granting tokens:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to grant tokens'
            });
        }
    }

    // Admin: Revoke tokens from player
    static async revokeTokens(req, res) {
        try {
            const { wallet_address, amount, reason } = req.body;
            const adminWallet = req.user?.wallet_address || 'admin';

            if (amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Amount must be positive'
                });
            }

            // Process transaction
            await this.processTransaction({
                body: {
                    wallet_address,
                    transaction_type: 'penalty',
                    amount,
                    source: 'admin',
                    description: `Admin revoke: ${reason || 'No reason provided'}`,
                    metadata: {
                        admin_wallet: adminWallet,
                        revoke_reason: reason
                    }
                }
            }, res);

            // Log admin action
            const db = database.getDatabase();
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO admin_actions (
                        admin_wallet, action_type, target_wallet, 
                        action_details, new_values, reason
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    adminWallet,
                    'revoke_tokens',
                    wallet_address,
                    `Revoked ${amount} tokens`,
                    JSON.stringify({ tokens_revoked: amount }),
                    reason || 'No reason provided'
                ], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

        } catch (error) {
            console.error('Error revoking tokens:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to revoke tokens'
            });
        }
    }
}

module.exports = TokenController;
