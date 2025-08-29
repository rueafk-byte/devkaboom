const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../../logs');
        this.ensureLogDirectory();
        this.logLevels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };
        this.currentLevel = process.env.LOG_LEVEL || 'INFO';
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    shouldLog(level) {
        return this.logLevels[level] <= this.logLevels[this.currentLevel];
    }

    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...meta
        };

        return JSON.stringify(logEntry) + '\n';
    }

    writeToFile(filename, content) {
        const filePath = path.join(this.logDir, filename);
        fs.appendFileSync(filePath, content, 'utf8');
    }

    log(level, message, meta = {}) {
        if (!this.shouldLog(level)) return;

        const formattedMessage = this.formatMessage(level, message, meta);
        const dateStr = new Date().toISOString().split('T')[0];
        
        // Write to appropriate log files
        this.writeToFile(`app-${dateStr}.log`, formattedMessage);
        
        if (level === 'ERROR') {
            this.writeToFile(`error-${dateStr}.log`, formattedMessage);
        }

        // Console output with colors
        const colors = {
            ERROR: '\x1b[31m', // Red
            WARN: '\x1b[33m',  // Yellow
            INFO: '\x1b[36m',  // Cyan
            DEBUG: '\x1b[37m'  // White
        };

        const reset = '\x1b[0m';
        const color = colors[level] || colors.INFO;
        
        console.log(`${color}[${level}] ${new Date().toISOString()} - ${message}${reset}`);
        
        if (Object.keys(meta).length > 0) {
            console.log(`${color}Meta:${reset}`, meta);
        }
    }

    error(message, meta = {}) {
        this.log('ERROR', message, meta);
    }

    warn(message, meta = {}) {
        this.log('WARN', message, meta);
    }

    info(message, meta = {}) {
        this.log('INFO', message, meta);
    }

    debug(message, meta = {}) {
        this.log('DEBUG', message, meta);
    }

    // Request logging middleware
    requestLogger() {
        return (req, res, next) => {
            const start = Date.now();
            const requestId = req.requestId || require('crypto').randomUUID();
            
            req.requestId = requestId;
            req.startTime = start;

            // Log request
            this.info('HTTP Request', {
                requestId,
                method: req.method,
                url: req.url,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                walletAddress: req.params.walletAddress || req.body.wallet_address
            });

            // Override res.json to log response
            const originalJson = res.json;
            res.json = function(data) {
                const duration = Date.now() - start;
                const level = res.statusCode >= 400 ? 'ERROR' : 'INFO';
                
                req.app.locals.logger.log(level, 'HTTP Response', {
                    requestId,
                    statusCode: res.statusCode,
                    duration: `${duration}ms`,
                    success: data.success !== false
                });

                return originalJson.call(this, data);
            };

            next();
        };
    }

    // Database operation logger
    dbLogger(operation, table, data = {}) {
        this.debug('Database Operation', {
            operation,
            table,
            data: typeof data === 'object' ? JSON.stringify(data) : data
        });
    }

    // Security event logger
    securityLogger(event, details = {}) {
        this.warn('Security Event', {
            event,
            ...details,
            timestamp: new Date().toISOString()
        });
    }

    // Performance logger
    performanceLogger(operation, duration, details = {}) {
        const level = duration > 1000 ? 'WARN' : 'INFO';
        this.log(level, 'Performance Metric', {
            operation,
            duration: `${duration}ms`,
            ...details
        });
    }

    // Error handler middleware
    errorHandler() {
        return (err, req, res, next) => {
            const requestId = req.requestId || 'unknown';
            
            this.error('Application Error', {
                requestId,
                error: err.message,
                stack: err.stack,
                url: req.url,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });

            // Don't leak error details in production
            const isDevelopment = process.env.NODE_ENV === 'development';
            
            const errorResponse = {
                success: false,
                error: isDevelopment ? err.message : 'Internal server error',
                requestId
            };

            if (isDevelopment && err.stack) {
                errorResponse.stack = err.stack;
            }

            res.status(err.status || 500).json(errorResponse);
        };
    }

    // Cleanup old log files (keep last 30 days)
    cleanupOldLogs() {
        try {
            const files = fs.readdirSync(this.logDir);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            files.forEach(file => {
                const filePath = path.join(this.logDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime < thirtyDaysAgo) {
                    fs.unlinkSync(filePath);
                    this.info('Cleaned up old log file', { file });
                }
            });
        } catch (error) {
            this.error('Error cleaning up log files', { error: error.message });
        }
    }

    // Get log files for admin dashboard
    getLogFiles(days = 7) {
        try {
            const files = fs.readdirSync(this.logDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            return files
                .filter(file => file.endsWith('.log'))
                .map(file => {
                    const filePath = path.join(this.logDir, file);
                    const stats = fs.statSync(filePath);
                    return {
                        name: file,
                        size: stats.size,
                        modified: stats.mtime,
                        path: filePath
                    };
                })
                .filter(file => file.modified >= cutoffDate)
                .sort((a, b) => b.modified - a.modified);
        } catch (error) {
            this.error('Error getting log files', { error: error.message });
            return [];
        }
    }

    // Read log file content
    readLogFile(filename, lines = 100) {
        try {
            const filePath = path.join(this.logDir, filename);
            const content = fs.readFileSync(filePath, 'utf8');
            const logLines = content.trim().split('\n');
            
            return logLines
                .slice(-lines)
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch {
                        return { message: line, timestamp: new Date().toISOString() };
                    }
                });
        } catch (error) {
            this.error('Error reading log file', { filename, error: error.message });
            return [];
        }
    }
}

// Create singleton instance
const logger = new Logger();

// Schedule daily cleanup
setInterval(() => {
    logger.cleanupOldLogs();
}, 24 * 60 * 60 * 1000); // Run daily

module.exports = logger;
