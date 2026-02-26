import axios from 'axios';

// Get base URL relative to current location
// If app is served at /EinkaufsApp/, this ensures requests go to /EinkaufsApp/api
const baseURL = import.meta.env.BASE_URL === '/'
    ? '/api'
    : `${import.meta.env.BASE_URL}api`.replace('//', '/');

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || baseURL,
    withCredentials: true // Note: You might rely on LocalStorage for token, check AuthContext
});

const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

// Add Authorization header and Caching logic
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Cache clearing for mutations
    const method = config.method?.toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
        cache.clear();
        return config;
    }

    // Cache retrieval for GET
    if (method === 'get' && !config.skipCache) {
        // Build a unique key based on URL + serialization of params
        const key = config.url + (config.params ? JSON.stringify(config.params) : '');
        const cached = cache.get(key);

        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            // Intercept request to immediately return cached promise via custom adapter
            config.adapter = function () {
                return Promise.resolve({
                    data: JSON.parse(JSON.stringify(cached.data)), // Deep clone to prevent mutations
                    status: 200,
                    statusText: 'OK',
                    headers: cached.headers || {},
                    config,
                    request: {}
                });
            };
        }
    }

    return config;
});

// Auto-redirect on 401 & Cache storage interceptor
api.interceptors.response.use(
    (response) => {
        // Store successful GETs
        if (response.config.method?.toLowerCase() === 'get') {
            const key = response.config.url + (response.config.params ? JSON.stringify(response.config.params) : '');
            cache.set(key, {
                timestamp: Date.now(),
                data: response.data,
                headers: response.headers
            });
        }
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/signup')) {
                const base = import.meta.env.BASE_URL || '/';
                window.location.href = `${base}login`.replace('//', '/');
            }
        }
        return Promise.reject(error);
    }
);

export default api;
