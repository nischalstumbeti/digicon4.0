import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';

const isLocalhost = typeof window !== 'undefined'
    && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const ProblemSelection = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [problems, setProblems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [teamHasSelection, setTeamHasSelection] = useState(false);

    // Selection Modal State
    const [showModal, setShowModal] = useState(false);
    const [selectedForConfirmation, setSelectedForConfirmation] = useState(null);
    const [confirming, setConfirming] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        const load = async () => {
            const selection = await api.get('/team/selection').then(r => r.data).catch(() => null);
            setTeamHasSelection(!!selection);
        };
        load();
        fetchProblems();

        const socketUrl = import.meta.env.VITE_SOCKET_URL || (isLocalhost ? 'http://localhost:5000' : window.location.origin);
        const socket = io(socketUrl);

        socket.on('problemsUpdated', () => {
            fetchProblems();
        });

        socket.on('problemStatusChanged', ({ problemId, status }) => {
            setProblems(prev => prev.map(p => p._id === problemId ? { ...p, status } : p));
        });

        return () => socket.disconnect();
    }, [navigate]);

    const fetchProblems = async () => {
        try {
            const res = await api.get('/problems');
            setProblems(res.data);
        } catch (err) {
            console.error('Error fetching problems:', err);
        } finally {
            setLoading(false);
        }
    };

    const categories = [...new Set(problems.map(p => p.category))];

    const filteredProblems = problems.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory ? p.category === filterCategory : true;
        return matchesSearch && matchesCategory;
    });

    const handleSelectClick = (problem) => {
        if (teamHasSelection || problem.status === 'Selected' || problem.remaining === 0) return;
        setSelectedForConfirmation(problem);
        setShowModal(true);
        setErrorMsg('');
    };

    const selectionDisabled = teamHasSelection;

    const confirmSelection = async () => {
        setConfirming(true);
        setErrorMsg('');
        try {
            await api.post('/team/select-problem', { problemId: selectedForConfirmation._id });
            setShowModal(false);
            // user needs to reflect the new state, let's just parse logic to redirect
            setTimeout(() => navigate('/team'), 1500); // go to dashboard after success
        } catch (err) {
            setErrorMsg(err.response?.data?.message || 'Failed to select problem. It might have just been selected by someone else.');
            setTimeout(() => setShowModal(false), 3000);
        } finally {
            setConfirming(false);
        }
    };

    if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>;

    return (
        <div className="container-fluid page-fade-in mb-5">
            {teamHasSelection && (
                <div className="alert alert-info d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
                    <span className="fw-semibold">Your team has already selected a problem. Selection is locked.</span>
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => navigate('/team')}>Go to Dashboard</button>
                </div>
            )}
            <div className="row mb-4 align-items-center">
                <div className="col-md-6 mb-3 mb-md-0">
                    <h2 className="fw-bold m-0">Available Problem Statements</h2>
                    <p className="text-muted m-0">First-come, first-serve selection.</p>
                </div>
                <div className="col-md-6">
                    <div className="d-flex gap-2">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Search by title..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <select
                            className="form-select w-auto"
                            value={filterCategory}
                            onChange={e => setFilterCategory(e.target.value)}
                        >
                            <option value="">All Categories</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
                {filteredProblems.map((problem) => (
                    <div className="col" key={problem._id}>
                        <div className={`card h-100 shadow-sm card-hover border-0 ${problem.status === 'Available' ? 'problem-card-available' : 'problem-card-selected'}`}>
                            <div className="card-body d-flex flex-column">
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                    <span className={`badge ${problem.status === 'Available' ? 'bg-success' : 'bg-danger'}`}>
                                        {problem.status}
                                    </span>
                                    <span className="badge bg-secondary">{problem.difficulty}</span>
                                </div>
                                <h5 className="card-title fw-bold mb-1">{problem.title}</h5>
                                <p className="text-muted small mb-2 text-truncate">ID: {problem.problemId}</p>
                                <p className="small text-muted mb-2">
                                    Can be taken by <strong>{problem.maxTeamsAllowed ?? '—'}</strong> team(s) · Already selected by <strong>{problem.selectedCount ?? 0}</strong>
                                </p>
                                <p className="card-text problem-statement-text flex-grow-1" style={{ fontSize: '0.9rem' }}>
                                    {problem.description.length > 100 ? problem.description.substring(0, 100) + '...' : problem.description}
                                </p>
                                <div className="mt-3">
                                    <button
                                        className={`btn w-100 fw-semibold ${selectionDisabled || problem.status === 'Selected' || problem.remaining === 0 ? 'btn-outline-secondary' : 'btn-outline-primary'}`}
                                        onClick={() => handleSelectClick(problem)}
                                        disabled={selectionDisabled || problem.status === 'Selected' || problem.remaining === 0}
                                    >
                                        {selectionDisabled ? 'Selection locked' : (problem.remaining === 0 || problem.status === 'Selected') ? 'Capacity full' : 'Select Problem'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {filteredProblems.length === 0 && (
                    <div className="col-12 text-center py-5">
                        <p className="text-muted fs-5">No problem statements found.</p>
                    </div>
                )}
            </div>

            {/* Confirmation Modal — fixed to viewport center */}
            {showModal && (
                <div
                    className="modal fade show d-block"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1050
                    }}
                >
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg animate__animated animate__zoomIn animate__faster">
                            <div className="modal-header border-bottom-0 pb-0">
                                <h5 className="modal-title fw-bold">Confirm Selection</h5>
                                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                            </div>
                            <div className="modal-body py-4">
                                {errorMsg && <div className="alert alert-danger mb-3">{errorMsg}</div>}
                                <p className="mb-1 text-muted">You are about to select:</p>
                                <h5 className="fw-bold text-primary mb-3">
                                    {selectedForConfirmation?.title}
                                </h5>
                                <div className="alert alert-warning border-0">
                                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                    <strong>This selection cannot be changed by the team.</strong>
                                    <br />Only an admin can modify it later.
                                </div>
                                <p className="mb-0 fw-semibold text-center mt-4">Are you sure you want to proceed?</p>
                            </div>
                            <div className="modal-footer border-top-0 pt-0 justify-content-center gap-2">
                                <button type="button" className="btn btn-light px-4" onClick={() => setShowModal(false)} disabled={confirming}>Cancel</button>
                                <button type="button" className="btn btn-primary px-4" onClick={confirmSelection} disabled={confirming}>
                                    {confirming ? <span className="spinner-border spinner-border-sm"></span> : 'Confirm Selection'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProblemSelection;
