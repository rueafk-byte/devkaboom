const winston = require('winston');

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    // Log error
    winston.error('Error occurred:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    });

    // Don't leak error details in production
    if (process.env.NODE_ENV === 'production') {
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Invalid data provided'
            });
        }
        
        if (err.name === 'UnauthorizedError') {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }
        
        if (err.name === 'ForbiddenError') {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Access denied'
            });
        }
        
        if (err.name === 'NotFoundError') {
            return res.status(404).json({
                error: 'Not found',
                message: 'Resource not found'
            });
        }
        
        // Default error response
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Something went wrong'
        });
    } else {
        // Development error response with full details
        res.status(err.status || 500).json({
            error: err.message,
            stack: err.stack,
            name: err.name,
            timestamp: new Date().toISOString()
        });
    }
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error classes
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
        this.status = 400;
    }
}

class UnauthorizedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UnauthorizedError';
        this.status = 401;
    }
}

class ForbiddenError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ForbiddenError';
        this.status = 403;
    }
}

class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
        this.status = 404;
    }
}

class DatabaseError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DatabaseError';
        this.status = 500;
    }
}

class Web3Error extends Error {
    constructor(message) {
        super(message);
        this.name = 'Web3Error';
        this.status = 500;
    }
}

module.exports = {
    errorHandler,
    asyncHandler,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    DatabaseError,
    Web3Error
};
