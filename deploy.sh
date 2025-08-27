#!/bin/bash

# Kaboom Game Production Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="kaboom-game"
DOMAIN="${1:-localhost}"
ENVIRONMENT="${2:-production}"

echo -e "${BLUE}🚀 Starting Kaboom Game Production Deployment${NC}"
echo -e "${BLUE}Domain: ${DOMAIN}${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo -e "${YELLOW}Please copy env.example to .env and configure your environment variables.${NC}"
    exit 1
fi

# Load environment variables
source .env

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Create necessary directories
echo -e "${BLUE}📁 Creating necessary directories...${NC}"
mkdir -p logs
mkdir -p ssl
mkdir -p monitoring
mkdir -p scripts

# Generate SSL certificates (self-signed for development)
if [ ! -f ssl/cert.pem ] || [ ! -f ssl/key.pem ]; then
    echo -e "${YELLOW}🔐 Generating SSL certificates...${NC}"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/key.pem \
        -out ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=${DOMAIN}"
    echo -e "${GREEN}✅ SSL certificates generated${NC}"
fi

# Create database initialization script
echo -e "${BLUE}🗄️ Creating database initialization script...${NC}"
cat > scripts/init-db.sql << 'EOF'
-- Create database extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_wallet_address ON players(wallet_address);
CREATE INDEX IF NOT EXISTS idx_players_total_score ON players(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_players_level ON players(level DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_wallet ON game_sessions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_game_sessions_start ON game_sessions(session_start);
CREATE INDEX IF NOT EXISTS idx_blockchain_transactions_wallet ON blockchain_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_blockchain_transactions_status ON blockchain_transactions(status);

-- Create views for common queries
CREATE OR REPLACE VIEW player_stats AS
SELECT 
    wallet_address,
    username,
    level,
    total_score,
    boom_tokens,
    lives,
    created_at,
    last_updated
FROM players
ORDER BY total_score DESC;

CREATE OR REPLACE VIEW daily_stats AS
SELECT 
    DATE(session_start) as date,
    COUNT(DISTINCT wallet_address) as unique_players,
    SUM(score_earned) as total_score,
    SUM(enemies_killed) as total_enemies_killed,
    SUM(levels_completed) as total_levels_completed
FROM game_sessions
WHERE session_start >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(session_start)
ORDER BY date DESC;
EOF

echo -e "${GREEN}✅ Database initialization script created${NC}"

# Create monitoring configuration
echo -e "${BLUE}📊 Creating monitoring configuration...${NC}"

# Prometheus configuration
cat > monitoring/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'kaboom-server'
    static_configs:
      - targets: ['kaboom-server:3000']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
EOF

# Grafana dashboard configuration
mkdir -p monitoring/grafana/dashboards
cat > monitoring/grafana/dashboards/kaboom-dashboard.json << 'EOF'
{
  "dashboard": {
    "id": null,
    "title": "Kaboom Game Dashboard",
    "tags": ["kaboom", "game"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Active Players",
        "type": "stat",
        "targets": [
          {
            "expr": "kaboom_active_players",
            "legendFormat": "Active Players"
          }
        ]
      },
      {
        "id": 2,
        "title": "Total Score",
        "type": "stat",
        "targets": [
          {
            "expr": "kaboom_total_score",
            "legendFormat": "Total Score"
          }
        ]
      }
    ],
    "time": {
      "from": "now-6h",
      "to": "now"
    },
    "refresh": "5s"
  }
}
EOF

echo -e "${GREEN}✅ Monitoring configuration created${NC}"

# Build and start services
echo -e "${BLUE}🐳 Building and starting Docker services...${NC}"

# Stop existing services
docker-compose down --remove-orphans

# Build images
docker-compose build --no-cache

# Start services
docker-compose up -d

# Wait for services to be healthy
echo -e "${BLUE}⏳ Waiting for services to be healthy...${NC}"
sleep 30

# Check service health
echo -e "${BLUE}🏥 Checking service health...${NC}"

# Check database
if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database is healthy${NC}"
else
    echo -e "${RED}❌ Database health check failed${NC}"
    exit 1
fi

# Check Redis
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is healthy${NC}"
else
    echo -e "${RED}❌ Redis health check failed${NC}"
    exit 1
fi

# Check application
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Application is healthy${NC}"
else
    echo -e "${RED}❌ Application health check failed${NC}"
    exit 1
fi

# Show service status
echo -e "${BLUE}📊 Service Status:${NC}"
docker-compose ps

# Show logs
echo -e "${BLUE}📋 Recent logs:${NC}"
docker-compose logs --tail=20

# Final instructions
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${BLUE}📱 Access your game at:${NC}"
echo -e "${GREEN}   Game: https://${DOMAIN}${NC}"
echo -e "${GREEN}   Admin: https://${DOMAIN}/admin-dashboard.html${NC}"
echo -e "${GREEN}   Health: https://${DOMAIN}/health${NC}"

if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${YELLOW}📊 Monitoring (optional):${NC}"
    echo -e "${GREEN}   Prometheus: https://${DOMAIN}:9090${NC}"
    echo -e "${GREEN}   Grafana: https://${DOMAIN}:3001${NC}"
fi

echo -e "${BLUE}🔧 Useful commands:${NC}"
echo -e "${GREEN}   View logs: docker-compose logs -f${NC}"
echo -e "${GREEN}   Stop services: docker-compose down${NC}"
echo -e "${GREEN}   Restart services: docker-compose restart${NC}"
echo -e "${GREEN}   Update services: docker-compose pull && docker-compose up -d${NC}"

echo -e "${YELLOW}⚠️  Remember to:${NC}"
echo -e "${YELLOW}   1. Configure your domain DNS to point to this server${NC}"
echo -e "${YELLOW}   2. Update SSL certificates with Let's Encrypt for production${NC}"
echo -e "${YELLOW}   3. Set up proper firewall rules${NC}"
echo -e "${YELLOW}   4. Configure backup strategies${NC}"
echo -e "${YELLOW}   5. Set up monitoring alerts${NC}"
