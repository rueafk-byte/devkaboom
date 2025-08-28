require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const winston = require('winston');
const cluster = require('cluster');
const os = require('os');

// Import configurations
const db = require('./config/database');
const { client: redisClient, game: gameRedis } = require('./config/redis');

// Import routes
const playerRoutes = require('./routes/players');
const gameRoutes = require('./routes/game');
const leaderboardRoutes = require('./routes/leaderboard');
const adminRoutes = require('./routes/admin');
const web3Routes = require('./routes/web3');

// Import middleware
const { authMiddleware, walletAuthMiddleware, rateLimitMiddleware } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

// Import services
const Web3Service = require('./services/web3Service');
const GameService = require('./services/gameService');
const LeaderboardService = require('./services/leaderboardService');

// Configure logging
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'kaboom-game-server' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

// Production server setup
if (cluster.isMaster && process.env.NODE_ENV === 'production') {
    const numCPUs = os.cpus().length;
    logger.info(`Master process starting ${numCPUs} workers`);
    
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker, code, signal) => {
        logger.warn(`Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
    });
} else {
    startServer();
}

async function startServer() {
    try {
        // Initialize database (optional for local development)
        try {
            await db.initialize();
            logger.info('Database initialized successfully');
        } catch (dbError) {
            logger.warn('Database initialization failed, continuing without database:', dbError.message);
            logger.info('Game will run with local storage only');
        }
        
        // Initialize Redis (optional for local development)
        try {
            await redisClient.ping();
            logger.info('Redis connected successfully');
        } catch (redisError) {
            logger.warn('Redis connection failed, continuing without Redis:', redisError.message);
            logger.info('Game will run without caching');
        }
        
        // Initialize Web3 service (optional for local development)
        let web3Service;
        try {
            web3Service = new Web3Service();
            await web3Service.initialize();
            logger.info('Web3 service initialized successfully');
        } catch (web3Error) {
            logger.warn('Web3 service initialization failed, continuing without Web3:', web3Error.message);
            logger.info('Game will run without blockchain features');
        }
        
        // Create Express app
        const app = express();
        const server = http.createServer(app);
        
        // Initialize Socket.IO
        const io = socketIo(server, {
            cors: {
                origin: process.env.CORS_ORIGIN || "*",
                methods: ["GET", "POST"]
            },
            transports: ['websocket', 'polling']
        });
        
        // Security middleware
        app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: [
                        "'self'", 
                        "'unsafe-eval'", 
                        "'unsafe-inline'",
                        "https://cdn.socket.io",
                        "https://unpkg.com",
                        "https://cdn.jsdelivr.net"
                    ],
                    scriptSrcElem: [
                        "'self'",
                        "'unsafe-inline'",
                        "https://cdn.socket.io",
                        "https://unpkg.com",
                        "https://cdn.jsdelivr.net"
                    ],
                    imgSrc: ["'self'", "data:", "https:", "blob:"],
                    connectSrc: ["'self'", "wss:", "https:", "http:"],
                    fontSrc: ["'self'", "https:", "data:"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'", "https:"],
                    frameSrc: ["'self'"]
                }
            }
        }));
        
        // CORS configuration
        app.use(cors({
            origin: process.env.CORS_ORIGIN || "*",
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));
        
        // Compression
        app.use(compression());
        
        // Body parsing
        app.use(bodyParser.json({ limit: '10mb' }));
        app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
        
        // Rate limiting
        app.use(rateLimitMiddleware);
        
        // Static files
        app.use(express.static(path.join(__dirname, '.'), {
            maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
            etag: true
        }));
        
        // Health check endpoint
        app.get('/health', async (req, res) => {
            try {
                const health = {
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    services: {
                        database: 'unknown',
                        redis: 'unknown',
                        web3: 'unknown'
                    },
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    version: process.env.npm_package_version || '2.0.0'
                };
                
                // Check database health
                try {
                    const dbHealth = await db.healthCheck();
                    health.services.database = dbHealth.status;
                } catch (error) {
                    health.services.database = 'unhealthy';
                }
                
                // Check Redis health
                try {
                    const redisHealth = await redisClient.healthCheck();
                    health.services.redis = redisHealth.status;
                } catch (error) {
                    health.services.redis = 'unhealthy';
                }
                
                // Check Web3 health
                try {
                    health.services.web3 = web3Service && web3Service.isConnected() ? 'healthy' : 'unhealthy';
                } catch (error) {
                    health.services.web3 = 'unhealthy';
                }
                
                const isHealthy = health.services.database === 'healthy' || 
                                health.services.redis === 'healthy' || 
                                health.services.web3 === 'healthy';
                
                res.status(isHealthy ? 200 : 503).json(health);
            } catch (error) {
                logger.error('Health check failed:', error);
                res.status(503).json({
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // API health endpoint (same as /health but under /api)
        app.get('/api/health', async (req, res) => {
            try {
                const health = {
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    services: {
                        database: 'unknown',
                        redis: 'unknown',
                        web3: 'unknown'
                    },
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    version: process.env.npm_package_version || '2.0.0'
                };
                
                // Check database health
                try {
                    const dbHealth = await db.healthCheck();
                    health.services.database = dbHealth.status;
                } catch (error) {
                    health.services.database = 'unhealthy';
                }
                
                // Check Redis health
                try {
                    const redisHealth = await redisClient.healthCheck();
                    health.services.redis = redisHealth.status;
                } catch (error) {
                    health.services.redis = 'unhealthy';
                }
                
                // Check Web3 health
                try {
                    health.services.web3 = web3Service && web3Service.isConnected() ? 'healthy' : 'unhealthy';
                } catch (error) {
                    health.services.web3 = 'unhealthy';
                }
                
                const isHealthy = health.services.database === 'healthy' || 
                                health.services.redis === 'healthy' || 
                                health.services.web3 === 'healthy';
                
                res.status(isHealthy ? 200 : 503).json(health);
            } catch (error) {
                logger.error('Health check failed:', error);
                res.status(503).json({
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // API routes
        app.use('/api/players', playerRoutes);
        app.use('/api/game', gameRoutes);
        app.use('/api/leaderboard', leaderboardRoutes);
        app.use('/api/admin', authMiddleware, adminRoutes);
        app.use('/api/web3', web3Routes);
        
        // WebSocket connection handling
        io.on('connection', (socket) => {
            logger.info(`Client connected: ${socket.id}`);
            
            // Handle player authentication
            socket.on('authenticate', async (data) => {
                try {
                    const { walletAddress, signature } = data;
                    const isValid = await web3Service.verifySignature(walletAddress, signature);
                    
                    if (isValid) {
                        socket.walletAddress = walletAddress;
                        socket.join(`player:${walletAddress}`);
                        
                        // Add to online players
                        await gameRedis.addOnlinePlayer(walletAddress, {
                            socketId: socket.id,
                            connectedAt: new Date().toISOString()
                        });
                        
                        socket.emit('authenticated', { success: true });
                        logger.info(`Player authenticated: ${walletAddress}`);
                    } else {
                        socket.emit('authenticated', { success: false, error: 'Invalid signature' });
                    }
                } catch (error) {
                    logger.error('Authentication error:', error);
                    socket.emit('authenticated', { success: false, error: error.message });
                }
            });
            
            // Handle game state updates
            socket.on('gameStateUpdate', async (data) => {
                try {
                    if (!socket.walletAddress) {
                        socket.emit('error', { message: 'Not authenticated' });
                        return;
                    }
                    
                    const { gameState, score, level } = data;
                    
                    // Cache game state
                    await gameRedis.cacheGameState(socket.walletAddress, gameState);
                    
                    // Update leaderboard
                    await gameRedis.updateLeaderboard('score', socket.walletAddress, score, level, 0);
                    
                    // Broadcast to other players in same level
                    socket.to(`level:${level}`).emit('playerUpdate', {
                        walletAddress: socket.walletAddress,
                        score: score,
                        level: level
                    });
                    
                } catch (error) {
                    logger.error('Game state update error:', error);
                }
            });
            
            // Handle level completion
            socket.on('levelComplete', async (data) => {
                try {
                    if (!socket.walletAddress) return;
                    
                    const { level, score, tokensEarned } = data;
                    
                    // Process rewards on blockchain
                    const rewardResult = await web3Service.processLevelReward(
                        socket.walletAddress, 
                        level, 
                        score, 
                        tokensEarned
                    );
                    
                    socket.emit('levelRewardProcessed', rewardResult);
                    
                    // Update leaderboard
                    await gameRedis.updateLeaderboard('score', socket.walletAddress, score, level, tokensEarned.boom);
                    
                } catch (error) {
                    logger.error('Level completion error:', error);
                    socket.emit('error', { message: 'Failed to process rewards' });
                }
            });
            
            // Handle disconnection
            socket.on('disconnect', async () => {
                logger.info(`Client disconnected: ${socket.id}`);
                
                if (socket.walletAddress) {
                    await gameRedis.removeOnlinePlayer(socket.walletAddress);
                }
            });
        });
        
        // Error handling middleware
        app.use(errorHandler);
        
        // 404 handler
        app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Route not found',
                path: req.originalUrl,
                timestamp: new Date().toISOString()
            });
        });
        
        // Start server
        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            logger.info(`Kaboom Game Server running on port ${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV}`);
            logger.info(`Process ID: ${process.pid}`);
        });
        
        // Graceful shutdown
        process.on('SIGTERM', async () => {
            logger.info('SIGTERM received, shutting down gracefully');
            server.close(async () => {
                await db.close();
                await redisClient.quit();
                process.exit(0);
            });
        });
        
        process.on('SIGINT', async () => {
            logger.info('SIGINT received, shutting down gracefully');
            server.close(async () => {
                await db.close();
                await redisClient.quit();
                process.exit(0);
            });
        });
        
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

module.exports = { startServer };
