// Service Worker for Kaboom Web3 Game
const CACHE_NAME = 'kaboom-game-v2.0.0';
const STATIC_CACHE = 'kaboom-static-v2.0.0';
const DYNAMIC_CACHE = 'kaboom-dynamic-v2.0.0';

// Cache strategies
const CACHE_STRATEGIES = {
    STATIC: 'cache-first',
    DYNAMIC: 'stale-while-revalidate',
    API: 'network-first',
    ASSETS: 'cache-first'
};

// Files to cache immediately
const STATIC_FILES = [
    '/',
    '/index.html',
    '/game.js',
    '/web3/game-integration.js',
    '/web3/ui-components.js',
    '/performance-optimization.js',
    '/Sprites/1-Player-Bomb Guy/1-Idle/1.png',
    '/Sprites/1-Player-Bomb Guy/2-Run/1.png',
    '/Sprites/1-Player-Bomb Guy/7-Hit/1.png',
    '/music/Cyber punk.mp3',
    '/favicon.ico'
];

// API endpoints to cache
const API_ENDPOINTS = [
    '/api/game/config',
    '/api/leaderboard/global',
    '/api/health'
];

// Install event - cache static files
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('Caching static files...');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('Static files cached successfully');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Failed to cache static files:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== STATIC_CACHE && 
                            cacheName !== DYNAMIC_CACHE && 
                            cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - handle requests
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Handle different types of requests
    if (isStaticFile(url.pathname)) {
        event.respondWith(handleStaticFile(request));
    } else if (isAPIRequest(url.pathname)) {
        event.respondWith(handleAPIRequest(request));
    } else if (isAssetRequest(url.pathname)) {
        event.respondWith(handleAssetRequest(request));
    } else {
        event.respondWith(handleDynamicRequest(request));
    }
});

// Handle static files (cache-first strategy)
async function handleStaticFile(request) {
    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If not in cache, fetch from network
        const networkResponse = await fetch(request);
        
        // Cache the response for future use
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Static file fetch failed:', error);
        
        // Return offline page if available
        const offlineResponse = await caches.match('/offline.html');
        if (offlineResponse) {
            return offlineResponse;
        }
        
        throw error;
    }
}

