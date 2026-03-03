const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Utility to convert VAPID public key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Request notification permission and subscribe to push
 */
export async function subscribeUserToPush() {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push messaging is not supported');
            return null;
        }

        const registration = await navigator.serviceWorker.ready;

        // 1. Get VAPID Public Key from server
        const response = await fetch(`${API_URL}/notifications/vapid-public-key`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const { publicKey } = await response.json();

        // 2. Subscribe via PushManager
        const applicationServerKey = urlBase64ToUint8Array(publicKey.trim());

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
        });

        // 3. Send subscription to server
        await fetch(`${API_URL}/notifications/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(subscription)
        });

        console.log('User is subscribed to push notifications');
        return subscription;
    } catch (error) {
        console.error('Failed to subscribe user:', error);
        return null;
    }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeUserFromPush() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await subscription.unsubscribe();

            // Notify server
            await fetch(`${API_URL}/notifications/unsubscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ endpoint: subscription.endpoint })
            });
        }

        console.log('User is unsubscribed from push notifications');
    } catch (error) {
        console.error('Failed to unsubscribe user:', error);
    }
}

/**
 * Check if the user is currently subscribed
 */
export async function getPushSubscription() {
    if (!('serviceWorker' in navigator)) return null;
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
}
