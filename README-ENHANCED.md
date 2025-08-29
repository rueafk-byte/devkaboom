# 🏴‍☠️ Kaboom: Blockchain Adventure - Enhanced Backend

## Overview

This is the **enhanced version 2.0** of Kaboom: Blockchain Adventure with a completely rebuilt, production-ready backend architecture. The game features a robust Node.js/Express backend with comprehensive security, caching, logging, and deployment capabilities.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm 8+
- SQLite3
- Git

### Installation

1. **Clone and setup**:
```bash
git clone <repository-url>
cd pirate-bomb-git1
npm install
```

2. **Environment configuration**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start the enhanced server**:
```bash
npm run dev  # Development with auto-reload
# or
npm start    # Production mode
```

4. **Access the game**:
- Game: http://localhost:3000
- Admin Dashboard: http://localhost:3000/admin
- API Health: http://localhost:3000/health
- API Documentation: http://localhost:3000/api/v2

## 🏗️ Enhanced Architecture

### Backend Structure
```
backend/
├── config/
│   └── database.js          # Enhanced database with proper schema
├── controllers/
│   ├── playerController.js  # Player management with validation
│   ├── gameController.js    # Game session tracking
│   └── tokenController.js   # Token transaction handling
├── middleware/
│   ├── security.js          # Security, rate limiting, CORS
│   └── validation.js        # Input validation and sanitization
├── routes/
│   └── api.js              # RESTful API endpoints v2
├── utils/
│   ├── logger.js           # Advanced logging system
│   └── cache.js            # Multi-layer caching
└── tests/
    ├── player.test.js      # Player API tests
    ├── game.test.js        # Game session tests
    └── setup.js            # Test configuration
```

### Key Features

#### 🔒 **Security**
- Helmet.js security headers
- CORS protection with whitelist
- Rate limiting (different limits per endpoint type)
- Input validation and sanitization
- JWT authentication support
- Admin token authentication
- IP whitelisting for admin endpoints

#### 📊 **Database**
- Enhanced SQLite schema with proper indexing
- 8 comprehensive tables with relationships
- Data integrity constraints
- Automatic migrations
- Backup and restore capabilities

#### ⚡ **Performance**
- Multi-layer caching system (NodeCache)
- Database query optimization
- Response compression
- Static file caching
- Memory usage monitoring

#### 📝 **Logging**
- Structured JSON logging
- Multiple log levels (ERROR, WARN, INFO, DEBUG)
- Request/response logging
- Security event logging
- Performance metrics
- Log rotation and cleanup

#### 🧪 **Testing**
- Jest test framework
- API endpoint testing
- Database integration tests
- Test coverage reporting
- Automated test setup/teardown

## 📡 API Endpoints (v2)

### Player Management
```
GET    /api/v2/players/:walletAddress     # Get player data
POST   /api/v2/players                    # Create player
PUT    /api/v2/players/:walletAddress     # Update player
DELETE /api/v2/players/:walletAddress     # Delete player (admin)
GET    /api/v2/players/:walletAddress/stats # Player statistics
GET    /api/v2/players/search             # Search players
GET    /api/v2/leaderboard                # Leaderboard
```

### Game Sessions
```
POST   /api/v2/sessions                   # Create game session
GET    /api/v2/sessions/:sessionId        # Get session
PUT    /api/v2/sessions/:sessionId        # Update session
POST   /api/v2/sessions/:sessionId/end    # End session
GET    /api/v2/players/:wallet/sessions   # Player sessions
```

### Token Management
```
GET    /api/v2/tokens/:wallet/balance     # Get token balance
POST   /api/v2/tokens/transaction         # Process transaction
GET    /api/v2/tokens/:wallet/history     # Transaction history
POST   /api/v2/tokens/achievement-reward  # Award achievement tokens
```

### Recharge System
```
GET    /api/v2/recharge/:walletAddress    # Get recharge status
POST   /api/v2/recharge/:wallet/start     # Start recharge
POST   /api/v2/recharge/:wallet/complete  # Complete recharge
```

### Achievements
```
GET    /api/v2/achievements               # Get all achievements
GET    /api/v2/players/:wallet/achievements # Player achievements
```

### Admin & Monitoring
```
GET    /api/v2/admin/dashboard            # Admin dashboard stats
GET    /api/v2/stats/game                 # Game statistics
GET    /api/v2/stats/tokens               # Token statistics
GET    /health                            # Health check
GET    /metrics                           # System metrics
```

## 🗄️ Database Schema

### Enhanced Tables
- **players**: Complete player profiles with stats and preferences
- **recharge_tracking**: Lives and cooldown management
- **game_sessions**: Detailed session tracking
- **achievements**: Achievement system
- **player_achievements**: Player achievement progress
- **token_transactions**: Complete transaction history
- **admin_actions**: Admin activity logging
- **system_config**: Dynamic configuration
- **leaderboards**: Ranking system

## 🚀 Deployment Options

### Development
```bash
npm run dev
```

### Production with PM2
```bash
npm run deploy:production
```

### Docker
```bash
docker build -t kaboom-game .
docker run -p 3000:3000 kaboom-game
```

### Docker Compose
```bash
docker-compose up -d
```

## 🧪 Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## 📊 Monitoring

### Health Checks
- `/health` - Application health status
- `/metrics` - System metrics and performance data

### Logging
- Structured JSON logs in `logs/` directory
- Automatic log rotation (30-day retention)
- Different log levels for development/production

### Cache Statistics
- Real-time cache hit/miss ratios
- Memory usage monitoring
- Cache invalidation strategies

## 🔧 Configuration

### Environment Variables
See `.env.example` for all available configuration options:
- Database settings
- Security tokens
- Rate limiting
- Cache TTL
- Logging levels
- CORS origins

### Production Considerations
- Set `NODE_ENV=production`
- Configure proper JWT secrets
- Set up SSL certificates
- Configure monitoring (Sentry, etc.)
- Set up log aggregation
- Configure backup strategies

## 🛡️ Security Features

- **Rate Limiting**: Different limits for different endpoint types
- **Input Validation**: Comprehensive validation with express-validator
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Input sanitization
- **CSRF Protection**: Security headers
- **Authentication**: JWT and admin token support
- **Authorization**: Role-based access control

## 📈 Performance Optimizations

- **Caching**: Multi-layer caching with different TTLs
- **Database Indexing**: Optimized queries with proper indexes
- **Compression**: Response compression
- **Static Files**: Efficient static file serving
- **Connection Pooling**: Database connection optimization

## 🔄 Migration from v1

The enhanced backend is fully backward compatible. To migrate:

1. Install new dependencies: `npm install`
2. Copy your existing database to `data/` directory
3. Run migration script: `npm run db:migrate`
4. Start enhanced server: `npm start`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Run tests: `npm test`
4. Commit changes: `git commit -m 'Add amazing feature'`
5. Push to branch: `git push origin feature/amazing-feature`
6. Open Pull Request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- Create an issue for bugs or feature requests
- Check the logs in `logs/` directory for troubleshooting
- Use `/health` endpoint to check system status
- Monitor `/metrics` for performance insights

---

**Enhanced Backend v2.0** - Production-ready, secure, and scalable! 🚀
