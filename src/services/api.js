import axios from 'axios';

const isLocalhost = typeof window !== 'undefined'
    && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || (isLocalhost ? 'http://localhost:5000/api' : '/api'),
    timeout: 0, // no timeout - wait for response
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            const requestUrl = error.config?.url || '';

            // For login endpoint, let the caller handle the error
            // so the Login page can show a proper error message
            if (requestUrl.includes('/auth/login')) {
                return Promise.reject(error);
            }

            // For all other endpoints, treat 401 as session expiry
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return; // prevent further handling
        }
        return Promise.reject(error);
    }
);

export default api;
