// Performance Optimization for Worldwide Web3 Game
class PerformanceOptimizer {
    constructor() {
        this.cdnConfig = {
            primary: 'https://cdn.kaboom-game.com',
            fallback: 'https://backup-cdn.kaboom-game.com',
            regions: {
                'us-east': 'https://us-east-cdn.kaboom-game.com',
                'us-west': 'https://us-west-cdn.kaboom-game.com',
                'eu-west': 'https://eu-west-cdn.kaboom-game.com',
                'asia-pacific': 'https://ap-cdn.kaboom-game.com'
            }
        };
        
        this.cacheConfig = {
            assets: {
                maxAge: 86400, // 24 hours
                staleWhileRevalidate: 3600 // 1 hour
            },
            api: {
                maxAge: 300, // 5 minutes
                staleWhileRevalidate: 60 // 1 minute
            }
        };
        
        this.init();
    }

    init() {
        this.detectRegion();
        this.setupServiceWorker();
        this.optimizeImages();
        this.setupPreloading();
        this.enableCompression();
        this.setupCaching();
        this.monitorPerformance();
        
        console.log('Performance optimizer initialized');
    }

    detectRegion() {
        // Detect user's region for optimal CDN
        fetch('https://ipapi.co/json/')
            .then(response => response.json())
            .then(data => {
                const region = this.getRegionFromCountry(data.country_code);
                this.setOptimalCDN(region);
            })
            .catch(() => {
                // Fallback to primary CDN
                this.setOptimalCDN('default');
            });
    }

    getRegionFromCountry(countryCode) {
        const regionMap = {
            'US': 'us-east',
            'CA': 'us-east',
            'MX': 'us-west',
            'GB': 'eu-west',
            'DE': 'eu-west',
            'FR': 'eu-west',
            'JP': 'asia-pacific',
            'KR': 'asia-pacific',
            'CN': 'asia-pacific',
            'AU': 'asia-pacific'
        };
        
        return regionMap[countryCode] || 'default';
    }

    setOptimalCDN(region) {
        const cdnUrl = this.cdnConfig.regions[region] || this.cdnConfig.primary;
        window.optimalCDN = cdnUrl;
        
        // Update asset URLs
        this.updateAssetUrls(cdnUrl);
    }

