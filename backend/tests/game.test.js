const request = require('supertest');
const express = require('express');
const database = require('../config/database');
const apiRoutes = require('../routes/api');

const createTestApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v2', apiRoutes);
    return app;
};

describe('Game Controller', () => {
    let app;
    let testWallet = '11111111111111111111111111111111';
    let testSessionId = 'test-session-123';

    beforeAll(async () => {
        app = createTestApp();
        await database.connect();
        
        // Create test player
        await request(app)
            .post('/api/v2/players')
            .send({
                wallet_address: testWallet,
                username: 'testplayer'
            });
    });

    afterAll(async () => {
        await database.close();
    });

    beforeEach(async () => {
        // Clean up test sessions
        const db = database.getDatabase();
        await new Promise((resolve) => {
            db.run('DELETE FROM game_sessions WHERE session_id = ?', [testSessionId], resolve);
        });
    });

    describe('POST /api/v2/sessions', () => {
        it('should create a new game session', async () => {
            const sessionData = {
                session_id: testSessionId,
                wallet_address: testWallet,
                session_type: 'pve',
                device_type: 'desktop'
            };

            const response = await request(app)
                .post('/api/v2/sessions')
                .send(sessionData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.session_id).toBe(testSessionId);
            expect(response.body.data.wallet_address).toBe(testWallet);
        });

        it('should reject duplicate session ID', async () => {
            const sessionData = {
                session_id: testSessionId,
                wallet_address: testWallet
            };

            // Create first session
            await request(app)
                .post('/api/v2/sessions')
                .send(sessionData)
                .expect(201);

            // Try to create duplicate
            const response = await request(app)
                .post('/api/v2/sessions')
                .send(sessionData)
                .expect(409);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Session already exists');
        });
    });

    describe('GET /api/v2/sessions/:sessionId', () => {
        beforeEach(async () => {
            // Create test session
            await request(app)
                .post('/api/v2/sessions')
                .send({
                    session_id: testSessionId,
                    wallet_address: testWallet
                });
        });

        it('should get session by ID', async () => {
            const response = await request(app)
                .get(`/api/v2/sessions/${testSessionId}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.session_id).toBe(testSessionId);
        });

        it('should return 404 for non-existent session', async () => {
            const response = await request(app)
                .get('/api/v2/sessions/non-existent-session')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Game session not found');
        });
    });

    describe('PUT /api/v2/sessions/:sessionId', () => {
        beforeEach(async () => {
            // Create test session
            await request(app)
                .post('/api/v2/sessions')
                .send({
                    session_id: testSessionId,
                    wallet_address: testWallet
                });
        });

        it('should update session data', async () => {
            const updateData = {
                levels_completed: 5,
                score_earned: 1000,
                enemies_killed: 20
            };

            const response = await request(app)
                .put(`/api/v2/sessions/${testSessionId}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Game session updated successfully');
        });

        it('should complete session and update player stats', async () => {
            const updateData = {
                levels_completed: 3,
                score_earned: 500,
                tokens_earned: 50,
                is_completed: true
            };

            const response = await request(app)
                .put(`/api/v2/sessions/${testSessionId}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/v2/stats/game', () => {
        it('should return game statistics', async () => {
            const response = await request(app)
                .get('/api/v2/stats/game')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('total_players');
            expect(response.body.data).toHaveProperty('total_sessions');
            expect(response.body.data).toHaveProperty('total_score_earned');
        });
    });
});
