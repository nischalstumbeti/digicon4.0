import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';

const TeamLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const navItems = [
        { to: '/team', end: true, label: 'Dashboard', icon: 'bi-grid-1x2' },
        { to: '/team/problems', end: false, label: 'Select Problem', icon: 'bi-journal-code' },
    ];

    return (
        <div className="admin-layout team-layout">
            <aside className={`admin-sidebar ${sidebarOpen ? 'admin-sidebar-open' : ''}`}>
                <div className="admin-sidebar-header">
                    <span className="admin-sidebar-title">Team</span>
                    <button
                        type="button"
                        className="admin-sidebar-close d-lg-none"
                        onClick={() => setSidebarOpen(false)}
                        aria-label="Close menu"
                    >
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <nav className="admin-sidebar-nav">
                    {navItems.map(({ to, end, label, icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`}
                            onClick={() => setSidebarOpen(false)}
                        >
                            <i className={`bi ${icon} admin-sidebar-icon`} aria-hidden="true"></i>
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>
            </aside>
            <div className="admin-main">
                <button
                    type="button"
                    className="admin-sidebar-toggle d-lg-none"
                    onClick={() => setSidebarOpen(true)}
                    aria-label="Open menu"
                >
                    <i className="bi bi-list" aria-hidden="true"></i>
                </button>
                <div className="admin-main-inner">
                    <Outlet />
                </div>
            </div>
            {sidebarOpen && (
                <div
                    className="admin-sidebar-backdrop d-lg-none"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}
        </div>
    );
};

export default TeamLayout;
