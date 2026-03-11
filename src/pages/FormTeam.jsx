import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';

const FormTeam = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const [students, setStudents] = useState([]);
    const [limits, setLimits] = useState({ minStudentsPerTeam: 2, maxStudentsPerTeam: 5 });
    const [loading, setLoading] = useState(true);
    const [teamName, setTeamName] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [selectedProblem, setSelectedProblem] = useState(null);
    const [search, setSearch] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [leaderId, setLeaderId] = useState(null);
    const [alreadyInTeam, setAlreadyInTeam] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [studentsRes, limitsRes, selectionRes, sessionRes] = await Promise.all([
                    api.get('/team/students-available'),
                    api.get('/team/team-limits').catch(() => ({ data: { minStudentsPerTeam: 2, maxStudentsPerTeam: 5 } })),
                    api.get('/team/selection').catch(() => ({ data: null })),
                    api.get('/auth/session').catch(() => ({ data: { user: null } })),
                ]);
                setStudents(studentsRes.data);
                if (studentsRes.data && user?.teamId) {
                    const self = studentsRes.data.find(s =>
                        String(s.registrationNumber || '').trim().toLowerCase() === String(user.teamId || '').trim().toLowerCase()
                    );
                    if (self) {
                        setLeaderId(self._id);
                        setSelectedIds(prev => (prev.includes(self._id) ? prev : [self._id, ...prev]));
                    }
                }
                if (limitsRes.data) setLimits(limitsRes.data);
                setSelectedProblem(selectionRes.data || null);

                const sessionUser = sessionRes.data?.user;
                if (sessionUser?.role === 'Student' && sessionUser.assignedTeamId) {
                    setAlreadyInTeam(true);
                }
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load students');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const toggleMember = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!teamName.trim()) {
            setError('Please enter a team name.');
            return;
        }
        if (selectedIds.length === 0) {
            setError('Please select at least yourself as a member.');
            return;
        }
        if (selectedIds.length < limits.minStudentsPerTeam) {
            setError(`Team must have at least ${limits.minStudentsPerTeam} member(s). You selected ${selectedIds.length}.`);
            return;
        }
        if (selectedIds.length > limits.maxStudentsPerTeam) {
            setError(`Team cannot have more than ${limits.maxStudentsPerTeam} member(s). You selected ${selectedIds.length}.`);
            return;
        }
        setShowConfirm(true);
    };

    if (loading) {
        return (
            <div className="container page-fade-in mt-5 text-center">
                <div className="spinner-border text-primary" />
            </div>
        );
    }

    if (alreadyInTeam) {
        return (
            <div className="container page-fade-in mt-5 mb-5">
                <div className="card shadow border-0 mx-auto" style={{ maxWidth: '720px' }}>
                    <div className="card-body p-4">
                        <h4 className="text-danger mb-3">You are already added to a group</h4>
                        <p className="mb-2">
                            Our records show that you are already a member of a team for this hackathon. Each participant can
                            belong to only <strong>one</strong> team, so you cannot create another group.
                        </p>
                        <p className="mb-3">
                            Please contact your team member who created the team to get the <strong>Team ID</strong>, and log in using
                            that Team ID for further actions.
                        </p>
                        <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>
                            Go to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (result) {
        return (
            <div className="container page-fade-in mt-5 mb-5">
                <div className="card shadow border-0 mx-auto" style={{ maxWidth: '900px' }}>
                    <div className="card-body p-4">
                        <h4 className="text-success mb-3">Team created successfully</h4>
                        <p className="mb-2">Your team <strong>{result.teamName}</strong> has been created.</p>
                        <p className="mb-2"><strong>Team ID (use this to log in):</strong></p>
                        <p className="mb-3"><code className="bg-light px-3 py-2 rounded d-inline-block">{result.teamId}</code></p>
                        <p className="text-muted small mb-4">{result.password}</p>
                        {Array.isArray(result.members) && result.members.length > 0 && (
                            <div className="mt-4 mb-4">
                                <h6 className="fw-bold mb-3">Team members</h6>
                                <div className="table-responsive" style={{ minWidth: '100%' }}>
                                    <table className="table table-bordered align-middle mb-0" style={{ width: '100%', tableLayout: 'auto' }}>
                                        <thead className="table-light">
                                            <tr>
                                                <th style={{ minWidth: '120px' }}>Name</th>
                                                <th style={{ minWidth: '100px' }}>Reg. No</th>
                                                <th style={{ minWidth: '160px' }}>Email</th>
                                                <th style={{ minWidth: '140px' }}>College</th>
                                                <th style={{ width: '60px' }}>Year</th>
                                                <th style={{ minWidth: '80px' }}>Dept</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.members.map(m => (
                                                <tr key={m.id || m.registrationNumber}>
                                                    <td style={{ wordBreak: 'break-word' }}>{m.name || '—'}</td>
                                                    <td>{m.registrationNumber || '—'}</td>
                                                    <td style={{ wordBreak: 'break-word' }}>{m.email || '—'}</td>
                                                    <td style={{ wordBreak: 'break-word' }}>{m.collegeName || '—'}</td>
                                                    <td>{m.year || '—'}</td>
                                                    <td>{m.dept || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        <p className="small text-muted">You will need to log in again using the Team ID above and your current password.</p>
                        <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>
                            Go to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const atMax = selectedIds.length >= limits.maxStudentsPerTeam;
    const filteredStudents = students.filter(s => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            (s.teamName || s.teamLeader || '').toLowerCase().includes(q) ||
            (s.registrationNumber || '').toLowerCase().includes(q) ||
            (s.email || '').toLowerCase().includes(q) ||
            (s.collegeName || '').toLowerCase().includes(q)
        );
    });
    const availableStudents = filteredStudents.filter(s => !selectedIds.includes(s._id));

    const confirmCreateTeam = async () => {
        setError('');
        setSubmitting(true);
        try {
            const res = await api.post('/team/form-team', { teamName: teamName.trim(), memberIds: selectedIds });
            setResult(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create team');
            setShowConfirm(false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="container page-fade-in mt-4 mb-5">
            <h2 className="fw-bold mb-3">Form your team</h2>

            {selectedProblem && (
                <div className="card shadow-sm border-success border-2 mb-4">
                    <div className="card-header bg-success bg-opacity-10 fw-bold text-success">
                        Your team&apos;s selected problem statement
                    </div>
                    <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                            <span className="badge bg-secondary">{selectedProblem.problemId}</span>
                            <span className="badge bg-info text-dark">{selectedProblem.category}</span>
                        </div>
                        <h5 className="card-title fw-bold">{selectedProblem.title}</h5>
                        <p className="card-text text-muted mb-0 whitespace-pre-wrap">{selectedProblem.description}</p>
                        {selectedProblem.difficulty && (
                            <p className="small text-muted mt-2 mb-0">Difficulty: {selectedProblem.difficulty}</p>
                        )}
                    </div>
                </div>
            )}

            <p className="text-muted mb-4">
                Select between <strong>{limits.minStudentsPerTeam} and {limits.maxStudentsPerTeam} members</strong> (including yourself) and enter your team name.
                A unique Team ID will be generated automatically.
            </p>

            {error && <div className="alert alert-danger">{error}</div>}

            <form onSubmit={handleSubmit}>
                <div className="card shadow-sm border-0 mb-4">
                    <div className="card-body">
                        <label className="form-label fw-semibold">Team name</label>
                        <input
                            type="text"
                            className="form-control form-control-lg"
                            placeholder="e.g. Code Warriors"
                            value={teamName}
                            onChange={e => setTeamName(e.target.value)}
                            required
                        />
                    </div>
                </div>

                <div className="card shadow-sm border-0 mb-4">
                    <div className="card-header bg-white fw-semibold d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <span>Select team members (include yourself)</span>
                        <span className="small text-muted">
                            Selected: {selectedIds.length} / {limits.minStudentsPerTeam}–{limits.maxStudentsPerTeam}
                        </span>
                    </div>
                    <div className="card-body">
                        <div className="mb-3">
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search by name, reg. no, email, or college…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        {students.length === 0 ? (
                            <p className="text-muted mb-0">No students available. Ask admin to upload the student list.</p>
                        ) : filteredStudents.length === 0 ? (
                            <p className="text-muted mb-0">No students match your search.</p>
                        ) : (
                            <>
                                {!atMax && (
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Add member from list</label>
                                        <select
                                            className="form-select"
                                            value=""
                                            onChange={e => {
                                                const id = e.target.value;
                                                if (!id) return;
                                                if (!selectedIds.includes(id) && selectedIds.length < limits.maxStudentsPerTeam) {
                                                    setSelectedIds(prev => [...prev, id]);
                                                }
                                            }}
                                        >
                                            <option value="">Select participant…</option>
                                            {availableStudents.map(s => (
                                                <option key={s._id} value={s._id}>
                                                    {(s.teamName || s.teamLeader || 'Unnamed')} – {s.registrationNumber}
                                                    {s.email ? ` – ${s.email}` : ''}
                                                    {s.collegeName ? ` – ${s.collegeName} · ${s.year} ${s.dept}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {atMax && (
                                    <p className="small text-warning mb-2">
                                        You have reached the maximum team size (selected {selectedIds.length} of {limits.maxStudentsPerTeam}). Remove a member below to change.
                                    </p>
                                )}
                                {selectedIds.length === 0 ? (
                                    <p className="text-muted mb-0 small">No members selected yet.</p>
                                ) : (
                                    <ul className="list-group">
                                        {selectedIds.map(id => {
                                            const s = students.find(st => st._id === id);
                                            if (!s) return null;
                                            const isLeader = leaderId && id === leaderId;
                                            return (
                                                <li key={id} className="list-group-item d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <strong>{s.teamName || s.teamLeader}</strong>{' '}
                                                        {isLeader && <span className="badge bg-primary ms-2">Leader (you)</span>}
                                                        <span className="text-muted small">
                                                            ({s.registrationNumber}{s.email ? ` · ${s.email}` : ''})
                                                        </span>
                                                        {s.collegeName && (
                                                            <span className="text-muted small">
                                                                {' '}— {s.collegeName} · {s.year} {s.dept}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {!isLeader && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger"
                                                            onClick={() => setSelectedIds(prev => prev.filter(x => x !== id))}
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={
                        submitting ||
                        students.length === 0 ||
                        selectedIds.length < limits.minStudentsPerTeam ||
                        selectedIds.length > limits.maxStudentsPerTeam
                    }
                >
                    {submitting ? 'Creating…' : 'Create team'}
                </button>
            </form>

            {showConfirm && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header border-bottom-0">
                                <h5 className="modal-title fw-bold">Confirm team creation</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => !submitting && setShowConfirm(false)}
                                    disabled={submitting}
                                />
                            </div>
                            <div className="modal-body">
                                <p className="mb-2">You are about to create team:</p>
                                <p className="fw-bold mb-3">{teamName}</p>
                                <p className="mb-2 fw-semibold">Team members ({selectedIds.length}):</p>
                                <ul className="list-unstyled small mb-3">
                                    {students
                                        .filter(s => selectedIds.includes(s._id))
                                        .map(s => (
                                            <li key={s._id} className="mb-1">
                                                <strong>{s.teamName || s.teamLeader}</strong>{' '}
                                                <span className="text-muted">
                                                    ({s.registrationNumber}{s.email ? ` · ${s.email}` : ''})
                                                </span>
                                                {s.collegeName && (
                                                    <span className="text-muted"> — {s.collegeName} · {s.year} {s.dept}</span>
                                                )}
                                            </li>
                                        ))}
                                </ul>
                                <p className="small text-muted mb-0">
                                    After confirming, your team will be created and you will receive a Team ID for login.
                                </p>
                            </div>
                            <div className="modal-footer border-top-0">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => !submitting && setShowConfirm(false)}
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={confirmCreateTeam}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Creating…' : 'Confirm & Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FormTeam;
