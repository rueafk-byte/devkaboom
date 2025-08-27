# 🎮 Kaboom Web3 Game

A modern Web3 blockchain game built with real-time multiplayer capabilities, token rewards, and worldwide optimization.

## 🌟 Features

- **Web3 Integration** - Solana blockchain with real token rewards
- **Real-time Multiplayer** - WebSocket communication for live gameplay
- **Global Optimization** - CDN integration and performance monitoring
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

## 🌍 Deployment Options

### 1. **Vercel Deployment** (Recommended for Frontend)

#### Automatic Deployment
1. Fork this repository to your GitHub account
2. Connect your GitHub account to [Vercel](https://vercel.com)
3. Import the repository in Vercel
4. Add environment variables in Vercel dashboard
5. Deploy automatically on every push to main branch

#### Manual Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

#### Environment Variables for Vercel
Add these in your Vercel project settings:
```
BACKEND_URL=https://your-backend-url.com
NODE_ENV=production
```

### 2. **Koyeb Deployment** (Recommended for Backend)

#### Using Koyeb CLI
```bash
# Install Koyeb CLI
curl -fsSL https://cli.koyeb.com/install.sh | bash

# Login to Koyeb
koyeb login

# Deploy using koyeb.yaml
koyeb app init kaboom-web3-game --docker ./koyeb.yaml
```

#### Using Koyeb Dashboard
1. Go to [Koyeb Dashboard](https://app.koyeb.com)
2. Click "Create App"
3. Connect your GitHub repository
4. Select the repository and main branch
5. Configure environment variables
6. Deploy

#### Environment Variables for Koyeb
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

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. **Netlify Deployment**

#### Using Netlify CLI
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

#### Using Netlify Dashboard
1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Click "New site from Git"
3. Connect your GitHub repository
4. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `.`
5. Add environment variables
6. Deploy

### 4. **GitHub Pages Deployment**

#### Using GitHub Actions
The repository includes a GitHub Actions workflow that automatically deploys to multiple platforms on every push to main branch.

1. Fork this repository
2. Add secrets to your GitHub repository:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
   - `KOYEB_TOKEN`
   - `NETLIFY_AUTH_TOKEN`
   - `NETLIFY_SITE_ID`

3. Push to main branch to trigger deployment

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
├── 📄 vercel.json                   # Vercel configuration
├── 📄 koyeb.yaml                    # Koyeb configuration
├── 📄 netlify.toml                  # Netlify configuration
├── 📄 .github/workflows/deploy.yml  # GitHub Actions
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
- **CDN Optimization** for global players
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

## 🚀 Production Deployment Checklist

### Before Deployment
- [ ] Set up environment variables
- [ ] Configure database and Redis
- [ ] Set up Solana smart contracts
- [ ] Configure domain and SSL
- [ ] Set up monitoring and logging
- [ ] Test all features locally

### After Deployment
- [ ] Verify health checks
- [ ] Test Web3 integration
- [ ] Monitor performance metrics
- [ ] Set up alerts and notifications
- [ ] Configure backup strategies
- [ ] Document deployment process

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
- Vercel, Koyeb, and Netlify for hosting platforms
- All contributors and players

---

**Ready to play? Deploy and start gaming! 🎮🚀**
