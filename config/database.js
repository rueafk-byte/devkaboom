const { Pool } = require('pg');
require('dotenv').config();

// Database Configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'kaboom_production',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    // Disable SSL for local development, only use SSL in production
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

// Check if we have database credentials
const hasDatabaseCredentials = process.env.DB_HOST || process.env.DATABASE_URL;

// Create connection pool only if we have database credentials
let pool = null;
if (hasDatabaseCredentials) {
    pool = new Pool(dbConfig);
}

// Test database connection
if (pool) {
    pool.on('connect', () => {
        console.log('Connected to PostgreSQL database');
    });

    pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
        // Don't exit process, just log the error
        console.log('Database connection error, but continuing...');
    });
}

// Database initialization
async function initializeDatabase() {
    if (!hasDatabaseCredentials) {
        console.log('No database credentials provided, running without database');
        return;
    }
    
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
    if (!pool) {
        throw new Error('Database pool not initialized');
    }
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
                game_data JSONB DEFAULT '{}'
            )
        `);

        // Leaderboard table
        await client.query(`
            CREATE TABLE IF NOT EXISTS leaderboard_cache (
                id SERIAL PRIMARY KEY,
                leaderboard_type VARCHAR(20) NOT NULL,
                rank INTEGER NOT NULL,
                wallet_address VARCHAR(44) NOT NULL,
                username VARCHAR(50),
                score BIGINT NOT NULL,
                level INTEGER,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    query: (text, params) => {
        if (!pool) {
            throw new Error('Database not available');
        }
        return pool.query(text, params);
    },
    
    // Get a client from the pool
    getClient: () => {
        if (!pool) {
            throw new Error('Database not available');
        }
        return pool.connect();
    },
    
    // Initialize database
    initialize: initializeDatabase,
    
    // Close pool
    close: () => {
        if (pool) {
            return pool.end();
        }
    },
    
    // Health check
    healthCheck: async () => {
        if (!pool) {
            return { status: 'not_configured', message: 'No database configured' };
        }
        try {
            const result = await pool.query('SELECT NOW()');
            return { status: 'healthy', timestamp: result.rows[0].now };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }
};

module.exports = db;

