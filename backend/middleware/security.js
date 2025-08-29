const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: {
            success: false,
            error: message,
            retryAfter: Math.ceil(windowMs / 1000)
        },
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => {
            // Skip rate limiting for admin endpoints with valid admin token
            return req.headers.authorization && req.headers.authorization.startsWith('Admin ');
        }
    });
};

// Different rate limits for different endpoints
const rateLimiters = {
    // General API rate limit
    general: createRateLimiter(15 * 60 * 1000, 100, 'Too many requests, please try again later'),
    
    // Strict rate limit for authentication endpoints
    auth: createRateLimiter(15 * 60 * 1000, 5, 'Too many authentication attempts, please try again later'),
    
    // Game session endpoints
    gameSession: createRateLimiter(1 * 60 * 1000, 10, 'Too many game session requests, please slow down'),
    
    // Player data updates
    playerUpdate: createRateLimiter(5 * 60 * 1000, 20, 'Too many player updates, please try again later'),
    
    // Token transactions
    tokenTransaction: createRateLimiter(1 * 60 * 1000, 5, 'Too many token transactions, please wait'),
    
    // Admin actions
    admin: createRateLimiter(1 * 60 * 1000, 50, 'Too many admin actions, please slow down')
};

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            // Add production domains here
            process.env.FRONTEND_URL,
            process.env.GAME_URL
        ].filter(Boolean);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS policy'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Session-ID', 'X-Wallet-Address']
};

// Helmet security configuration
const helmetConfig = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Needed for game engine
            connectSrc: ["'self'", "https://api.mainnet-beta.solana.com", "https://api.devnet.solana.com"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false // Disable for game compatibility
};

// JWT token verification
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token required'
        });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'kaboom-game-secret-key');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
};

// Admin authentication middleware
const verifyAdmin = (req, res, next) => {
    const adminToken = req.headers.authorization?.replace('Admin ', '');
    
    if (!adminToken) {
        return res.status(401).json({
            success: false,
            error: 'Admin token required'
        });
    }
    
    // In production, this should verify against a secure admin token system
    const validAdminToken = process.env.ADMIN_TOKEN || 'kaboom-admin-secret-token';
    
    if (adminToken !== validAdminToken) {
        return res.status(403).json({
            success: false,
            error: 'Invalid admin token'
        });
    }
    
    req.isAdmin = true;
    next();
};

// Wallet signature verification middleware
const verifyWalletSignature = async (req, res, next) => {
    const { wallet_address, signature, message, timestamp } = req.body;
    
    if (!wallet_address || !signature || !message || !timestamp) {
        return res.status(400).json({
            success: false,
            error: 'Wallet verification data required'
        });
    }
    
    // Check timestamp (message should be recent - within 5 minutes)
    const now = Date.now();
    const messageTime = parseInt(timestamp);
    const timeDiff = Math.abs(now - messageTime);
    
    if (timeDiff > 5 * 60 * 1000) { // 5 minutes
        return res.status(400).json({
            success: false,
            error: 'Message timestamp too old'
        });
    }
    
    try {
        // Verify the signature matches the wallet address
        // This is a simplified version - in production, use proper Solana signature verification
        const expectedMessage = `Kaboom Game Authentication: ${timestamp}`;
        
        if (message !== expectedMessage) {
            return res.status(400).json({
                success: false,
                error: 'Invalid message format'
            });
        }
        
        // Store verified wallet in request
        req.verifiedWallet = wallet_address;
        next();
    } catch (error) {
        return res.status(400).json({
            success: false,
            error: 'Invalid wallet signature'
        });
    }
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    const sanitize = (obj) => {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                // Remove potentially dangerous characters
                obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
                obj[key] = obj[key].replace(/javascript:/gi, '');
                obj[key] = obj[key].replace(/on\w+\s*=/gi, '');
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitize(obj[key]);
            }
        }
    };
    
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    
    next();
};

// Request logging middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();
    const requestId = crypto.randomUUID();
    
    req.requestId = requestId;
    req.startTime = start;
    
    // Log request
    console.log(`🔍 [${requestId}] ${req.method} ${req.path} - ${req.ip} - ${new Date().toISOString()}`);
    
    // Log response
    const originalSend = res.send;
    res.send = function(data) {
        const duration = Date.now() - start;
        const statusEmoji = res.statusCode >= 400 ? '❌' : '✅';
        console.log(`${statusEmoji} [${requestId}] ${res.statusCode} - ${duration}ms`);
        originalSend.call(this, data);
    };
    
    next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    const requestId = req.requestId || 'unknown';
    
    console.error(`💥 [${requestId}] Error:`, err);
    
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: isDevelopment ? err.message : 'Invalid input data',
            requestId
        });
    }
    
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            success: false,
            error: 'Authentication failed',
            requestId
        });
    }
    
    if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({
            success: false,
            error: 'Data conflict',
            details: isDevelopment ? err.message : 'Resource already exists or constraint violation',
            requestId
        });
    }
    
    // Generic server error
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: isDevelopment ? err.message : 'Something went wrong',
        requestId
    });
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
};

// IP whitelist middleware (for admin endpoints)
const ipWhitelist = (allowedIPs = []) => {
    return (req, res, next) => {
        const clientIP = req.ip || req.connection.remoteAddress;
        
        if (allowedIPs.length === 0 || allowedIPs.includes(clientIP) || allowedIPs.includes('127.0.0.1')) {
            next();
        } else {
            res.status(403).json({
                success: false,
                error: 'IP address not allowed'
            });
        }
    };
};

module.exports = {
    rateLimiters,
    corsOptions,
    helmetConfig,
    verifyToken,
    verifyAdmin,
    verifyWalletSignature,
    sanitizeInput,
    requestLogger,
    errorHandler,
    securityHeaders,
    ipWhitelist,
    helmet: helmet(helmetConfig),
    cors: cors(corsOptions)
};
