const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.')); // Serve static files from current directory

// Database setup
const db = new sqlite3.Database('./player_data.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        createTables();
    }
});

// Create tables if they don't exist
function createTables() {
    db.serialize(() => {
        // Players table
        db.run(`CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wallet_address TEXT UNIQUE NOT NULL,
            username TEXT,
            level INTEGER DEFAULT 1,
            total_score INTEGER DEFAULT 0,
            boom_tokens INTEGER DEFAULT 0,
            lives INTEGER DEFAULT 3,
            current_score INTEGER DEFAULT 0,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Recharge tracking table
        db.run(`CREATE TABLE IF NOT EXISTS recharge_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wallet_address TEXT UNIQUE NOT NULL,
            lives_remaining INTEGER DEFAULT 3,
            last_recharge_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            recharge_cooldown_end DATETIME,
            is_recharging BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Game sessions table for tracking
        db.run(`CREATE TABLE IF NOT EXISTS game_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wallet_address TEXT NOT NULL,
            session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
            session_end DATETIME,
            score_earned INTEGER DEFAULT 0,
            tokens_earned INTEGER DEFAULT 0,
            enemies_killed INTEGER DEFAULT 0,
            levels_completed INTEGER DEFAULT 0
        )`);

        // Admin actions log
        db.run(`CREATE TABLE IF NOT EXISTS admin_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_ip TEXT,
            action_type TEXT NOT NULL,
            target_wallet TEXT,
            action_details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        console.log('Database tables created successfully');
    });
}

// API Routes

// Get all players
app.get('/api/players', (req, res) => {
    const query = `
        SELECT * FROM players 
        ORDER BY total_score DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get player by wallet address
app.get('/api/players/:walletAddress', (req, res) => {
    const walletAddress = req.params.walletAddress;
    
    db.get('SELECT * FROM players WHERE wallet_address = ?', [walletAddress], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (row) {
            res.json(row);
        } else {
            res.status(404).json({ error: 'Player not found' });
        }
    });
});

// Create or update player
app.post('/api/players', (req, res) => {
    const { wallet_address, username, level, total_score, boom_tokens, lives, current_score } = req.body;
    
    const query = `
        INSERT OR REPLACE INTO players 
        (wallet_address, username, level, total_score, boom_tokens, lives, current_score, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    db.run(query, [wallet_address, username, level, total_score, boom_tokens, lives, current_score], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ 
            success: true, 
            message: 'Player data saved successfully',
            id: this.lastID 
        });
    });
});

// Update player progress
app.put('/api/players/:walletAddress/progress', (req, res) => {
    const walletAddress = req.params.walletAddress;
    const { level, total_score, boom_tokens, lives, current_score } = req.body;
    
    const query = `
        UPDATE players 
        SET level = ?, total_score = ?, boom_tokens = ?, lives = ?, current_score = ?, last_updated = CURRENT_TIMESTAMP
        WHERE wallet_address = ?
    `;
    
    db.run(query, [level, total_score, boom_tokens, lives, current_score, walletAddress], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes > 0) {
            res.json({ success: true, message: 'Player progress updated' });
        } else {
            res.status(404).json({ error: 'Player not found' });
        }
    });
});

// Delete player
app.delete('/api/players/:walletAddress', (req, res) => {
    const walletAddress = req.params.walletAddress;
    const adminIP = req.ip;
    
    db.run('DELETE FROM players WHERE wallet_address = ?', [walletAddress], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Log admin action
        db.run('INSERT INTO admin_actions (admin_ip, action_type, target_wallet, action_details) VALUES (?, ?, ?, ?)', 
            [adminIP, 'DELETE_PLAYER', walletAddress, 'Player profile deleted']);
        
        res.json({ success: true, message: 'Player deleted successfully' });
    });
});

// Reset player progress
app.post('/api/players/:walletAddress/reset', (req, res) => {
    const walletAddress = req.params.walletAddress;
    const adminIP = req.ip;
    
    const query = `
        UPDATE players 
        SET level = 1, total_score = 0, boom_tokens = 0, lives = 3, current_score = 0, last_updated = CURRENT_TIMESTAMP
        WHERE wallet_address = ?
    `;
    
    db.run(query, [walletAddress], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Log admin action
        db.run('INSERT INTO admin_actions (admin_ip, action_type, target_wallet, action_details) VALUES (?, ?, ?, ?)', 
            [adminIP, 'RESET_PLAYER', walletAddress, 'Player progress reset']);
        
        res.json({ success: true, message: 'Player progress reset successfully' });
    });
});

// Get dashboard statistics
app.get('/api/dashboard/stats', (req, res) => {
    const queries = {
        totalPlayers: 'SELECT COUNT(*) as count FROM players',
        totalTokens: 'SELECT SUM(boom_tokens) as total FROM players',
        totalScore: 'SELECT SUM(total_score) as total FROM players',
        avgLevel: 'SELECT AVG(level) as average FROM players',
        avgScore: 'SELECT AVG(total_score) as average FROM players',
        avgTokens: 'SELECT AVG(boom_tokens) as average FROM players',
        topPlayer: 'SELECT username, total_score FROM players ORDER BY total_score DESC LIMIT 1',
        recentActivity: 'SELECT * FROM players ORDER BY last_updated DESC LIMIT 5'
    };
    
    const results = {};
    let completed = 0;
    const totalQueries = Object.keys(queries).length;
    
    Object.keys(queries).forEach(key => {
        db.get(queries[key], [], (err, row) => {
            if (err) {
                console.error(`Error in query ${key}:`, err);
            } else {
                results[key] = row;
            }
            completed++;
            
            if (completed === totalQueries) {
                res.json(results);
            }
        });
    });
});

// Get token distribution
app.get('/api/dashboard/token-distribution', (req, res) => {
    const query = `
        SELECT 
            CASE 
                WHEN boom_tokens BETWEEN 0 AND 100 THEN '0-100'
                WHEN boom_tokens BETWEEN 101 AND 500 THEN '101-500'
                WHEN boom_tokens BETWEEN 501 AND 1000 THEN '501-1000'
                WHEN boom_tokens BETWEEN 1001 AND 5000 THEN '1001-5000'
                ELSE '5000+'
            END as range,
            COUNT(*) as count
        FROM players 
        GROUP BY range
        ORDER BY 
            CASE range
                WHEN '0-100' THEN 1
                WHEN '101-500' THEN 2
                WHEN '501-1000' THEN 3
                WHEN '1001-5000' THEN 4
                ELSE 5
            END
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Search players
app.get('/api/search/players', (req, res) => {
    const searchTerm = req.query.q;
    
    if (!searchTerm) {
        res.status(400).json({ error: 'Search term required' });
        return;
    }
    
    const query = `
        SELECT * FROM players 
        WHERE wallet_address LIKE ? OR username LIKE ?
        ORDER BY total_score DESC
    `;
    
    const searchPattern = `%${searchTerm}%`;
    
    db.all(query, [searchPattern, searchPattern], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get admin action log
app.get('/api/admin/actions', (req, res) => {
    const query = 'SELECT * FROM admin_actions ORDER BY timestamp DESC LIMIT 100';
    
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Export player data
app.get('/api/players/:walletAddress/export', (req, res) => {
    const walletAddress = req.params.walletAddress;
    
    db.get('SELECT * FROM players WHERE wallet_address = ?', [walletAddress], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (row) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="player_${walletAddress.slice(0, 8)}_${Date.now()}.json"`);
            res.json(row);
        } else {
            res.status(404).json({ error: 'Player not found' });
        }
    });
});

// Recharge System API Endpoints

// Get recharge status for a wallet
app.get('/api/recharge/:walletAddress', (req, res) => {
    const walletAddress = req.params.walletAddress;
    
    db.get('SELECT * FROM recharge_tracking WHERE wallet_address = ?', [walletAddress], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (row) {
            // Calculate current recharge status
            const now = new Date();
            const cooldownEnd = new Date(row.recharge_cooldown_end);
            const isRecharging = now < cooldownEnd;
            const timeRemaining = isRecharging ? Math.max(0, cooldownEnd - now) : 0;
            
            res.json({
                wallet_address: row.wallet_address,
                lives_remaining: row.lives_remaining,
                is_recharging: isRecharging,
                time_remaining_ms: timeRemaining,
                time_remaining_minutes: Math.ceil(timeRemaining / (1000 * 60)),
                can_play: !isRecharging && row.lives_remaining > 0,
                last_recharge_time: row.last_recharge_time,
                recharge_cooldown_end: row.recharge_cooldown_end
            });
        } else {
            // New wallet - can play immediately
            res.json({
                wallet_address: walletAddress,
                lives_remaining: 3,
                is_recharging: false,
                time_remaining_ms: 0,
                time_remaining_minutes: 0,
                can_play: true,
                last_recharge_time: null,
                recharge_cooldown_end: null
            });
        }
    });
});

// Start recharge cooldown (called when player loses all lives)
app.post('/api/recharge/start/:walletAddress', (req, res) => {
    const walletAddress = req.params.walletAddress;
    const cooldownMinutes = 45; // 45 minutes cooldown
    const cooldownEnd = new Date(Date.now() + (cooldownMinutes * 60 * 1000));
    
    const query = `
        INSERT OR REPLACE INTO recharge_tracking 
        (wallet_address, lives_remaining, recharge_cooldown_end, is_recharging, updated_at)
        VALUES (?, 0, ?, 1, CURRENT_TIMESTAMP)
    `;
    
    db.run(query, [walletAddress, cooldownEnd.toISOString()], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        res.json({
            success: true,
            wallet_address: walletAddress,
            recharge_cooldown_end: cooldownEnd.toISOString(),
            time_remaining_ms: cooldownMinutes * 60 * 1000,
            time_remaining_minutes: cooldownMinutes
        });
    });
});

// Complete recharge (called when cooldown is finished)
app.post('/api/recharge/complete/:walletAddress', (req, res) => {
    const walletAddress = req.params.walletAddress;
    
    const query = `
        UPDATE recharge_tracking 
        SET lives_remaining = 3, 
            is_recharging = 0, 
            last_recharge_time = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE wallet_address = ?
    `;
    
    db.run(query, [walletAddress], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        res.json({
            success: true,
            wallet_address: walletAddress,
            lives_remaining: 3,
            is_recharging: false
        });
    });
});

// Update lives remaining (called when player takes damage)
app.put('/api/recharge/lives/:walletAddress', (req, res) => {
    const walletAddress = req.params.walletAddress;
    const { lives_remaining } = req.body;
    
    if (lives_remaining < 0 || lives_remaining > 3) {
        res.status(400).json({ error: 'Invalid lives count' });
        return;
    }
    
    const query = `
        INSERT OR REPLACE INTO recharge_tracking 
        (wallet_address, lives_remaining, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
    `;
    
    db.run(query, [walletAddress, lives_remaining], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        res.json({
            success: true,
            wallet_address: walletAddress,
            lives_remaining: lives_remaining
        });
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        database: 'connected'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🎮 Kaboom Admin Server running on port ${PORT}`);
    console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin-dashboard.html`);
    console.log(`🔍 Simple Admin Panel: http://localhost:${PORT}/admin-panel.html`);
    console.log(`🎯 Game: http://localhost:${PORT}/`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('✅ Database connection closed');
        }
        process.exit(0);
    });
});
