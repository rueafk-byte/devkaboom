// Emergency Wallet Connection Fix
// This script provides a backup wallet connection method

// UPDATED: Show wallet selector instead of auto-connecting to Phantom
window.emergencyWalletConnect = async function() {
    console.log('🚑 Emergency wallet connection started...');
    console.log('🛑 SHOWING WALLET SELECTOR INSTEAD OF AUTO-CONNECTING');
    
    // Instead of auto-connecting to Phantom, show the wallet selector
    if (window.walletConnection && typeof window.walletConnection.showWalletSelector === 'function') {
        console.log('🎯 Showing wallet selector from emergency function...');
        window.walletConnection.showWalletSelector();
        return false; // Don't auto-connect
    } else if (window.walletConnection && typeof window.walletConnection.connectWallet === 'function') {
        console.log('🎯 Calling connectWallet (should show selector)...');
        return await window.walletConnection.connectWallet(); // No parameter = show selector
    } else {
        console.error('❌ WalletConnection not available!');
        alert('Wallet connection system not ready. Please refresh the page.');
        return false;
    }
};

// Simple wallet connection without full class dependencies
window.emergencyWalletConnect = async function() {
    console.log('🚨 Emergency wallet connection started...');
    
    try {
        // Direct Phantom connection bypass
        if (window.solana && window.solana.isPhantom) {
            console.log('✅ Phantom detected, attempting direct connection...');
            
            // Check if already connected
            if (window.solana.isConnected && window.solana.publicKey) {
                console.log('✅ Phantom already connected!');
                
                // Update global state safely
                if (window.walletConnection && typeof window.walletConnection === 'object') {
                    window.walletConnection.isConnected = true;
                    window.walletConnection.publicKey = window.solana.publicKey;
                    window.walletConnection.selectedWallet = 'phantom';
                    
                    // Only call updateConnectionUI if it exists
                    if (typeof window.walletConnection.updateConnectionUI === 'function') {
                        window.walletConnection.updateConnectionUI();
                    } else {
                        console.log('⚠️ updateConnectionUI method not found, updating UI manually');
                        updateWalletUI(window.solana.publicKey.toString());
                    }
                } else {
                    console.log('⚠️ walletConnection object not found, updating UI manually');
                    updateWalletUI(window.solana.publicKey.toString());
                }
                
                return true;
            }
            
            // Request new connection
            console.log('🔗 Requesting Phantom connection...');
            const response = await window.solana.connect({ onlyIfTrusted: false });
            
            if (response && response.publicKey) {
                console.log('✅ Emergency connection successful!');
                console.log('📍 Public Key:', response.publicKey.toString());
                
                // Update global state safely
                if (window.walletConnection && typeof window.walletConnection === 'object') {
                    window.walletConnection.isConnected = true;
                    window.walletConnection.publicKey = response.publicKey;
                    window.walletConnection.selectedWallet = 'phantom';
                    
                    // Only call updateConnectionUI if it exists
                    if (typeof window.walletConnection.updateConnectionUI === 'function') {
                        window.walletConnection.updateConnectionUI();
                    } else {
                        console.log('⚠️ updateConnectionUI method not found, updating UI manually');
                        updateWalletUI(response.publicKey.toString());
                    }
                } else {
                    console.log('⚠️ walletConnection object not found, updating UI manually');
                    updateWalletUI(response.publicKey.toString());
                }
                
                return true;
            }
        }
        
        throw new Error('No compatible wallet found or connection failed');
        
    } catch (error) {
        console.error('❌ Emergency connection failed:', error);
        alert('Wallet connection failed: ' + error.message + '\n\nPlease make sure Phantom wallet is installed and unlocked.');
        return false;
    }
};

function updateWalletUI(publicKey) {
    console.log('🔄 Updating wallet UI...');
    
    // Hide connect button
    const connectBtn = document.getElementById('connectWalletBtn');
    if (connectBtn) {
        connectBtn.style.display = 'none';
    }
    
    // Show wallet status
    const walletStatus = document.getElementById('walletStatus');
    if (walletStatus) {
        walletStatus.textContent = `Connected: ${publicKey.substring(0, 8)}...`;
        walletStatus.className = 'wallet-status connected';
        walletStatus.style.display = 'block';
    }
    
    // Enable start button
    const startButton = document.getElementById('startButton');
    if (startButton) {
        startButton.disabled = false;
        startButton.style.opacity = '1';
        startButton.style.cursor = 'pointer';
    }
    
    // Show start button container
    const startButtonContainer = document.getElementById('startButtonContainer');
    if (startButtonContainer) {
        startButtonContainer.style.display = 'block';
    }
    
    console.log('✅ Wallet UI updated successfully');
}

// Auto-fix function for common issues  
window.fixWalletConnection = function() {
    console.log('🔧 Running wallet connection fixes...');
    
    // Fix 1: Reload wallet connection module
    if (window.walletConnection && typeof window.walletConnection.initConnection === 'function') {
        window.walletConnection.initConnection();
    }
    
    // Fix 2: Re-setup wallet button
    setTimeout(() => {
        const connectBtn = document.getElementById('connectWalletBtn');
        if (connectBtn && window.emergencyWalletConnect) {
            connectBtn.onclick = window.emergencyWalletConnect;
            console.log('🔧 Emergency handler attached to connect button');
        }
    }, 1000);
    
    // Fix 3: DISABLED - Don't auto-connect to prevent bypassing wallet selector
    // if (window.solana && window.solana.isConnected && window.solana.publicKey) {
    //     console.log('🔧 Found existing Phantom connection, updating UI...');
    //     updateWalletUI(window.solana.publicKey.toString());
    // }
    
    console.log('🙅‍♂️ Auto-connection disabled - user must select wallet manually');
};

// Auto-run fixes when script loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Wallet connection fix loaded');
    setTimeout(window.fixWalletConnection, 2000);
});

console.log('✅ Emergency wallet connection fix loaded');