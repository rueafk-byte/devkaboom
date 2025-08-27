# 🚀 Quick Deployment Guide - Kaboom Web3 Game

## ✅ What's Already Done
- ✅ Git repository initialized
- ✅ All files committed
- ✅ Environment files created
- ✅ Dependencies installed
- ✅ Vercel CLI installed locally

## 🌐 Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click "New repository"
3. Name: `kaboom-web3-game`
4. Description: `Modern Web3 blockchain game with real-time multiplayer`
5. Make it **Public**
6. **Don't** initialize with README (we already have one)
7. Click "Create repository"

## 📤 Step 2: Push to GitHub

Run these commands in your terminal:

```bash
# Add your GitHub repository as remote origin
git remote add origin https://github.com/YOUR_USERNAME/kaboom-web3-game.git

# Push to GitHub
git push -u origin main
```

## ⚡ Step 3: Deploy to Vercel (Frontend)

1. Go to [Vercel](https://vercel.com)
2. Sign up/Login with GitHub
3. Click "New Project"
4. Import your `kaboom-web3-game` repository
5. Configure:
   - **Framework Preset**: Other
   - **Root Directory**: `./`
   - **Build Command**: Leave empty
   - **Output Directory**: Leave empty
   - **Install Command**: `npm install`
6. Add Environment Variables:
   ```
   BACKEND_URL=https://your-koyeb-backend-url.koyeb.app
   NODE_ENV=production
   ```
7. Click "Deploy"

## 🚀 Step 4: Deploy to Koyeb (Backend)

1. Go to [Koyeb](https://koyeb.com)
2. Sign up/Login with GitHub
3. Click "Create App"
4. Choose "GitHub" as source
5. Select your `kaboom-web3-game` repository
6. Choose "main" branch
7. Configure:
   - **Name**: `kaboom-backend`
   - **Environment**: Node.js
   - **Port**: `3000`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
8. Add Environment Variables (see below)
9. Click "Deploy"

### Koyeb Environment Variables:
```bash
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

## 🗄️ Step 5: Set Up Database (Koyeb)

1. In Koyeb dashboard, go to "Databases"
2. Click "Create Database"
3. Choose PostgreSQL
4. Select "Starter" plan
5. Choose region (closest to your users)
6. Note the connection details
7. Update `DATABASE_URL` in your app environment variables

## 🔄 Step 6: Set Up Redis (Koyeb)

1. Go to "Databases" again
2. Click "Create Database"
3. Choose Redis
4. Select "Starter" plan
5. Choose same region as PostgreSQL
6. Note the connection details
7. Update `REDIS_URL` in your app environment variables

## 🔗 Step 7: Update Frontend Backend URL

After Koyeb deployment, update your Vercel environment variables:
```
BACKEND_URL=https://kaboom-backend-YOUR_APP_NAME.koyeb.app
```

## 🧪 Step 8: Test Deployment

1. **Test Frontend**: Visit your Vercel URL
2. **Test Backend**: Visit `https://your-koyeb-backend-url.koyeb.app/health`
3. **Test Web3**: Connect Phantom wallet and test game features

## 📊 Step 9: Monitor & Optimize

1. **Vercel Analytics**: Enable in project dashboard
2. **Koyeb Monitoring**: Check logs and metrics
3. **Health Checks**: Monitor `/health` endpoint
4. **Performance**: Test game loading and Web3 integration

## 🎯 Your Live URLs

After deployment, you'll have:
- **Frontend**: `https://your-project-name.vercel.app`
- **Backend**: `https://kaboom-backend-your-app-name.koyeb.app`
- **Health Check**: `https://kaboom-backend-your-app-name.koyeb.app/health`

## 🆘 Troubleshooting

### Common Issues:
- **CORS Errors**: Check `CORS_ORIGIN` in backend
- **Database Connection**: Verify `DATABASE_URL`
- **Web3 Connection**: Check Solana network settings
- **Build Failures**: Check build logs in platform dashboards

### Debug Commands:
```bash
# Check backend health
curl https://your-backend-url.koyeb.app/health

# Test frontend
curl -I https://your-vercel-domain.vercel.app

# Check local development
npm run dev
```

## 🎉 Success!

Your Kaboom Web3 game is now deployed and ready for worldwide players! 

**Next Steps:**
1. Share your game with the community
2. Monitor performance and user feedback
3. Plan future updates and features
4. Scale based on user growth

Happy gaming! 🎮🚀
