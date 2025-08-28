// Enhanced UI Components for Web3 Game
class GameUI {
    constructor() {
        this.components = {};
        this.isInitialized = false;
        this.currentTheme = 'dark';
        
        // Initialize UI
        this.init();
    }

    init() {
        this.createStyles();
        this.createComponents();
        this.bindEvents();
        this.isInitialized = true;
        
        console.log('Game UI initialized');
    }

    createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Game UI Styles */
            .game-ui {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1000;
                font-family: 'Arial', sans-serif;
            }

            .game-ui * {
                pointer-events: auto;
            }

            /* Header Panel */
            .header-panel {
                position: absolute;
                top: 20px;
                left: 20px;
                right: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(10px);
                border-radius: 15px;
                padding: 15px 20px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .player-info {
                display: flex;
                align-items: center;
                gap: 15px;
            }

            .player-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                color: white;
                font-size: 16px;
            }

            .player-details h3 {
                margin: 0;
                color: white;
                font-size: 16px;
                font-weight: bold;
            }

            .player-details p {
                margin: 5px 0 0 0;
                color: #ccc;
                font-size: 12px;
            }

            .game-stats {
                display: flex;
                gap: 20px;
                align-items: center;
            }

            .stat-item {
                text-align: center;
                color: white;
            }

            .stat-value {
                font-size: 18px;
                font-weight: bold;
                color: #4ecdc4;
            }

            .stat-label {
                font-size: 10px;
                color: #ccc;
                text-transform: uppercase;
            }

            /* Token Balances */
            .token-balances {
                display: flex;
                gap: 15px;
                align-items: center;
            }

            .token {
                display: flex;
                align-items: center;
                gap: 5px;
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                color: white;
            }

