# 🚀 Kaboom Web3 Game - Deployment Guide

This guide provides step-by-step instructions for deploying the Kaboom Web3 game to multiple platforms: GitHub, Vercel, and Koyeb.

## 📋 Prerequisites

Before starting deployment, ensure you have:

- ✅ GitHub account
- ✅ Vercel account (free tier available)
- ✅ Koyeb account (free tier available)
- ✅ Solana wallet with test tokens
- ✅ Domain name (optional but recommended)

## 🎯 Deployment Strategy

### Recommended Architecture
- **Frontend**: Vercel (for static files and CDN)
- **Backend**: Koyeb (for API and WebSocket)
- **Database**: Koyeb PostgreSQL
- **Cache**: Koyeb Redis
- **Domain**: Custom domain with SSL

## 🌐 1. GitHub Repository Setup

### Step 1: Create GitHub Repository
1. Go to [GitHub](https://github.com)
2. Click "New repository"
3. Name: `kaboom-web3-game`
4. Description: `Modern Web3 blockchain game with real-time multiplayer`
5. Make it Public
6. Don't initialize with README (we already have one)

### Step 2: Push Your Code
```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Initial commit
git commit -m "Initial commit: Kaboom Web3 Game"

# Add remote origin
git remote add origin https://github.com/YOUR_USERNAME/kaboom-web3-game.git

# Push to main branch
git push -u origin main
```

### Step 3: Set Up GitHub Secrets
Go to your repository → Settings → Secrets and variables → Actions

Add these secrets:
```
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_vercel_org_id
VERCEL_PROJECT_ID=your_vercel_project_id
KOYEB_TOKEN=your_koyeb_token
NETLIFY_AUTH_TOKEN=your_netlify_token
NETLIFY_SITE_ID=your_netlify_site_id
SLACK_WEBHOOK=your_slack_webhook (optional)
```

## ⚡ 2. Vercel Deployment (Frontend)

### Step 1: Connect to Vercel
1. Go to [Vercel](https://vercel.com)
2. Sign up/Login with GitHub
3. Click "New Project"
4. Import your `kaboom-web3-game` repository

### Step 2: Configure Project
- **Framework Preset**: Other
- **Root Directory**: `./`
- **Build Command**: Leave empty (static files)
- **Output Directory**: Leave empty
- **Install Command**: `npm install`

### Step 3: Environment Variables
Add these in Vercel project settings:
```
BACKEND_URL=https://your-koyeb-backend-url.koyeb.app
NODE_ENV=production
```

### Step 4: Deploy
Click "Deploy" and wait for the build to complete.

### Step 5: Custom Domain (Optional)
1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. Enable SSL

## 🚀 3. Koyeb Deployment (Backend)

### Step 1: Create Koyeb Account
1. Go to [Koyeb](https://koyeb.com)
2. Sign up with GitHub
3. Verify your email

### Step 2: Create App
1. Click "Create App"
2. Choose "GitHub" as source
3. Select your `kaboom-web3-game` repository
4. Choose "main" branch

### Step 3: Configure Backend Service
- **Name**: `kaboom-backend`
- **Environment**: Node.js
- **Port**: `3000`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### Step 4: Environment Variables
Add these environment variables:
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@host:port/database
REDIS_URL=redis://user:password@host:port
JWT_SECRET=your-super-secret-jwt-key-here
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
BOOM_TOKEN_ADDRESS=your_boom_token_address
PIRATE_TOKEN_ADDRESS=your_pirate_token_address
ADMIRAL_TOKEN_ADDRESS=your_admiral_token_address
PLAYER_REGISTRY_ADDRESS=your_player_registry_address
ADMIN_WALLETS=wallet1,wallet2,wallet3
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Step 5: Create Database
1. In Koyeb dashboard, go to "Databases"
2. Click "Create Database"
3. Choose PostgreSQL
4. Select "Starter" plan
5. Choose region (closest to your users)
6. Note the connection details

### Step 6: Create Redis Cache
1. Go to "Databases" again
2. Click "Create Database"
3. Choose Redis
4. Select "Starter" plan
5. Choose same region as PostgreSQL
6. Note the connection details

### Step 7: Update Environment Variables
Update the `DATABASE_URL` and `REDIS_URL` with the actual connection strings from Koyeb.

### Step 8: Deploy
Click "Deploy" and wait for the service to be ready.

## 🔧 4. Configuration Updates

### Update Frontend Backend URL
After Koyeb deployment, update your Vercel environment variables:
```
BACKEND_URL=https://kaboom-backend-YOUR_APP_NAME.koyeb.app
```

### Update CORS Settings
In your Koyeb backend environment variables:
```
CORS_ORIGIN=https://your-vercel-domain.vercel.app
```

## 🧪 5. Testing Deployment

### Test Frontend
1. Visit your Vercel URL
2. Check if the game loads
3. Test wallet connection
4. Verify UI components load

### Test Backend
1. Visit `https://your-koyeb-backend-url.koyeb.app/health`
2. Should return health status
3. Test API endpoints

### Test Web3 Integration
1. Connect Phantom wallet
2. Check token balances
3. Test game session creation
4. Verify real-time updates

## 📊 6. Monitoring Setup

### Vercel Analytics
1. Go to Vercel project dashboard
2. Enable Analytics
3. Monitor Core Web Vitals
4. Set up alerts

### Koyeb Monitoring
1. Go to Koyeb app dashboard
2. Monitor logs and metrics
3. Set up health checks
4. Configure alerts

### Custom Monitoring
Set up monitoring for:
- API response times
- WebSocket connections
- Database performance
- Error rates

## 🔒 7. Security Configuration

### SSL/TLS
- Vercel: Automatic SSL
- Koyeb: Automatic SSL
- Custom domain: Configure SSL certificates

### Security Headers
Already configured in:
- `vercel.json`
- `netlify.toml`
- Backend middleware

### Rate Limiting
Configured in backend:
- API rate limiting
- WebSocket connection limits
- Database connection pooling

## 🚀 8. Production Checklist

### Before Going Live
- [ ] All environment variables set
- [ ] Database migrations completed
- [ ] SSL certificates active
- [ ] Health checks passing
- [ ] Performance tests completed
- [ ] Security audit passed
- [ ] Backup strategy configured

### Post-Deployment
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Test all game features
- [ ] Verify Web3 integration
- [ ] Set up monitoring alerts
- [ ] Document deployment process

## 🔄 9. Continuous Deployment

### GitHub Actions
The repository includes automated deployment:
- Tests run on every PR
- Automatic deployment on main branch
- Multi-platform deployment (Vercel, Koyeb, Netlify)

### Manual Deployment
```bash
# Update code
git add .
git commit -m "Update game features"
git push origin main

# GitHub Actions will automatically deploy
```

## 🆘 10. Troubleshooting

### Common Issues

#### Frontend Issues
- **CORS Errors**: Check CORS_ORIGIN in backend
- **Asset Loading**: Verify CDN configuration
- **Web3 Connection**: Check Solana network settings

#### Backend Issues
- **Database Connection**: Verify DATABASE_URL
- **Redis Connection**: Check REDIS_URL
- **WebSocket**: Ensure proper CORS configuration

#### Deployment Issues
- **Build Failures**: Check build logs
- **Environment Variables**: Verify all required variables
- **Domain Issues**: Check DNS configuration

### Debug Commands
```bash
# Check backend health
curl https://your-backend-url.koyeb.app/health

# Test WebSocket connection
wscat -c wss://your-backend-url.koyeb.app

# Check frontend
curl -I https://your-vercel-domain.vercel.app
```

## 📈 11. Scaling Strategy

### Horizontal Scaling
- Koyeb: Auto-scaling based on CPU usage
- Vercel: Global CDN distribution
- Database: Connection pooling

### Performance Optimization
- CDN for static assets
- Redis caching for frequently accessed data
- Database indexing for queries
- Image optimization

### Cost Optimization
- Use free tiers where possible
- Monitor resource usage
- Optimize database queries
- Implement caching strategies

## 🎯 12. Next Steps

### Immediate Actions
1. Set up monitoring and alerts
2. Configure backup strategies
3. Document deployment process
4. Train team on deployment

### Future Enhancements
1. Set up staging environment
2. Implement blue-green deployment
3. Add automated testing
4. Configure disaster recovery

---

## 🎉 Success!

Your Kaboom Web3 game is now deployed and ready for worldwide players! 

**Live URLs:**
- Frontend: `https://your-vercel-domain.vercel.app`
- Backend: `https://your-koyeb-backend-url.koyeb.app`
- Health Check: `https://your-koyeb-backend-url.koyeb.app/health`

**Next Steps:**
1. Share your game with the community
2. Monitor performance and user feedback
3. Plan future updates and features
4. Scale based on user growth

Happy gaming! 🎮🚀
