import axios from 'axios';

// Get base URL relative to current location
// If app is served at /EinkaufsApp/, this ensures requests go to /EinkaufsApp/api
const baseURL = import.meta.env.BASE_URL === '/'
    ? '/api'
    : `${import.meta.env.BASE_URL}api`.replace('//', '/');

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || baseURL,
    withCredentials: true
});

export default api;
