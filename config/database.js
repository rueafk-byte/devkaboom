const { Pool } = require('pg');
require('dotenv').config();

// Production Database Configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'kaboom_production',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

// Create connection pool
const pool = new Pool(dbConfig);

// Test database connection
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Database initialization
async function initializeDatabase() {
    try {
        // Create tables if they don't exist
        await createTables();
        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    }
}

// Create all necessary tables
async function createTables() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Players table
        await client.query(`
            CREATE TABLE IF NOT EXISTS players (
                id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(44) UNIQUE NOT NULL,
                username VARCHAR(50),
                level INTEGER DEFAULT 1,
                total_score BIGINT DEFAULT 0,
                boom_tokens BIGINT DEFAULT 0,
                pirate_tokens BIGINT DEFAULT 0,
                admiral_tokens BIGINT DEFAULT 0,
                lives INTEGER DEFAULT 3,
                current_score INTEGER DEFAULT 0,
                achievements JSONB DEFAULT '[]',
                game_stats JSONB DEFAULT '{}',
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_wallet_address (wallet_address),
                INDEX idx_total_score (total_score DESC),
                INDEX idx_level (level DESC)
            )
        `);

        // Game sessions table
        await client.query(`
            CREATE TABLE IF NOT EXISTS game_sessions (
                id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(44) NOT NULL,
                session_id VARCHAR(36) UNIQUE NOT NULL,
                session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                session_end TIMESTAMP,
                score_earned INTEGER DEFAULT 0,
                tokens_earned JSONB DEFAULT '{}',
                enemies_killed INTEGER DEFAULT 0,
                levels_completed INTEGER DEFAULT 0,
                game_data JSONB DEFAULT '{}',
                INDEX idx_session_id (session_id),
                INDEX idx_wallet_address (wallet_address),
                INDEX idx_session_start (session_start)
            )
        `);

        // Leaderboard table (for caching)
        await client.query(`
            CREATE TABLE IF NOT EXISTS leaderboard_cache (
                id SERIAL PRIMARY KEY,
                leaderboard_type VARCHAR(20) NOT NULL,
                rank INTEGER NOT NULL,
                wallet_address VARCHAR(44) NOT NULL,
                username VARCHAR(50),
                score BIGINT NOT NULL,
                level INTEGER,
                tokens BIGINT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(leaderboard_type, rank),
                INDEX idx_leaderboard_type (leaderboard_type),
                INDEX idx_updated_at (updated_at)
            )
        `);

        // Admin actions log
        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_actions (
                id SERIAL PRIMARY KEY,
                admin_ip INET,
                admin_wallet VARCHAR(44),
                action_type VARCHAR(50) NOT NULL,
                target_wallet VARCHAR(44),
                action_details JSONB,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_admin_wallet (admin_wallet),
                INDEX idx_action_type (action_type),
                INDEX idx_timestamp (timestamp)
            )
        `);

        // Blockchain transactions log
        await client.query(`
            CREATE TABLE IF NOT EXISTS blockchain_transactions (
                id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(44) NOT NULL,
                transaction_hash VARCHAR(44) UNIQUE NOT NULL,
                transaction_type VARCHAR(30) NOT NULL,
                token_type VARCHAR(20),
                amount BIGINT,
                status VARCHAR(20) DEFAULT 'pending',
                block_number BIGINT,
                gas_used BIGINT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_transaction_hash (transaction_hash),
                INDEX idx_wallet_address (wallet_address),
                INDEX idx_status (status),
                INDEX idx_timestamp (timestamp)
            )
        `);

        // Player achievements
        await client.query(`
            CREATE TABLE IF NOT EXISTS player_achievements (
                id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(44) NOT NULL,
                achievement_id VARCHAR(50) NOT NULL,
                achievement_name VARCHAR(100) NOT NULL,
                achievement_description TEXT,
                reward_tokens JSONB DEFAULT '{}',
                unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(wallet_address, achievement_id),
                INDEX idx_wallet_address (wallet_address),
                INDEX idx_achievement_id (achievement_id)
            )
        `);

        // Daily/Weekly rewards tracking
        await client.query(`
            CREATE TABLE IF NOT EXISTS reward_claims (
                id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(44) NOT NULL,
                reward_type VARCHAR(20) NOT NULL,
                reward_date DATE NOT NULL,
                tokens_claimed JSONB DEFAULT '{}',
                claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(wallet_address, reward_type, reward_date),
                INDEX idx_wallet_address (wallet_address),
                INDEX idx_reward_date (reward_date)
            )
        `);

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Database operations
const db = {
    // Query execution
    query: (text, params) => pool.query(text, params),
    
    // Get a client from the pool
    getClient: () => pool.connect(),
    
    // Initialize database
    initialize: initializeDatabase,
    
    // Close pool
    close: () => pool.end(),
    
    // Health check
    healthCheck: async () => {
        try {
            const result = await pool.query('SELECT NOW()');
            return { status: 'healthy', timestamp: result.rows[0].now };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }
};

module.exports = db;
