const db = require('../config/database');
const { game: gameRedis } = require('../config/redis');
const Web3Service = require('./web3Service');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

class GameService {
    constructor() {
        this.web3Service = new Web3Service();
        
        // Initialize logger
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'game-service' },
            transports: [
                new winston.transports.File({ filename: 'logs/game.log' })
            ]
        });
    }

    // Create new game session
    async createSession(walletAddress, level, difficulty = 'normal', gameMode = 'standard') {
        try {
            const sessionId = uuidv4();
            const sessionData = {
                sessionId,
                walletAddress,
                level: parseInt(level),
                difficulty,
                gameMode,
                startTime: new Date(),
                score: 0,
                lives: 3,
                bombs: 3,
                enemiesKilled: 0,
                powerUpsCollected: 0,
                gameState: 'active',
                position: { x: 0, y: 0 }
            };

            // Save to database
            await db.query(`
                INSERT INTO game_sessions 
                (wallet_address, session_id, game_data)
                VALUES ($1, $2, $3)
            `, [walletAddress, sessionId, JSON.stringify(sessionData)]);

            // Cache session
            await gameRedis.setPlayerSession(walletAddress, sessionData, 3600);

            this.logger.info('Game session created', { sessionId, walletAddress, level });

            return {
                success: true,
                sessionId,
                sessionData
            };
        } catch (error) {
            this.logger.error('Failed to create game session', { error: error.message, walletAddress });
            throw error;
        }
    }

    // Update game state
    async updateGameState(sessionId, walletAddress, gameState) {
        try {
            const { score, lives, bombs, enemiesKilled, powerUpsCollected, position, gameState: state } = gameState;

            const updateData = {
                score: parseInt(score) || 0,
                lives: parseInt(lives) || 3,
                bombs: parseInt(bombs) || 3,
                enemiesKilled: parseInt(enemiesKilled) || 0,
                powerUpsCollected: parseInt(powerUpsCollected) || 0,
                position: position || { x: 0, y: 0 },
                gameState: state || 'active',
                lastUpdate: new Date()
            };

            // Update database
            await db.query(`
                UPDATE game_sessions 
                SET game_data = $1
                WHERE session_id = $2 AND wallet_address = $3
            `, [JSON.stringify(updateData), sessionId, walletAddress]);

            // Update cache
            await gameRedis.setPlayerSession(walletAddress, updateData, 3600);

            return {
                success: true,
                sessionData: updateData
            };
        } catch (error) {
            this.logger.error('Failed to update game state', { error: error.message, sessionId });
            throw error;
        }
    }

    // Complete level
    async completeLevel(sessionId, walletAddress, completionData) {
        try {
            const { level, score, enemiesKilled, powerUpsCollected, completionTime, difficulty } = completionData;

            // Calculate rewards
            const rewards = this.calculateRewards(level, score, enemiesKilled, powerUpsCollected, completionTime, difficulty);

            // End session
            await db.query(`
                UPDATE game_sessions 
                SET session_end = CURRENT_TIMESTAMP, score_earned = $1, tokens_earned = $2,
                    enemies_killed = $3, levels_completed = 1, game_data = $4
                WHERE session_id = $5 AND wallet_address = $6
            `, [score, JSON.stringify(rewards), enemiesKilled, JSON.stringify({ completed: true }), sessionId, walletAddress]);

            // Update player stats
            const playerResult = await db.query(`
                SELECT * FROM players WHERE wallet_address = $1
            `, [walletAddress]);

            if (playerResult.rows.length > 0) {
                const player = playerResult.rows[0];
                const newLevel = Math.max(player.level, level + 1);
                const newTotalScore = player.total_score + score;
                const newBoomTokens = player.boom_tokens + rewards.boom;

                await db.query(`
                    UPDATE players 
                    SET level = $1, total_score = $2, boom_tokens = $3, last_updated = CURRENT_TIMESTAMP
                    WHERE wallet_address = $4
                `, [newLevel, newTotalScore, newBoomTokens, walletAddress]);

                // Process blockchain rewards
                if (this.web3Service.isConnected()) {
                    await this.web3Service.processLevelReward(walletAddress, level, score, rewards);
                }

                // Update leaderboard
                await gameRedis.updateLeaderboard('score', walletAddress, newTotalScore, newLevel, newBoomTokens);

                // Check for achievements
                const achievements = await this.checkAchievements(walletAddress, newLevel, newTotalScore, newBoomTokens);

                this.logger.info('Level completed', { 
                    sessionId, walletAddress, level, score, rewards, achievements 
                });

                return {
                    success: true,
                    rewards,
                    newStats: {
                        level: newLevel,
                        totalScore: newTotalScore,
                        boomTokens: newBoomTokens
                    },
                    achievements
                };
            }

            return {
                success: false,
                error: 'Player not found'
            };
        } catch (error) {
            this.logger.error('Failed to complete level', { error: error.message, sessionId });
            throw error;
        }
    }

    // Calculate rewards based on performance
    calculateRewards(level, score, enemiesKilled, powerUpsCollected, completionTime, difficulty) {
        const baseReward = level * 10;
        const scoreBonus = Math.floor(score / 1000);
        const enemyBonus = enemiesKilled * 2;
        const powerUpBonus = powerUpsCollected * 5;
        const timeBonus = Math.max(0, 60 - completionTime) * 2;
        const difficultyMultiplier = difficulty === 'hard' ? 1.5 : difficulty === 'easy' ? 0.8 : 1;

        const totalReward = Math.floor((baseReward + scoreBonus + enemyBonus + powerUpBonus + timeBonus) * difficultyMultiplier);

        return {
            boom: totalReward,
            pirate: Math.floor(totalReward * 0.1), // 10% of boom tokens
            admiral: Math.floor(totalReward * 0.05) // 5% of boom tokens
        };
    }

    // Check for achievements
    async checkAchievements(walletAddress, level, totalScore, boomTokens) {
        const achievements = [];

        // First win achievement
        const firstWinResult = await db.query(`
            SELECT COUNT(*) as count FROM game_sessions 
            WHERE wallet_address = $1 AND levels_completed > 0
        `, [walletAddress]);

        if (parseInt(firstWinResult.rows[0].count) === 1) {
            achievements.push({
                id: 'first_win',
                name: 'First Victory',
                description: 'Complete your first level',
                rewardTokens: { boom: 50 }
            });
        }

        // Score milestone achievements
        if (totalScore >= 10000 && totalScore < 20000) {
            achievements.push({
                id: 'score_10k',
                name: 'Score Master',
                description: 'Reach 10,000 total score',
                rewardTokens: { boom: 100 }
            });
        }

        if (totalScore >= 50000) {
            achievements.push({
                id: 'score_50k',
                name: 'Score Legend',
                description: 'Reach 50,000 total score',
                rewardTokens: { boom: 500 }
            });
        }

        // Level achievements
        if (level >= 10) {
            achievements.push({
                id: 'level_10',
                name: 'Level 10 Master',
                description: 'Reach level 10',
                rewardTokens: { boom: 200 }
            });
        }

        if (level >= 20) {
            achievements.push({
                id: 'level_20',
                name: 'Level 20 Master',
                description: 'Reach level 20',
                rewardTokens: { boom: 500 }
            });
        }

        // Token achievements
        if (boomTokens >= 1000) {
            achievements.push({
                id: 'tokens_1k',
                name: 'Token Collector',
                description: 'Collect 1,000 BOOM tokens',
                rewardTokens: { boom: 100 }
            });
        }

        // Save achievements to database
        for (const achievement of achievements) {
            await db.query(`
                INSERT INTO player_achievements 
                (wallet_address, achievement_id, achievement_name, achievement_description, reward_tokens)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (wallet_address, achievement_id) DO NOTHING
            `, [walletAddress, achievement.id, achievement.name, achievement.description, JSON.stringify(achievement.rewardTokens)]);
        }

        return achievements;
    }

    // Get player statistics
    async getPlayerStats(walletAddress) {
        try {
            // Get player data
            const playerResult = await db.query(`
                SELECT * FROM players WHERE wallet_address = $1
            `, [walletAddress]);

            if (playerResult.rows.length === 0) {
                throw new Error('Player not found');
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

            return {
                player,
                statistics: statsResult.rows[0],
                achievements: achievementsResult.rows,
                recentSessions: sessionsResult.rows
            };
        } catch (error) {
            this.logger.error('Failed to get player stats', { error: error.message, walletAddress });
            throw error;
        }
    }

    // Get game configuration
    getGameConfig() {
        return {
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
    }

    // Validate game state
    validateGameState(gameState) {
        const required = ['score', 'lives', 'bombs', 'enemiesKilled', 'powerUpsCollected'];
        
        for (const field of required) {
            if (typeof gameState[field] !== 'number' || gameState[field] < 0) {
                throw new Error(`Invalid ${field}: must be a non-negative number`);
            }
        }

        if (gameState.lives > 3) {
            throw new Error('Lives cannot exceed 3');
        }

        if (gameState.bombs > 3) {
            throw new Error('Bombs cannot exceed 3');
        }

        return true;
    }

    // Get active sessions for a player
    async getActiveSessions(walletAddress) {
        try {
            const result = await db.query(`
                SELECT * FROM game_sessions 
                WHERE wallet_address = $1 AND session_end IS NULL
                ORDER BY session_start DESC
            `, [walletAddress]);

            return result.rows;
        } catch (error) {
            this.logger.error('Failed to get active sessions', { error: error.message, walletAddress });
            throw error;
        }
    }

    // End game session
    async endSession(sessionId, walletAddress, finalData) {
        try {
            const { finalScore, enemiesKilled, powerUpsCollected, gameTime } = finalData;

            await db.query(`
                UPDATE game_sessions 
                SET session_end = CURRENT_TIMESTAMP, score_earned = $1, enemies_killed = $2,
                    game_data = $3
                WHERE session_id = $4 AND wallet_address = $5
            `, [finalScore, enemiesKilled, JSON.stringify({ gameOver: true, gameTime }), sessionId, walletAddress]);

            // Clear cache
            await gameRedis.del(`session:${walletAddress}`);

            this.logger.info('Game session ended', { sessionId, walletAddress, finalScore });

            return {
                success: true,
                message: 'Session ended successfully'
            };
        } catch (error) {
            this.logger.error('Failed to end session', { error: error.message, sessionId });
            throw error;
        }
    }
}

module.exports = GameService;
