import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { io } from 'socket.io-client';

const isLocalhost = typeof window !== 'undefined'
    && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const SAMPLE_CSV = 'Student Name,Registration Number,Email,College Name,Year,Dept\nJohn Doe,REG001,john@college.edu,ABC College,3,CSE\nJane Smith,REG002,jane@college.edu,ABC College,3,ECE';

const AdminTeams = () => {
    const [teams, setTeams] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({ teamName: '', teamLeader: '', teamId: '', password: '', email: '', phone: '', members: '' });
    const [msg, setMsg] = useState({ text: '', type: '' });
    const [showCreate, setShowCreate] = useState(false);
    const [showCreateFromStudents, setShowCreateFromStudents] = useState(false);
    const [selectedForTeam, setSelectedForTeam] = useState([]);
    const [teamNameFromStudents, setTeamNameFromStudents] = useState('');
    const [passwordFromStudents, setPasswordFromStudents] = useState('');
    const [teamLeaderIdFromStudents, setTeamLeaderIdFromStudents] = useState('');
    const [creatingFromStudents, setCreatingFromStudents] = useState(false);
    const [showStudents, setShowStudents] = useState(false);
    const [teamFilter, setTeamFilter] = useState({ search: '', status: 'all' });
    const [studentFilter, setStudentFilter] = useState('');
    const [teamLimits, setTeamLimits] = useState({ minStudentsPerTeam: 2, maxStudentsPerTeam: 5 });
    const [savingLimits, setSavingLimits] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [editStudentForm, setEditStudentForm] = useState({ teamName: '', registrationNumber: '', email: '', phone: '', collegeName: '', year: '', dept: '' });
    const [savingStudent, setSavingStudent] = useState(false);
    const [teamDetail, setTeamDetail] = useState(null);
    const [teamDetailLoading, setTeamDetailLoading] = useState(false);

    const fetchTeams = async () => {
        try {
            const res = await api.get('/admin/teams');
            setTeams(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        try {
            const res = await api.get('/admin/students');
            setStudents(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchTeams();
        const socketUrl = import.meta.env.VITE_SOCKET_URL || (isLocalhost ? 'http://localhost:5000' : window.location.origin);
        const socket = io(socketUrl);
        socket.on('teamsUpdated', () => fetchTeams());
        return () => socket.disconnect();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/admin/settings');
            setTeamLimits({ minStudentsPerTeam: res.data.minStudentsPerTeam ?? 2, maxStudentsPerTeam: res.data.maxStudentsPerTeam ?? 5 });
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSaveTeamLimits = async (e) => {
        e.preventDefault();
        setSavingLimits(true);
        setMsg({ text: '', type: '' });
        try {
            await api.put('/admin/settings', teamLimits);
            setMsg({ text: 'Team selection limits updated.', type: 'success' });
        } catch (err) {
            setMsg({ text: err.response?.data?.message || 'Failed to update limits', type: 'danger' });
        } finally {
            setSavingLimits(false);
        }
    };

    const handleDownloadSample = () => {
        const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'students_template.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setMsg({ text: '', type: '' });
        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result;
                    const b64 = result?.includes(',') ? result.split(',')[1] : result;
                    resolve(b64 || '');
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            const res = await api.post('/admin/upload-students', { fileBase64: base64, filename: file.name });
            setMsg({ text: `Uploaded: ${res.data.created} created, ${res.data.updated} updated.`, type: 'success' });
            fetchTeams();
            fetchStudents();
        } catch (err) {
            const text = err.response?.data?.message || err.response?.data?.error || err.message || 'Upload failed';
            setMsg({ text, type: 'danger' });
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const membersArr = formData.members.split(',').map(m => m.trim()).filter(m => m);
            await api.post('/admin/create-team', { ...formData, members: membersArr });
            setMsg({ text: 'Team created successfully', type: 'success' });
            setFormData({ teamName: '', teamLeader: '', teamId: '', password: '', email: '', phone: '', members: '' });
            setShowCreate(false);
            fetchTeams();
        } catch (err) {
            setMsg({ text: err.response?.data?.message || 'Error creating team', type: 'danger' });
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this team entirely?')) return;
        try {
            await api.delete(`/admin/team/${id}`);
            setMsg({ text: 'Team deleted', type: 'success' });
            fetchTeams();
        } catch (err) {
            setMsg({ text: err.response?.data?.message || 'Error deleting team', type: 'danger' });
        }
    };

    const handleDeleteStudent = async (id, name) => {
        if (!window.confirm(`Delete student "${name}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/admin/student/${id}`);
            setMsg({ text: 'Student deleted', type: 'success' });
            fetchStudents();
        } catch (err) {
            setMsg({ text: err.response?.data?.message || 'Error deleting student', type: 'danger' });
        }
    };

    const handleDeleteAllStudents = async () => {
        if (!window.confirm('Delete ALL student data? Students who have joined a team will not be removed. This cannot be undone.')) return;
        try {
            const res = await api.delete('/admin/students');
            setMsg({ text: res.data.message || 'All students deleted', type: 'success' });
            fetchStudents();
            fetchTeams();
        } catch (err) {
            setMsg({ text: err.response?.data?.message || 'Error deleting students', type: 'danger' });
        }
    };

    const openCreateFromStudents = () => {
        setShowCreateFromStudents(true);
        setSelectedForTeam([]);
        setTeamNameFromStudents('');
        setPasswordFromStudents('');
        setTeamLeaderIdFromStudents('');
        fetchStudents();
    };

    const availableStudents = students.filter(s => !s.assignedTeamId);
    const selectedStudentDetails = availableStudents.filter(s => selectedForTeam.includes(s._id));

    const toggleStudentForTeam = (id) => {
        setSelectedForTeam(prev => {
            if (prev.includes(id)) {
                const next = prev.filter(i => i !== id);
                if (!next.includes(teamLeaderIdFromStudents)) setTeamLeaderIdFromStudents(next[0] || '');
                setMsg({ text: '', type: '' });
                return next;
            }
            if (prev.length >= teamLimits.maxStudentsPerTeam) {
                setMsg({ text: `Team limit reached. Maximum ${teamLimits.maxStudentsPerTeam} members allowed.`, type: 'danger' });
                return prev;
            }
            const next = [...prev, id];
            if (!next.includes(teamLeaderIdFromStudents)) setTeamLeaderIdFromStudents(next[0] || '');
            setMsg({ text: '', type: '' });
            return next;
        });
    };

    const handleCreateTeamFromStudents = async (e) => {
        e.preventDefault();
        if (!teamNameFromStudents.trim()) {
            setMsg({ text: 'Enter team name', type: 'danger' });
            return;
        }
        if (!passwordFromStudents || passwordFromStudents.length < 4) {
            setMsg({ text: 'Password must be at least 4 characters', type: 'danger' });
            return;
        }
        if (selectedForTeam.length === 0) {
            setMsg({ text: 'Select at least one student', type: 'danger' });
            return;
        }
        if (selectedForTeam.length < teamLimits.minStudentsPerTeam) {
            setMsg({ text: `Team limit: at least ${teamLimits.minStudentsPerTeam} member(s) required. You selected ${selectedForTeam.length}.`, type: 'danger' });
            return;
        }
        if (selectedForTeam.length > teamLimits.maxStudentsPerTeam) {
            setMsg({ text: `Team limit reached. Maximum ${teamLimits.maxStudentsPerTeam} members allowed. You selected ${selectedForTeam.length}.`, type: 'danger' });
            return;
        }
        if (!teamLeaderIdFromStudents) {
            setMsg({ text: 'Choose a team leader', type: 'danger' });
            return;
        }
        setCreatingFromStudents(true);
        setMsg({ text: '', type: '' });
        try {
            await api.post('/admin/create-team-from-students', {
                teamName: teamNameFromStudents.trim(),
                password: passwordFromStudents,
                memberIds: selectedForTeam,
                teamLeaderId: teamLeaderIdFromStudents
            });
            setMsg({ text: 'Team created from students successfully', type: 'success' });
            setShowCreateFromStudents(false);
            setSelectedForTeam([]);
            setTeamNameFromStudents('');
            setPasswordFromStudents('');
            setTeamLeaderIdFromStudents('');
            fetchTeams();
            fetchStudents();
        } catch (err) {
            setMsg({ text: err.response?.data?.message || 'Failed to create team', type: 'danger' });
        } finally {
            setCreatingFromStudents(false);
        }
    };

    const handleResetPassword = async (teamId) => {
        const newPass = prompt(`Enter new password for ${teamId}:`);
        if (!newPass) return;
        try {
            await api.put('/admin/reset-password', { teamId, newPassword: newPass });
            alert('Password reset successfully! Session invalidated.');
        } catch (err) {
            alert('Error resetting password');
        }
    };

    const handleUpdateUserName = async (id, currentName, label) => {
        const next = window.prompt(`Enter new name for ${label}:`, currentName || '');
        if (next == null) return;
        const trimmed = next.trim();
        if (!trimmed) {
            setMsg({ text: 'Name cannot be empty.', type: 'danger' });
            return;
        }
        setMsg({ text: '', type: '' });
        try {
            await api.put(`/admin/user-name/${id}`, { name: trimmed });
            setMsg({ text: 'Name updated successfully.', type: 'success' });
            fetchTeams();
            fetchStudents();
        } catch (err) {
            setMsg({ text: err.response?.data?.message || 'Failed to update name', type: 'danger' });
        }
    };

    const openEditStudent = (s) => {
        setEditingStudent(s);
        setEditStudentForm({
            teamName: s.teamName || '',
            registrationNumber: s.registrationNumber || '',
            email: s.email || '',
            phone: s.phone || '',
            collegeName: s.collegeName || '',
            year: s.year || '',
            dept: s.dept || '',
        });
    };

    const handleUpdateStudent = async (e) => {
        e.preventDefault();
        if (!editingStudent) return;
        const { teamName, registrationNumber, email } = editStudentForm;
        if (!teamName?.trim()) {
            setMsg({ text: 'Name is required.', type: 'danger' });
            return;
        }
        if (!email?.trim()) {
            setMsg({ text: 'Email is required.', type: 'danger' });
            return;
        }
        setSavingStudent(true);
        setMsg({ text: '', type: '' });
        try {
            await api.put(`/admin/student/${editingStudent._id}`, editStudentForm);
            setMsg({ text: 'Student details updated successfully.', type: 'success' });
            setEditingStudent(null);
            fetchStudents();
            fetchTeams();
        } catch (err) {
            setMsg({ text: err.response?.data?.message || 'Failed to update student', type: 'danger' });
        } finally {
            setSavingStudent(false);
        }
    };

    const fetchTeamDetail = async (teamId) => {
        const t = teams.find(x => String(x._id) === String(teamId));
        if (!t) return;
        setTeamDetail({ loading: true });
        setTeamDetailLoading(true);
        try {
            const res = await api.get(`/admin/team/${t._id}`);
            setTeamDetail(res.data);
        } catch (err) {
            setMsg({ text: err.response?.data?.message || 'Failed to load team details', type: 'danger' });
            setTeamDetail(null);
        } finally {
            setTeamDetailLoading(false);
        }
    };

    const handleExportTeamsExcel = async () => {
        try {
            const res = await api.get('/admin/export-teams-excel', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'teams_list.xlsx';
            a.click();
            window.URL.revokeObjectURL(url);
            setMsg({ text: 'Teams list downloaded.', type: 'success' });
        } catch (err) {
            setMsg({ text: err.response?.data?.message || 'Failed to download Excel', type: 'danger' });
        }
    };

    const filteredTeams = teams.filter(t => {
        const matchSearch = !teamFilter.search || [t.teamId, t.teamName, t.teamLeader, t.email].some(
            v => String(v || '').toLowerCase().includes(teamFilter.search.toLowerCase())
        );
        const matchStatus = teamFilter.status === 'all' ||
            (teamFilter.status === 'selected' && t.selectedProblemId) ||
            (teamFilter.status === 'pending' && !t.selectedProblemId);
        return matchSearch && matchStatus;
    });

    const filteredStudents = students.filter(s => {
        if (!studentFilter.trim()) return true;
        const q = studentFilter.toLowerCase();
        return [s.teamName, s.registrationNumber, s.email, s.collegeName, s.year, s.dept].some(
            v => String(v || '').toLowerCase().includes(q)
        );
    });

    if (loading) return <div className="text-center mt-5"><div className="spinner-border text-primary"></div></div>;

    return (
        <div className="container page-fade-in mt-4 mb-5 theme-page">
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <h2 className="fw-bold m-0 theme-heading">Team Management</h2>
                <div className="d-flex gap-2 flex-wrap">
                    <button className="btn btn-success fw-semibold" onClick={handleExportTeamsExcel}>
                        Download teams Excel
                    </button>
                    <button className="btn btn-outline-danger fw-semibold" onClick={() => setShowCreate(!showCreate)}>
                        {showCreate ? 'Cancel' : '+ Create New Team'}
                    </button>
                    <button className="btn btn-danger fw-semibold" onClick={openCreateFromStudents}>
                        Create team from students
                    </button>
                </div>
            </div>

            {msg.text && <div className={`alert alert-${msg.type} alert-dismissible animate__animated animate__fadeIn`}>{msg.text}</div>}

            <div className="card theme-card mb-4">
                <div className="card-body">
                    <h5 className="fw-bold mb-3 theme-heading">Team selection limits</h5>
                    <p className="theme-muted small mb-3">Set how many students can be in one team when they form teams. Students will see this limit on the Form Team page.</p>
                    <form onSubmit={handleSaveTeamLimits} className="d-flex flex-wrap align-items-end gap-3">
                        <div>
                            <label className="form-label small theme-muted mb-1">Min students per team</label>
                            <input
                                type="number"
                                min={1}
                                max={20}
                                className="form-control"
                                style={{ width: '100px' }}
                                value={teamLimits.minStudentsPerTeam}
                                onChange={e => setTeamLimits(l => ({ ...l, minStudentsPerTeam: parseInt(e.target.value, 10) || 1 }))}
                            />
                        </div>
                        <div>
                            <label className="form-label small theme-muted mb-1">Max students per team</label>
                            <input
                                type="number"
                                min={1}
                                max={20}
                                className="form-control"
                                style={{ width: '100px' }}
                                value={teamLimits.maxStudentsPerTeam}
                                onChange={e => setTeamLimits(l => ({ ...l, maxStudentsPerTeam: parseInt(e.target.value, 10) || 1 }))}
                            />
                        </div>
                        <button type="submit" className="btn btn-danger btn-sm" disabled={savingLimits}>
                            {savingLimits ? 'Saving…' : 'Save limits'}
                        </button>
                    </form>
                </div>
            </div>

            <div className="card theme-card mb-4">
                <div className="card-body">
                    <h5 className="fw-bold mb-3 theme-heading">Upload students (CSV)</h5>
                    <p className="theme-muted small mb-3">Use the <strong>CSV template</strong> below. Columns: Student Name, Registration Number, Email, College Name, Year, Dept. Students log in with <strong>Registration Number</strong> and default password <strong>Student@123</strong> to form teams.</p>
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                        <button type="button" className="btn btn-danger btn-sm" onClick={handleDownloadSample}>
                            Download CSV template
                        </button>
                        <label className="btn btn-outline-danger mb-0">
                            <input type="file" accept=".csv" className="d-none" onChange={handleFileUpload} disabled={uploading} />
                            {uploading ? 'Uploading…' : 'Choose CSV file'}
                        </label>
                        <button type="button" className="btn btn-outline-secondary btn-sm theme-btn-outline" onClick={() => { setShowStudents(!showStudents); if (!showStudents) fetchStudents(); }}>
                            {showStudents ? 'Hide' : 'Show'} student list
                        </button>
                    </div>
                </div>
            </div>

            {showStudents && (
                <div className="card theme-card mb-4">
                    <div className="card-header theme-card-header fw-semibold d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <span>Uploaded students</span>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Filter students…"
                                value={studentFilter}
                                onChange={e => setStudentFilter(e.target.value)}
                                style={{ maxWidth: '200px' }}
                            />
                            {students.length > 0 && (
                                <button type="button" className="btn btn-outline-danger btn-sm" onClick={handleDeleteAllStudents}>
                                    Delete all students
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="card-body">
                        {students.length === 0 ? (
                            <p className="theme-muted mb-0">No students uploaded yet. Use the upload section above.</p>
                        ) : filteredStudents.length === 0 ? (
                            <p className="theme-muted mb-0">No students match the filter.</p>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0 theme-table">
                                    <thead className="theme-table-head">
                                        <tr>
                                            <th>Reg. No</th>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>College</th>
                                            <th>Year</th>
                                            <th>Dept</th>
                                            <th className="text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents.map(s => (
                                            <tr key={s._id}>
                                                <td className="fw-semibold">{s.registrationNumber}</td>
                                                <td>{s.teamName}</td>
                                                <td className="small">{s.email}</td>
                                                <td className="small">{s.collegeName}</td>
                                                <td>{s.year}</td>
                                                <td>{s.dept}</td>
                                                <td className="text-end">
                                                    <div className="d-inline-flex gap-1">
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-primary"
                                                            onClick={() => openEditStudent(s)}
                                                            title="Edit all details"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger"
                                                            onClick={() => handleDeleteStudent(s._id, s.teamName || s.registrationNumber)}
                                                            title="Delete this student"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {editingStudent && createPortal(
                <div
                    className="modal d-block"
                    tabIndex={-1}
                    style={{ position: 'fixed', inset: 0, zIndex: 1050, overflow: 'auto', backgroundColor: 'rgba(0,0,0,0.5)' }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="editStudentModalTitle"
                    onClick={(e) => { if (e.target === e.currentTarget) setEditingStudent(null); }}
                >
                    <div className="d-flex min-vh-100 align-items-center justify-content-center p-3">
                        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable my-0" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-content shadow">
                            <div className="modal-header">
                                <h5 className="modal-title fw-bold" id="editStudentModalTitle">Edit student — all details</h5>
                                <button type="button" className="btn-close" onClick={() => setEditingStudent(null)} aria-label="Close" />
                            </div>
                            <form onSubmit={handleUpdateStudent}>
                                <div className="modal-body">
                                    <div className="row g-3">
                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold">Name</label>
                                            <input type="text" className="form-control" value={editStudentForm.teamName} onChange={e => setEditStudentForm(f => ({ ...f, teamName: e.target.value }))} required />
                                        </div>
                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold">Registration number</label>
                                            <input type="text" className="form-control" value={editStudentForm.registrationNumber} onChange={e => setEditStudentForm(f => ({ ...f, registrationNumber: e.target.value }))} placeholder="Login ID for student" />
                                        </div>
                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold">Email</label>
                                            <input type="email" className="form-control" value={editStudentForm.email} onChange={e => setEditStudentForm(f => ({ ...f, email: e.target.value }))} required />
                                        </div>
                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold">Phone</label>
                                            <input type="text" className="form-control" value={editStudentForm.phone} onChange={e => setEditStudentForm(f => ({ ...f, phone: e.target.value }))} />
                                        </div>
                                        <div className="col-12">
                                            <label className="form-label fw-semibold">College name</label>
                                            <input type="text" className="form-control" value={editStudentForm.collegeName} onChange={e => setEditStudentForm(f => ({ ...f, collegeName: e.target.value }))} />
                                        </div>
                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold">Year</label>
                                            <input type="text" className="form-control" value={editStudentForm.year} onChange={e => setEditStudentForm(f => ({ ...f, year: e.target.value }))} placeholder="e.g. 3" />
                                        </div>
                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold">Dept</label>
                                            <input type="text" className="form-control" value={editStudentForm.dept} onChange={e => setEditStudentForm(f => ({ ...f, dept: e.target.value }))} placeholder="e.g. CSE" />
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setEditingStudent(null)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={savingStudent}>{savingStudent ? 'Saving…' : 'Save changes'}</button>
                                </div>
                            </form>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {teamDetail && createPortal(
                <div
                    className="modal d-block"
                    tabIndex={-1}
                    style={{ position: 'fixed', inset: 0, zIndex: 1050, overflow: 'auto', backgroundColor: 'rgba(0,0,0,0.5)' }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="teamDetailModalTitle"
                    onClick={(e) => { if (e.target === e.currentTarget) setTeamDetail(null); }}
                >
                    <div className="d-flex min-vh-100 align-items-center justify-content-center p-3">
                        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable my-0" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal-content shadow">
                                <div className="modal-header">
                                    <h5 className="modal-title fw-bold" id="teamDetailModalTitle">Team details</h5>
                                    <button type="button" className="btn-close" onClick={() => setTeamDetail(null)} aria-label="Close" />
                                </div>
                                <div className="modal-body">
                                    {teamDetail.loading ? (
                                        <div className="text-center py-4">
                                            <div className="spinner-border text-primary" role="status" />
                                            <p className="mt-2 mb-0 text-muted small">Loading…</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="mb-4">
                                                <h6 className="fw-bold text-primary mb-2">Team info</h6>
                                                <div className="row g-2 small">
                                                    <div className="col-6"><span className="text-muted">Team ID:</span> <strong>{teamDetail.team?.teamId}</strong></div>
                                                    <div className="col-6"><span className="text-muted">Team name:</span> <strong>{teamDetail.team?.teamName}</strong></div>
                                                    <div className="col-6"><span className="text-muted">Leader:</span> {teamDetail.team?.teamLeader}</div>
                                                    <div className="col-6"><span className="text-muted">Email:</span> {teamDetail.team?.email}</div>
                                                    <div className="col-12"><span className="text-muted">Phone:</span> {teamDetail.team?.phone || '—'}</div>
                                                </div>
                                            </div>
                                            <div className="mb-4">
                                                <h6 className="fw-bold text-primary mb-2">Problem status</h6>
                                                {teamDetail.team?.selectedProblemId ? (
                                                    <div className="border rounded p-3 bg-success bg-opacity-10">
                                                        <span className="badge bg-success me-2">Selected</span>
                                                        <strong>{teamDetail.team.selectedProblemId.problemId}</strong> — {teamDetail.team.selectedProblemId.title}
                                                        {teamDetail.team.selectedProblemId.category && <span className="text-muted small ms-2">({teamDetail.team.selectedProblemId.category})</span>}
                                                    </div>
                                                ) : (
                                                    <p className="mb-0 text-muted"><span className="badge bg-secondary">Pending</span> No problem selected yet.</p>
                                                )}
                                            </div>
                                            <div>
                                                <h6 className="fw-bold text-primary mb-2">Team members ({teamDetail.members?.length ?? 0})</h6>
                                                {!teamDetail.members?.length ? (
                                                    <p className="mb-0 text-muted small">No members in this team (team may have been created manually).</p>
                                                ) : (
                                                    <div className="table-responsive">
                                                        <table className="table table-sm table-hover mb-0">
                                                            <thead className="table-light">
                                                                <tr>
                                                                    <th>Name</th>
                                                                    <th>Reg. No</th>
                                                                    <th>Email</th>
                                                                    <th>College</th>
                                                                    <th>Year</th>
                                                                    <th>Dept</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {teamDetail.members.map((m) => (
                                                                    <tr key={m._id}>
                                                                        <td className="fw-semibold">{m.teamName || m.teamLeader}</td>
                                                                        <td>{m.registrationNumber}</td>
                                                                        <td className="small">{m.email}</td>
                                                                        <td className="small">{m.collegeName}</td>
                                                                        <td>{m.year}</td>
                                                                        <td>{m.dept}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setTeamDetail(null)}>Close</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {showCreateFromStudents && (
                <div className="card theme-card mb-4 animate__animated animate__fadeInDown">
                    <div className="card-body theme-card-body rounded px-4 py-4">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h5 className="fw-bold mb-0">Create team from student list</h5>
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowCreateFromStudents(false)}>Close</button>
                        </div>
                        <p className="theme-muted small mb-3">Select between <strong>{teamLimits.minStudentsPerTeam} and {teamLimits.maxStudentsPerTeam} members</strong> from the uploaded student list. Their details will appear below. Set team name, password, and team leader.</p>
                        <form onSubmit={handleCreateTeamFromStudents}>
                            <div className="row g-3 mb-3">
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">Team name</label>
                                    <input type="text" className="form-control" placeholder="e.g. Team Alpha" value={teamNameFromStudents} onChange={e => setTeamNameFromStudents(e.target.value)} required />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">Team password</label>
                                    <input type="password" className="form-control" placeholder="Min 4 characters" value={passwordFromStudents} onChange={e => setPasswordFromStudents(e.target.value)} minLength={4} required />
                                </div>
                                {selectedForTeam.length > 0 && (
                                    <div className="col-12">
                                        <label className="form-label fw-semibold">Team leader</label>
                                        <select className="form-select" value={teamLeaderIdFromStudents} onChange={e => setTeamLeaderIdFromStudents(e.target.value)} required>
                                            <option value="">Select leader</option>
                                            {selectedStudentDetails.map(s => (
                                                <option key={s._id} value={s._id}>{s.teamName || s.teamLeader} ({s.registrationNumber})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="mb-3">
                                <label className="form-label fw-semibold">Select members (from uploaded students) — {selectedForTeam.length} / {teamLimits.minStudentsPerTeam}–{teamLimits.maxStudentsPerTeam}</label>
                                {availableStudents.length === 0 ? (
                                    <p className="theme-muted small mb-0">No students available (upload CSV first or all are already in a team).</p>
                                ) : (
                                    <div className="border rounded p-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                        {availableStudents.map(s => (
                                            <label key={s._id} className="d-flex align-items-center gap-2 py-2 px-2 border-bottom border-secondary border-opacity-25" style={{ cursor: selectedForTeam.length >= teamLimits.maxStudentsPerTeam && !selectedForTeam.includes(s._id) ? 'not-allowed' : 'pointer', opacity: selectedForTeam.length >= teamLimits.maxStudentsPerTeam && !selectedForTeam.includes(s._id) ? 0.6 : 1 }}>
                                                <input type="checkbox" checked={selectedForTeam.includes(s._id)} onChange={() => toggleStudentForTeam(s._id)} className="form-check-input" disabled={selectedForTeam.length >= teamLimits.maxStudentsPerTeam && !selectedForTeam.includes(s._id)} />
                                                <span className="fw-semibold">{s.teamName || s.teamLeader}</span>
                                                <span className="theme-muted small">{s.registrationNumber}</span>
                                                {s.collegeName && <span className="theme-muted small"> · {s.collegeName}</span>}
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {selectedStudentDetails.length > 0 && (
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Selected members — details</label>
                                    <div className="table-responsive">
                                        <table className="table table-sm theme-table mb-0">
                                            <thead className="theme-table-head">
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Reg. No</th>
                                                    <th>Email</th>
                                                    <th>College</th>
                                                    <th>Year</th>
                                                    <th>Dept</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedStudentDetails.map(s => (
                                                    <tr key={s._id}>
                                                        <td>{s.teamName || s.teamLeader}</td>
                                                        <td>{s.registrationNumber}</td>
                                                        <td className="small">{s.email}</td>
                                                        <td className="small">{s.collegeName}</td>
                                                        <td>{s.year}</td>
                                                        <td>{s.dept}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            <div className="d-flex gap-2">
                                <button type="submit" className="btn btn-danger" disabled={creatingFromStudents || availableStudents.length === 0 || selectedForTeam.length === 0 || selectedForTeam.length < teamLimits.minStudentsPerTeam || selectedForTeam.length > teamLimits.maxStudentsPerTeam}>
                                    {creatingFromStudents ? 'Creating…' : 'Create team'}
                                </button>
                                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowCreateFromStudents(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showCreate && (
                <div className="card theme-card mb-4 animate__animated animate__fadeInDown">
                    <div className="card-body theme-card-body rounded px-4 py-4">
                        <h5 className="fw-bold mb-3">Create Team Account</h5>
                        <form onSubmit={handleCreate}>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <input type="text" className="form-control" placeholder="Team Name" value={formData.teamName} onChange={e => setFormData({ ...formData, teamName: e.target.value })} required />
                                </div>
                                <div className="col-md-6">
                                    <input type="text" className="form-control" placeholder="Team ID (Unique Login ID)" value={formData.teamId} onChange={e => setFormData({ ...formData, teamId: e.target.value })} required />
                                </div>
                                <div className="col-md-6">
                                    <input type="text" className="form-control" placeholder="Team Leader Name" value={formData.teamLeader} onChange={e => setFormData({ ...formData, teamLeader: e.target.value })} required />
                                </div>
                                <div className="col-md-6">
                                    <input type="password" className="form-control" placeholder="Initial Password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required />
                                </div>
                                <div className="col-md-6">
                                    <input type="email" className="form-control" placeholder="Email Address" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                                </div>
                                <div className="col-md-6">
                                    <input type="text" className="form-control" placeholder="Phone Number" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} required />
                                </div>
                                <div className="col-12">
                                    <input type="text" className="form-control" placeholder="Other Members (comma separated)" value={formData.members} onChange={e => setFormData({ ...formData, members: e.target.value })} />
                                </div>
                                <div className="col-12 text-end mt-3">
                                    <button type="submit" className="btn btn-danger px-4 fw-semibold">Save Team</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="card theme-card">
                <div className="card-header theme-card-header d-flex flex-wrap align-items-center gap-3">
                    <span>Teams</span>
                    <div className="filter-bar ms-auto">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Search teams…"
                            value={teamFilter.search}
                            onChange={e => setTeamFilter(f => ({ ...f, search: e.target.value }))}
                        />
                        <select
                            className="form-select"
                            value={teamFilter.status}
                            onChange={e => setTeamFilter(f => ({ ...f, status: e.target.value }))}
                        >
                            <option value="all">All</option>
                            <option value="selected">Has problem</option>
                            <option value="pending">No problem</option>
                        </select>
                    </div>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 theme-table">
                        <thead className="theme-table-head">
                            <tr>
                                <th className="py-3 px-4 rounded-top-start">Team ID</th>
                                <th className="py-3">Team Name</th>
                                <th className="py-3">Leader</th>
                                <th className="py-3">Selected Problem</th>
                                <th className="py-3 px-4 rounded-top-end text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTeams.length === 0 ? (
                                <tr><td colSpan="5" className="text-center py-4 text-muted">No teams match the filter.</td></tr>
                            ) : (
                                filteredTeams.map(t => (
                                    <tr key={t._id}>
                                        <td className="px-4">
                                            <button
                                                type="button"
                                                className="btn btn-link link-primary fw-semibold p-0 text-decoration-none"
                                                onClick={() => fetchTeamDetail(t._id)}
                                                title="View team details"
                                            >
                                                {t.teamId}
                                            </button>
                                        </td>
                                        <td className="fw-semibold">{t.teamName}</td>
                                        <td><div className="text-muted small mb-1">{t.teamLeader}</div><div className="text-muted small">{t.email}</div></td>
                                        <td>
                                            {t.selectedProblemId ? <span className="badge bg-success">Selected</span> : <span className="badge bg-secondary">Pending</span>}
                                        </td>
                                        <td className="text-end px-4">
                                            <div className="dropdown">
                                                <button className="btn btn-sm btn-light border dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                                    Manage
                                                </button>
                                                <ul className="dropdown-menu dropdown-menu-end shadow-sm border-0">
                                                    <li><button className="dropdown-item" onClick={() => handleUpdateUserName(t._id, t.teamName, t.teamId)}>Rename team</button></li>
                                                    <li><button className="dropdown-item text-warning fw-semibold" onClick={() => handleResetPassword(t.teamId)}>Reset Password</button></li>
                                                    <li><hr className="dropdown-divider" /></li>
                                                    <li><button className="dropdown-item text-danger fw-semibold" onClick={() => handleDelete(t._id)}>Delete Team</button></li>
                                                </ul>
                                            </div>
                                        </td>
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

export default AdminTeams;
