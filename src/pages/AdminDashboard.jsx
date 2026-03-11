import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const res = await api.get('/admin/analytics');
                setStats(res.data);
            } catch (err) {
                console.error('Failed to load analytics', err);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, []);

    if (loading) {
        return (
            <div className="container page-fade-in mt-4 mb-5">
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status"></div>
                    <p className="text-muted mt-2 mb-0">Loading dashboard…</p>
                </div>
            </div>
        );
    }

    const problemData = {
        labels: ['Available', 'Selected'],
        datasets: [
            {
                data: [stats.problemsAvailable, stats.problemsSelected],
                backgroundColor: ['#198754', '#dc3545'],
                hoverBackgroundColor: ['#157347', '#bb2d3b'],
                borderWidth: 0,
            },
        ],
    };

    const loginData = {
        labels: ['Total Teams', 'Currently Logged In'],
        datasets: [
            {
                label: 'Teams',
                data: [stats.totalTeams, stats.loggedInTeams],
                backgroundColor: ['#0d6efd', '#0dcaf0'],
            },
        ],
    };

    const statCards = [
        { label: 'Total Teams', value: stats.totalTeams, color: 'primary', border: 'border-primary', bg: 'bg-primary bg-opacity-10' },
        { label: 'Active Sessions', value: stats.loggedInTeams, color: 'info', border: 'border-info', bg: 'bg-info bg-opacity-10' },
        { label: 'Available Problems', value: stats.problemsAvailable, color: 'success', border: 'border-success', bg: 'bg-success bg-opacity-10' },
        { label: 'Selected Problems', value: stats.problemsSelected, color: 'danger', border: 'border-danger', bg: 'bg-danger bg-opacity-10' },
    ];

    const quickLinks = [
        { to: '/admin/teams', label: 'Teams', desc: 'Manage teams & students' },
        { to: '/admin/problems', label: 'Problems', desc: 'Upload & manage problems' },
        { to: '/admin/logs', label: 'Logs (last 10) & Export', desc: 'Last 10 activity logs & Excel export' },
        { to: '/admin/cms', label: 'CMS', desc: 'Branding, marquee, colors' },
    ];

    return (
        <div className="container page-fade-in mt-2 mb-5">
            {/* Header */}
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                <div>
                    <h2 className="fw-bold m-0 text-primary">Admin Dashboard</h2>
                    <p className="text-muted small mb-0 mt-1">Overview and quick access to hackathon management</p>
                </div>
            </div>

            {/* Stats row */}
            <div className="row g-3 mb-4">
                {statCards.map((card, i) => (
                    <div key={i} className="col-6 col-lg-3">
                        <div className={`card shadow-sm border-0 h-100`}>
                            <div className={`card-body py-3 ${card.bg} rounded-end`}>
                                <p className="text-muted fw-semibold mb-1 small text-uppercase">{card.label}</p>
                                <h4 className="mb-0 fw-bold">{card.value}</h4>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick links */}
            <div className="mb-4">
                <h6 className="fw-bold text-primary mb-3">Quick access</h6>
                <div className="row g-3">
                    {quickLinks.map((item, i) => (
                        <div key={i} className="col-12 col-sm-6 col-lg-3">
                            <Link to={item.to} className="text-decoration-none">
                                <div className="card shadow-sm border-0 h-100 card-hover">
                                    <div className="card-body py-3">
                                        <span className="fw-bold text-primary d-block">{item.label}</span>
                                        <span className="small text-muted">{item.desc}</span>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
            </div>

            {/* Charts */}
            <div className="row g-4">
                <div className="col-12">
                    <h6 className="fw-bold text-primary mb-3">Analytics</h6>
                </div>
                <div className="col-12 col-lg-6">
                    <div className="card shadow-sm border-0 h-100">
                        <div className="card-body">
                            <h6 className="card-title fw-bold mb-3">Problem selection distribution</h6>
                            <div style={{ height: '280px' }} className="d-flex justify-content-center align-items-center">
                                {stats.problemsAvailable === 0 && stats.problemsSelected === 0 ? (
                                    <p className="text-muted mb-0">No problem data yet</p>
                                ) : (
                                    <Doughnut data={problemData} options={{ maintainAspectRatio: false }} />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-lg-6">
                    <div className="card shadow-sm border-0 h-100">
                        <div className="card-body">
                            <h6 className="card-title fw-bold mb-3">Login activity</h6>
                            <div style={{ height: '280px' }}>
                                <Bar
                                    data={loginData}
                                    options={{
                                        maintainAspectRatio: false,
                                        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                                        plugins: { legend: { display: false } },
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
