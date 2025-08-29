/*
Kaboom - Sprite-Based Game Engine
- Loads actual PNG sprites from Sprites folder
- Animated player with proper sprite frames
- Optimized for web deployment
*/

// ---------------------------
// Sprite Asset Loader
// ---------------------------
class SpriteLoader {
	constructor() {
		this.sprites = {
			player: {},
			enemies: {},
			objects: {},
			tiles: {}
		};
		this.loadedCount = 0;
		this.totalCount = 0;
	}

	async loadImage(src) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => {
				this.loadedCount++;
				resolve(img);
			};
			img.onerror = () => {
				console.warn(`Failed to load: ${src}`);
				this.loadedCount++;
				resolve(null); // Return null instead of rejecting
			};
			img.src = src;
		});
	}

	async loadPlayerSprites(onProgress) {
		console.log('Loading player sprites...');
		
		// Load essential player animations
		const animations = {
			idle: { path: 'Sprites/1-Player-Bomb Guy/1-Idle', frames: 26 },
			run: { path: 'Sprites/1-Player-Bomb Guy/2-Run', frames: 14 },
			jump: { path: 'Sprites/1-Player-Bomb Guy/4-Jump', frames: 4 },
			fall: { path: 'Sprites/1-Player-Bomb Guy/5-Fall', frames: 2 }
		};

		this.totalCount += Object.values(animations).reduce((sum, anim) => sum + Math.min(anim.frames, 5), 0);

		for (const [animName, anim] of Object.entries(animations)) {
			this.sprites.player[animName] = [];
			
			// Load only first 5 frames for faster loading
			const frameCount = Math.min(anim.frames, 5);
			for (let i = 1; i <= frameCount; i++) {
				const img = await this.loadImage(`${anim.path}/${i}.png`);
				if (img) {
					this.sprites.player[animName].push(img);
				}
				
				if (onProgress) {
					onProgress(this.loadedCount, this.totalCount);
				}
			}
		}
	}

	async loadTileSprites(onProgress) {
		console.log('Loading tile sprites...');
		
		const tileImages = ['blocks.png', 'block2.png', 'block3.png'];
		this.totalCount += tileImages.length;

		for (const tileName of tileImages) {
			const img = await this.loadImage(`Sprites/8-Tile-Sets/${tileName}`);
			if (img) {
				this.sprites.tiles[tileName.replace('.png', '')] = img;
			}
			
			if (onProgress) {
				onProgress(this.loadedCount, this.totalCount);
			}
		}
	}

	async loadAll(onProgress) {
		console.log('Starting sprite loading...');
		this.loadedCount = 0;
		this.totalCount = 0;

		await this.loadPlayerSprites(onProgress);
		await this.loadTileSprites(onProgress);

		console.log(`Loaded ${this.loadedCount} sprites successfully`);
		return this.sprites;
	}
}

// ---------------------------
// Game Engine
// ---------------------------
class KaboomGame {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.sprites = null;
		this.gameRunning = false;
		
		// Game state
		this.player = {
			x: 100,
			y: 400,
			width: 64,
			height: 64,
			vx: 0,
			vy: 0,
			onGround: false,
			currentAnimation: 'idle',
			frame: 0,
			frameTimer: 0
		};
		
		this.camera = { x: 0, y: 0 };
		this.keys = {};
		
		// Bind methods
		this.update = this.update.bind(this);
		this.render = this.render.bind(this);
		this.gameLoop = this.gameLoop.bind(this);
		
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

	async init(sprites) {
		this.sprites = sprites;
		this.canvas.width = 1024;
		this.canvas.height = 576;
		console.log('Game initialized with sprites');
	}

	start() {
		this.gameRunning = true;
		this.gameLoop();
		console.log('Game started!');
	}

	stop() {
		this.gameRunning = false;
		document.getElementById('gameCanvas').style.display = 'none';
		document.getElementById('welcomeMenu').style.display = 'flex';
		console.log('Game stopped');
	}

	update() {
		// Player movement
		const speed = 5;
		const jumpPower = 15;
		const gravity = 0.8;
		
		// Horizontal movement
		if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
			this.player.vx = -speed;
			this.player.currentAnimation = 'run';
		} else if (this.keys['KeyD'] || this.keys['ArrowRight']) {
			this.player.vx = speed;
			this.player.currentAnimation = 'run';
		} else {
			this.player.vx = 0;
			if (this.player.onGround) {
				this.player.currentAnimation = 'idle';
			}
		}

