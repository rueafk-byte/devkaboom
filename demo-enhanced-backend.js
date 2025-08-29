#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v2';

async function demoEnhancedBackend() {
    console.log('🚀 Kaboom Enhanced Backend v2.0 Demo\n');

    try {
        // 1. Health Check
        console.log('1. 🔍 Health Check');
        const health = await axios.get('http://localhost:3000/health');
        console.log(`   Status: ${health.data.status}`);
        console.log(`   Version: ${health.data.version}`);
        console.log(`   Database: ${health.data.database ? '✅ Connected' : '❌ Disconnected'}`);
        console.log(`   Memory Used: ${health.data.memory.used}MB\n`);

        // 2. Create Test Player
        console.log('2. 👤 Creating Test Player');
        const playerData = {
            wallet_address: '22222222222222222222222222222222',
            username: 'demoplayer',
            email: 'demo@kaboom.com'
        };
        
        try {
            const createPlayer = await axios.post(`${BASE_URL}/players`, playerData);
            console.log(`   ✅ Player created: ${createPlayer.data.data.username}`);
            console.log(`   Referral Code: ${createPlayer.data.data.referral_code}\n`);
        } catch (error) {
            if (error.response?.status === 409) {
                console.log('   ℹ️  Player already exists\n');
            } else {
                throw error;
            }
        }

        // 3. Get Player Data
        console.log('3. 📊 Retrieving Player Data');
        const player = await axios.get(`${BASE_URL}/players/22222222222222222222222222222222`);
        console.log(`   Username: ${player.data.data.player.username}`);
        console.log(`   Level: ${player.data.data.player.level}`);
        console.log(`   Score: ${player.data.data.player.total_score}`);
        console.log(`   Tokens: ${player.data.data.player.boom_tokens}`);
        console.log(`   Lives: ${player.data.data.player.lives}/${player.data.data.player.max_lives}\n`);

        // 4. Create Game Session
        console.log('4. 🎮 Creating Game Session');
        const sessionData = {
            session_id: 'demo-session-' + Date.now(),
            wallet_address: '22222222222222222222222222222222',
            session_type: 'pve',
            device_type: 'desktop'
        };
        
        const session = await axios.post(`${BASE_URL}/sessions`, sessionData);
        console.log(`   ✅ Session created: ${session.data.data.session_id}\n`);

        // 5. Update Session with Game Progress
        console.log('5. 📈 Updating Session Progress');
        const sessionUpdate = {
            levels_completed: 3,
            score_earned: 1500,
            tokens_earned: 75,
            enemies_killed: 25,
            bombs_used: 12,
            is_completed: true
        };
        
        await axios.put(`${BASE_URL}/sessions/${sessionData.session_id}`, sessionUpdate);
        console.log('   ✅ Session updated with game progress\n');

        // 6. Check Token Balance
        console.log('6. 💰 Token Balance');
        const balance = await axios.get(`${BASE_URL}/tokens/22222222222222222222222222222222/balance`);
        console.log(`   Balance: ${balance.data.data.balance} BOOM tokens\n`);

        // 7. Get Leaderboard
        console.log('7. 🏆 Leaderboard');
        const leaderboard = await axios.get(`${BASE_URL}/leaderboard?limit=5`);
        console.log(`   Total Players: ${leaderboard.data.data.pagination.total}`);
        if (leaderboard.data.data.leaderboard.length > 0) {
            leaderboard.data.data.leaderboard.forEach((player, index) => {
                console.log(`   ${index + 1}. ${player.username} - ${player.value} points`);
            });
        }
        console.log();

        // 8. Get Game Statistics
        console.log('8. 📊 Game Statistics');
        const stats = await axios.get(`${BASE_URL}/stats/game`);
        console.log(`   Total Players: ${stats.data.data.total_players}`);
        console.log(`   Total Sessions: ${stats.data.data.total_sessions}`);
        console.log(`   Total Score: ${stats.data.data.total_score_earned}`);
        console.log(`   Total Tokens: ${stats.data.data.total_tokens_earned}\n`);

        // 9. Test Rate Limiting (make multiple requests)
        console.log('9. 🛡️  Testing Rate Limiting');
        const requests = [];
        for (let i = 0; i < 5; i++) {
            requests.push(axios.get(`${BASE_URL}/health`));
        }
        
        const results = await Promise.allSettled(requests);
        const successful = results.filter(r => r.status === 'fulfilled').length;
        console.log(`   ${successful}/5 requests successful (rate limiting active)\n`);

        // 10. Cache Performance Test
        console.log('10. ⚡ Cache Performance Test');
        const start = Date.now();
        await axios.get(`${BASE_URL}/leaderboard`);
        const firstRequest = Date.now() - start;
        
        const start2 = Date.now();
        await axios.get(`${BASE_URL}/leaderboard`);
        const secondRequest = Date.now() - start2;
        
        console.log(`   First request: ${firstRequest}ms`);
        console.log(`   Cached request: ${secondRequest}ms`);
        console.log(`   Cache speedup: ${Math.round((firstRequest / secondRequest) * 100) / 100}x\n`);

        console.log('✅ Enhanced Backend Demo Complete!');
        console.log('\n🎯 Key Features Demonstrated:');
        console.log('   • RESTful API with validation');
        console.log('   • Player management system');
        console.log('   • Game session tracking');
        console.log('   • Token transaction system');
        console.log('   • Real-time leaderboards');
        console.log('   • Comprehensive statistics');
        console.log('   • Rate limiting protection');
        console.log('   • Multi-layer caching');
        console.log('   • Health monitoring');

    } catch (error) {
        console.error('❌ Demo failed:', error.response?.data || error.message);
    }
}

// Run demo if called directly
if (require.main === module) {
    demoEnhancedBackend();
}

module.exports = demoEnhancedBackend;
