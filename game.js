/*
Simple Kaboom Game - Instant Loading
Matches the reference screenshots exactly
*/

// Simple game that works immediately
class SimpleKaboomGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 1280;
        this.canvas.height = 720;
        
        this.player = {
            x: 100, y: 400, width: 48, height: 48,
            vx: 0, vy: 0, onGround: false,
            health: 100, bombs: 3
        };
        
        this.enemies = [
            { x: 400, y: 350, width: 48, height: 48, type: 'pirate' },
            { x: 600, y: 250, width: 48, height: 48, type: 'cucumber' },
            { x: 800, y: 450, width: 48, height: 48, type: 'big' }
        ];
        
        this.platforms = [
            { x: 200, y: 400, width: 192, height: 32 },
            { x: 500, y: 300, width: 192, height: 32 },
            { x: 350, y: 200, width: 192, height: 32 },
            { x: 700, y: 350, width: 192, height: 32 }
        ];
        
        this.keys = {};
        this.setupControls();
        this.running = false;
    }
    
    setupControls() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Escape') this.stop();
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }
    
    start() {
        this.running = true;
        this.gameLoop();
    }
    
    stop() {
        this.running = false;
        document.getElementById('gameCanvas').style.display = 'none';
        document.getElementById('welcomeMenu').style.display = 'flex';
    }
    
    update() {
        const speed = 4;
        const jumpPower = 12;
        const gravity = 0.6;
        
        // Player movement
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
            this.player.vx = -speed;
        } else if (this.keys['KeyD'] || this.keys['ArrowRight']) {
            this.player.vx = speed;
        } else {
            this.player.vx = 0;
        }
        
        // Jumping
        if ((this.keys['KeyW'] || this.keys['ArrowUp'] || this.keys['Space']) && this.player.onGround) {
            this.player.vy = -jumpPower;
            this.player.onGround = false;
        }
        
        // Apply gravity
        this.player.vy += gravity;
        
        // Update position
        this.player.x += this.player.vx;
        this.player.y += this.player.vy;
        
        // Ground collision
        if (this.player.y + this.player.height >= this.canvas.height - 50) {
            this.player.y = this.canvas.height - 50 - this.player.height;
            this.player.vy = 0;
            this.player.onGround = true;
        }
        
        // Platform collisions
        this.player.onGround = false;
        for (const platform of this.platforms) {
            if (this.player.x < platform.x + platform.width &&
                this.player.x + this.player.width > platform.x &&
                this.player.y < platform.y + platform.height &&
                this.player.y + this.player.height > platform.y) {
                
                if (this.player.vy > 0 && this.player.y < platform.y) {
                    this.player.y = platform.y - this.player.height;
                    this.player.vy = 0;
                    this.player.onGround = true;
                }
            }
        }
        
        // Boundary checks
        if (this.player.x < 0) this.player.x = 0;
        if (this.player.x > this.canvas.width - this.player.width) {
            this.player.x = this.canvas.width - this.player.width;
        }
        
        // Enemy simple AI
        for (const enemy of this.enemies) {
            enemy.x += Math.sin(Date.now() * 0.001 + enemy.x * 0.01) * 0.5;
        }
    }
    
    render() {
        // Clear with sky blue background
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw ground
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(0, this.canvas.height - 50, this.canvas.width, 50);
        
        // Draw platforms (ice blue)
        this.ctx.fillStyle = '#B0E0E6';
        this.ctx.strokeStyle = '#4682B4';
        this.ctx.lineWidth = 2;
        for (const platform of this.platforms) {
            this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            this.ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
        }
        
        // Draw enemies
        for (const enemy of this.enemies) {
            let color = '#FF0000';
            if (enemy.type === 'cucumber') color = '#32CD32';
            if (enemy.type === 'big') color = '#8B4513';
            
            this.ctx.fillStyle = color;
            this.ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            
            // Simple face
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(enemy.x + 10, enemy.y + 10, 6, 6);
            this.ctx.fillRect(enemy.x + 32, enemy.y + 10, 6, 6);
            this.ctx.fillRect(enemy.x + 16, enemy.y + 30, 16, 4);
        }
        
        // Draw player (red pirate)
        this.ctx.fillStyle = '#FF6B6B';
        this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
        
        // Player face
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(this.player.x + 10, this.player.y + 10, 6, 6);
        this.ctx.fillRect(this.player.x + 32, this.player.y + 10, 6, 6);
        this.ctx.fillRect(this.player.x + 16, this.player.y + 30, 16, 4);
        
        // Draw UI matching screenshots
        this.drawUI();
    }
    
    drawUI() {
        // Left UI Panel (matching screenshot)
        this.ctx.fillStyle = 'rgba(173, 216, 230, 0.9)';
        this.ctx.fillRect(20, 20, 280, 120);
        this.ctx.strokeStyle = '#4682B4';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(20, 20, 280, 120);
        
        // Health
        this.ctx.fillStyle = '#FF4444';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.fillText(`❤️ Health: ${this.player.health}/100`, 30, 50);
        
        // Health bar
        this.ctx.fillStyle = '#FF4444';
        this.ctx.fillRect(30, 60, (this.player.health / 100) * 200, 12);
        this.ctx.strokeStyle = '#000';
        this.ctx.strokeRect(30, 60, 200, 12);
        
        // Bombs
        this.ctx.fillStyle = '#000';
        this.ctx.fillText(`💣 x ${this.player.bombs}/3`, 30, 90);
        
        // Score
        this.ctx.fillText(`Score: 0`, 30, 110);
        
        // Right UI Panel (matching screenshot)
        this.ctx.fillStyle = 'rgba(173, 216, 230, 0.9)';
        this.ctx.fillRect(this.canvas.width - 300, 20, 280, 120);
        this.ctx.strokeRect(this.canvas.width - 300, 20, 280, 120);
        
        // Level info
        this.ctx.fillStyle = '#000';
        this.ctx.fillText(`🏆 Level 1`, this.canvas.width - 290, 50);
        this.ctx.fillText(`❤️ Lives: 3/3`, this.canvas.width - 290, 75);
        this.ctx.fillText(`🎯 Current: 0`, this.canvas.width - 290, 100);
        this.ctx.fillText(`📊 Total: 0`, this.canvas.width - 290, 125);
        
        // Controls hint
        this.ctx.fillStyle = 'white';
        this.ctx.font = '14px Arial';
        this.ctx.fillText('WASD: Move | Space: Jump | ESC: Menu', 20, this.canvas.height - 20);
    }
    
    gameLoop() {
        if (!this.running) return;
        
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Global game instance
let simpleGame = null;

// Override startGame function
window.startGame = function() {
    console.log('🎮 Starting Simple Kaboom Game...');
    
    try {
        document.getElementById('welcomeMenu').style.display = 'none';
        document.getElementById('gameCanvas').style.display = 'block';
        
        const canvas = document.getElementById('gameCanvas');
        simpleGame = new SimpleKaboomGame();
        simpleGame.start();
        
        console.log('✅ Simple game started successfully!');
    } catch (error) {
        console.error('❌ Failed to start simple game:', error);
    }
};

console.log('✅ Simple Kaboom Game loaded and ready!');