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

// Add Authorization header if token exists
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 (Unauthorized) - Expired or Invalid Token
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            // Check if we are not already on login/signup to avoid loops
            if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/signup')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
