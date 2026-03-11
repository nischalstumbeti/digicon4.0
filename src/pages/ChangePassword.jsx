import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const ChangePassword = () => {
    const { user, setUser } = useContext(AuthContext);
    const navigate = useNavigate();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const canChangePassword = user?.mustChangePassword
        || (user?.role === 'Team' && user?.teamId && String(user.teamId).includes('_digicon_'))
        || user?.role === 'Admin'
        || user?.role === 'StudentCoordinator'
        || user?.role === 'FacultyCoordinator';

    useEffect(() => {
        if (!user) {
            navigate('/login', { replace: true });
        } else if (!canChangePassword) {
            navigate('/', { replace: true });
        }
    }, [user, canChangePassword, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!currentPassword || !newPassword) {
            setError('Please fill in all fields.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New password and confirm password do not match.');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post('/auth/change-password', { currentPassword, newPassword });
            localStorage.setItem('token', res.data.token);
            setUser({
                _id: res.data._id,
                teamName: res.data.teamName,
                teamId: res.data.teamId,
                role: res.data.role,
                selectedProblemId: res.data.selectedProblemId,
                mustChangePassword: res.data.mustChangePassword,
                permission: res.data.permission,
            });
            setSuccess('Password updated successfully. Redirecting...');
            setTimeout(() => {
                navigate('/', { replace: true });
            }, 1200);
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to change password';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container-fluid page-fade-in vh-100 d-flex justify-content-center align-items-center theme-page theme-login-bg">
            <div className="col-12 col-md-6 col-lg-4">
                <div className="card theme-card theme-card-glow animate__animated animate__fadeInUp">
                    <div className="card-body p-5">
                        <h2 className="text-center mb-3 fw-bold theme-title">Change Password</h2>
                        <p className="text-center theme-muted mb-4">Please change your default password to continue.</p>

                        {error && <div className="alert alert-danger animate__animated animate__shakeX">{error}</div>}
                        {success && <div className="alert alert-success">{success}</div>}

                        <form onSubmit={handleSubmit}>
                            <div className="mb-3">
                                <label className="form-label fw-semibold">Current password</label>
                                <input
                                    type="password"
                                    className="form-control form-control-lg"
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label fw-semibold">New password</label>
                                <input
                                    type="password"
                                    className="form-control form-control-lg"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="form-label fw-semibold">Confirm new password</label>
                                <input
                                    type="password"
                                    className="form-control form-control-lg"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="d-grid gap-2">
                                <button
                                    type="submit"
                                    className="btn btn-danger btn-lg fw-bold theme-btn-neon"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                    ) : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChangePassword;

