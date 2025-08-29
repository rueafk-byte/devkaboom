const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.isConnected = false;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            const dbPath = path.join(__dirname, '../../data/kaboom_game.db');
            
            // Ensure data directory exists
            const dataDir = path.dirname(dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            this.db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('❌ Database connection failed:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Connected to SQLite database');
                    this.isConnected = true;
                    this.createTables().then(resolve).catch(reject);
                }
            });

            // Handle database errors
            this.db.on('error', (err) => {
                console.error('❌ Database error:', err);
                this.isConnected = false;
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Enhanced Players table with proper indexing
                this.db.run(`CREATE TABLE IF NOT EXISTS players (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    wallet_address TEXT UNIQUE NOT NULL,
                    username TEXT NOT NULL,
                    email TEXT,
                    level INTEGER DEFAULT 1 CHECK(level >= 1 AND level <= 40),
                    total_score INTEGER DEFAULT 0 CHECK(total_score >= 0),
                    current_score INTEGER DEFAULT 0 CHECK(current_score >= 0),
                    boom_tokens DECIMAL(18,8) DEFAULT 0.0 CHECK(boom_tokens >= 0),
                    lives INTEGER DEFAULT 3 CHECK(lives >= 0 AND lives <= 5),
                    max_lives INTEGER DEFAULT 3 CHECK(max_lives >= 3 AND max_lives <= 5),
                    experience_points INTEGER DEFAULT 0 CHECK(experience_points >= 0),
                    achievements_unlocked INTEGER DEFAULT 0 CHECK(achievements_unlocked >= 0),
                    total_playtime_minutes INTEGER DEFAULT 0 CHECK(total_playtime_minutes >= 0),
                    levels_completed INTEGER DEFAULT 0 CHECK(levels_completed >= 0),
                    bosses_defeated INTEGER DEFAULT 0 CHECK(bosses_defeated >= 0),
                    enemies_killed INTEGER DEFAULT 0 CHECK(enemies_killed >= 0),
                    bombs_used INTEGER DEFAULT 0 CHECK(bombs_used >= 0),
                    deaths INTEGER DEFAULT 0 CHECK(deaths >= 0),
                    consecutive_wins INTEGER DEFAULT 0 CHECK(consecutive_wins >= 0),
                    best_streak INTEGER DEFAULT 0 CHECK(best_streak >= 0),
                    preferred_difficulty TEXT DEFAULT 'normal' CHECK(preferred_difficulty IN ('easy', 'normal', 'hard', 'expert')),
                    player_rank TEXT DEFAULT 'novice' CHECK(player_rank IN ('novice', 'apprentice', 'warrior', 'champion', 'legend', 'master')),
                    is_premium BOOLEAN DEFAULT 0,
                    is_banned BOOLEAN DEFAULT 0,
                    ban_reason TEXT,
                    ban_expires_at DATETIME,
                    last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ip_address TEXT,
                    user_agent TEXT,
                    referral_code TEXT UNIQUE,
                    referred_by TEXT,
                    total_referrals INTEGER DEFAULT 0 CHECK(total_referrals >= 0)
                )`);

                // Enhanced Recharge tracking with better structure
                this.db.run(`CREATE TABLE IF NOT EXISTS recharge_tracking (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    wallet_address TEXT UNIQUE NOT NULL,
                    lives_remaining INTEGER DEFAULT 3 CHECK(lives_remaining >= 0 AND lives_remaining <= 5),
                    max_lives INTEGER DEFAULT 3 CHECK(max_lives >= 3 AND max_lives <= 5),
                    last_death_time DATETIME,
                    recharge_start_time DATETIME,
                    recharge_end_time DATETIME,
                    cooldown_duration_minutes INTEGER DEFAULT 45 CHECK(cooldown_duration_minutes > 0),
                    is_recharging BOOLEAN DEFAULT 0,
                    recharge_count INTEGER DEFAULT 0 CHECK(recharge_count >= 0),
                    premium_recharges_used INTEGER DEFAULT 0 CHECK(premium_recharges_used >= 0),
                    free_recharges_remaining INTEGER DEFAULT 3 CHECK(free_recharges_remaining >= 0),
                    next_free_recharge DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (wallet_address) REFERENCES players(wallet_address) ON DELETE CASCADE
                )`);

                // Game Sessions with detailed tracking
                this.db.run(`CREATE TABLE IF NOT EXISTS game_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT UNIQUE NOT NULL,
                    wallet_address TEXT NOT NULL,
                    session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
                    session_end DATETIME,
                    duration_minutes INTEGER DEFAULT 0 CHECK(duration_minutes >= 0),
                    levels_attempted INTEGER DEFAULT 0 CHECK(levels_attempted >= 0),
                    levels_completed INTEGER DEFAULT 0 CHECK(levels_completed >= 0),
                    score_earned INTEGER DEFAULT 0 CHECK(score_earned >= 0),
                    tokens_earned DECIMAL(18,8) DEFAULT 0.0 CHECK(tokens_earned >= 0),
                    enemies_killed INTEGER DEFAULT 0 CHECK(enemies_killed >= 0),
                    bombs_used INTEGER DEFAULT 0 CHECK(bombs_used >= 0),
                    deaths INTEGER DEFAULT 0 CHECK(deaths >= 0),
                    achievements_unlocked INTEGER DEFAULT 0 CHECK(achievements_unlocked >= 0),
                    highest_level_reached INTEGER DEFAULT 1 CHECK(highest_level_reached >= 1 AND highest_level_reached <= 40),
                    session_type TEXT DEFAULT 'pve' CHECK(session_type IN ('pve', 'pvp', 'tutorial', 'challenge')),
                    device_type TEXT DEFAULT 'desktop' CHECK(device_type IN ('desktop', 'mobile', 'tablet')),
                    ip_address TEXT,
                    user_agent TEXT,
                    is_completed BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (wallet_address) REFERENCES players(wallet_address) ON DELETE CASCADE
                )`);

                // Achievements system
                this.db.run(`CREATE TABLE IF NOT EXISTS achievements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    achievement_key TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    category TEXT NOT NULL CHECK(category IN ('gameplay', 'progression', 'social', 'special', 'seasonal')),
                    difficulty TEXT DEFAULT 'normal' CHECK(difficulty IN ('easy', 'normal', 'hard', 'legendary')),
                    reward_tokens DECIMAL(18,8) DEFAULT 0.0 CHECK(reward_tokens >= 0),
                    reward_experience INTEGER DEFAULT 0 CHECK(reward_experience >= 0),
                    is_hidden BOOLEAN DEFAULT 0,
                    is_active BOOLEAN DEFAULT 1,
                    unlock_condition TEXT,
                    icon_url TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // Player achievements (junction table)
                this.db.run(`CREATE TABLE IF NOT EXISTS player_achievements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    wallet_address TEXT NOT NULL,
                    achievement_id INTEGER NOT NULL,
                    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    progress_value INTEGER DEFAULT 0,
                    is_claimed BOOLEAN DEFAULT 0,
                    claimed_at DATETIME,
                    FOREIGN KEY (wallet_address) REFERENCES players(wallet_address) ON DELETE CASCADE,
                    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
                    UNIQUE(wallet_address, achievement_id)
                )`);

                // Token transactions
                this.db.run(`CREATE TABLE IF NOT EXISTS token_transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    transaction_id TEXT UNIQUE NOT NULL,
                    wallet_address TEXT NOT NULL,
                    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('earned', 'spent', 'transferred', 'bonus', 'penalty')),
                    amount DECIMAL(18,8) NOT NULL,
                    balance_before DECIMAL(18,8) NOT NULL CHECK(balance_before >= 0),
                    balance_after DECIMAL(18,8) NOT NULL CHECK(balance_after >= 0),
                    source TEXT NOT NULL CHECK(source IN ('level_completion', 'achievement', 'daily_bonus', 'referral', 'purchase', 'admin', 'penalty')),
                    source_id TEXT,
                    description TEXT,
                    metadata TEXT, -- JSON string for additional data
                    is_confirmed BOOLEAN DEFAULT 1,
                    blockchain_tx_hash TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (wallet_address) REFERENCES players(wallet_address) ON DELETE CASCADE
                )`);

                // Admin actions with enhanced logging
                this.db.run(`CREATE TABLE IF NOT EXISTS admin_actions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    admin_wallet TEXT,
                    admin_ip TEXT,
                    action_type TEXT NOT NULL CHECK(action_type IN ('create', 'update', 'delete', 'ban', 'unban', 'reset', 'grant_tokens', 'revoke_tokens', 'system')),
                    target_wallet TEXT,
                    action_details TEXT NOT NULL,
                    old_values TEXT, -- JSON string
                    new_values TEXT, -- JSON string
                    reason TEXT,
                    is_automated BOOLEAN DEFAULT 0,
                    severity TEXT DEFAULT 'info' CHECK(severity IN ('info', 'warning', 'error', 'critical')),
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // System configuration
                this.db.run(`CREATE TABLE IF NOT EXISTS system_config (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    config_key TEXT UNIQUE NOT NULL,
                    config_value TEXT NOT NULL,
                    data_type TEXT DEFAULT 'string' CHECK(data_type IN ('string', 'number', 'boolean', 'json')),
                    description TEXT,
                    is_public BOOLEAN DEFAULT 0,
                    updated_by TEXT,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // Leaderboards
                this.db.run(`CREATE TABLE IF NOT EXISTS leaderboards (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    leaderboard_type TEXT NOT NULL CHECK(leaderboard_type IN ('daily', 'weekly', 'monthly', 'all_time')),
                    category TEXT NOT NULL CHECK(category IN ('score', 'tokens', 'level', 'achievements', 'streak')),
                    wallet_address TEXT NOT NULL,
                    username TEXT NOT NULL,
                    value INTEGER NOT NULL CHECK(value >= 0),
                    rank_position INTEGER NOT NULL CHECK(rank_position > 0),
                    period_start DATETIME NOT NULL,
                    period_end DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (wallet_address) REFERENCES players(wallet_address) ON DELETE CASCADE,
                    UNIQUE(leaderboard_type, category, wallet_address, period_start)
                )`);

                // Create indexes for better performance
                this.createIndexes();

                console.log('✅ Database tables created successfully');
                resolve();
            });
        });
    }

    createIndexes() {
        const indexes = [
            // Players table indexes
            'CREATE INDEX IF NOT EXISTS idx_players_wallet ON players(wallet_address)',
            'CREATE INDEX IF NOT EXISTS idx_players_username ON players(username)',
            'CREATE INDEX IF NOT EXISTS idx_players_level ON players(level)',
            'CREATE INDEX IF NOT EXISTS idx_players_score ON players(total_score DESC)',
            'CREATE INDEX IF NOT EXISTS idx_players_tokens ON players(boom_tokens DESC)',
            'CREATE INDEX IF NOT EXISTS idx_players_rank ON players(player_rank)',
            'CREATE INDEX IF NOT EXISTS idx_players_created ON players(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_players_last_login ON players(last_login)',
            
            // Recharge tracking indexes
            'CREATE INDEX IF NOT EXISTS idx_recharge_wallet ON recharge_tracking(wallet_address)',
            'CREATE INDEX IF NOT EXISTS idx_recharge_status ON recharge_tracking(is_recharging)',
            'CREATE INDEX IF NOT EXISTS idx_recharge_end_time ON recharge_tracking(recharge_end_time)',
            
            // Game sessions indexes
            'CREATE INDEX IF NOT EXISTS idx_sessions_wallet ON game_sessions(wallet_address)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_start ON game_sessions(session_start)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_type ON game_sessions(session_type)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_completed ON game_sessions(is_completed)',
            
            // Achievements indexes
            'CREATE INDEX IF NOT EXISTS idx_achievements_key ON achievements(achievement_key)',
            'CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category)',
            'CREATE INDEX IF NOT EXISTS idx_achievements_active ON achievements(is_active)',
            
            // Player achievements indexes
            'CREATE INDEX IF NOT EXISTS idx_player_achievements_wallet ON player_achievements(wallet_address)',
            'CREATE INDEX IF NOT EXISTS idx_player_achievements_unlocked ON player_achievements(unlocked_at)',
            'CREATE INDEX IF NOT EXISTS idx_player_achievements_claimed ON player_achievements(is_claimed)',
            
            // Token transactions indexes
            'CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON token_transactions(wallet_address)',
            'CREATE INDEX IF NOT EXISTS idx_transactions_type ON token_transactions(transaction_type)',
            'CREATE INDEX IF NOT EXISTS idx_transactions_source ON token_transactions(source)',
            'CREATE INDEX IF NOT EXISTS idx_transactions_created ON token_transactions(created_at)',
            
            // Admin actions indexes
            'CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON admin_actions(action_type)',
            'CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_wallet)',
            'CREATE INDEX IF NOT EXISTS idx_admin_actions_timestamp ON admin_actions(timestamp)',
            
            // Leaderboards indexes
            'CREATE INDEX IF NOT EXISTS idx_leaderboards_type ON leaderboards(leaderboard_type)',
            'CREATE INDEX IF NOT EXISTS idx_leaderboards_category ON leaderboards(category)',
            'CREATE INDEX IF NOT EXISTS idx_leaderboards_rank ON leaderboards(rank_position)',
            'CREATE INDEX IF NOT EXISTS idx_leaderboards_period ON leaderboards(period_start, period_end)'
        ];

        indexes.forEach(indexQuery => {
            this.db.run(indexQuery, (err) => {
                if (err) {
                    console.error('❌ Error creating index:', err.message);
                }
            });
        });
    }

    async insertDefaultData() {
        return new Promise((resolve, reject) => {
            // Insert default achievements
            const defaultAchievements = [
                {
                    key: 'first_steps',
                    name: 'First Steps',
                    description: 'Complete your first level',
                    category: 'progression',
                    difficulty: 'easy',
                    reward_tokens: 10,
                    reward_experience: 50
                },
                {
                    key: 'bomb_master',
                    name: 'Bomb Master',
                    description: 'Use 100 bombs',
                    category: 'gameplay',
                    difficulty: 'normal',
                    reward_tokens: 50,
                    reward_experience: 200
                },
                {
                    key: 'level_10',
                    name: 'Getting Serious',
                    description: 'Reach level 10',
                    category: 'progression',
                    difficulty: 'normal',
                    reward_tokens: 100,
                    reward_experience: 500
                },
                {
                    key: 'boss_slayer',
                    name: 'Boss Slayer',
                    description: 'Defeat your first boss',
                    category: 'gameplay',
                    difficulty: 'hard',
                    reward_tokens: 200,
                    reward_experience: 1000
                },
                {
                    key: 'legend',
                    name: 'Legendary Pirate',
                    description: 'Complete all 40 levels',
                    category: 'progression',
                    difficulty: 'legendary',
                    reward_tokens: 1000,
                    reward_experience: 5000
                }
            ];

            let completed = 0;
            const total = defaultAchievements.length;

            defaultAchievements.forEach(achievement => {
                this.db.run(`INSERT OR IGNORE INTO achievements 
                    (achievement_key, name, description, category, difficulty, reward_tokens, reward_experience) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [achievement.key, achievement.name, achievement.description, achievement.category, 
                     achievement.difficulty, achievement.reward_tokens, achievement.reward_experience],
                    (err) => {
                        if (err) {
                            console.error('❌ Error inserting achievement:', err.message);
                        }
                        completed++;
                        if (completed === total) {
                            console.log('✅ Default achievements inserted');
                            resolve();
                        }
                    }
                );
            });
        });
    }

    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('❌ Error closing database:', err.message);
                    } else {
                        console.log('✅ Database connection closed');
                    }
                    this.isConnected = false;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    getDatabase() {
        return this.db;
    }

    isHealthy() {
        return this.isConnected && this.db !== null;
    }
}

module.exports = new DatabaseManager();
