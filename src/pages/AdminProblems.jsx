import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

const AdminProblems = () => {
    const fileInputRef = useRef(null);
    const [problems, setProblems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [formData, setFormData] = useState({ problemId: '', title: '', description: '', category: '', difficulty: 'Medium', sponsor: '' });
    const [msg, setMsg] = useState({ text: '', type: '' });
    const [problemFilter, setProblemFilter] = useState({ search: '', status: 'all' });
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [maxTeamsPerProblem, setMaxTeamsPerProblem] = useState(5);
    const [savingCapacity, setSavingCapacity] = useState(false);

    const fetchProblems = async () => {
        try {
            const res = await api.get('/admin/problems'); // Need to use admin route to see exactly who selected it
            setProblems(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await api.get('/admin/settings');
            setMaxTeamsPerProblem(res.data.maxTeamsPerProblem ?? 5);
        } catch (err) {
            // ignore
        }
    };

    useEffect(() => { fetchProblems(); fetchSettings(); }, []);

    const saveDefaultCapacity = async (e) => {
        e.preventDefault();
        setSavingCapacity(true);
        setMsg({ text: '', type: '' });
        try {
            await api.put('/admin/settings', { maxTeamsPerProblem });
            setMsg({ text: 'Group problem statement limit updated.', type: 'success' });
            fetchProblems();
        } catch (err) {
            setMsg({ text: err.response?.data?.message || 'Failed to update capacity', type: 'danger' });
        } finally {
            setSavingCapacity(false);
        }
    };

    const setProblemCapacity = async (p) => {
        const current = p.maxTeams != null ? String(p.maxTeams) : '';
        const next = window.prompt('Individual problem statement limit (leave empty to use group limit):', current);
        if (next == null) return;
        const trimmed = String(next).trim();
        let value = null;
        if (trimmed !== '') {
            const n = parseInt(trimmed, 10);
            if (Number.isNaN(n) || n < 1 || n > 100) {
                setMsg({ text: 'Max teams must be between 1 and 100 (or empty).', type: 'danger' });
                return;
            }
            value = n;
        }
        try {
            await api.put(`/admin/problem/${p._id}`, { maxTeams: value });
            setMsg({ text: 'Individual problem statement limit updated.', type: 'success' });
            fetchProblems();
        } catch (err) {
            setMsg({ text: err.response?.data?.message || 'Failed to update problem capacity', type: 'danger' });
        }
    };

    const resetProblemCapacityToGroup = async (p) => {
        try {
            await api.put(`/admin/problem/${p._id}`, { maxTeams: null });
            setMsg({ text: 'Individual problem statement limit cleared (group limit applies).', type: 'success' });
            fetchProblems();
        } catch (err) {
            setMsg({ text: err.response?.data?.message || 'Failed to reset problem capacity', type: 'danger' });
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/problem', formData);
            setMsg({ text: 'Problem created successfully', type: 'success' });
            setFormData({ problemId: '', title: '', description: '', category: '', difficulty: 'Medium', sponsor: '' });
            setShowCreate(false);
            fetchProblems();
        } catch (err) {
            setMsg({ text: err.response?.data?.message || 'Error creating problem', type: 'danger' });
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete problem rule? Check if anyone selected it first!')) return;
        try {
            await api.delete(`/admin/problem/${id}`);
            fetchProblems();
        } catch (err) {
            alert('Error deleting problem');
        }
    };

    const handleRemoveSelection = async (dbId) => {
        if (!window.confirm('Force remove this selection? This will free it up and notify users.')) return;
        try {
            await api.post('/admin/remove-selection', { problemId: dbId });
            setMsg({ text: 'Selection removed successfully.', type: 'info' });
            fetchProblems();
        } catch (err) {
            alert('Error removing selection');
        }
    };

    const sampleCSV = 'Problem ID,Title,Problem statement,Category,Difficulty,Sponsor\nP001,Sample Title,Short problem description here,Web,Medium,Optional Sponsor\nP002,Another Problem,Another description,AI,Hard,';

    const handleDownloadSample = () => {
        const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'problems_template.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const handleUploadProblems = async (e) => {
        e.preventDefault();
        if (!uploadFile) {
            setMsg({ text: 'Please select a CSV file.', type: 'danger' });
            return;
        }
        const ext = uploadFile.name.toLowerCase();
        if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx')) {
            setMsg({ text: 'Only CSV or Excel (.xlsx) files are supported.', type: 'danger' });
            return;
        }
        setUploading(true);
        setUploadResult(null);
        try {
            const b64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target?.result?.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(uploadFile);
            });
            if (!b64) {
                setMsg({ text: 'Could not read file.', type: 'danger' });
                setUploading(false);
                return;
            }
            const res = await api.post('/admin/upload-problems', { fileBase64: b64, filename: uploadFile.name });
            setUploadResult(res.data);
            setMsg({ text: `Upload complete: ${res.data.created || 0} created, ${res.data.updated || 0} updated.`, type: 'success' });
            setUploadFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchProblems();
        } catch (err) {
            setMsg({ text: err.response?.data?.message || 'Upload failed', type: 'danger' });
        } finally {
            setUploading(false);
        }
    };

    const onFileChange = (e) => {
        setUploadFile(e.target.files?.[0] || null);
        setUploadResult(null);
    };

    const filteredProblems = problems.filter(p => {
        const matchSearch = !problemFilter.search || [p.problemId, p.title, p.category, p.sponsor].some(
            v => String(v || '').toLowerCase().includes(problemFilter.search.toLowerCase())
        );
        const matchStatus = problemFilter.status === 'all' ||
            (problemFilter.status === 'available' && p.status === 'Available') ||
            (problemFilter.status === 'selected' && p.status === 'Selected');
        return matchSearch && matchStatus;
    });

    if (loading) return <div className="text-center mt-5"><div className="spinner-border text-primary"></div></div>;

    return (
        <div className="container page-fade-in mt-4 mb-5 theme-page">
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <h2 className="fw-bold m-0 theme-heading">Problem Management</h2>
                <div className="d-flex gap-2 flex-wrap">
                    <button className="btn btn-outline-primary fw-semibold" onClick={handleDownloadSample}>
                        Download sample CSV
                    </button>
                    <button className="btn btn-danger fw-semibold" onClick={() => setShowCreate(!showCreate)}>
                        {showCreate ? 'Cancel' : '+ Add Problem Statement'}
                    </button>
                </div>
            </div>

            <div className="card theme-card mb-4">
                <div className="card-body theme-card-body">
                    <h6 className="fw-bold mb-2">Problem statement selection limits</h6>
                    <p className="small text-muted mb-3">Two options: set a <strong>group limit</strong> (default for all problems), and optionally set an <strong>individual limit</strong> for specific problem statements.</p>
                    <form onSubmit={saveDefaultCapacity} className="d-flex flex-wrap gap-2 align-items-end">
                        <div>
                            <label className="form-label small text-muted mb-1">Group problem statement limit (default)</label>
                            <input
                                type="number"
                                min={1}
                                max={100}
                                className="form-control"
                                style={{ width: '180px' }}
                                value={maxTeamsPerProblem}
                                onChange={(e) => setMaxTeamsPerProblem(parseInt(e.target.value, 10) || 1)}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={savingCapacity}>
                            {savingCapacity ? 'Saving…' : 'Save capacity'}
                        </button>
                    </form>
                </div>
            </div>

            <div className="card theme-card mb-4">
                <div className="card-body theme-card-body">
                    <h6 className="fw-bold mb-2">Upload problems from CSV or Excel</h6>
                    <p className="small text-muted mb-3">Columns: Problem ID, Title, Problem statement, Category. Optional: Difficulty (Easy/Medium/Hard), Sponsor. Accepted: .csv, .xlsx</p>
                    <form onSubmit={handleUploadProblems} className="d-flex flex-wrap align-items-end gap-3">
                        <div>
                            <input
                                ref={fileInputRef}
                                id="problems-csv-input"
                                type="file"
                                accept=".csv,.xlsx"
                                className="form-control form-control-sm"
                                onChange={onFileChange}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={!uploadFile || uploading}>
                            {uploading ? 'Uploading…' : 'Upload file'}
                        </button>
                    </form>
                    {uploadResult && (
                        <div className="small text-success mt-2">
                            Created: {uploadResult.created}, Updated: {uploadResult.updated}, Rows: {uploadResult.total}
                        </div>
                    )}
                </div>
            </div>

            {msg.text && <div className={`alert alert-${msg.type} alert-dismissible animate__animated animate__fadeIn`}>{msg.text}</div>}

            <div className="card theme-card mb-4">
                <div className="card-body filter-bar">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search problems…"
                        value={problemFilter.search}
                        onChange={e => setProblemFilter(f => ({ ...f, search: e.target.value }))}
                        style={{ maxWidth: '280px' }}
                    />
                    <select
                        className="form-select"
                        value={problemFilter.status}
                        onChange={e => setProblemFilter(f => ({ ...f, status: e.target.value }))}
                        style={{ maxWidth: '160px' }}
                    >
                        <option value="all">All</option>
                        <option value="available">Available</option>
                        <option value="selected">Selected</option>
                    </select>
                </div>
            </div>

            {showCreate && (
                <div className="card theme-card mb-4 animate__animated animate__fadeInDown">
                    <div className="card-body theme-card-body rounded px-4 py-4">
                        <h5 className="fw-bold mb-3">Add Problem Statement</h5>
                        <form onSubmit={handleCreate}>
                            <div className="row g-3">
                                <div className="col-md-2">
                                    <input type="text" className="form-control" placeholder="Problem ID (Unique)" value={formData.problemId} onChange={e => setFormData({ ...formData, problemId: e.target.value })} required />
                                </div>
                                <div className="col-md-10">
                                    <input type="text" className="form-control" placeholder="Title" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                                </div>
                                <div className="col-12">
                                    <textarea className="form-control" placeholder="Detailed Description..." rows="3" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required></textarea>
                                </div>
                                <div className="col-md-4">
                                    <input type="text" className="form-control" placeholder="Category (e.g., AI, Web, IoT)" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required />
                                </div>
                                <div className="col-md-4">
                                    <select className="form-select" value={formData.difficulty} onChange={e => setFormData({ ...formData, difficulty: e.target.value })}>
                                        <option value="Easy">Easy</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Hard">Hard</option>
                                    </select>
                                </div>
                                <div className="col-md-4">
                                    <input type="text" className="form-control" placeholder="Sponsor (Optional)" value={formData.sponsor} onChange={e => setFormData({ ...formData, sponsor: e.target.value })} />
                                </div>
                                <div className="col-12 text-end mt-3">
                                    <button type="submit" className="btn btn-success px-4 fw-semibold">Save Problem</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="row g-4">
                {filteredProblems.length === 0 ? (
                    <div className="col-12 text-center theme-muted">No problems match the filter.</div>
                ) : (
                    filteredProblems.map(p => (
                        <div className="col-12 col-lg-6" key={p._id}>
                            <div className={`card h-100 theme-card card-hover ${p.status === 'Available' ? 'problem-card-available' : 'problem-card-selected'}`}>
                                <div className="card-body d-flex flex-column">
                                    <div className="d-flex justify-content-between mb-2">
                                        <span className="fw-bold theme-muted small">{p.problemId}</span>
                                        <span className={`badge ${p.status === 'Available' ? 'bg-success' : 'bg-danger'}`}>{p.status}</span>
                                    </div>
                                    <h5 className="card-title fw-bold mb-2">{p.title}</h5>
                                    <p className="small problem-statement-text mb-3 flex-grow-1">{p.description}</p>

                                    <div className="p-3 bg-light rounded mt-auto d-flex justify-content-between align-items-center">
                                        <div>
                                            <div className="small text-muted mb-1">
                                                Capacity:{' '}
                                                <strong>{(p.selectedByTeams?.length || 0) || (p.selectedByTeam ? 1 : 0)}</strong>
                                                {' / '}
                                                <strong>{p.maxTeams != null ? p.maxTeams : maxTeamsPerProblem}</strong>
                                                {' '}team(s){' '}
                                                <span className="text-muted">
                                                    ({p.maxTeams != null ? 'individual limit' : 'group limit'})
                                                </span>
                                            </div>
                                            {p.status === 'Selected' ? (
                                                <>
                                                    <div className="small fw-semibold text-danger">Selected (capacity reached)</div>
                                                    <div className="small text-muted">{new Date(p.selectedAt).toLocaleString()}</div>
                                                </>
                                            ) : (
                                                <div className="small fw-semibold text-success">Available for selection</div>
                                            )}
                                        </div>
                                        <div className="dropdown">
                                            <button className="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">Admin</button>
                                            <ul className="dropdown-menu dropdown-menu-end shadow-sm border-0">
                                                <li><button className="dropdown-item" onClick={() => setProblemCapacity(p)}>Set individual limit (teams)</button></li>
                                                {p.maxTeams != null && (
                                                    <li>
                                                        <button className="dropdown-item" onClick={() => resetProblemCapacityToGroup(p)}>
                                                            Reset to group limit
                                                        </button>
                                                    </li>
                                                )}
                                                {p.status === 'Selected' && (
                                                    <li><button className="dropdown-item text-warning fw-semibold" onClick={() => handleRemoveSelection(p._id)}>Remove Selection</button></li>
                                                )}
                                                <li><button className="dropdown-item text-danger fw-semibold" onClick={() => handleDelete(p._id)}>Delete Problem</button></li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AdminProblems;