// Handle API requests (network-first strategy)
async function handleAPIRequest(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('API request failed, trying cache:', error);
        
        // Fallback to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return error response
        return new Response(
            JSON.stringify({ error: 'Network unavailable', offline: true }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// Handle asset requests (cache-first strategy)
async function handleAssetRequest(request) {
    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If not in cache, fetch from network
        const networkResponse = await fetch(request);
        
        // Cache the response
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Asset request failed:', error);
        throw error;
    }
}

// Handle dynamic requests (stale-while-revalidate strategy)
async function handleDynamicRequest(request) {
    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        
        // Fetch from network in background
        const networkPromise = fetch(request).then(networkResponse => {
            if (networkResponse.ok) {
                const cache = await caches.open(DYNAMIC_CACHE);
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        }).catch(() => null);
        
        // Return cached response if available, otherwise wait for network
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await networkPromise;
        if (networkResponse) {
            return networkResponse;
        }
        
        throw new Error('No cached or network response available');
    } catch (error) {
        console.error('Dynamic request failed:', error);
        throw error;
    }
}

// Helper functions
function isStaticFile(pathname) {
    const staticExtensions = ['.html', '.js', '.css', '.json'];
    return staticExtensions.some(ext => pathname.endsWith(ext)) || 
           pathname === '/' || 
           pathname === '/index.html';
}

function isAPIRequest(pathname) {
    return pathname.startsWith('/api/');
}

function isAssetRequest(pathname) {
    const assetExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp3', '.wav', '.ogg', '.mp4', '.webm'];
    return assetExtensions.some(ext => pathname.endsWith(ext)) ||
           pathname.startsWith('/Sprites/') ||
           pathname.startsWith('/music/');
}

// Background sync for offline actions
self.addEventListener('sync', event => {
    console.log('Background sync triggered:', event.tag);
    
    if (event.tag === 'background-sync') {
        event.waitUntil(performBackgroundSync());
    }
}

// Perform background sync
async function performBackgroundSync() {
    try {
        // Get pending offline actions
        const pendingActions = await getPendingOfflineActions();
        
        for (const action of pendingActions) {
            try {
                await performOfflineAction(action);
                await removePendingAction(action.id);
            } catch (error) {
                console.error('Failed to perform offline action:', error);
            }
        }
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

// Get pending offline actions from IndexedDB
async function getPendingOfflineActions() {
    // This would typically use IndexedDB
    // For now, return empty array
    return [];
}

// Perform offline action
async function performOfflineAction(action) {
    const { type, data, url } = action;
    
    switch (type) {
        case 'game_completion':
            return await syncGameCompletion(data);
        case 'score_submission':
            return await syncScoreSubmission(data);
        case 'achievement_unlock':
            return await syncAchievementUnlock(data);
        default:
            throw new Error(`Unknown action type: ${type}`);
    }
}

// Sync game completion
async function syncGameCompletion(data) {
    const response = await fetch('/api/game/session/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        throw new Error('Failed to sync game completion');
    }
    
    return response.json();
}

// Sync score submission
async function syncScoreSubmission(data) {
    const response = await fetch('/api/game/score/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        throw new Error('Failed to sync score submission');
    }
    
    return response.json();
}

// Sync achievement unlock
async function syncAchievementUnlock(data) {
    const response = await fetch('/api/players/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        throw new Error('Failed to sync achievement unlock');
    }
    
    return response.json();
}

// Remove pending action
async function removePendingAction(actionId) {
    // This would typically use IndexedDB
    console.log('Removing pending action:', actionId);
}

// Push notification handling
self.addEventListener('push', event => {
    console.log('Push notification received:', event);
    
    const options = {
        body: event.data ? event.data.text() : 'New game update available!',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Play Now',
                icon: '/favicon.ico'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/favicon.ico'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Kaboom Game', options)
    );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event);
    
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Message handling from main thread
self.addEventListener('message', event => {
    console.log('Service Worker received message:', event.data);
    
    const { type, data } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
        case 'CACHE_ASSET':
            cacheAsset(data.url, data.response);
            break;
        case 'CLEAR_CACHE':
            clearCache();
            break;
        case 'GET_CACHE_INFO':
            getCacheInfo().then(info => {
                event.ports[0].postMessage(info);
            });
            break;
    }
});

// Cache asset
async function cacheAsset(url, response) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        await cache.put(url, response);
        console.log('Asset cached:', url);
    } catch (error) {
        console.error('Failed to cache asset:', error);
    }
}

// Clear cache
async function clearCache() {
    try {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('Cache cleared');
    } catch (error) {
        console.error('Failed to clear cache:', error);
    }
}

// Get cache information
async function getCacheInfo() {
    try {
        const cacheNames = await caches.keys();
        const cacheInfo = {};
        
        for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();
            cacheInfo[cacheName] = keys.length;
        }
        
        return cacheInfo;
    } catch (error) {
        console.error('Failed to get cache info:', error);
        return {};
    }
}

// Periodic cache cleanup
setInterval(async () => {
    try {
        await cleanupOldCacheEntries();
    } catch (error) {
        console.error('Cache cleanup failed:', error);
    }
}, 24 * 60 * 60 * 1000); // Run every 24 hours

// Cleanup old cache entries
async function cleanupOldCacheEntries() {
    const cache = await caches.open(DYNAMIC_CACHE);
    const keys = await cache.keys();
    
    for (const request of keys) {
        const response = await cache.match(request);
        const date = response.headers.get('date');
        
        if (date) {
            const age = Date.now() - new Date(date).getTime();
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
            
            if (age > maxAge) {
                await cache.delete(request);
                console.log('Deleted old cache entry:', request.url);
            }
        }
    }
}

console.log('Service Worker loaded successfully');
