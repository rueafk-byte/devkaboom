# 🎮 Kaboom Web3 Game

A modern Web3 blockchain game built with real-time multiplayer capabilities and token rewards.

## 🌟 Features

- **Web3 Integration** - Solana blockchain with real token rewards
- **Real-time Multiplayer** - WebSocket communication for live gameplay
- **Modern UI** - Dynamic components with responsive design
- **PWA Support** - Offline capabilities and app-like experience
- **Production Ready** - Scalable backend with monitoring

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Local Development
```bash
# Clone the repository
git clone https://github.com/yourusername/kaboom-web3-game.git
cd kaboom-web3-game

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
# (See Environment Variables section below)

# Start development server
npm run dev

# Open http://localhost:3000
```

## 🔧 Environment Variables

### Required Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database
REDIS_URL=redis://user:password@host:port

# Security
JWT_SECRET=your-super-secret-jwt-key-here

# Solana Configuration
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
BOOM_TOKEN_ADDRESS=your_boom_token_address
PIRATE_TOKEN_ADDRESS=your_pirate_token_address
ADMIRAL_TOKEN_ADDRESS=your_admiral_token_address
PLAYER_REGISTRY_ADDRESS=your_player_registry_address

# Admin Configuration
ADMIN_WALLETS=wallet1,wallet2,wallet3

# Backend URL (for frontend)
BACKEND_URL=https://your-backend-url.com
```

### Optional Variables
```bash
# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=*

# Monitoring
ENABLE_MONITORING=true
PROMETHEUS_PORT=9090

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## 📁 Project Structure

```
kaboom-web3-game/
├── 📄 index.html                    # Main game page
├── 📄 game.js                       # Core game logic
├── 📄 server.js                     # Backend server
├── 📄 package.json                  # Dependencies
├── 📁 web3/                         # Web3 integration
├── 📁 config/                       # Configuration files
├── 📁 middleware/                   # Express middleware
├── 📁 services/                     # Business logic
├── 📁 routes/                       # API routes
├── 📁 Sprites/                      # Game assets
└── 📁 music/                        # Audio files
```

## 🎮 Game Features

### Web3 Integration
- **Solana Wallet** connection (Phantom)
- **Token Rewards** ($BOOM, $PIRATE, $ADMIRAL)
- **Player Registry** on blockchain
- **Achievement System** with verification
- **Leaderboard** with global rankings

### Real-time Features
- **Live Gameplay** with WebSocket
- **Multiplayer Support** (coming soon)
- **Real-time Leaderboard** updates
- **Live Chat** (coming soon)

### Performance
- **Image Optimization** with lazy loading
- **Core Web Vitals** monitoring
- **Offline Support** with Service Worker

## 🔒 Security

- **JWT Authentication** for secure sessions
- **Rate Limiting** to prevent abuse
- **CORS Configuration** for security
- **Input Validation** and sanitization
- **Secure Headers** with Helmet

## 📊 Monitoring

### Health Checks
- **Backend Health**: `/health`
- **Database Status**: `/api/health/db`
- **Redis Status**: `/api/health/redis`
- **Web3 Status**: `/api/health/web3`

### Metrics
- **Performance Metrics**: Core Web Vitals
- **Game Metrics**: FPS, latency, errors
- **Business Metrics**: Players, sessions, rewards

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Wiki](https://github.com/yourusername/kaboom-web3-game/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/kaboom-web3-game/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/kaboom-web3-game/discussions)
- **Email**: support@kaboom-game.com

## 🌟 Acknowledgments

- Solana Foundation for blockchain infrastructure
- Socket.IO for real-time communication
- All contributors and players

---

**Ready to play? Start the game locally! 🎮🚀**
