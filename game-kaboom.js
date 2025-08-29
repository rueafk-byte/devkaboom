/*
Kaboom - Complete Pirate Platformer Game
- Matches the original game design from screenshots
- Proper platformer levels with floating platforms
- Multiple enemies and characters
- Professional UI with health, bombs, tokens
*/

// ---------------------------
// Asset Loader
// ---------------------------
class AssetLoader {
	constructor() {
		this.assets = {
			player: {},
			enemies: {},
			objects: {},
			tiles: {}
		};
	}

	async loadImage(src) {
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => {
				console.warn(`Failed to load: ${src}`);
				// Create colored placeholder
				const canvas = document.createElement('canvas');
				canvas.width = 64;
				canvas.height = 64;
				const ctx = canvas.getContext('2d');
				ctx.fillStyle = '#ff6b6b';
				ctx.fillRect(0, 0, 64, 64);
				const placeholder = new Image();
				placeholder.src = canvas.toDataURL();
				resolve(placeholder);
			};
			img.src = src;
		});
	}

	async loadAll(onProgress) {
		let loaded = 0;
		const total = 20;

		// Load player sprites
		this.assets.player.idle = [];
		this.assets.player.run = [];
		
		for (let i = 1; i <= 5; i++) {
			const idleImg = await this.loadImage(`Sprites/1-Player-Bomb Guy/1-Idle/${i}.png`);
			this.assets.player.idle.push(idleImg);
			loaded++;
			if (onProgress) onProgress(loaded, total);
		}

		for (let i = 1; i <= 5; i++) {
			const runImg = await this.loadImage(`Sprites/1-Player-Bomb Guy/2-Run/${i}.png`);
			this.assets.player.run.push(runImg);
			loaded++;
			if (onProgress) onProgress(loaded, total);
		}

		// Load enemy sprites
		this.assets.enemies.pirate = [];
		this.assets.enemies.cucumber = [];
		
		for (let i = 1; i <= 3; i++) {
			const pirateImg = await this.loadImage(`Sprites/2-Enemy-Bald Pirate/1-Idle/${i}.png`);
			this.assets.enemies.pirate.push(pirateImg);
			loaded++;
			if (onProgress) onProgress(loaded, total);
		}

		for (let i = 1; i <= 3; i++) {
			const cucumberImg = await this.loadImage(`Sprites/3-Enemy-Cucumber/1-Idle/${i}.png`);
			this.assets.enemies.cucumber.push(cucumberImg);
			loaded++;
			if (onProgress) onProgress(loaded, total);
		}

		// Load tile sprites
		this.assets.tiles.platform = await this.loadImage('Sprites/8-Tile-Sets/blocks.png');
		this.assets.tiles.ground = await this.loadImage('Sprites/8-Tile-Sets/block2.png');
		loaded += 2;
		if (onProgress) onProgress(loaded, total);

		// Load UI sprites
		this.assets.objects.heart = await this.loadImage('Sprites/emojis/heart.png');
		this.assets.objects.bomb = await this.loadImage('Sprites/emojis/bomb.png');
		this.assets.objects.coin = await this.loadImage('Sprites/emojis/image.png');
		loaded += 3;
		if (onProgress) onProgress(loaded, total);

		return this.assets;
	}
}

// ---------------------------
// Game Engine
// ---------------------------
class KaboomGame {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.assets = null;
		this.gameRunning = false;
		
		// Game state
		this.player = {
			x: 100,
			y: 300,
			width: 48,
			height: 48,
			vx: 0,
			vy: 0,
			onGround: false,
			health: 100,
			bombs: 3,
			animation: 'idle',
			frame: 0,
			frameTimer: 0
		};

		this.enemies = [
			{ x: 400, y: 350, width: 48, height: 48, type: 'pirate', frame: 0, frameTimer: 0 },
			{ x: 600, y: 250, width: 48, height: 48, type: 'cucumber', frame: 0, frameTimer: 0 },
			{ x: 800, y: 450, width: 48, height: 48, type: 'pirate', frame: 0, frameTimer: 0 }
		];

