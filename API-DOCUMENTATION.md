# 🎮 Kaboom Game - API Documentation

Complete API documentation for the Kaboom Web3 game backend system.

## 📋 Table of Contents

- [Authentication](#authentication)
- [Player Management](#player-management)
- [Game Management](#game-management)
- [Leaderboards](#leaderboards)
- [Web3 Integration](#web3-integration)
- [Admin Panel](#admin-panel)
- [Error Handling](#error-handling)

## 🔐 Authentication

### Wallet Authentication
All authenticated endpoints require wallet signature verification.

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "walletAddress": "string",
  "signature": "string"
}
```

## 👥 Player Management

### Get All Players
```
GET /api/players?page=1&limit=50
```

**Response:**
```json
{
  "success": true,
  "players": [
    {
      "id": 1,
      "wallet_address": "string",
      "username": "string",
      "level": 1,
      "total_score": 0,
      "boom_tokens": 0,
      "pirate_tokens": 0,
      "admiral_tokens": 0,
      "lives": 3,
      "current_score": 0,
      "achievements": [],
      "game_stats": {},
      "last_updated": "2024-01-01T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "pages": 2
  }
}
```

### Get Player by Wallet Address
```
GET /api/players/{walletAddress}
```

### Create or Update Player
```
POST /api/players
```

**Request Body:**
```json
{
  "walletAddress": "string",
  "username": "string",
  "level": 1,
  "totalScore": 0,
  "boomTokens": 0,
  "lives": 3,
  "currentScore": 0
}
```

### Update Player Progress
```
PUT /api/players/{walletAddress}/progress
```

**Request Body:**
```json
{
  "level": 1,
  "totalScore": 1000,
  "boomTokens": 50,
  "lives": 3,
  "currentScore": 500
}
```

### Get Player Achievements
```
GET /api/players/{walletAddress}/achievements
```

### Add Player Achievement
```
POST /api/players/{walletAddress}/achievements
```

**Request Body:**
```json
{
  "achievementId": "string",
  "achievementName": "string",
  "achievementDescription": "string",
  "rewardTokens": {
    "boom": 50,
    "pirate": 5,
    "admiral": 2
  }
}
```

### Get Player Game Sessions
```
GET /api/players/{walletAddress}/sessions?page=1&limit=20
```

### Search Players
```
GET /api/players/search/{query}?limit=20
```

## 🎮 Game Management

### Start New Game Session
```
POST /api/game/session/start
```

**Request Body:**
```json
{
  "walletAddress": "string",
  "level": 1,
  "difficulty": "normal",
  "gameMode": "standard"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "uuid",
  "sessionData": {
    "sessionId": "uuid",
    "walletAddress": "string",
    "level": 1,
    "difficulty": "normal",
    "gameMode": "standard",
    "startTime": "2024-01-01T00:00:00Z",
    "score": 0,
    "lives": 3,
    "bombs": 3,
    "enemiesKilled": 0,
    "powerUpsCollected": 0,
    "gameState": "active"
  }
}
```

### Update Game State
```
PUT /api/game/session/{sessionId}/update
```

**Request Body:**
```json
{
  "walletAddress": "string",
  "score": 1000,
  "lives": 2,
  "bombs": 2,
  "enemiesKilled": 5,
  "powerUpsCollected": 2,
  "gameState": "active",
  "position": {
    "x": 100,
    "y": 200
  }
}
```

### Complete Level
```
POST /api/game/session/{sessionId}/complete
```

**Request Body:**
```json
{
  "walletAddress": "string",
  "level": 1,
  "score": 1500,
  "enemiesKilled": 8,
  "powerUpsCollected": 3,
  "completionTime": 45,
  "difficulty": "normal"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Level completed",
  "rewards": {
    "boom": 75,
    "level": 1,
    "score": 1500
  },
  "newStats": {
    "level": 2,
    "totalScore": 1500,
    "boomTokens": 75
  }
}
```

### Game Over
```
POST /api/game/session/{sessionId}/gameover
```

**Request Body:**
```json
{
  "walletAddress": "string",
  "finalScore": 800,
  "enemiesKilled": 4,
  "powerUpsCollected": 1,
  "gameTime": 120
}
```

### Get Current Game Session
```
GET /api/game/session/{sessionId}
```

### Get Active Sessions
```
GET /api/game/sessions/active/{walletAddress}
```

### Get Player Statistics
```
GET /api/game/stats/{walletAddress}
```

**Response:**
```json
{
  "success": true,
  "player": {
    "id": 1,
    "wallet_address": "string",
    "username": "string",
    "level": 5,
    "total_score": 5000,
    "boom_tokens": 250
  },
  "statistics": {
    "total_sessions": 10,
    "total_score_earned": 5000,
    "total_enemies_killed": 50,
    "total_levels_completed": 5,
    "avg_session_time": 300,
    "highest_score": 1500,
    "completed_sessions": 8
  },
  "achievements": [
    {
      "id": 1,
      "achievement_id": "first_win",
      "achievement_name": "First Victory",
      "achievement_description": "Complete your first level",
      "reward_tokens": {
        "boom": 50
      },
      "unlocked_at": "2024-01-01T00:00:00Z"
    }
  ],
  "recentSessions": [
    {
      "id": 1,
      "session_id": "uuid",
      "session_start": "2024-01-01T00:00:00Z",
      "session_end": "2024-01-01T00:05:00Z",
      "score_earned": 1000,
      "tokens_earned": {
        "boom": 50
      },
      "enemies_killed": 8,
      "levels_completed": 1
    }
  ]
}
```

### Get Online Players
```
GET /api/game/online
```

### Get Game Configuration
```
GET /api/game/config
```

### Submit Score
```
POST /api/game/score/submit
```

**Request Body:**
```json
{
  "walletAddress": "string",
  "level": 1,
  "score": 1500,
  "difficulty": "normal",
  "gameMode": "standard",
  "completionTime": 45
}
```

## 🏆 Leaderboards

### Get Global Leaderboard
```
GET /api/leaderboard/global?page=1&limit=100
```

### Get Level-Specific Leaderboard
```
GET /api/leaderboard/level/{level}?page=1&limit=50
```

### Get Token Leaderboard
```
GET /api/leaderboard/tokens/{tokenType}?page=1&limit=100
```
*tokenType: boom, pirate, admiral*

### Get Achievement Leaderboard
```
GET /api/leaderboard/achievements?page=1&limit=50
```

### Get Player Rank
```
GET /api/leaderboard/player/{walletAddress}/rank?type=global
```
*type: global, level*

### Get Leaderboard Statistics
```
GET /api/leaderboard/stats
```

### Get Leaderboard History
```
GET /api/leaderboard/history/{type}?days=30
```
*type: players, scores, tokens*

### Force Update Leaderboard Cache
```
POST /api/leaderboard/update-cache
```

## ⛓️ Web3 Integration

### Get Blockchain Status
```
GET /api/web3/status
```

### Get Wallet Balance
```
GET /api/web3/wallet/{walletAddress}/balance
```

### Get Token Balance
```
GET /api/web3/wallet/{walletAddress}/tokens/{tokenType}
```

### Register Player on Blockchain
```
POST /api/web3/register
```

**Request Body:**
```json
{
  "walletAddress": "string",
  "username": "string"
}
```

### Get Player Profile from Blockchain
```
GET /api/web3/player/{walletAddress}/profile
```

### Process Level Completion Reward
```
POST /api/web3/reward/level-completion
```

**Request Body:**
```json
{
  "walletAddress": "string",
  "level": 1,
  "score": 1500,
  "enemiesKilled": 8,
  "powerUpsCollected": 3,
  "completionTime": 45,
  "difficulty": "normal"
}
```

### Get Transaction History
```
GET /api/web3/transactions/{walletAddress}?page=1&limit=20
```

### Verify Wallet Signature
```
POST /api/web3/verify-signature
```

**Request Body:**
```json
{
  "walletAddress": "string",
  "signature": "string",
  "message": "string"
}
```

### Get Contract Addresses
```
GET /api/web3/contracts
```

### Get Blockchain Network Info
```
GET /api/web3/network
```

### Get Token Metadata
```
GET /api/web3/tokens/{tokenType}/metadata
```

### Get Recent Transactions
```
GET /api/web3/transactions/recent?limit=50
```

### Get Transaction Statistics
```
GET /api/web3/transactions/stats
```

## 🔧 Admin Panel

*All admin endpoints require admin authentication*

### Get Admin Dashboard
```
GET /api/admin/dashboard
```

### Get All Players (Admin)
```
GET /api/admin/players?page=1&limit=50&search=&sortBy=total_score&sortOrder=DESC
```

### Get Player Details (Admin)
```
GET /api/admin/players/{walletAddress}
```

### Update Player (Admin)
```
PUT /api/admin/players/{walletAddress}
```

**Request Body:**
```json
{
  "username": "string",
  "level": 1,
  "totalScore": 0,
  "boomTokens": 0,
  "pirateTokens": 0,
  "admiralTokens": 0,
  "lives": 3
}
```

### Reset Player Progress (Admin)
```
POST /api/admin/players/{walletAddress}/reset
```

**Request Body:**
```json
{
  "resetType": "full"
}
```
*resetType: progress, tokens, full*

### Delete Player (Admin)
```
DELETE /api/admin/players/{walletAddress}
```

### Get Admin Action Log
```
GET /api/admin/actions?page=1&limit=50&actionType=&adminWallet=
```

### Get System Statistics (Admin)
```
GET /api/admin/system/stats
```

### Get Game Configuration (Admin)
```
GET /api/admin/config
```

### Update Game Configuration (Admin)
```
PUT /api/admin/config
```

**Request Body:**
```json
{
  "config": {
    "game": {
      "maxLevel": 40,
      "maxLives": 3,
      "maxBombs": 3
    },
    "rewards": {
      "levelCompletion": {
        "base": 10,
        "scoreMultiplier": 0.001
      }
    }
  }
}
```

### Get Blockchain Status (Admin)
```
GET /api/admin/blockchain/status
```

### Force Leaderboard Update (Admin)
```
POST /api/admin/leaderboard/update
```

### Get Online Players (Admin)
```
GET /api/admin/online
```

### Kick Player (Admin)
```
POST /api/admin/players/{walletAddress}/kick
```

## 🚨 Error Handling

### Error Response Format
```json
{
  "error": "Error message",
  "message": "Detailed error description",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Common HTTP Status Codes

- **200** - Success
- **201** - Created
- **400** - Bad Request
- **401** - Unauthorized
- **403** - Forbidden
- **404** - Not Found
- **429** - Too Many Requests
- **500** - Internal Server Error
- **503** - Service Unavailable

### Error Types

- **ValidationError** - Invalid input data
- **UnauthorizedError** - Authentication required
- **ForbiddenError** - Access denied
- **NotFoundError** - Resource not found
- **DatabaseError** - Database operation failed
- **Web3Error** - Blockchain operation failed

## 📊 Rate Limiting

- **General API**: 100 requests per 15 minutes
- **Authentication**: 5 requests per 15 minutes
- **Game State Updates**: 60 requests per minute
- **Admin Endpoints**: 10 requests per minute

## 🔒 Security

### Required Headers
```
Content-Type: application/json
Authorization: Bearer <token> (for admin endpoints)
```

### CORS Configuration
- Origin: Configurable via environment variable
- Methods: GET, POST, PUT, DELETE, OPTIONS
- Headers: Content-Type, Authorization, X-Requested-With

### Security Headers
- X-Frame-Options: SAMEORIGIN
- X-XSS-Protection: 1; mode=block
- X-Content-Type-Options: nosniff
- Referrer-Policy: no-referrer-when-downgrade
- Strict-Transport-Security: max-age=31536000; includeSubDomains

## 📈 Monitoring

### Health Check
```
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "web3": true
  },
  "uptime": 3600,
  "memory": {
    "rss": 123456789,
    "heapTotal": 987654321,
    "heapUsed": 123456789,
    "external": 12345
  },
  "version": "2.0.0"
}
```

## 🚀 WebSocket Events

### Connection
```javascript
const socket = io('ws://localhost:3000');
```

### Authentication
```javascript
socket.emit('authenticate', {
  walletAddress: 'string',
  signature: 'string'
});

socket.on('authenticated', (response) => {
  console.log(response.success);
});
```

### Game State Updates
```javascript
socket.emit('gameStateUpdate', {
  gameState: {},
  score: 1000,
  level: 1
});

socket.on('playerUpdate', (data) => {
  console.log(data.walletAddress, data.score, data.level);
});
```

### Level Completion
```javascript
socket.emit('levelComplete', {
  level: 1,
  score: 1500,
  tokensEarned: {
    boom: 75
  }
});

socket.on('levelRewardProcessed', (result) => {
  console.log(result.success, result.reward);
});
```

## 📝 Examples

### Complete Game Flow Example

1. **Connect Wallet**
```javascript
// Verify wallet signature
const response = await fetch('/api/web3/verify-signature', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: 'user_wallet_address',
    signature: 'wallet_signature'
  })
});
```

2. **Start Game Session**
```javascript
const session = await fetch('/api/game/session/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: 'user_wallet_address',
    level: 1,
    difficulty: 'normal',
    gameMode: 'standard'
  })
});
```

3. **Update Game State**
```javascript
const update = await fetch(`/api/game/session/${sessionId}/update`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: 'user_wallet_address',
    score: 1000,
    lives: 2,
    bombs: 2,
    enemiesKilled: 5,
    powerUpsCollected: 2,
    gameState: 'active',
    position: { x: 100, y: 200 }
  })
});
```

4. **Complete Level**
```javascript
const completion = await fetch(`/api/game/session/${sessionId}/complete`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: 'user_wallet_address',
    level: 1,
    score: 1500,
    enemiesKilled: 8,
    powerUpsCollected: 3,
    completionTime: 45,
    difficulty: 'normal'
  })
});
```

5. **Check Leaderboard**
```javascript
const leaderboard = await fetch('/api/leaderboard/global?limit=10');
```

This completes the comprehensive API documentation for the Kaboom Web3 game backend system! 🎉
