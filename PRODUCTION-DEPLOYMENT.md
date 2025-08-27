# 🚀 Kaboom Game - Production Deployment Guide

This guide will help you deploy the Kaboom Web3 game for worldwide hosting with production-grade infrastructure.

## 📋 Prerequisites

### Server Requirements
- **OS**: Ubuntu 20.04+ or CentOS 8+
- **CPU**: 4+ cores (8+ recommended for high traffic)
- **RAM**: 8GB+ (16GB+ recommended)
- **Storage**: 100GB+ SSD
- **Network**: 100Mbps+ bandwidth
- **Domain**: A registered domain name

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Git
- OpenSSL
- Nginx (optional, included in Docker setup)

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   CDN/CloudFlare│    │   DNS Provider  │
│   (Optional)    │    │   (Optional)    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Nginx Proxy   │
                    │   (SSL/TLS)     │
                    └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Kaboom Server  │    │   PostgreSQL    │    │     Redis       │
│   (Node.js)     │    │   (Database)    │    │   (Cache)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Solana RPC    │
                    │   (Blockchain)  │
                    └─────────────────┘
```

## 🚀 Quick Deployment

### 1. Clone and Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd kaboom-game

# Copy environment template
cp env.example .env
```

### 2. Configure Environment
Edit `.env` file with your production settings:

```bash
# Production Environment
NODE_ENV=production
PORT=3000

# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=kaboom_production
DB_USER=postgres
DB_PASSWORD=your_secure_password_here

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here

# Solana Network (Mainnet)
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WS_URL=wss://api.mainnet-beta.solana.com

# Smart Contract Addresses (Deploy your contracts first)
BOOM_TOKEN_ADDRESS=your_boom_token_address
PIRATE_TOKEN_ADDRESS=your_pirate_token_address
ADMIRAL_TOKEN_ADDRESS=your_admiral_token_address
PLAYER_REGISTRY_ADDRESS=your_player_registry_address

# Security
JWT_SECRET=your_super_secure_jwt_secret_key_here
CORS_ORIGIN=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Deploy
```bash
# Make deployment script executable
chmod +x deploy.sh

# Deploy with your domain
./deploy.sh yourdomain.com production
```

## 🔧 Manual Deployment Steps

### 1. Server Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
```

### 2. Domain and SSL Setup
```bash
# Point your domain to this server's IP
# A record: yourdomain.com -> YOUR_SERVER_IP
# A record: www.yourdomain.com -> YOUR_SERVER_IP

# For production SSL certificates (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Update nginx.conf with your certificate paths
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### 3. Firewall Configuration
```bash
# Configure UFW firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3000/tcp  # Game server (if needed)
sudo ufw enable
```

### 4. Start Services
```bash
# Build and start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

## 📊 Monitoring and Maintenance

### Health Checks
```bash
# Check application health
curl https://yourdomain.com/health

# Check database
docker-compose exec postgres pg_isready -U postgres

# Check Redis
docker-compose exec redis redis-cli ping
```

### Logs and Debugging
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f kaboom-server
docker-compose logs -f postgres
docker-compose logs -f redis

# Access application logs
tail -f logs/combined.log
tail -f logs/error.log
```

### Backup Strategy
```bash
# Database backup
docker-compose exec postgres pg_dump -U postgres kaboom_production > backup_$(date +%Y%m%d_%H%M%S).sql

# Redis backup
docker-compose exec redis redis-cli BGSAVE

# Automated backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
docker-compose exec -T postgres pg_dump -U postgres kaboom_production > $BACKUP_DIR/db_backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete
EOF

chmod +x backup.sh
```

## 🔒 Security Considerations

### 1. Environment Variables
- Use strong, unique passwords
- Rotate secrets regularly
- Never commit `.env` files to version control

### 2. Network Security
- Use HTTPS only
- Implement rate limiting
- Configure proper CORS policies
- Use security headers

### 3. Database Security
- Use strong database passwords
- Limit database access to application only
- Regular security updates
- Encrypt sensitive data

### 4. Application Security
- Keep dependencies updated
- Implement input validation
- Use prepared statements
- Monitor for suspicious activity

## 📈 Scaling and Performance

### Horizontal Scaling
```bash
# Scale application instances
docker-compose up -d --scale kaboom-server=3

# Update nginx.conf for load balancing
upstream kaboom_backend {
    server kaboom-server:3000;
    server kaboom-server_2:3000;
    server kaboom-server_3:3000;
}
```

### Performance Optimization
- Enable Redis caching
- Use CDN for static assets
- Optimize database queries
- Implement connection pooling
- Use compression

### Monitoring Setup
```bash
# Start monitoring services
docker-compose --profile monitoring up -d

# Access monitoring
# Prometheus: https://yourdomain.com:9090
# Grafana: https://yourdomain.com:3001
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Database Connection Issues
```bash
# Check database status
docker-compose exec postgres pg_isready -U postgres

# Check database logs
docker-compose logs postgres

# Reset database (WARNING: Data loss)
docker-compose down
docker volume rm kaboom_postgres_data
docker-compose up -d
```

#### 2. Redis Connection Issues
```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# Check Redis logs
docker-compose logs redis

# Reset Redis (WARNING: Cache loss)
docker-compose down
docker volume rm kaboom_redis_data
docker-compose up -d
```

#### 3. Application Issues
```bash
# Check application logs
docker-compose logs kaboom-server

# Restart application
docker-compose restart kaboom-server

# Check application health
curl http://localhost:3000/health
```

#### 4. SSL Issues
```bash
# Check SSL certificate
openssl x509 -in ssl/cert.pem -text -noout

# Renew Let's Encrypt certificate
sudo certbot renew

# Test SSL configuration
curl -I https://yourdomain.com
```

## 📞 Support and Maintenance

### Regular Maintenance Tasks
- [ ] Weekly: Check logs for errors
- [ ] Weekly: Update dependencies
- [ ] Monthly: Review security patches
- [ ] Monthly: Backup verification
- [ ] Quarterly: Performance review
- [ ] Quarterly: Security audit

### Emergency Procedures
1. **Service Down**: Check `docker-compose ps` and restart services
2. **Database Issues**: Check logs and restore from backup if needed
3. **SSL Expired**: Renew certificates with `certbot renew`
4. **High Load**: Scale horizontally or optimize performance
5. **Security Breach**: Isolate affected services and investigate

### Contact Information
- **Technical Support**: [Your Support Email]
- **Emergency**: [Your Emergency Contact]
- **Documentation**: [Your Documentation URL]

## 🎯 Production Checklist

Before going live, ensure:

- [ ] All environment variables are configured
- [ ] SSL certificates are valid
- [ ] Database is properly initialized
- [ ] Redis is connected and working
- [ ] Web3 contracts are deployed and configured
- [ ] Monitoring is set up
- [ ] Backup strategy is implemented
- [ ] Security measures are in place
- [ ] Load testing is completed
- [ ] Documentation is updated
- [ ] Team is trained on maintenance procedures

## 🚀 Going Live

Once everything is configured and tested:

1. **DNS**: Point your domain to the server
2. **SSL**: Ensure HTTPS is working
3. **Monitoring**: Start monitoring services
4. **Backup**: Perform initial backup
5. **Announcement**: Notify users about the launch
6. **Monitoring**: Watch for issues during launch

Congratulations! Your Kaboom game is now live and ready for worldwide players! 🎉
