import React, { useContext } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export const ProtectedRoute = ({ role }) => {
    const { user, loading } = useContext(AuthContext);
    const location = useLocation();

    if (loading) return <div>Loading...</div>;

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (user.mustChangePassword && location.pathname !== '/change-password') {
        return <Navigate to="/change-password" replace />;
    }

    if (role) {
        const allowed = role === 'Admin' ? ['Admin', 'StudentCoordinator', 'FacultyCoordinator'] : [role];
        if (!allowed.includes(user.role)) {
            return <Navigate to="/" replace />;
        }
    }

    return <Outlet />;
};
