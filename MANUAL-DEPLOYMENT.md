# 🚀 Manual Deployment Guide - Kaboom Web3 Game

## ❌ Why GitHub Pages Failed

GitHub Pages is designed for **static websites only**. Your Kaboom game has:
- Node.js backend server
- WebSocket connections
- Database requirements
- Web3 blockchain integration

These require a **full hosting platform**, not just static file hosting.

## ✅ Recommended Deployment Strategy

### **Frontend (Static Files) → Vercel**
### **Backend (Node.js) → Koyeb**

---

## 🌐 Step 1: Deploy Frontend to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. **Go to [Vercel](https://vercel.com)**
2. **Sign up/Login** with your GitHub account
3. **Click "New Project"**
4. **Import Git Repository**: Select `rueafk-byte/kaboom`
5. **Configure Project**:
   - **Framework Preset**: `Other`
   - **Root Directory**: `./`
   - **Build Command**: Leave empty
   - **Output Directory**: Leave empty
   - **Install Command**: `npm install`
6. **Environment Variables**:
   ```
   BACKEND_URL=https://your-koyeb-backend-url.koyeb.app
   NODE_ENV=production
   ```
7. **Click "Deploy"**

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

---

## 🚀 Step 2: Deploy Backend to Koyeb

### Via Koyeb Dashboard

1. **Go to [Koyeb](https://koyeb.com)**
2. **Sign up/Login** with your GitHub account
3. **Click "Create App"**
4. **Choose "GitHub"** as source
5. **Select Repository**: `rueafk-byte/kaboom`
6. **Choose "main"** branch
7. **Configure App**:
   - **Name**: `kaboom-backend`
   - **Environment**: `Node.js`
   - **Port**: `3000`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
8. **Add Environment Variables** (see below)
9. **Click "Deploy"**

### Environment Variables for Koyeb:

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

---

## 🗄️ Step 3: Set Up Database (Koyeb)

1. **In Koyeb Dashboard**, go to "Databases"
2. **Click "Create Database"**
3. **Choose PostgreSQL**
4. **Select "Starter"** plan
5. **Choose region** (closest to your users)
6. **Note connection details**
7. **Update `DATABASE_URL`** in your app environment variables

---

## 🔄 Step 4: Set Up Redis (Koyeb)

1. **Go to "Databases"** again
2. **Click "Create Database"**
3. **Choose Redis**
4. **Select "Starter"** plan
5. **Choose same region** as PostgreSQL
6. **Note connection details**
7. **Update `REDIS_URL`** in your app environment variables

---

## 🔗 Step 5: Connect Frontend to Backend

After Koyeb deployment, update your Vercel environment variables:
```
BACKEND_URL=https://kaboom-backend-YOUR_APP_NAME.koyeb.app
```

---

## 🧪 Step 6: Test Your Deployment

### Test Frontend
- Visit your Vercel URL
- Check if the game loads
- Test wallet connection

### Test Backend
- Visit: `https://your-koyeb-backend-url.koyeb.app/health`
- Should return: `{"status":"healthy","timestamp":"..."}`

### Test Web3 Integration
- Connect Phantom wallet
- Check token balances
- Test game session creation

---

## 🎯 Expected URLs

After successful deployment:
- **Frontend**: `https://your-project-name.vercel.app`
- **Backend**: `https://kaboom-backend-your-app-name.koyeb.app`
- **Health Check**: `https://kaboom-backend-your-app-name.koyeb.app/health`

---

## 🆘 Troubleshooting

### Common Issues:

**CORS Errors**
- Check `CORS_ORIGIN` in backend environment variables
- Make sure it includes your Vercel domain

**Database Connection**
- Verify `DATABASE_URL` format
- Check if database is running in Koyeb

**Web3 Connection**
- Ensure `SOLANA_RPC_URL` is correct
- Check if wallet addresses are valid

**Build Failures**
- Check build logs in platform dashboards
- Verify all dependencies are in `package.json`

### Debug Commands:
```bash
# Check backend health
curl https://your-backend-url.koyeb.app/health

# Test frontend
curl -I https://your-vercel-domain.vercel.app

# Check local development
npm run dev
```

---

## 🎉 Success!

Once deployed, your Kaboom Web3 game will be:
- ✅ **Globally accessible** via CDN
- ✅ **Real-time multiplayer** ready
- ✅ **Web3 integrated** with Solana
- ✅ **Scalable** and **monitored**
- ✅ **Secure** with proper authentication

**Your game will be live worldwide!** 🌍🎮🚀
