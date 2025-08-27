// Enhanced Game Integration for Web3 Backend
class GameIntegration {
    constructor() {
        this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
        this.socket = null;
        this.currentSession = null;
        this.playerData = null;
        this.isConnected = false;
        this.walletAddress = null;
        this.signature = null;
        
        // Game state
        this.gameState = {
            score: 0,
            lives: 3,
            bombs: 3,
            enemiesKilled: 0,
            powerUpsCollected: 0,
            position: { x: 0, y: 0 },
            gameState: 'inactive'
        };
        
        // Initialize
        this.init();
    }

    async init() {
        try {
            // Initialize WebSocket connection
            await this.initWebSocket();
            
            // Initialize wallet connection
            await this.initWalletConnection();
            
            // Load game configuration
            await this.loadGameConfig();
            
            console.log('Game integration initialized successfully');
        } catch (error) {
            console.error('Failed to initialize game integration:', error);
        }
    }

    async initWebSocket() {
        try {
            // Connect to WebSocket server
            this.socket = io(this.backendUrl);
            
            this.socket.on('connect', () => {
                console.log('Connected to game server');
                this.isConnected = true;
            });
            
            this.socket.on('disconnect', () => {
                console.log('Disconnected from game server');
                this.isConnected = false;
            });
            
            this.socket.on('playerUpdate', (data) => {
                this.handlePlayerUpdate(data);
            });
            
            this.socket.on('levelRewardProcessed', (result) => {
                this.handleLevelReward(result);
            });
            
            this.socket.on('achievementUnlocked', (achievement) => {
                this.handleAchievementUnlocked(achievement);
            });
            
            this.socket.on('leaderboardUpdate', (data) => {
                this.handleLeaderboardUpdate(data);
            });
            
        } catch (error) {
            console.error('WebSocket initialization failed:', error);
        }
    }

    async initWalletConnection() {
        try {
            // Check if wallet is connected
            if (typeof window.solana !== 'undefined' && window.solana.isPhantom) {
                const response = await window.solana.connect();
                this.walletAddress = response.publicKey.toString();
                
                // Generate signature for authentication
                const message = 'Kaboom Game Authentication - ' + Date.now();
                const encodedMessage = new TextEncoder().encode(message);
                const signedMessage = await window.solana.signMessage(encodedMessage, 'utf8');
                this.signature = Array.from(signedMessage.signature);
                
                // Authenticate with backend
                await this.authenticateWallet();
                
                console.log('Wallet connected:', this.walletAddress);
            } else {
                console.log('Phantom wallet not detected');
            }
        } catch (error) {
            console.error('Wallet connection failed:', error);
        }
    }

    async authenticateWallet() {
        try {
            const response = await fetch(`${this.backendUrl}/api/web3/verify-signature`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    walletAddress: this.walletAddress,
                    signature: this.signature,
                    message: 'Kaboom Game Authentication'
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Authenticate WebSocket
                this.socket.emit('authenticate', {
                    walletAddress: this.walletAddress,
                    signature: this.signature
                });
                
                // Load player data
                await this.loadPlayerData();
            }
        } catch (error) {
            console.error('Wallet authentication failed:', error);
        }
    }

    async loadPlayerData() {
        try {
            const response = await fetch(`${this.backendUrl}/api/players/${this.walletAddress}`);
            const result = await response.json();
            
            if (result.success) {
                this.playerData = result.player;
                this.updateUI();
            } else {
                // Player doesn't exist, create new player
                await this.createPlayer();
            }
        } catch (error) {
            console.error('Failed to load player data:', error);
        }
    }

    async createPlayer() {
        try {
            const username = `Player_${this.walletAddress.slice(0, 8)}`;
            
            const response = await fetch(`${this.backendUrl}/api/players`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    walletAddress: this.walletAddress,
                    username: username,
                    level: 1,
                    totalScore: 0,
                    boomTokens: 0,
                    lives: 3,
                    currentScore: 0
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.playerData = result.player;
                this.updateUI();
            }
        } catch (error) {
            console.error('Failed to create player:', error);
        }
    }

    async loadGameConfig() {
        try {
            const response = await fetch(`${this.backendUrl}/api/game/config`);
            const result = await response.json();
            
            if (result.success) {
                window.gameConfig = result.config;
                console.log('Game configuration loaded');
            }
        } catch (error) {
            console.error('Failed to load game config:', error);
        }
    }

