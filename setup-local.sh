#!/bin/bash

echo "🚀 Setting up Kaboom Web3 Game Local Environment..."

# Check if databases are running
echo "📊 Checking database services..."

# Check PostgreSQL
if brew services list | grep -q "postgresql.*started"; then
    echo "✅ PostgreSQL is running"
else
    echo "❌ PostgreSQL is not running. Starting..."
    brew services start postgresql@14
fi

# Check Redis
if brew services list | grep -q "redis.*started"; then
    echo "✅ Redis is running"
else
    echo "❌ Redis is not running. Starting..."
    brew services start redis
fi

# Create database if it doesn't exist
echo "🗄️ Setting up database..."
createdb kaboom_production 2>/dev/null || echo "Database already exists"

# Update .env file with local settings
echo "⚙️ Configuring environment variables..."
cat > .env << EOF
# Local Development Environment
NODE_ENV=development
PORT=3000

# Database Configuration (Local)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kaboom_production
DB_USER=$(whoami)
DB_PASSWORD=

# Redis Configuration (Local)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Security
JWT_SECRET=your_local_development_secret_key_change_in_production

# Solana Configuration (Testnet for development)
SOLANA_NETWORK=testnet
SOLANA_RPC_URL=https://api.testnet.solana.com
SOLANA_WS_URL=wss://api.testnet.solana.com

# Game Configuration
MAX_PLAYERS_PER_SESSION=100
GAME_SESSION_TIMEOUT=3600000
LEADERBOARD_UPDATE_INTERVAL=300000

# Logging
LOG_LEVEL=debug

# CORS (for local development)
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
EOF

echo "✅ Local environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Start the server: npm run dev"
echo "2. Open http://localhost:3000"
echo "3. The game will work with local storage"
echo ""
echo "🔧 For production deployment:"
echo "- Replace database URLs with cloud services"
echo "- Set proper JWT_SECRET"
echo "- Configure Solana mainnet addresses"
