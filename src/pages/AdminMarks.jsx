import React, { useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';

const getRoundMarks = (user, roundId) => {
    const entry = (user.roundMarks || []).find((e) => e.round && (e.round._id || e.round) && String(e.round._id || e.round) === String(roundId));
    return entry ? { marks: entry.marks, remarks: entry.remarks } : { marks: null, remarks: '' };
};

const AdminMarks = () => {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'Admin';
    const [data, setData] = useState({ rounds: [], teams: [], students: [] });
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [editing, setEditing] = useState({}); // { userId: { roundId: { marks, remarks } } or legacy { marks, marksRemarks } }
    const [visibilitySaving, setVisibilitySaving] = useState(false);
    const [marksMode, setMarksMode] = useState('team'); // 'team' | 'individual'
    const [editingRowId, setEditingRowId] = useState(null); // id of row in edit mode (team or student _id)
    const [teamSearch, setTeamSearch] = useState('');

    const fetchMarks = async () => {
        try {
            const [marksRes, settingsRes] = await Promise.all([
                api.get('/admin/marks'),
                api.get('/admin/settings').catch(() => ({ data: {} })),
            ]);
            setData(marksRes.data);
            setSettings(settingsRes.data);
        } catch (e) {
            setMsg({ type: 'danger', text: e.response?.data?.message || 'Failed to load marks' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMarks();
    }, []);

    useEffect(() => {
        setEditingRowId(null);
    }, [marksMode]);

    const setEdit = (userId, roundId, marks, remarks) => {
        setEditing((p) => {
            const next = { ...p };
            if (!next[userId]) next[userId] = {};
            if (roundId) {
                next[userId][roundId] = { marks: marks ?? '', remarks: remarks ?? '' };
            } else {
                next[userId].legacy = { marks: marks ?? '', marksRemarks: remarks ?? '' };
            }
            return next;
        });
    };

    const getEdit = (userId, roundId) => {
        const u = data.teams.find((t) => t._id === userId) || data.students.find((s) => s._id === userId);
        if (!u) return { marks: '', remarks: '' };
        if (roundId) {
            const rm = getRoundMarks(u, roundId);
            const ed = editing[userId]?.[roundId];
            return ed ? { marks: ed.marks ?? rm.marks ?? '', remarks: ed.remarks ?? rm.remarks ?? '' } : { marks: rm.marks ?? '', remarks: rm.remarks ?? '' };
        }
        const ed = editing[userId]?.legacy;
        return ed ? { marks: ed.marks ?? u.marks ?? '', remarks: ed.marksRemarks ?? u.marksRemarks ?? '' } : { marks: u.marks ?? '', remarks: u.marksRemarks ?? '' };
    };

    const saveMarks = async (userId, roundIdOrAll) => {
        if (!isAdmin) return;
        setSavingId(userId);
        setMsg({ type: '', text: '' });
        try {
            if (hasRounds && roundIdOrAll === 'all') {
                const roundMarks = rounds.map((r) => {
                    const ed = getEdit(userId, r._id);
                    return { roundId: r._id, marks: ed.marks === '' ? null : Number(ed.marks), remarks: ed.remarks || '' };
                });
                await api.put(`/admin/marks/${userId}`, { roundMarks });
            } else if (roundIdOrAll) {
                const ed = editing[userId]?.[roundIdOrAll];
                if (ed) {
                    await api.put(`/admin/marks/${userId}`, {
                        roundId: roundIdOrAll,
                        marks: ed.marks === '' ? null : Number(ed.marks),
                        marksRemarks: ed.remarks || '',
                    });
                }
            } else {
                const ed = editing[userId]?.legacy;
                if (ed) {
                    await api.put(`/admin/marks/${userId}`, {
                        marks: ed.marks === '' ? null : Number(ed.marks),
                        marksRemarks: ed.marksRemarks ?? ed.remarks ?? '',
                    });
                }
            }
            const isTeam = data.teams.some((t) => String(t._id) === String(userId));
            setMsg({ type: 'success', text: isTeam ? 'Marks updated and applied to all team members.' : 'Marks updated.' });
            setEditing((p) => { const next = { ...p }; delete next[userId]; return next; });
            setEditingRowId(null);
            fetchMarks();
        } catch (err) {
            setMsg({ type: 'danger', text: err.response?.data?.message || 'Failed to update marks' });
        } finally {
            setSavingId(null);
        }
    };

    const startEdit = (rowId) => {
        setEditingRowId(rowId);
    };

    const cancelEdit = (rowId) => {
        setEditingRowId(null);
        setEditing((p) => { const next = { ...p }; delete next[rowId]; return next; });
    };

    const handleExportExcel = async () => {
        setMsg({ type: '', text: '' });
        try {
            const res = await api.get('/admin/export-marks-excel', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'hackathon_marks.xlsx';
            a.click();
            window.URL.revokeObjectURL(url);
            setMsg({ type: 'success', text: 'Excel downloaded.' });
        } catch (e) {
            setMsg({ type: 'danger', text: e.response?.data?.message || 'Failed to download Excel' });
        }
    };

    const handleVisibilityChange = async (checked) => {
        setVisibilitySaving(true);
        setMsg({ type: '', text: '' });
        try {
            await api.put('/admin/settings', { marksVisibleToTeams: !!checked });
            setSettings((s) => (s ? { ...s, marksVisibleToTeams: !!checked } : { marksVisibleToTeams: !!checked }));
            setMsg({ type: 'success', text: checked ? 'Teams can now see their marks.' : 'Marks hidden from teams.' });
        } catch (e) {
            setMsg({ type: 'danger', text: e.response?.data?.message || 'Failed to update setting' });
        } finally {
            setVisibilitySaving(false);
        }
    };

    if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>;

    const rounds = data.rounds || [];
    const hasRounds = rounds.length > 0;
    const teamSearchNorm = teamSearch.trim().toLowerCase();
    const filteredTeams = (data.teams || []).filter((t) => {
        if (!teamSearchNorm) return true;
        const hay = `${t.teamName || ''} ${t.teamId || ''}`.toLowerCase();
        return hay.includes(teamSearchNorm);
    });

    return (
        <div className="container page-fade-in mt-2 mb-5">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                <div>
                    <h2 className="fw-bold text-primary mb-1">Marks</h2>
                    <p className="text-muted small mb-0">
                        View and update marks by round. Total is calculated from round weightages. Only Admins can update.
                    </p>
                </div>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                    <label className="d-flex align-items-center gap-2 small mb-0">
                        <span className="text-muted me-1">Enter marks by:</span>
                        <select
                            className="form-select form-select-sm"
                            style={{ width: 'auto' }}
                            value={marksMode}
                            onChange={(e) => setMarksMode(e.target.value)}
                        >
                            <option value="team">Team marks</option>
                            <option value="individual">Individual marks</option>
                        </select>
                    </label>
                    <input
                        type="text"
                        className="form-control form-control-sm"
                        style={{ width: 240 }}
                        placeholder="Search team name / ID…"
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                    />
                    <label className="d-flex align-items-center gap-2 small mb-0">
                        <input
                            type="checkbox"
                            checked={!!settings?.marksVisibleToTeams}
                            disabled={visibilitySaving || !isAdmin}
                            onChange={(e) => handleVisibilityChange(e.target.checked)}
                        />
                        Marks visible to teams
                    </label>
                    {isAdmin && (
                        <button type="button" className="btn btn-success btn-sm" onClick={handleExportExcel}>
                            Download Excel
                        </button>
                    )}
                </div>
            </div>

            {msg.text && <div className={`alert alert-${msg.type} mb-4`}>{msg.text}</div>}

            {marksMode === 'team' && (
                <p className="text-muted small mb-3">
                    Enter marks per team. Saved team marks are automatically applied to all members of that team.
                </p>
            )}
            {marksMode === 'individual' && (
                <p className="text-muted small mb-3">
                    Enter marks per student. Below you can see all team members; each row shows which team the student belongs to.
                </p>
            )}

            <div className="mb-4">
                <h6 className="fw-bold mb-3">Teams</h6>
                <div className="card shadow-sm border-0">
                    <div className="table-responsive">
                        <table className="table table-hover mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th>Team ID</th>
                                    <th>Team Name</th>
                                    <th>Problem</th>
                                    {hasRounds ? rounds.map((r) => <th key={r._id}>{r.name} ({r.weightage}%)</th>) : <th>Marks</th>}
                                    <th>Total</th>
                                    {isAdmin && marksMode === 'team' && <th></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTeams.length === 0 ? (
                                    <tr><td colSpan={hasRounds ? 5 + rounds.length : 6} className="text-muted text-center py-3">No teams yet.</td></tr>
                                ) : (
                                    filteredTeams.map((t) => {
                                        const isEditingTeam = isAdmin && marksMode === 'team' && String(editingRowId) === String(t._id);
                                        return (
                                        <tr key={t._id}>
                                            <td>{t.teamId}</td>
                                            <td>{t.teamName}</td>
                                            <td>{t.selectedProblemId ? (t.selectedProblemId.title || t.selectedProblemId.problemId) : '—'}</td>
                                            {hasRounds ? (
                                                rounds.map((r) => {
                                                    const ed = getEdit(t._id, r._id);
                                                    return (
                                                        <td key={r._id}>
                                                            {isEditingTeam ? (
                                                                <input
                                                                    type="number"
                                                                    className="form-control form-control-sm"
                                                                    style={{ width: 70 }}
                                                                    min={0}
                                                                    value={ed.marks}
                                                                    onChange={(ev) => setEdit(t._id, r._id, ev.target.value, ed.remarks)}
                                                                />
                                                            ) : (
                                                                (getRoundMarks(t, r._id).marks ?? '—')
                                                            )}
                                                        </td>
                                                    );
                                                })
                                            ) : (
                                                <td>
                                                    {isEditingTeam ? (
                                                        <input
                                                            type="number"
                                                            className="form-control form-control-sm"
                                                            style={{ width: 80 }}
                                                            min={0}
                                                            value={getEdit(t._id, null).marks}
                                                            onChange={(ev) => setEdit(t._id, null, ev.target.value, getEdit(t._id, null).remarks)}
                                                        />
                                                    ) : (
                                                        t.marks != null ? t.marks : '—'
                                                    )}
                                                </td>
                                            )}
                                            <td><strong>{t.totalMarks != null ? t.totalMarks : '—'}</strong></td>
                                            {isAdmin && marksMode === 'team' && (
                                                <td>
                                                    {isEditingTeam ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-primary me-1"
                                                                disabled={savingId === t._id}
                                                                onClick={() => saveMarks(t._id, hasRounds ? 'all' : null)}
                                                            >
                                                                {savingId === t._id ? 'Saving…' : 'Save'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-secondary"
                                                                onClick={() => cancelEdit(t._id)}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-primary"
                                                            onClick={() => startEdit(t._id)}
                                                        >
                                                            Edit
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {marksMode === 'individual' && (
                <div>
                    <h6 className="fw-bold mb-3">Individual students (all team members)</h6>
                    <div className="card shadow-sm border-0">
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>Team</th>
                                        <th>Reg. No.</th>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>College</th>
                                        {hasRounds ? rounds.map((r) => <th key={r._id}>{r.name}</th>) : <th>Marks</th>}
                                        <th>Total</th>
                                        {isAdmin && <th></th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.students.length === 0 ? (
                                        <tr><td colSpan={7 + (hasRounds ? rounds.length : 1)} className="text-muted text-center py-3">No students yet.</td></tr>
                                    ) : (
                                        data.students.map((s) => {
                                            const team = data.teams.find((t) => String(t._id) === String(s.assignedTeamId));
                                            const teamLabel = team ? `${team.teamId} (${team.teamName})` : '—';
                                            const isEditingStudent = isAdmin && String(editingRowId) === String(s._id);
                                            return (
                                                <tr key={s._id}>
                                                    <td className="small">{teamLabel}</td>
                                                    <td>{s.registrationNumber || '—'}</td>
                                                    <td>{s.teamName}</td>
                                                    <td>{s.email}</td>
                                                    <td>{s.collegeName || '—'}</td>
                                                    {hasRounds ? (
                                                        rounds.map((r) => {
                                                            const ed = getEdit(s._id, r._id);
                                                            return (
                                                                <td key={r._id}>
                                                                    {isEditingStudent ? (
                                                                        <input
                                                                            type="number"
                                                                            className="form-control form-control-sm"
                                                                            style={{ width: 70 }}
                                                                            min={0}
                                                                            value={ed.marks}
                                                                            onChange={(ev) => setEdit(s._id, r._id, ev.target.value, ed.remarks)}
                                                                        />
                                                                    ) : (
                                                                        (getRoundMarks(s, r._id).marks ?? '—')
                                                                    )}
                                                                </td>
                                                            );
                                                        })
                                                    ) : (
                                                        <td>
                                                            {isEditingStudent ? (
                                                                <input
                                                                    type="number"
                                                                    className="form-control form-control-sm"
                                                                    style={{ width: 80 }}
                                                                    min={0}
                                                                    value={getEdit(s._id, null).marks}
                                                                    onChange={(ev) => setEdit(s._id, null, ev.target.value, getEdit(s._id, null).remarks)}
                                                                />
                                                            ) : (
                                                                s.marks != null ? s.marks : '—'
                                                            )}
                                                        </td>
                                                    )}
                                                    <td><strong>{s.totalMarks != null ? s.totalMarks : '—'}</strong></td>
                                                    {isAdmin && (
                                                        <td>
                                                            {isEditingStudent ? (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-primary me-1"
                                                                        disabled={savingId === s._id}
                                                                        onClick={() => saveMarks(s._id, hasRounds ? 'all' : null)}
                                                                    >
                                                                        {savingId === s._id ? 'Saving…' : 'Save'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-secondary"
                                                                        onClick={() => cancelEdit(s._id)}
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-outline-primary"
                                                                    onClick={() => startEdit(s._id)}
                                                                >
                                                                    Edit
                                                                </button>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminMarks;
