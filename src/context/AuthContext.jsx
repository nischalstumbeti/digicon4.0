import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const maxWait = 12000; // guarantee we stop loading after 12s
        const timeoutId = setTimeout(() => {
            if (!cancelled) setLoading(false);
        }, maxWait);

        const checkUser = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const res = await api.get('/auth/session');
                    if (!cancelled) setUser(res.data.user);
                } catch (error) {
                    console.error("Session invalid", error);
                    localStorage.removeItem('token');
                }
            }
            if (!cancelled) setLoading(false);
        };

        checkUser();
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, []);

    const login = async (identifier, password) => {
        const res = await api.post('/auth/login', { teamId: identifier?.trim(), password });
        localStorage.setItem('token', res.data.token);
        setUser({ ...res.data });
        return res.data;
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (err) {
            console.error(err);
        }
        localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
            {loading ? (
                <div className="d-flex align-items-center justify-content-center min-vh-100" style={{ background: 'var(--bg, #f0f4f8)', color: 'var(--text, #1e293b)' }}>
                    <div className="text-center">
                        <div className="spinner-border text-primary mb-2" role="status" style={{ width: '2.5rem', height: '2.5rem' }} />
                        <p className="mb-0" style={{ fontSize: '1rem' }}>Loading...</p>
                    </div>
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};
