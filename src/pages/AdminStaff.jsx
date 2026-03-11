import React, { useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';

const ROLE_LABELS = { Admin: 'Admin', StudentCoordinator: 'Student Coordinator', FacultyCoordinator: 'Faculty Coordinator' };

const AdminStaff = () => {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'Admin';
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [form, setForm] = useState({
        role: 'StudentCoordinator',
        permission: 'read',
        loginId: '',
        name: '',
        email: '',
        password: '',
    });
    const [resettingId, setResettingId] = useState(null);

    const fetchStaff = async () => {
        try {
            const res = await api.get('/admin/staff');
            setStaff(res.data);
        } catch (e) {
            setMsg({ type: 'danger', text: e.response?.data?.message || 'Failed to load staff' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    const counts = {
        Admin: staff.filter((s) => s.role === 'Admin').length,
        StudentCoordinator: staff.filter((s) => s.role === 'StudentCoordinator').length,
        FacultyCoordinator: staff.filter((s) => s.role === 'FacultyCoordinator').length,
    };

    const onChange = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!isAdmin) return;
        setSaving(true);
        setMsg({ type: '', text: '' });
        try {
            await api.post('/admin/create-staff', {
                role: form.role,
                permission: form.permission,
                loginId: form.loginId.trim(),
                name: form.name.trim(),
                email: form.email.trim(),
                password: form.password,
            });
            setMsg({ type: 'success', text: 'Account created successfully.' });
            setForm({ role: 'StudentCoordinator', permission: 'read', loginId: '', name: '', email: '', password: '' });
            fetchStaff();
        } catch (e) {
            setMsg({ type: 'danger', text: e.response?.data?.message || 'Failed to create account' });
        } finally {
            setSaving(false);
        }
    };

    const handleResetPassword = async (staffId) => {
        const newPassword = window.prompt('Enter new password (min 6 characters):');
        if (newPassword == null || newPassword.trim().length < 6) {
            if (newPassword !== null) setMsg({ type: 'danger', text: 'Password must be at least 6 characters' });
            return;
        }
        setResettingId(staffId);
        setMsg({ type: '', text: '' });
        try {
            await api.put('/admin/reset-staff-password', { staffId, newPassword: newPassword.trim() });
            setMsg({ type: 'success', text: 'Password updated successfully.' });
        } catch (e) {
            setMsg({ type: 'danger', text: e.response?.data?.message || 'Failed to update password' });
        } finally {
            setResettingId(null);
        }
    };

    const handleRename = async (staffUser) => {
        const current = staffUser.teamName || '';
        const next = window.prompt('Enter new name:', current);
        if (next == null) return;
        const trimmed = next.trim();
        if (!trimmed) {
            setMsg({ type: 'danger', text: 'Name cannot be empty.' });
            return;
        }
        setMsg({ type: '', text: '' });
        try {
            await api.put(`/admin/user-name/${staffUser._id}`, { name: trimmed });
            setMsg({ type: 'success', text: 'Name updated successfully.' });
            fetchStaff();
        } catch (e) {
            setMsg({ type: 'danger', text: e.response?.data?.message || 'Failed to update name' });
        }
    };

    if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>;

    return (
        <div className="container page-fade-in mt-2 mb-5">
            <h2 className="fw-bold text-primary mb-1">User Management</h2>
            <p className="text-muted small mb-2">Create Admin, Student Coordinator, or Faculty Coordinator logins and assign read or read-write access.</p>
            <p className="text-muted small mb-4">
                <strong>In list:</strong> {counts.Admin} Admin{counts.Admin !== 1 ? 's' : ''}, {counts.StudentCoordinator} Student Coordinator{counts.StudentCoordinator !== 1 ? 's' : ''}, {counts.FacultyCoordinator} Faculty Coordinator{counts.FacultyCoordinator !== 1 ? 's' : ''}.
            </p>

            {msg.text && <div className={`alert alert-${msg.type} mb-4`}>{msg.text}</div>}

            {isAdmin && (
                <div className="card shadow-sm border-0 mb-4">
                    <div className="card-body">
                        <h5 className="fw-bold mb-3">Create new login</h5>
                        <form onSubmit={onSubmit} className="row g-3">
                            <div className="col-12 col-md-6">
                                <label className="form-label fw-semibold">Role</label>
                                <select className="form-select" value={form.role} onChange={onChange('role')}>
                                    <option value="Admin">Admin</option>
                                    <option value="StudentCoordinator">Student Coordinator</option>
                                    <option value="FacultyCoordinator">Faculty Coordinator</option>
                                </select>
                            </div>
                            {(form.role === 'StudentCoordinator' || form.role === 'FacultyCoordinator') && (
                                <div className="col-12 col-md-6">
                                    <label className="form-label fw-semibold">Permission</label>
                                    <select className="form-select" value={form.permission} onChange={onChange('permission')}>
                                        <option value="read">Read only</option>
                                        <option value="readWrite">Read and write</option>
                                    </select>
                                </div>
                            )}
                            <div className="col-12 col-md-6">
                                <label className="form-label fw-semibold">Login ID</label>
                                <input className="form-control" value={form.loginId} onChange={onChange('loginId')} placeholder="Used to sign in" required />
                            </div>
                            <div className="col-12 col-md-6">
                                <label className="form-label fw-semibold">Name</label>
                                <input className="form-control" value={form.name} onChange={onChange('name')} placeholder="Display name" required />
                            </div>
                            <div className="col-12 col-md-6">
                                <label className="form-label fw-semibold">Email</label>
                                <input type="email" className="form-control" value={form.email} onChange={onChange('email')} placeholder="email@example.com" required />
                            </div>
                            <div className="col-12 col-md-6">
                                <label className="form-label fw-semibold">Password</label>
                                <input type="password" className="form-control" value={form.password} onChange={onChange('password')} placeholder="Min 6 characters" minLength={6} required />
                            </div>
                            <div className="col-12">
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Creating…' : 'Create account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {!isAdmin && <p className="text-muted small mb-3">Only Admins can create new accounts. You can view the list below.</p>}

            <h6 className="fw-bold mb-2">User list</h6>
            <div className="card shadow-sm border-0">
                <div className="table-responsive">
                    <table className="table table-hover mb-0">
                        <thead className="table-light">
                            <tr>
                                <th>Login ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Permission</th>
                                {isAdmin && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {staff.length === 0 ? (
                                <tr><td colSpan={isAdmin ? 6 : 5} className="text-muted text-center py-4">No users yet.</td></tr>
                            ) : (
                                staff.map((s) => (
                                    <tr key={s._id}>
                                        <td>{s.teamId}</td>
                                        <td>{s.teamName}</td>
                                        <td>{s.email}</td>
                                        <td><span className="badge bg-primary">{ROLE_LABELS[s.role] || s.role}</span></td>
                                        <td>{(s.role === 'StudentCoordinator' || s.role === 'FacultyCoordinator') ? (s.permission || 'read') : '—'}</td>
                                        {isAdmin && (
                                            <td>
                                                <div className="d-flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-secondary"
                                                        disabled={resettingId === s._id}
                                                        onClick={() => handleResetPassword(s._id)}
                                                    >
                                                        {resettingId === s._id ? 'Updating…' : 'Change password'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-primary"
                                                        onClick={() => handleRename(s)}
                                                    >
                                                        Edit name
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminStaff;
