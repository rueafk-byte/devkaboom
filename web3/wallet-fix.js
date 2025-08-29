// Wallet Connection Fix for Kaboom Game
// This script ensures proper Web3 initialization and wallet connectivity

(function() {
    'use strict';
    
    // Global variables
    let walletInitialized = false;
    let retryCount = 0;
    const maxRetries = 10;
    
    // Enhanced wallet detection with fallbacks
    function detectWallets() {
        const wallets = {};
        
        // Phantom Wallet
        if (window.solana && window.solana.isPhantom) {
            wallets.phantom = {
                name: 'Phantom',
                provider: window.solana,
                detected: true
            };
        }
        
        // Solflare Wallet
        if (window.solflare && window.solflare.isSolflare) {
            wallets.solflare = {
                name: 'Solflare',
                provider: window.solflare,
                detected: true
            };
        }
        
        // Backpack Wallet
        if (window.backpack && window.backpack.isBackpack) {
            wallets.backpack = {
                name: 'Backpack',
                provider: window.backpack,
                detected: true
            };
        }
        
        return wallets;
    }
    
    // Initialize wallet connection with proper error handling
    function initializeWalletConnection() {
        try {
            console.log('🔧 Initializing wallet connection...');
            
            const detectedWallets = detectWallets();
            const walletCount = Object.keys(detectedWallets).length;
            
            console.log(`🔍 Detected ${walletCount} wallet(s):`, Object.keys(detectedWallets));
            
            if (walletCount === 0) {
                console.warn('⚠️ No Solana wallets detected. Please install Phantom, Solflare, or another Solana wallet.');
                showWalletInstallPrompt();
                return false;
            }
            
            // Create enhanced wallet connection
            if (typeof WalletConnection !== 'undefined') {
                window.walletConnection = new WalletConnection();
                console.log('✅ WalletConnection initialized successfully');
            } else {
                console.warn('⚠️ WalletConnection class not found, creating fallback');
                createFallbackWalletConnection(detectedWallets);
            }
            
            walletInitialized = true;
            return true;
            
        } catch (error) {
            console.error('❌ Error initializing wallet connection:', error);
            createFallbackWalletConnection({});
            return false;
        }
    }
    
    // Create fallback wallet connection for when main class fails
    function createFallbackWalletConnection(detectedWallets) {
        window.walletConnection = {
            isConnected: false,
            publicKey: null,
            
            async connect(walletName = 'phantom') {
                try {
                    const wallet = detectedWallets[walletName];
                    if (!wallet) {
                        throw new Error(`${walletName} wallet not detected`);
                    }
                    
                    console.log(`🔗 Connecting to ${wallet.name}...`);
                    const response = await wallet.provider.connect();
                    
                    this.isConnected = true;
                    this.publicKey = response.publicKey || wallet.provider.publicKey;
                    
                    console.log('✅ Wallet connected:', this.publicKey.toString());
                    
                    // Update UI
                    updateWalletUI(true, this.publicKey.toString());
                    
                    return {
                        success: true,
                        publicKey: this.publicKey.toString()
                    };
                    
                } catch (error) {
                    console.error('❌ Wallet connection failed:', error);
                    return {
                        success: false,
                        error: error.message
                    };
                }
            },
            
            async disconnect() {
                try {
                    if (this.isConnected && window.solana) {
                        await window.solana.disconnect();
                    }
                    this.isConnected = false;
                    this.publicKey = null;
                    
                    console.log('🔌 Wallet disconnected');
                    updateWalletUI(false, null);
                    
                } catch (error) {
                    console.error('❌ Disconnect error:', error);
                }
            },
            
            getPublicKey() {
                return this.publicKey;
            }
        };
    }
    
    // Update wallet UI elements
    function updateWalletUI(connected, publicKey) {
        const connectBtn = document.getElementById('connectWallet');
        const disconnectBtn = document.getElementById('disconnectWallet');
        const walletInfo = document.getElementById('walletInfo');
        
        if (connectBtn) {
            connectBtn.style.display = connected ? 'none' : 'block';
            connectBtn.disabled = false;
            connectBtn.textContent = 'Connect Wallet';
        }
        
        if (disconnectBtn) {
            disconnectBtn.style.display = connected ? 'block' : 'none';
        }
        
        if (walletInfo && connected && publicKey) {
            walletInfo.textContent = `Connected: ${publicKey.substring(0, 8)}...${publicKey.substring(publicKey.length - 8)}`;
            walletInfo.style.display = 'block';
        } else if (walletInfo) {
            walletInfo.style.display = 'none';
        }
    }
    
    // Show wallet installation prompt
    function showWalletInstallPrompt() {
        const connectBtn = document.getElementById('connectWallet');
        if (connectBtn) {
            connectBtn.textContent = 'Install Wallet';
            connectBtn.onclick = () => {
                window.open('https://phantom.app/', '_blank');
            };
        }
    }
    
    // Enhanced Web3 initialization with retry logic
    function initializeWeb3Enhanced() {
        console.log(`🚀 Web3 initialization attempt ${retryCount + 1}/${maxRetries}`);
        
        // Check if Solana Web3.js is available
        if (typeof solanaWeb3 === 'undefined') {
            console.log('⏳ Solana Web3.js not yet available, retrying...');
            
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(initializeWeb3Enhanced, 1000);
                return;
            } else {
                console.warn('⚠️ Solana Web3.js failed to load after maximum retries');
                // Continue without Web3.js
            }
        } else {
            console.log('✅ Solana Web3.js loaded successfully');
        }
        
        // Initialize wallet connection
        const success = initializeWalletConnection();
        
        if (success) {
            console.log('🎉 Web3 initialization complete!');
            
            // Set up wallet connection event handlers
            setupWalletEventHandlers();
            
            // Mark as ready
            window.web3Ready = true;
            
            // Dispatch ready event
            window.dispatchEvent(new CustomEvent('web3Ready'));
        }
    }
    
    // Set up wallet event handlers
    function setupWalletEventHandlers() {
        const connectBtn = document.getElementById('connectWallet');
        const disconnectBtn = document.getElementById('disconnectWallet');
        
        if (connectBtn) {
            connectBtn.addEventListener('click', async () => {
                connectBtn.disabled = true;
                connectBtn.textContent = 'Connecting...';
                
                try {
                    const result = await window.walletConnection.connect();
                    if (!result.success) {
                        alert('Failed to connect wallet: ' + result.error);
                        connectBtn.disabled = false;
                        connectBtn.textContent = 'Connect Wallet';
                    }
                } catch (error) {
                    console.error('Connection error:', error);
                    alert('Failed to connect wallet. Please try again.');
                    connectBtn.disabled = false;
                    connectBtn.textContent = 'Connect Wallet';
                }
            });
        }
        
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', async () => {
                await window.walletConnection.disconnect();
            });
        }
    }
    
    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeWeb3Enhanced);
    } else {
        // DOM already loaded, start immediately
        setTimeout(initializeWeb3Enhanced, 100);
    }
    
    // Also listen for wallet provider injection (some wallets inject after page load)
    window.addEventListener('load', () => {
        if (!walletInitialized) {
            setTimeout(initializeWeb3Enhanced, 500);
        }
    });
    
})();