		// Jumping
		if ((this.keys['KeyW'] || this.keys['ArrowUp'] || this.keys['Space']) && this.player.onGround) {
			this.player.vy = -jumpPower;
			this.player.onGround = false;
			this.player.currentAnimation = 'jump';
		}

		// Apply gravity
		if (!this.player.onGround) {
			this.player.vy += gravity;
			if (this.player.vy > 0) {
				this.player.currentAnimation = 'fall';
			}
		}

		// Update position
		this.player.x += this.player.vx;
		this.player.y += this.player.vy;

		// Ground collision
		const groundY = this.canvas.height - 150;
		if (this.player.y + this.player.height >= groundY) {
			this.player.y = groundY - this.player.height;
			this.player.vy = 0;
			this.player.onGround = true;
		}

		// Boundary checks
		if (this.player.x < 0) this.player.x = 0;
		if (this.player.x > this.canvas.width - this.player.width) {
			this.player.x = this.canvas.width - this.player.width;
		}

		// Update animation frame
		this.player.frameTimer++;
		if (this.player.frameTimer >= 8) { // Change frame every 8 game ticks
			this.player.frameTimer = 0;
			const anim = this.sprites.player[this.player.currentAnimation];
			if (anim && anim.length > 0) {
				this.player.frame = (this.player.frame + 1) % anim.length;
			}
		}
	}

	render() {
		// Clear canvas
		this.ctx.fillStyle = '#87CEEB'; // Sky blue
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		// Draw ground
		this.ctx.fillStyle = '#8B4513'; // Brown
		this.ctx.fillRect(0, this.canvas.height - 100, this.canvas.width, 100);

		// Draw tile pattern on ground if available
		if (this.sprites.tiles.blocks) {
			const tileSize = 64;
			for (let x = 0; x < this.canvas.width; x += tileSize) {
				this.ctx.drawImage(
					this.sprites.tiles.blocks,
					x, this.canvas.height - 100,
					tileSize, tileSize
				);
			}
		}

		// Draw player sprite
		const anim = this.sprites.player[this.player.currentAnimation];
		if (anim && anim.length > 0 && anim[this.player.frame]) {
			this.ctx.drawImage(
				anim[this.player.frame],
				this.player.x, this.player.y,
				this.player.width, this.player.height
			);
		} else {
			// Fallback rectangle if sprite not loaded
			this.ctx.fillStyle = '#FF6B6B';
			this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
		}

		// Draw UI
		this.ctx.fillStyle = 'white';
		this.ctx.font = '24px Arial';
		this.ctx.textAlign = 'left';
		this.ctx.fillText('KABOOM PIRATE GAME', 20, 40);
		this.ctx.font = '16px Arial';
		this.ctx.fillText('WASD/Arrows: Move | Space: Jump | ESC: Menu', 20, 70);
		this.ctx.fillText(`Animation: ${this.player.currentAnimation} | Frame: ${this.player.frame}`, 20, 90);
	}

	gameLoop() {
		if (!this.gameRunning) return;

		this.update();
		this.render();
		requestAnimationFrame(this.gameLoop);
	}
}

// ---------------------------
// Global Game Instance
// ---------------------------
let gameInstance = null;

// Start game function called by Play button
window.startGame = async () => {
	console.log('🎮 Starting Kaboom Pirate Game...');
	
	try {
		// Show loading screen
		document.getElementById('loadingScreen').style.display = 'flex';
		document.getElementById('welcomeMenu').style.display = 'none';
		
		const loader = new SpriteLoader();
		const sprites = await loader.loadAll((loaded, total) => {
			const progress = (loaded / total) * 100;
			document.getElementById('loadingFill').style.width = progress + '%';
			document.getElementById('loadingText').textContent = `Loading sprites... ${Math.round(progress)}%`;
		});

		// Hide loading screen and show game
		document.getElementById('loadingScreen').style.display = 'none';
		document.getElementById('gameCanvas').style.display = 'block';
		
		// Initialize and start game
		const canvas = document.getElementById('gameCanvas');
		gameInstance = new KaboomGame(canvas);
		await gameInstance.init(sprites);
		gameInstance.start();
		
	} catch (error) {
		console.error('Failed to start game:', error);
		document.getElementById('loadingText').textContent = 'Failed to start game';
	}
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
	console.log('Kaboom Sprite Game ready!');
});
