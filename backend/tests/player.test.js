const request = require('supertest');
const express = require('express');
const database = require('../config/database');
const apiRoutes = require('../routes/api');

// Test app setup
const createTestApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v2', apiRoutes);
    return app;
};

describe('Player Controller', () => {
    let app;
    let testWallet = '11111111111111111111111111111111';

    beforeAll(async () => {
        app = createTestApp();
        await database.connect();
    });

    afterAll(async () => {
        await database.close();
    });

    beforeEach(async () => {
        // Clean up test data
        const db = database.getDatabase();
        await new Promise((resolve) => {
            db.run('DELETE FROM players WHERE wallet_address = ?', [testWallet], resolve);
        });
    });

    describe('POST /api/v2/players', () => {
        it('should create a new player', async () => {
            const playerData = {
                wallet_address: testWallet,
                username: 'testplayer',
                email: 'test@example.com'
            };

            const response = await request(app)
                .post('/api/v2/players')
                .send(playerData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.wallet_address).toBe(testWallet);
            expect(response.body.data.username).toBe('testplayer');
        });

        it('should reject invalid wallet address', async () => {
            const playerData = {
                wallet_address: 'invalid-wallet',
                username: 'testplayer'
            };

            const response = await request(app)
                .post('/api/v2/players')
                .send(playerData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Validation failed');
        });

        it('should reject duplicate wallet address', async () => {
            const playerData = {
                wallet_address: testWallet,
                username: 'testplayer'
            };

            // Create first player
            await request(app)
                .post('/api/v2/players')
                .send(playerData)
                .expect(201);

            // Try to create duplicate
            const response = await request(app)
                .post('/api/v2/players')
                .send(playerData)
                .expect(409);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Player already exists');
        });
    });

    describe('GET /api/v2/players/:walletAddress', () => {
        beforeEach(async () => {
            // Create test player
            await request(app)
                .post('/api/v2/players')
                .send({
                    wallet_address: testWallet,
                    username: 'testplayer',
                    email: 'test@example.com'
                });
        });

        it('should get player by wallet address', async () => {
            const response = await request(app)
                .get(`/api/v2/players/${testWallet}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.player.wallet_address).toBe(testWallet);
            expect(response.body.data.player.username).toBe('testplayer');
        });

        it('should return 404 for non-existent player', async () => {
            const nonExistentWallet = '22222222222222222222222222222222';
            
            const response = await request(app)
                .get(`/api/v2/players/${nonExistentWallet}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Player not found');
        });
    });

    describe('PUT /api/v2/players/:walletAddress', () => {
        beforeEach(async () => {
            // Create test player
            await request(app)
                .post('/api/v2/players')
                .send({
                    wallet_address: testWallet,
                    username: 'testplayer',
                    total_score: 100
                });
        });

        it('should update player data', async () => {
            const updateData = {
                username: 'updatedplayer',
                total_score: 500
            };

            const response = await request(app)
                .put(`/api/v2/players/${testWallet}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Player updated successfully');
        });

        it('should reject invalid update data', async () => {
            const updateData = {
                level: -1 // Invalid level
            };

            const response = await request(app)
                .put(`/api/v2/players/${testWallet}`)
                .send(updateData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/v2/leaderboard', () => {
        beforeEach(async () => {
            // Create test players
            const players = [
                { wallet_address: '11111111111111111111111111111111', username: 'player1', total_score: 1000 },
                { wallet_address: '22222222222222222222222222222222', username: 'player2', total_score: 800 },
                { wallet_address: '33333333333333333333333333333333', username: 'player3', total_score: 600 }
            ];

            for (const player of players) {
                await request(app)
                    .post('/api/v2/players')
                    .send(player);
            }
        });

        afterEach(async () => {
            // Clean up test players
            const db = database.getDatabase();
            const wallets = ['11111111111111111111111111111111', '22222222222222222222222222222222', '33333333333333333333333333333333'];
            for (const wallet of wallets) {
                await new Promise((resolve) => {
                    db.run('DELETE FROM players WHERE wallet_address = ?', [wallet], resolve);
                });
            }
        });

        it('should return leaderboard sorted by score', async () => {
            const response = await request(app)
                .get('/api/v2/leaderboard')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.leaderboard).toHaveLength(3);
            expect(response.body.data.leaderboard[0].username).toBe('player1');
            expect(response.body.data.leaderboard[0].value).toBe(1000);
        });

        it('should support pagination', async () => {
            const response = await request(app)
                .get('/api/v2/leaderboard?limit=2&offset=1')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.leaderboard).toHaveLength(2);
            expect(response.body.data.pagination.limit).toBe(2);
            expect(response.body.data.pagination.offset).toBe(1);
        });
    });
});
