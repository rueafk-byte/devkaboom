require('dotenv').config();
const express = require('express');
const path = require('path');

// Import enhanced backend modules
const database = require('./config/database');
const logger = require('./utils/logger');
const { cacheManager } = require('./utils/cache');
const { 
    helmet, 
    cors, 
    rateLimiters, 
    requestLogger, 
    errorHandler,
    securityHeaders 
} = require('./middleware/security');

// Import API routes
const apiRoutes = require('./routes/api');

class KaboomServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.isProduction = process.env.NODE_ENV === 'production';
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet);
        this.app.use(cors);
        this.app.use(securityHeaders);

        // Rate limiting
        this.app.use('/api/', rateLimiters.general);

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request logging
        this.app.use(logger.requestLogger());
        this.app.locals.logger = logger;

        // Static file serving
        this.app.use(express.static('.', {
            maxAge: this.isProduction ? '1d' : 0,
            etag: true,
            lastModified: true
        }));

        // Health check middleware
        this.app.use((req, res, next) => {
            req.serverHealth = {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                database: database.isHealthy(),
                cache: cacheManager.getCacheStats()
            };
            next();
        });
    }

    setupRoutes() {
        // API routes
        this.app.use('/api/v2', apiRoutes);

        // Legacy API compatibility (redirect to v2)
        this.app.use('/api', (req, res, next) => {
            if (req.path.startsWith('/v2')) {
                return next();
            }
            const newPath = `/api/v2${req.path}`;
            logger.info('Legacy API redirect', { 
                originalPath: req.path, 
                newPath,
                ip: req.ip 
            });
            res.redirect(301, newPath);
        });

        // Game routes (serve main game)
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'index.html'));
        });

        this.app.get('/game', (req, res) => {
            res.sendFile(path.join(__dirname, 'index.html'));
        });

        // Admin dashboard
        this.app.get('/admin', (req, res) => {
            res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
        });

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: '2.0.0',
                environment: process.env.NODE_ENV || 'development',
                database: database.isHealthy(),
                cache: cacheManager.getCacheStats(),
                memory: {
                    used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                    total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                    rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
                }
            };

            res.json(health);
        });

        // Metrics endpoint (for monitoring)
        this.app.get('/metrics', (req, res) => {
            const metrics = {
                timestamp: new Date().toISOString(),
                uptime_seconds: process.uptime(),
                memory_usage: process.memoryUsage(),
                cache_stats: cacheManager.getCacheStats(),
                database_healthy: database.isHealthy()
            };

            res.json(metrics);
        });

        // 404 handler for API routes
        this.app.use('/api/*', (req, res) => {
            logger.warn('API endpoint not found', { 
                path: req.path, 
                method: req.method,
                ip: req.ip 
            });
            res.status(404).json({
                success: false,
                error: 'API endpoint not found',
                path: req.path,
                method: req.method
            });
        });

        // Catch-all for SPA routing
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, 'index.html'));
        });
    }

    setupErrorHandling() {
        // Global error handler
        this.app.use(errorHandler);

        // Unhandled promise rejection
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Promise Rejection', {
                reason: reason.toString(),
                stack: reason.stack
            });
        });

        // Uncaught exception
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception', {
                error: error.message,
                stack: error.stack
            });
            
            // Graceful shutdown
            this.gracefulShutdown('uncaughtException');
        });

        // Graceful shutdown handlers
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    }

    async gracefulShutdown(signal) {
        logger.info(`Received ${signal}, starting graceful shutdown...`);

        // Stop accepting new connections
        this.server.close(async () => {
            logger.info('HTTP server closed');

            try {
                // Close database connection
                await database.close();
                logger.info('Database connection closed');

                // Clear caches
                cacheManager.clearAllCaches();
                logger.info('Caches cleared');

                logger.info('Graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                logger.error('Error during graceful shutdown', { error: error.message });
                process.exit(1);
            }
        });

        // Force shutdown after 30 seconds
        setTimeout(() => {
            logger.error('Forced shutdown after timeout');
            process.exit(1);
        }, 30000);
    }

    async start() {
        try {
            // Initialize database
            logger.info('Initializing database...');
            await database.connect();
            await database.insertDefaultData();
            logger.info('Database initialized successfully');

            // Start server
            this.server = this.app.listen(this.port, () => {
                logger.info('🚀 Kaboom Game Server Started', {
                    port: this.port,
                    environment: process.env.NODE_ENV || 'development',
                    version: '2.0.0',
                    pid: process.pid
                });

                if (!this.isProduction) {
                    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    🏴‍☠️ KABOOM GAME SERVER 🏴‍☠️                    ║
║                                                              ║
║  🎮 Game URL:        http://localhost:${this.port}                     ║
║  📊 Admin Dashboard: http://localhost:${this.port}/admin              ║
║  🔧 Health Check:    http://localhost:${this.port}/health             ║
║  📈 API Docs:        http://localhost:${this.port}/api/v2             ║
║                                                              ║
║  🚀 Server Status:   READY                                   ║
║  💾 Database:        CONNECTED                               ║
║  🔒 Security:        ENABLED                                 ║
║  ⚡ Cache:           ACTIVE                                   ║
╚══════════════════════════════════════════════════════════════╝
                    `);
                }
            });

            // Handle server errors
            this.server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    logger.error(`Port ${this.port} is already in use`);
                    process.exit(1);
                } else {
                    logger.error('Server error', { error: error.message });
                }
            });

        } catch (error) {
            logger.error('Failed to start server', { error: error.message });
            process.exit(1);
        }
    }
}

// Start server if this file is run directly
if (require.main === module) {
    const server = new KaboomServer();
    server.start().catch(error => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}

module.exports = KaboomServer;