		this.platforms = [
			{ x: 200, y: 400, width: 192, height: 32 },
			{ x: 500, y: 300, width: 192, height: 32 },
			{ x: 350, y: 200, width: 192, height: 32 },
			{ x: 700, y: 350, width: 192, height: 32 },
			{ x: 150, y: 150, width: 192, height: 32 },
			{ x: 600, y: 450, width: 192, height: 32 }
		];

		this.gameState = {
			level: 1,
			score: 0,
			tokens: 0,
			lives: 3
		};

		this.keys = {};
		this.setupControls();
	}

	setupControls() {
		document.addEventListener('keydown', (e) => {
			this.keys[e.code] = true;
			if (e.code === 'Escape' && this.gameRunning) {
				this.stop();
			}
		});

		document.addEventListener('keyup', (e) => {
			this.keys[e.code] = false;
		});
	}

	async init(assets) {
		this.assets = assets;
		this.canvas.width = 1024;
		this.canvas.height = 576;
	}

	start() {
		this.gameRunning = true;
		this.gameLoop();
	}

	stop() {
		this.gameRunning = false;
		document.getElementById('gameCanvas').style.display = 'none';
		document.getElementById('welcomeMenu').style.display = 'flex';
	}

	update() {
		// Player movement
		const speed = 4;
		const jumpPower = 12;
		const gravity = 0.6;

		// Horizontal movement
		if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
			this.player.vx = -speed;
			this.player.animation = 'run';
		} else if (this.keys['KeyD'] || this.keys['ArrowRight']) {
			this.player.vx = speed;
			this.player.animation = 'run';
		} else {
			this.player.vx = 0;
			if (this.player.onGround) {
				this.player.animation = 'idle';
			}
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

		// Platform collisions
		this.player.onGround = false;
		
		// Check ground collision
		if (this.player.y + this.player.height >= this.canvas.height - 50) {
			this.player.y = this.canvas.height - 50 - this.player.height;
			this.player.vy = 0;
			this.player.onGround = true;
		}

		// Check platform collisions
		for (const platform of this.platforms) {
			if (this.player.x < platform.x + platform.width &&
				this.player.x + this.player.width > platform.x &&
				this.player.y < platform.y + platform.height &&
				this.player.y + this.player.height > platform.y) {
				
				// Landing on top of platform
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

		// Update animations
		this.updateAnimations();
	}

	updateAnimations() {
		// Player animation
		this.player.frameTimer++;
		if (this.player.frameTimer >= 10) {
			this.player.frameTimer = 0;
			const anim = this.assets.player[this.player.animation];
			if (anim && anim.length > 0) {
				this.player.frame = (this.player.frame + 1) % anim.length;
			}
		}

		// Enemy animations
		for (const enemy of this.enemies) {
			enemy.frameTimer++;
			if (enemy.frameTimer >= 15) {
				enemy.frameTimer = 0;
				const anim = this.assets.enemies[enemy.type];
				if (anim && anim.length > 0) {
					enemy.frame = (enemy.frame + 1) % anim.length;
				}
			}
		}
	}

	render() {
		// Clear with sky blue background
		this.ctx.fillStyle = '#87CEEB';
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		// Draw ground
		this.ctx.fillStyle = '#8B4513';
		this.ctx.fillRect(0, this.canvas.height - 50, this.canvas.width, 50);

		// Draw platforms
		for (const platform of this.platforms) {
			if (this.assets.tiles.platform) {
				// Draw tiled platform
				for (let x = 0; x < platform.width; x += 64) {
					this.ctx.drawImage(
						this.assets.tiles.platform,
						platform.x + x, platform.y,
						Math.min(64, platform.width - x), platform.height
					);
				}
			} else {
				// Fallback rectangle
				this.ctx.fillStyle = '#666';
				this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
			}
		}

		// Draw enemies
		for (const enemy of this.enemies) {
			const anim = this.assets.enemies[enemy.type];
			if (anim && anim.length > 0 && anim[enemy.frame]) {
				this.ctx.drawImage(
					anim[enemy.frame],
					enemy.x, enemy.y,
					enemy.width, enemy.height
				);
			} else {
				// Fallback
				this.ctx.fillStyle = enemy.type === 'pirate' ? '#8B4513' : '#32CD32';
				this.ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
			}
		}

		// Draw player
		const playerAnim = this.assets.player[this.player.animation];
		if (playerAnim && playerAnim.length > 0 && playerAnim[this.player.frame]) {
			this.ctx.drawImage(
				playerAnim[this.player.frame],
				this.player.x, this.player.y,
				this.player.width, this.player.height
			);
		} else {
			// Fallback
			this.ctx.fillStyle = '#FF6B6B';
			this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
		}

		// Draw UI
		this.drawUI();
	}

	drawUI() {
		// Left UI Panel
		this.ctx.fillStyle = 'rgba(173, 216, 230, 0.8)';
		this.ctx.fillRect(20, 20, 280, 120);
		this.ctx.strokeStyle = '#4682B4';
		this.ctx.lineWidth = 2;
		this.ctx.strokeRect(20, 20, 280, 120);

		// Health
		this.ctx.fillStyle = '#FF4444';
		this.ctx.font = '16px Arial';
		this.ctx.fillText(`Health: ${this.player.health}/100`, 30, 45);
		
		// Health bar
		this.ctx.fillStyle = '#FF4444';
		this.ctx.fillRect(30, 50, (this.player.health / 100) * 200, 10);
		this.ctx.strokeRect(30, 50, 200, 10);

		// Bombs
		this.ctx.fillStyle = '#000';
		this.ctx.fillText(`💣 x ${this.player.bombs}/3`, 30, 80);

		// Score
		this.ctx.fillText(`Score: ${this.gameState.score}`, 30, 100);
		this.ctx.fillText(`Tokens: ${this.gameState.tokens}`, 30, 120);

		// Right UI Panel
		this.ctx.fillStyle = 'rgba(173, 216, 230, 0.8)';
		this.ctx.fillRect(this.canvas.width - 300, 20, 280, 120);
		this.ctx.strokeRect(this.canvas.width - 300, 20, 280, 120);

		// Level info
		this.ctx.fillStyle = '#000';
		this.ctx.fillText(`🏆 Level ${this.gameState.level}`, this.canvas.width - 290, 45);
		this.ctx.fillText(`❤️ Lives: ${this.gameState.lives}/3`, this.canvas.width - 290, 70);
		this.ctx.fillText(`🎯 Current`, this.canvas.width - 290, 95);
		this.ctx.fillText(`📊 Total`, this.canvas.width - 290, 120);

		// Controls hint
		this.ctx.fillStyle = 'white';
		this.ctx.font = '14px Arial';
		this.ctx.fillText('WASD: Move | Space: Jump | ESC: Menu', 20, this.canvas.height - 20);
	}

	gameLoop() {
		if (!this.gameRunning) return;

		this.update();
		this.render();
		requestAnimationFrame(() => this.gameLoop());
	}
}

// ---------------------------
// Global Game Instance
// ---------------------------
let gameInstance = null;

window.startGame = async () => {
	console.log('🎮 Starting Kaboom Pirate Game...');
	
	try {
		document.getElementById('loadingScreen').style.display = 'flex';
		document.getElementById('welcomeMenu').style.display = 'none';
		
		const loader = new AssetLoader();
		const assets = await loader.loadAll((loaded, total) => {
			const progress = (loaded / total) * 100;
			document.getElementById('loadingFill').style.width = progress + '%';
			document.getElementById('loadingText').textContent = `Loading game... ${Math.round(progress)}%`;
		});

		document.getElementById('loadingScreen').style.display = 'none';
		document.getElementById('gameCanvas').style.display = 'block';
		
		const canvas = document.getElementById('gameCanvas');
		gameInstance = new KaboomGame(canvas);
		await gameInstance.init(assets);
		gameInstance.start();
		
	} catch (error) {
		console.error('Failed to start game:', error);
		document.getElementById('loadingText').textContent = 'Failed to start game';
	}
};

document.addEventListener('DOMContentLoaded', () => {
	console.log('Kaboom Pirate Game ready!');
});