    updateAssetUrls(cdnUrl) {
        // Update sprite URLs
        const spriteElements = document.querySelectorAll('[data-sprite]');
        spriteElements.forEach(element => {
            const spritePath = element.getAttribute('data-sprite');
            element.src = `${cdnUrl}/sprites/${spritePath}`;
        });
        
        // Update audio URLs
        const audioElements = document.querySelectorAll('[data-audio]');
        audioElements.forEach(element => {
            const audioPath = element.getAttribute('data-audio');
            element.src = `${cdnUrl}/audio/${audioPath}`;
        });
    }

    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        }
    }

    optimizeImages() {
        // Lazy load images
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    observer.unobserve(img);
                }
            });
        });
        
        images.forEach(img => imageObserver.observe(img));
        
        // Optimize sprite loading
        this.optimizeSpriteLoading();
    }

    optimizeSpriteLoading() {
        // Preload critical sprites
        const criticalSprites = [
            'player/idle/1.png',
            'player/run/1.png',
            'enemies/basic/1.png',
            'items/bomb/1.png'
        ];
        
        criticalSprites.forEach(sprite => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = `${window.optimalCDN || this.cdnConfig.primary}/sprites/${sprite}`;
            document.head.appendChild(link);
        });
    }

    setupPreloading() {
        // Preload critical resources
        const criticalResources = [
            '/api/game/config',
            '/api/leaderboard/global?limit=10',
            '/web3/game-integration.js',
            '/web3/ui-components.js'
        ];
        
        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = resource;
            document.head.appendChild(link);
        });
    }

    enableCompression() {
        // Enable Brotli/Gzip compression detection
        if (typeof window !== 'undefined') {
            // Check if compression is supported
            fetch('/api/health', {
                method: 'HEAD'
            }).then(response => {
                const encoding = response.headers.get('content-encoding');
                if (encoding) {
                    console.log(`Compression enabled: ${encoding}`);
                }
            });
        }
    }

    setupCaching() {
        // Setup API response caching
        this.setupAPICaching();
        
        // Setup asset caching
        this.setupAssetCaching();
    }

    setupAPICaching() {
        // Cache API responses
        const cacheableEndpoints = [
            '/api/game/config',
            '/api/leaderboard/global',
            '/api/leaderboard/level/1'
        ];
        
        cacheableEndpoints.forEach(endpoint => {
            this.cacheAPIResponse(endpoint);
        });
    }

    async cacheAPIResponse(endpoint) {
        try {
            const response = await fetch(endpoint);
            const data = await response.json();
            
            // Store in memory cache
            if (!window.apiCache) window.apiCache = {};
            window.apiCache[endpoint] = {
                data: data,
                timestamp: Date.now(),
                ttl: this.cacheConfig.api.maxAge * 1000
            };
        } catch (error) {
            console.error(`Failed to cache API response for ${endpoint}:`, error);
        }
    }

    setupAssetCaching() {
        // Setup asset caching headers
        const assets = document.querySelectorAll('img, audio, video');
        assets.forEach(asset => {
            asset.setAttribute('loading', 'lazy');
            asset.setAttribute('decoding', 'async');
        });
    }

    monitorPerformance() {
        // Monitor Core Web Vitals
        this.monitorCoreWebVitals();
        
        // Monitor game performance
        this.monitorGamePerformance();
        
        // Monitor network performance
        this.monitorNetworkPerformance();
    }

    monitorCoreWebVitals() {
        // Monitor Largest Contentful Paint (LCP)
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            console.log('LCP:', lastEntry.startTime);
            
            if (lastEntry.startTime > 2500) {
                this.optimizeLCP();
            }
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // Monitor First Input Delay (FID)
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach(entry => {
                console.log('FID:', entry.processingStart - entry.startTime);
                
                if (entry.processingStart - entry.startTime > 100) {
                    this.optimizeFID();
                }
            });
        }).observe({ entryTypes: ['first-input'] });
        
        // Monitor Cumulative Layout Shift (CLS)
        new PerformanceObserver((list) => {
            let cls = 0;
            const entries = list.getEntries();
            entries.forEach(entry => {
                if (!entry.hadRecentInput) {
                    cls += entry.value;
                }
            });
            console.log('CLS:', cls);
            
            if (cls > 0.1) {
                this.optimizeCLS();
            }
        }).observe({ entryTypes: ['layout-shift'] });
    }

    monitorGamePerformance() {
        // Monitor FPS
        let frameCount = 0;
        let lastTime = performance.now();
        
        const measureFPS = () => {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                console.log('FPS:', fps);
                
                if (fps < 30) {
                    this.optimizeGamePerformance();
                }
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(measureFPS);
        };
        
        requestAnimationFrame(measureFPS);
    }

    monitorNetworkPerformance() {
        // Monitor network requests
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const startTime = performance.now();
            
            return originalFetch.apply(this, args).then(response => {
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                console.log(`Network request to ${args[0]} took ${duration}ms`);
                
                if (duration > 1000) {
                    this.optimizeNetworkRequest(args[0]);
                }
                
                return response;
            });
        };
    }

    // Optimization methods
    optimizeLCP() {
        // Optimize largest contentful paint
        console.log('Optimizing LCP...');
        
        // Preload critical resources
        const criticalImages = document.querySelectorAll('img[loading="lazy"]');
        criticalImages.forEach(img => {
            if (img.getBoundingClientRect().top < window.innerHeight) {
                img.loading = 'eager';
            }
        });
    }

    optimizeFID() {
        // Optimize first input delay
        console.log('Optimizing FID...');
        
        // Reduce JavaScript execution time
        this.deferNonCriticalJS();
    }

    optimizeCLS() {
        // Optimize cumulative layout shift
        console.log('Optimizing CLS...');
        
        // Set explicit dimensions for images
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (!img.width || !img.height) {
                img.style.width = 'auto';
                img.style.height = 'auto';
            }
        });
    }

    optimizeGamePerformance() {
        // Optimize game performance
        console.log('Optimizing game performance...');
        
        // Reduce sprite quality for better performance
        this.reduceSpriteQuality();
        
        // Optimize rendering
        this.optimizeRendering();
    }

    optimizeNetworkRequest(url) {
        // Optimize slow network requests
        console.log(`Optimizing network request to ${url}...`);
        
        // Implement request caching
        this.implementRequestCaching(url);
    }

    deferNonCriticalJS() {
        // Defer non-critical JavaScript
        const scripts = document.querySelectorAll('script[data-defer]');
        scripts.forEach(script => {
            script.setAttribute('defer', '');
        });
    }

    reduceSpriteQuality() {
        // Reduce sprite quality for better performance
        const sprites = document.querySelectorAll('img[data-sprite]');
        sprites.forEach(sprite => {
            if (window.devicePixelRatio <= 1) {
                // Use lower resolution sprites for standard displays
                const originalSrc = sprite.src;
                sprite.src = originalSrc.replace('/hd/', '/sd/');
            }
        });
    }

    optimizeRendering() {
        // Optimize rendering performance
        const canvas = document.querySelector('canvas');
        if (canvas) {
            // Enable hardware acceleration
            canvas.style.transform = 'translateZ(0)';
            
            // Optimize canvas size
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false; // Disable anti-aliasing for pixel art
        }
    }

    implementRequestCaching(url) {
        // Implement intelligent request caching
        if (!window.requestCache) window.requestCache = new Map();
        
        const cacheKey = url;
        const cachedResponse = window.requestCache.get(cacheKey);
        
        if (cachedResponse && Date.now() - cachedResponse.timestamp < 300000) {
            // Return cached response if less than 5 minutes old
            return Promise.resolve(cachedResponse.data);
        }
    }

    // Public API methods
    getOptimalCDN() {
        return window.optimalCDN || this.cdnConfig.primary;
    }

    getCacheConfig() {
        return this.cacheConfig;
    }

    preloadAsset(path) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = this.getAssetType(path);
        link.href = `${this.getOptimalCDN()}/${path}`;
        document.head.appendChild(link);
    }

    getAssetType(path) {
        const extension = path.split('.').pop().toLowerCase();
        const typeMap = {
            'png': 'image',
            'jpg': 'image',
            'jpeg': 'image',
            'gif': 'image',
            'webp': 'image',
            'mp3': 'audio',
            'wav': 'audio',
            'ogg': 'audio',
            'mp4': 'video',
            'webm': 'video',
            'js': 'script',
            'css': 'style'
        };
        
        return typeMap[extension] || 'fetch';
    }

    // Performance reporting
    reportPerformanceMetrics() {
        const metrics = {
            lcp: this.getLCP(),
            fid: this.getFID(),
            cls: this.getCLS(),
            fps: this.getFPS(),
            networkLatency: this.getNetworkLatency()
        };
        
        // Send metrics to analytics
        this.sendMetricsToAnalytics(metrics);
        
        return metrics;
    }

    getLCP() {
        // Get Largest Contentful Paint
        return new Promise(resolve => {
            new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                resolve(lastEntry.startTime);
            }).observe({ entryTypes: ['largest-contentful-paint'] });
        });
    }

    getFID() {
        // Get First Input Delay
        return new Promise(resolve => {
            new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const firstEntry = entries[0];
                resolve(firstEntry.processingStart - firstEntry.startTime);
            }).observe({ entryTypes: ['first-input'] });
        });
    }

    getCLS() {
        // Get Cumulative Layout Shift
        return new Promise(resolve => {
            let cls = 0;
            new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    if (!entry.hadRecentInput) {
                        cls += entry.value;
                    }
                });
                resolve(cls);
            }).observe({ entryTypes: ['layout-shift'] });
        });
    }

    getFPS() {
        // Get current FPS
        return new Promise(resolve => {
            let frameCount = 0;
            let lastTime = performance.now();
            
            const measureFPS = () => {
                frameCount++;
                const currentTime = performance.now();
                
                if (currentTime - lastTime >= 1000) {
                    const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                    resolve(fps);
                    return;
                }
                
                requestAnimationFrame(measureFPS);
            };
            
            requestAnimationFrame(measureFPS);
        });
    }

    getNetworkLatency() {
        // Get average network latency
        return new Promise(resolve => {
            const startTime = performance.now();
            fetch('/api/health')
                .then(() => {
                    const endTime = performance.now();
                    resolve(endTime - startTime);
                })
                .catch(() => resolve(null));
        });
    }

    sendMetricsToAnalytics(metrics) {
        // Send performance metrics to analytics service
        fetch('/api/analytics/performance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metrics)
        }).catch(error => {
            console.error('Failed to send performance metrics:', error);
        });
    }
}

// Initialize performance optimizer
window.performanceOptimizer = new PerformanceOptimizer();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceOptimizer;
}
