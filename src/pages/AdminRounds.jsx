import React, { useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';

const AdminRounds = () => {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'Admin';
    const [rounds, setRounds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [form, setForm] = useState({ name: '', weightage: '' });
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', weightage: '' });

    const fetchRounds = async () => {
        try {
            const res = await api.get('/admin/rounds');
            setRounds(res.data);
        } catch (e) {
            setMsg({ type: 'danger', text: e.response?.data?.message || 'Failed to load rounds' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRounds();
    }, []);

    const totalWeight = rounds.reduce((s, r) => s + (r.weightage || 0), 0);
    const weightOk = totalWeight === 100;

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!isAdmin) return;
        const name = form.name.trim();
        const w = Number(form.weightage);
        if (!name || isNaN(w) || w < 0 || w > 100) {
            setMsg({ type: 'danger', text: 'Name required and weightage 0–100' });
            return;
        }
        setSaving(true);
        setMsg({ type: '', text: '' });
        try {
            await api.post('/admin/rounds', { name, weightage: w, order: rounds.length });
            setMsg({ type: 'success', text: 'Round added. Ensure total weightage = 100% for correct calculation.' });
            setForm({ name: '', weightage: '' });
            fetchRounds();
        } catch (e) {
            setMsg({ type: 'danger', text: e.response?.data?.message || 'Failed to create round' });
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (r) => {
        setEditingId(r._id);
        setEditForm({ name: r.name, weightage: String(r.weightage) });
    };

    const handleUpdate = async () => {
        if (!editingId) return;
        const w = Number(editForm.weightage);
        if (isNaN(w) || w < 0 || w > 100) {
            setMsg({ type: 'danger', text: 'Weightage must be 0–100' });
            return;
        }
        setSaving(true);
        setMsg({ type: '', text: '' });
        try {
            await api.put(`/admin/rounds/${editingId}`, { name: editForm.name.trim(), weightage: w });
            setEditingId(null);
            fetchRounds();
        } catch (e) {
            setMsg({ type: 'danger', text: e.response?.data?.message || 'Failed to update' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!isAdmin || !window.confirm('Delete this round? Marks for this round will be lost.')) return;
        try {
            await api.delete(`/admin/rounds/${id}`);
            fetchRounds();
        } catch (e) {
            setMsg({ type: 'danger', text: e.response?.data?.message || 'Failed to delete' });
        }
    };

    if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>;

    return (
        <div className="container page-fade-in mt-2 mb-5">
            <h2 className="fw-bold text-primary mb-1">Rounds</h2>
            <p className="text-muted small mb-4">
                Create rounds and set weightage (%). Total should be 100% for automatic complete marks calculation.
            </p>

            {msg.text && <div className={`alert alert-${msg.type} mb-4`}>{msg.text}</div>}

            {!weightOk && rounds.length > 0 && (
                <div className="alert alert-warning mb-4">
                    Total weightage is {totalWeight}%. Set it to 100% for correct total marks.
                </div>
            )}

            {isAdmin && (
                <div className="card shadow-sm border-0 mb-4">
                    <div className="card-body">
                        <h6 className="fw-bold mb-3">Add round</h6>
                        <form onSubmit={handleCreate} className="row g-2 align-items-end">
                            <div className="col-auto">
                                <input
                                    className="form-control"
                                    placeholder="Round name"
                                    value={form.name}
                                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                />
                            </div>
                            <div className="col-auto" style={{ width: 100 }}>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    className="form-control"
                                    placeholder="%"
                                    value={form.weightage}
                                    onChange={(e) => setForm((p) => ({ ...p, weightage: e.target.value }))}
                                />
                            </div>
                            <div className="col-auto">
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Adding…' : 'Add round'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <h6 className="fw-bold mb-2">Rounds list (total: {totalWeight}%)</h6>
            <div className="card shadow-sm border-0">
                <div className="table-responsive">
                    <table className="table table-hover mb-0">
                        <thead className="table-light">
                            <tr>
                                <th>#</th>
                                <th>Name</th>
                                <th>Weightage (%)</th>
                                {isAdmin && <th></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {rounds.length === 0 ? (
                                <tr><td colSpan={isAdmin ? 4 : 3} className="text-muted text-center py-4">No rounds. Add rounds to use per-round marks.</td></tr>
                            ) : (
                                rounds.map((r, i) => (
                                    <tr key={r._id}>
                                        <td>{i + 1}</td>
                                        <td>
                                            {editingId === r._id ? (
                                                <input
                                                    className="form-control form-control-sm"
                                                    value={editForm.name}
                                                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                                                />
                                            ) : (
                                                r.name
                                            )}
                                        </td>
                                        <td>
                                            {editingId === r._id ? (
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    step={0.5}
                                                    className="form-control form-control-sm"
                                                    style={{ width: 80 }}
                                                    value={editForm.weightage}
                                                    onChange={(e) => setEditForm((p) => ({ ...p, weightage: e.target.value }))}
                                                />
                                            ) : (
                                                r.weightage
                                            )}
                                        </td>
                                        {isAdmin && (
                                            <td>
                                                {editingId === r._id ? (
                                                    <>
                                                        <button type="button" className="btn btn-sm btn-primary me-1" onClick={handleUpdate} disabled={saving}>Save</button>
                                                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => startEdit(r)}>Edit</button>
                                                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(r._id)}>Delete</button>
                                                    </>
                                                )}
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

export default AdminRounds;
