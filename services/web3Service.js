const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { Provider, Program, web3 } = require('@project-serum/anchor');
const bs58 = require('bs58');
const winston = require('winston');

class Web3Service {
    constructor() {
        this.connection = null;
        this.provider = null;
        this.program = null;
        this.isInitialized = false;
        this.contractAddresses = {};
        this.isMock = false;
        
        // Initialize logger
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'web3-service' },
            transports: [
                new winston.transports.File({ filename: 'logs/web3.log' })
            ]
        });
    }

    async initialize() {
        try {
            // Initialize Solana connection
            const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
            const wsUrl = process.env.SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com';
            
            this.connection = new Connection(rpcUrl, {
                wsEndpoint: wsUrl,
                commitment: 'confirmed'
            });

            // Test connection
            const version = await this.connection.getVersion();
            this.logger.info('Solana connection established', { version });

            // Load contract addresses
            this.contractAddresses = {
                boomToken: process.env.BOOM_TOKEN_ADDRESS,
                pirateToken: process.env.PIRATE_TOKEN_ADDRESS,
                admiralToken: process.env.ADMIRAL_TOKEN_ADDRESS,
                playerRegistry: process.env.PLAYER_REGISTRY_ADDRESS
            };

            // Initialize provider (for Anchor programs)
            this.provider = new Provider(
                this.connection,
                null, // We'll use a dummy wallet for read operations
                { commitment: 'confirmed' }
            );

            // Load player registry program
            if (this.contractAddresses.playerRegistry) {
                try {
                    const playerRegistryIdl = require('../contracts/idl/player-registry.json');
                    this.program = new Program(
                        playerRegistryIdl,
                        new PublicKey(this.contractAddresses.playerRegistry),
                        this.provider
                    );
                } catch (error) {
                    this.logger.warn('Failed to load player registry program:', error.message);
                }
            }

            this.isInitialized = true;
            this.logger.info('Web3 service initialized successfully');
            
        } catch (error) {
            this.logger.warn('Failed to initialize Web3 service, using mock mode:', error.message);
            this.isMock = true;
            this.isInitialized = true;
            this.logger.info('Web3 service running in mock mode');
        }
    }

    isConnected() {
        return this.isInitialized && (this.connection !== null || this.isMock);
    }

    // Verify wallet signature
    async verifySignature(walletAddress, signature, message = 'Kaboom Game Authentication') {
        if (this.isMock) {
            this.logger.info('Mock signature verification', { walletAddress, isValid: true });
            return true; // Mock always returns true
        }

        try {
            const publicKey = new PublicKey(walletAddress);
            const signatureBytes = bs58.decode(signature);
            const messageBytes = new TextEncoder().encode(message);
            
            const isValid = await this.connection.verifyMessage(
                messageBytes,
                signatureBytes,
                publicKey
            );
            
            this.logger.info('Signature verification result', { 
                walletAddress, 
                isValid 
            });
            
            return isValid;
        } catch (error) {
            this.logger.error('Signature verification failed:', error);
            return false;
        }
    }

    // Get token balance
    async getTokenBalance(walletAddress, tokenMintAddress) {
        try {
            const walletPublicKey = new PublicKey(walletAddress);
            const tokenMintPublicKey = new PublicKey(tokenMintAddress);
            
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
                walletPublicKey,
                { mint: tokenMintPublicKey }
            );
            
            if (tokenAccounts.value.length === 0) {
                return 0;
            }
            
            const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
            return balance || 0;
            
        } catch (error) {
            this.logger.error('Failed to get token balance:', error);
            return 0;
        }
    }

    // Get SOL balance
    async getSolBalance(walletAddress) {
        try {
            const publicKey = new PublicKey(walletAddress);
            const balance = await this.connection.getBalance(publicKey);
            return balance / LAMPORTS_PER_SOL;
        } catch (error) {
            this.logger.error('Failed to get SOL balance:', error);
            return 0;
        }
    }

    // Process level completion reward
    async processLevelReward(walletAddress, level, score, tokensEarned) {
        try {
            this.logger.info('Processing level reward', {
                walletAddress,
                level,
                score,
                tokensEarned
            });

            // Calculate rewards based on level and score
            const baseReward = level * 10; // 10 tokens per level
            const scoreBonus = Math.floor(score / 1000); // 1 token per 1000 score
            const totalReward = baseReward + scoreBonus;

            // Update player stats on blockchain
            if (this.program) {
                await this.updatePlayerStats(walletAddress, {
                    level: level,
                    totalScore: score,
                    tokensEarned: totalReward
                });
            }

            // Log transaction
            await this.logTransaction(walletAddress, 'LEVEL_REWARD', {
                level: level,
                score: score,
                tokensEarned: totalReward
            });

            return {
                success: true,
                reward: totalReward,
                transactionHash: 'simulated_transaction_hash',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Failed to process level reward:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Update player stats on blockchain
    async updatePlayerStats(walletAddress, stats) {
        try {
            if (!this.program) {
                throw new Error('Player registry program not initialized');
            }

            const playerPublicKey = new PublicKey(walletAddress);
            
            // Create or update player profile
            const playerProfile = await this.program.account.playerProfile.fetch(playerPublicKey);
            
            if (playerProfile) {
                // Update existing profile
                await this.program.rpc.updatePlayerStats(
                    stats.level,
                    stats.totalScore,
                    stats.tokensEarned,
                    {
                        accounts: {
                            player: playerPublicKey,
                            authority: playerPublicKey
                        }
                    }
                );
            } else {
                // Create new profile
                await this.program.rpc.createPlayerProfile(
                    stats.level,
                    stats.totalScore,
                    stats.tokensEarned,
                    {
                        accounts: {
                            player: playerPublicKey,
                            authority: playerPublicKey,
                            systemProgram: SystemProgram.programId
                        }
                    }
                );
            }

            this.logger.info('Player stats updated on blockchain', {
                walletAddress,
                stats
            });

        } catch (error) {
            this.logger.error('Failed to update player stats:', error);
            throw error;
        }
    }

    // Register player on blockchain
    async registerPlayer(walletAddress, username) {
        try {
            if (!this.program) {
                throw new Error('Player registry program not initialized');
            }

            const playerPublicKey = new PublicKey(walletAddress);
            
            await this.program.rpc.registerPlayer(
                username,
                {
                    accounts: {
                        player: playerPublicKey,
                        authority: playerPublicKey,
                        systemProgram: SystemProgram.programId
                    }
                }
            );

            this.logger.info('Player registered on blockchain', {
                walletAddress,
                username
            });

            return {
                success: true,
                transactionHash: 'simulated_transaction_hash'
            };

        } catch (error) {
            this.logger.error('Failed to register player:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get player profile from blockchain
    async getPlayerProfile(walletAddress) {
        try {
            if (!this.program) {
                throw new Error('Player registry program not initialized');
            }

            const playerPublicKey = new PublicKey(walletAddress);
            const profile = await this.program.account.playerProfile.fetch(playerPublicKey);
            
            return {
                walletAddress: walletAddress,
                username: profile.username,
                level: profile.level,
                totalScore: profile.totalScore,
                tokensEarned: profile.tokensEarned,
                achievements: profile.achievements || [],
                createdAt: profile.createdAt
            };

        } catch (error) {
            this.logger.error('Failed to get player profile:', error);
            return null;
        }
    }

    // Log blockchain transaction
    async logTransaction(walletAddress, transactionType, details) {
        try {
            const db = require('../config/database');
            
            await db.query(`
                INSERT INTO blockchain_transactions 
                (wallet_address, transaction_hash, transaction_type, amount, status, timestamp)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                walletAddress,
                `simulated_${Date.now()}`,
                transactionType,
                details.tokensEarned || 0,
                'completed',
                new Date()
            ]);

        } catch (error) {
            this.logger.error('Failed to log transaction:', error);
        }
    }

    // Get contract addresses
    getContractAddresses() {
        return this.contractAddresses;
    }

    // Health check
    async healthCheck() {
        try {
            const version = await this.connection.getVersion();
            return {
                status: 'healthy',
                solanaVersion: version,
                contractsLoaded: Object.keys(this.contractAddresses).length,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = Web3Service;
