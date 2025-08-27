const jwt = require('jsonwebtoken');
const { game: gameRedis } = require('../config/redis');

// Authentication middleware
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token.' });
    }
};

// Wallet authentication middleware
const walletAuthMiddleware = async (req, res, next) => {
    try {
        const { walletAddress, signature } = req.body;
        
        if (!walletAddress || !signature) {
            return res.status(401).json({ error: 'Wallet address and signature required' });
        }
        
        // Verify signature (this would be implemented in Web3Service)
        // For now, we'll just validate the format
        if (walletAddress.length !== 44) {
            return res.status(401).json({ error: 'Invalid wallet address format' });
        }
        
        req.walletAddress = walletAddress;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Wallet authentication failed' });
    }
};

// Rate limiting middleware
const rateLimitMiddleware = async (req, res, next) => {
    try {
        const key = `rate_limit:${req.ip}`;
        const limit = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
        const window = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000; // 15 minutes
        
        const allowed = await gameRedis.checkRateLimit(key, limit, window / 1000);
        
        if (!allowed) {
            return res.status(429).json({ 
                error: 'Too many requests. Please try again later.',
                retryAfter: Math.ceil(window / 1000)
            });
        }
        
        next();
    } catch (error) {
        // If Redis is down, allow the request
        next();
    }
};

// Admin authorization middleware
const adminAuthMiddleware = async (req, res, next) => {
    try {
        const adminWallets = process.env.ADMIN_WALLETS?.split(',') || [];
        
        if (!adminWallets.includes(req.walletAddress)) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        next();
    } catch (error) {
        res.status(403).json({ error: 'Admin authorization failed' });
    }
};

// Session validation middleware
const sessionMiddleware = async (req, res, next) => {
    try {
        const { walletAddress } = req.body;
        
        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address required' });
        }
        
        // Check if user has an active session
        const session = await gameRedis.getPlayerSession(walletAddress);
        
        if (!session) {
            return res.status(401).json({ error: 'No active session found' });
        }
        
        req.session = session;
        next();
    } catch (error) {
        res.status(500).json({ error: 'Session validation failed' });
    }
};

module.exports = {
    authMiddleware,
    walletAuthMiddleware,
    rateLimitMiddleware,
    adminAuthMiddleware,
    sessionMiddleware
};
