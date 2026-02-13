import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                    const { data } = await api.get('/auth/me');
                    setUser(data);
                    localStorage.setItem('user', JSON.stringify(data));
                } catch (err) {
                    console.error('Failed to sync user profile', err);
                    const userData = JSON.parse(localStorage.getItem('user'));
                    setUser(userData);
                }
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    const login = async (username, password) => {
        const { data } = await api.post('/auth/login', { username, password });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        setUser(data.user);
        return data.user;
    };

    const signup = async (username, password, email, newsletter = false) => {
        const { data } = await api.post('/auth/signup', { username, password, email, newsletter });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        setUser(data.user);
        return data.user;
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete api.defaults.headers.common['Authorization'];
        setUser(null);
    };

    const [notificationCounts, setNotificationCounts] = useState({ messaging: 0, compliance: 0, total: 0 });

    const fetchNotificationCounts = async () => {
        if (user?.role !== 'admin') return;
        try {
            const [msgRes, compRes] = await Promise.all([
                api.get('/messaging?folder=inbox&limit=1'), // Limit 1 just to get the unread count metadata
                api.get('/compliance/stats')
            ]);
            // Assuming messaging endpoint returns unreadInbox in the top level object
            const messaging = msgRes.data.unreadInbox || 0;
            const compliance = compRes.data.open || 0;
            setNotificationCounts({ messaging, compliance, total: messaging + compliance });
        } catch (err) {
            console.error('Failed to update notifications', err);
        }
    };

    useEffect(() => {
        if (user?.role === 'admin') {
            fetchNotificationCounts();
        }
    }, [user]);

    return (
        <AuthContext.Provider value={{ user, setUser, login, signup, logout, loading, notificationCounts, fetchNotificationCounts }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