    async startGameSession(level, difficulty = 'normal', gameMode = 'standard') {
        try {
            const response = await fetch(`${this.backendUrl}/api/game/session/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    walletAddress: this.walletAddress,
                    level: level,
                    difficulty: difficulty,
                    gameMode: gameMode
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.currentSession = result.sessionData;
                this.gameState = {
                    score: 0,
                    lives: 3,
                    bombs: 3,
                    enemiesKilled: 0,
                    powerUpsCollected: 0,
                    position: { x: 0, y: 0 },
                    gameState: 'active'
                };
                
                // Emit WebSocket event
                this.socket.emit('gameSessionStarted', {
                    sessionId: this.currentSession.sessionId,
                    walletAddress: this.walletAddress,
                    level: level
                });
                
                console.log('Game session started:', this.currentSession.sessionId);
                return this.currentSession;
            }
        } catch (error) {
            console.error('Failed to start game session:', error);
        }
    }

    async updateGameState(gameState) {
        try {
            if (!this.currentSession) return;
            
            // Update local state
            this.gameState = { ...this.gameState, ...gameState };
            
            // Send to backend
            const response = await fetch(`${this.backendUrl}/api/game/session/${this.currentSession.sessionId}/update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    walletAddress: this.walletAddress,
                    ...this.gameState
                })
            });
            
            // Emit WebSocket event
            this.socket.emit('gameStateUpdate', {
                sessionId: this.currentSession.sessionId,
                walletAddress: this.walletAddress,
                gameState: this.gameState
            });
            
        } catch (error) {
            console.error('Failed to update game state:', error);
        }
    }

    async completeLevel(completionData) {
        try {
            if (!this.currentSession) return;
            
            const response = await fetch(`${this.backendUrl}/api/game/session/${this.currentSession.sessionId}/complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    walletAddress: this.walletAddress,
                    ...completionData
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Update player data
                this.playerData = { ...this.playerData, ...result.newStats };
                
                // Emit WebSocket event
                this.socket.emit('levelComplete', {
                    sessionId: this.currentSession.sessionId,
                    walletAddress: this.walletAddress,
                    level: completionData.level,
                    score: completionData.score,
                    tokensEarned: result.rewards
                });
                
                // Show rewards
                this.showRewards(result.rewards, result.achievements);
                
                // Update UI
                this.updateUI();
                
                console.log('Level completed:', result);
                return result;
            }
        } catch (error) {
            console.error('Failed to complete level:', error);
        }
    }

    async gameOver(finalData) {
        try {
            if (!this.currentSession) return;
            
            const response = await fetch(`${this.backendUrl}/api/game/session/${this.currentSession.sessionId}/gameover`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    walletAddress: this.walletAddress,
                    ...finalData
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Emit WebSocket event
                this.socket.emit('gameOver', {
                    sessionId: this.currentSession.sessionId,
                    walletAddress: this.walletAddress,
                    finalScore: finalData.finalScore
                });
                
                // Clear session
                this.currentSession = null;
                this.gameState.gameState = 'inactive';
                
                console.log('Game over:', result);
                return result;
            }
        } catch (error) {
            console.error('Failed to end game:', error);
        }
    }

    async getLeaderboard(type = 'global', limit = 10) {
        try {
            const response = await fetch(`${this.backendUrl}/api/leaderboard/${type}?limit=${limit}`);
            const result = await response.json();
            
            if (result.success) {
                return result.leaderboard;
            }
        } catch (error) {
            console.error('Failed to get leaderboard:', error);
        }
    }

    async getPlayerStats() {
        try {
            const response = await fetch(`${this.backendUrl}/api/game/stats/${this.walletAddress}`);
            const result = await response.json();
            
            if (result.success) {
                return result;
            }
        } catch (error) {
            console.error('Failed to get player stats:', error);
        }
    }

    async getTokenBalance(tokenType = 'boom') {
        try {
            const response = await fetch(`${this.backendUrl}/api/web3/wallet/${this.walletAddress}/tokens/${tokenType}`);
            const result = await response.json();
            
            if (result.success) {
                return result.balance;
            }
        } catch (error) {
            console.error('Failed to get token balance:', error);
        }
    }

    // UI Update Methods
    updateUI() {
        if (this.playerData) {
            // Update player info
            this.updatePlayerInfo();
            
            // Update token balances
            this.updateTokenBalances();
            
            // Update leaderboard
            this.updateLeaderboard();
        }
    }

    updatePlayerInfo() {
        const playerInfoElement = document.getElementById('player-info');
        if (playerInfoElement && this.playerData) {
            playerInfoElement.innerHTML = `
                <div class="player-card">
                    <h3>${this.playerData.username}</h3>
                    <p>Level: ${this.playerData.level}</p>
                    <p>Total Score: ${this.playerData.total_score.toLocaleString()}</p>
                    <p>BOOM Tokens: ${this.playerData.boom_tokens.toLocaleString()}</p>
                </div>
            `;
        }
    }

    async updateTokenBalances() {
        try {
            const boomBalance = await this.getTokenBalance('boom');
            const pirateBalance = await this.getTokenBalance('pirate');
            const admiralBalance = await this.getTokenBalance('admiral');
            
            const tokenElement = document.getElementById('token-balances');
            if (tokenElement) {
                tokenElement.innerHTML = `
                    <div class="token-balances">
                        <div class="token boom">BOOM: ${boomBalance?.toLocaleString() || 0}</div>
                        <div class="token pirate">PIRATE: ${pirateBalance?.toLocaleString() || 0}</div>
                        <div class="token admiral">ADMIRAL: ${admiralBalance?.toLocaleString() || 0}</div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to update token balances:', error);
        }
    }

    async updateLeaderboard() {
        try {
            const leaderboard = await this.getLeaderboard('global', 10);
            const leaderboardElement = document.getElementById('leaderboard');
            
            if (leaderboardElement && leaderboard) {
                leaderboardElement.innerHTML = `
                    <h3>Global Leaderboard</h3>
                    <div class="leaderboard-list">
                        ${leaderboard.map((player, index) => `
                            <div class="leaderboard-item ${player.wallet_address === this.walletAddress ? 'current-player' : ''}">
                                <span class="rank">#${index + 1}</span>
                                <span class="username">${player.username}</span>
                                <span class="score">${player.total_score.toLocaleString()}</span>
                                <span class="level">Lv.${player.level}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to update leaderboard:', error);
        }
    }

    // Event Handlers
    handlePlayerUpdate(data) {
        if (data.walletAddress === this.walletAddress) {
            this.playerData = { ...this.playerData, ...data };
            this.updateUI();
        }
    }

    handleLevelReward(result) {
        if (result.success) {
            this.showRewards(result.reward, result.achievements);
        }
    }

    handleAchievementUnlocked(achievement) {
        this.showAchievement(achievement);
    }

    handleLeaderboardUpdate(data) {
        this.updateLeaderboard();
    }

    // UI Display Methods
    showRewards(rewards, achievements) {
        const rewardsElement = document.getElementById('rewards-popup');
        if (rewardsElement) {
            rewardsElement.innerHTML = `
                <div class="rewards-container">
                    <h3>Level Complete!</h3>
                    <div class="rewards">
                        <div class="reward boom">+${rewards.boom} BOOM</div>
                        <div class="reward pirate">+${rewards.pirate} PIRATE</div>
                        <div class="reward admiral">+${rewards.admiral} ADMIRAL</div>
                    </div>
                    ${achievements && achievements.length > 0 ? `
                        <div class="achievements">
                            <h4>Achievements Unlocked!</h4>
                            ${achievements.map(achievement => `
                                <div class="achievement">
                                    <span class="achievement-name">${achievement.name}</span>
                                    <span class="achievement-reward">+${achievement.rewardTokens.boom} BOOM</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
            rewardsElement.style.display = 'block';
            
            // Hide after 5 seconds
            setTimeout(() => {
                rewardsElement.style.display = 'none';
            }, 5000);
        }
    }

    showAchievement(achievement) {
        const achievementElement = document.getElementById('achievement-popup');
        if (achievementElement) {
            achievementElement.innerHTML = `
                <div class="achievement-container">
                    <h3>🏆 Achievement Unlocked!</h3>
                    <div class="achievement-name">${achievement.name}</div>
                    <div class="achievement-description">${achievement.description}</div>
                    <div class="achievement-reward">+${achievement.rewardTokens.boom} BOOM</div>
                </div>
            `;
            achievementElement.style.display = 'block';
            
            // Hide after 3 seconds
            setTimeout(() => {
                achievementElement.style.display = 'none';
            }, 3000);
        }
    }

    // Public API Methods
    getCurrentSession() {
        return this.currentSession;
    }

    getPlayerData() {
        return this.playerData;
    }

    getGameState() {
        return this.gameState;
    }

    isWalletConnected() {
        return this.walletAddress !== null;
    }

    isServerConnected() {
        return this.isConnected;
    }
}

// Initialize game integration
window.gameIntegration = new GameIntegration();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameIntegration;
}