            .token.boom {
                background: linear-gradient(45deg, #ff6b6b, #ff8e8e);
            }

            .token.pirate {
                background: linear-gradient(45deg, #4ecdc4, #44a08d);
            }

            .token.admiral {
                background: linear-gradient(45deg, #a8e6cf, #88d8c0);
            }

            /* Sidebar */
            .sidebar {
                position: absolute;
                right: 20px;
                top: 100px;
                width: 300px;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(10px);
                border-radius: 15px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                overflow: hidden;
            }

            .sidebar-header {
                padding: 15px 20px;
                background: rgba(255, 255, 255, 0.1);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .sidebar-header h3 {
                margin: 0;
                color: white;
                font-size: 16px;
            }

            .sidebar-content {
                padding: 20px;
                max-height: 400px;
                overflow-y: auto;
            }

            /* Leaderboard */
            .leaderboard-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .leaderboard-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                transition: all 0.3s ease;
            }

            .leaderboard-item:hover {
                background: rgba(255, 255, 255, 0.1);
            }

            .leaderboard-item.current-player {
                background: rgba(78, 205, 196, 0.2);
                border: 1px solid rgba(78, 205, 196, 0.5);
            }

            .rank {
                font-weight: bold;
                color: #4ecdc4;
                min-width: 30px;
            }

            .username {
                flex: 1;
                color: white;
                font-size: 14px;
            }

            .score {
                color: #ff6b6b;
                font-weight: bold;
                font-size: 12px;
            }

            .level {
                color: #ccc;
                font-size: 12px;
            }

            /* Popups */
            .popup {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.95);
                backdrop-filter: blur(20px);
                border-radius: 20px;
                border: 2px solid rgba(255, 255, 255, 0.1);
                padding: 30px;
                text-align: center;
                color: white;
                z-index: 2000;
                display: none;
                animation: popupSlideIn 0.3s ease;
            }

            @keyframes popupSlideIn {
                from {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.8);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                }
            }

            .rewards-container h3 {
                margin: 0 0 20px 0;
                font-size: 24px;
                color: #4ecdc4;
            }

            .rewards {
                display: flex;
                justify-content: center;
                gap: 15px;
                margin-bottom: 20px;
            }

            .reward {
                padding: 10px 15px;
                border-radius: 25px;
                font-weight: bold;
                font-size: 14px;
            }

            .achievements {
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }

            .achievements h4 {
                margin: 0 0 15px 0;
                color: #ff6b6b;
            }

            .achievement {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                margin-bottom: 10px;
            }

            .achievement-name {
                color: white;
                font-size: 14px;
            }

            .achievement-reward {
                color: #4ecdc4;
                font-weight: bold;
                font-size: 12px;
            }

            /* Game Controls */
            .game-controls {
                position: absolute;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 15px;
                align-items: center;
            }

            .control-btn {
                padding: 12px 20px;
                border: none;
                border-radius: 25px;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(10px);
                color: white;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .control-btn:hover {
                background: rgba(78, 205, 196, 0.2);
                border-color: rgba(78, 205, 196, 0.5);
            }

            .control-btn.primary {
                background: linear-gradient(45deg, #ff6b6b, #ff8e8e);
            }

            .control-btn.primary:hover {
                background: linear-gradient(45deg, #ff5252, #ff7676);
            }

            /* Loading Spinner */
            .loading-spinner {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border-top-color: #4ecdc4;
                animation: spin 1s ease-in-out infinite;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            /* Responsive Design */
            @media (max-width: 768px) {
                .header-panel {
                    flex-direction: column;
                    gap: 15px;
                }

                .game-stats {
                    gap: 10px;
                }

                .sidebar {
                    width: 280px;
                    right: 10px;
                }

                .game-controls {
                    flex-wrap: wrap;
                    justify-content: center;
                }
            }

            /* Animations */
            .fade-in {
                animation: fadeIn 0.5s ease;
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            .slide-up {
                animation: slideUp 0.3s ease;
            }

            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }

    createComponents() {
        // Create main UI container
        this.components.container = this.createElement('div', 'game-ui');
        document.body.appendChild(this.components.container);

        // Create header panel
        this.createHeaderPanel();
        
        // Create sidebar
        this.createSidebar();
        
        // Create game controls
        this.createGameControls();
        
        // Create popups
        this.createPopups();
    }

    createHeaderPanel() {
        const header = this.createElement('div', 'header-panel');
        
        // Player info section
        const playerInfo = this.createElement('div', 'player-info');
        const avatar = this.createElement('div', 'player-avatar');
        const details = this.createElement('div', 'player-details');
        
        avatar.textContent = '?';
        details.innerHTML = `
            <h3>Connect Wallet</h3>
            <p>Level: 1 | Score: 0</p>
        `;
        
        playerInfo.appendChild(avatar);
        playerInfo.appendChild(details);
        
        // Game stats section
        const gameStats = this.createElement('div', 'game-stats');
        gameStats.innerHTML = `
            <div class="stat-item">
                <div class="stat-value" id="lives">3</div>
                <div class="stat-label">Lives</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" id="bombs">3</div>
                <div class="stat-label">Bombs</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" id="score">0</div>
                <div class="stat-label">Score</div>
            </div>
        `;
        
        // Token balances section
        const tokenBalances = this.createElement('div', 'token-balances');
        tokenBalances.innerHTML = `
            <div class="token boom">BOOM: 0</div>
            <div class="token pirate">PIRATE: 0</div>
            <div class="token admiral">ADMIRAL: 0</div>
        `;
        
        header.appendChild(playerInfo);
        header.appendChild(gameStats);
        header.appendChild(tokenBalances);
        
        this.components.container.appendChild(header);
        this.components.header = header;
    }

    createSidebar() {
        const sidebar = this.createElement('div', 'sidebar');
        
        const header = this.createElement('div', 'sidebar-header');
        header.innerHTML = '<h3>Leaderboard</h3>';
        
        const content = this.createElement('div', 'sidebar-content');
        content.innerHTML = `
            <div class="leaderboard-list" id="leaderboard">
                <div class="leaderboard-item">
                    <span class="rank">#1</span>
                    <span class="username">Loading...</span>
                    <span class="score">0</span>
                    <span class="level">Lv.1</span>
                </div>
            </div>
        `;
        
        sidebar.appendChild(header);
        sidebar.appendChild(content);
        
        this.components.container.appendChild(sidebar);
        this.components.sidebar = sidebar;
    }

    createGameControls() {
        const controls = this.createElement('div', 'game-controls');
        controls.innerHTML = `
            <button class="control-btn" id="connect-wallet">Connect Wallet</button>
            <button class="control-btn" id="start-game">Play (PVE)</button>
            <button class="control-btn" id="pause-game">Pause</button>
            <button class="control-btn" id="pvp-soon" disabled>PVP (coming soon)</button>
            <button class="control-btn primary" id="settings">Settings</button>
        `;
        
        this.components.container.appendChild(controls);
        this.components.controls = controls;
    }

    createPopups() {
        // Rewards popup
        const rewardsPopup = this.createElement('div', 'popup', 'rewards-popup');
        rewardsPopup.innerHTML = `
            <div class="rewards-container">
                <h3>Level Complete!</h3>
                <div class="rewards">
                    <div class="reward boom">+0 BOOM</div>
                    <div class="reward pirate">+0 PIRATE</div>
                    <div class="reward admiral">+0 ADMIRAL</div>
                </div>
            </div>
        `;
        
        // Achievement popup
        const achievementPopup = this.createElement('div', 'popup', 'achievement-popup');
        achievementPopup.innerHTML = `
            <div class="achievement-container">
                <h3>🏆 Achievement Unlocked!</h3>
                <div class="achievement-name">Achievement Name</div>
                <div class="achievement-description">Achievement Description</div>
                <div class="achievement-reward">+0 BOOM</div>
            </div>
        `;
        
        // Loading popup
        const loadingPopup = this.createElement('div', 'popup', 'loading-popup');
        loadingPopup.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <h3>Loading...</h3>
                <p>Please wait while we connect to the blockchain</p>
            </div>
        `;
        
        this.components.container.appendChild(rewardsPopup);
        this.components.container.appendChild(achievementPopup);
        this.components.container.appendChild(loadingPopup);
        
        this.components.rewardsPopup = rewardsPopup;
        this.components.achievementPopup = achievementPopup;
        this.components.loadingPopup = loadingPopup;
    }

    bindEvents() {
        // Connect wallet button
        const connectBtn = document.getElementById('connect-wallet');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                this.connectWallet();
            });
        }
        
        // Start game button
        const startBtn = document.getElementById('start-game');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.startGame();
            });
        }
        
        // Pause game button
        const pauseBtn = document.getElementById('pause-game');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.pauseGame();
            });
        }
        
        // Settings button
        const settingsBtn = document.getElementById('settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.showSettings();
            });
        }
    }

    // Utility methods
    createElement(tag, className, id = null) {
        const element = document.createElement(tag);
        element.className = className;
        if (id) element.id = id;
        return element;
    }

    // Public API methods
    updatePlayerInfo(playerData) {
        if (!playerData) return;
        
        const avatar = this.components.header.querySelector('.player-avatar');
        const details = this.components.header.querySelector('.player-details');
        
        if (avatar) {
            avatar.textContent = playerData.username ? playerData.username.charAt(0).toUpperCase() : '?';
        }
        
        if (details) {
            details.innerHTML = `
                <h3>${playerData.username || 'Player'}</h3>
                <p>Level: ${playerData.level || 1} | Score: ${(playerData.total_score || 0).toLocaleString()}</p>
            `;
        }
    }

    updateGameStats(stats) {
        const livesElement = document.getElementById('lives');
        const bombsElement = document.getElementById('bombs');
        const scoreElement = document.getElementById('score');
        
        if (livesElement) livesElement.textContent = stats.lives || 3;
        if (bombsElement) bombsElement.textContent = stats.bombs || 3;
        if (scoreElement) scoreElement.textContent = (stats.score || 0).toLocaleString();
    }

    updateTokenBalances(balances) {
        const tokenElements = this.components.header.querySelectorAll('.token');
        
        if (tokenElements.length >= 3) {
            tokenElements[0].textContent = `BOOM: ${(balances.boom || 0).toLocaleString()}`;
            tokenElements[1].textContent = `PIRATE: ${(balances.pirate || 0).toLocaleString()}`;
            tokenElements[2].textContent = `ADMIRAL: ${(balances.admiral || 0).toLocaleString()}`;
        }
    }

    updateLeaderboard(leaderboard) {
        const leaderboardElement = document.getElementById('leaderboard');
        if (!leaderboardElement || !leaderboard) return;
        
        leaderboardElement.innerHTML = leaderboard.map((player, index) => `
            <div class="leaderboard-item ${player.wallet_address === window.gameIntegration?.walletAddress ? 'current-player' : ''}">
                <span class="rank">#${index + 1}</span>
                <span class="username">${player.username}</span>
                <span class="score">${player.total_score.toLocaleString()}</span>
                <span class="level">Lv.${player.level}</span>
            </div>
        `).join('');
    }

    showRewards(rewards, achievements = []) {
        const popup = this.components.rewardsPopup;
        const container = popup.querySelector('.rewards-container');
        
        container.innerHTML = `
            <h3>Level Complete!</h3>
            <div class="rewards">
                <div class="reward boom">+${rewards.boom || 0} BOOM</div>
                <div class="reward pirate">+${rewards.pirate || 0} PIRATE</div>
                <div class="reward admiral">+${rewards.admiral || 0} ADMIRAL</div>
            </div>
            ${achievements.length > 0 ? `
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
        `;
        
        popup.style.display = 'block';
        
        setTimeout(() => {
            popup.style.display = 'none';
        }, 5000);
    }

    showAchievement(achievement) {
        const popup = this.components.achievementPopup;
        const container = popup.querySelector('.achievement-container');
        
        container.innerHTML = `
            <h3>🏆 Achievement Unlocked!</h3>
            <div class="achievement-name">${achievement.name}</div>
            <div class="achievement-description">${achievement.description}</div>
            <div class="achievement-reward">+${achievement.rewardTokens.boom} BOOM</div>
        `;
        
        popup.style.display = 'block';
        
        setTimeout(() => {
            popup.style.display = 'none';
        }, 3000);
    }

    showLoading(message = 'Loading...') {
        const popup = this.components.loadingPopup;
        const container = popup.querySelector('.loading-container');
        
        container.innerHTML = `
            <div class="loading-spinner"></div>
            <h3>${message}</h3>
            <p>Please wait while we connect to the blockchain</p>
        `;
        
        popup.style.display = 'block';
    }

    hideLoading() {
        this.components.loadingPopup.style.display = 'none';
    }

    // Event handlers
    async connectWallet() {
        this.showLoading('Connecting wallet...');
        
        try {
            if (window.gameIntegration) {
                await window.gameIntegration.initWalletConnection();
                this.hideLoading();
            }
        } catch (error) {
            this.hideLoading();
            console.error('Wallet connection failed:', error);
        }
    }

    async startGame() {
        try {
            // Require wallet connect first
            if (!window.gameIntegration || !window.gameIntegration.isWalletConnected()) {
                alert('Please connect your wallet first!');
                return;
            }

            // Create the game instance only when the player presses Play (PVE)
            if (typeof PirateBombGame !== 'undefined') {
                if (!window.__kaboomGameInstance) {
                    window.__kaboomGameInstance = new PirateBombGame();
                }
            }

            // Start session (non-blocking)
            if (window.gameIntegration && window.gameIntegration.startGameSession) {
                window.gameIntegration.startGameSession(1, 'normal', 'standard').catch(() => {});
            }
        } catch (error) {
            console.error('Failed to start game:', error);
        }
    }

    pauseGame() {
        // Implement pause functionality
        console.log('Game paused');
    }

    showSettings() {
        // Implement settings modal
        console.log('Settings opened');
    }

    // Theme management
    setTheme(theme) {
        this.currentTheme = theme;
        document.body.setAttribute('data-theme', theme);
    }

    // Animation helpers
    animateElement(element, animation) {
        element.classList.add(animation);
        setTimeout(() => {
            element.classList.remove(animation);
        }, 1000);
    }
}

// Initialize UI
window.gameUI = new GameUI();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameUI;
}
