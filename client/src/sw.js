import { precacheAndRoute } from 'workbox-precaching';

// 1. Lass Workbox (das Vite-Plugin) das gesamte Caching, Updaten 
// und Offline-Routing übernehmen. Diese eine Zeile ersetzt alles,
// was du vorher an 'install', 'activate' und 'fetch' Events hattest!
precacheAndRoute(self.__WB_MANIFEST || []);

// --- DIESEN BLOCK HINZUFÜGEN ---
// Lauscht auf den "Neu laden" Button aus deinem Frontend
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
// ---------------------------------

// 2. Push event - show notification
self.addEventListener('push', (event) => {
    let data = { title: 'GabelGuru', body: 'Neue Nachricht' };

    if (event.data) {
        try {
            // Wenn der Payload sauberes JSON ist
            data = event.data.json();
        } catch (e) {
            // Fallback, falls nur ein String geschickt wird
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// 3. Notification click event - open app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data.url;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there's already a tab open
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    // Navigate existing tab to target URL
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            // If no tab open, open a new one
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});