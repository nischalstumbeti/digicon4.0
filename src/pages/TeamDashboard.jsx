import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const TeamDashboard = () => {
    const { user } = useContext(AuthContext);
    const [selectedProblem, setSelectedProblem] = useState(null);
    const [teammates, setTeammates] = useState([]);
    const [marksData, setMarksData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [selectionRes, teammatesRes, marksRes] = await Promise.all([
                    api.get('/team/selection'),
                    api.get('/team/teammates').catch(() => ({ data: [] })),
                    api.get('/team/my-marks').catch(() => ({ data: { visible: false } })),
                ]);
                setSelectedProblem(selectionRes.data);
                setTeammates(Array.isArray(teammatesRes.data) ? teammatesRes.data : []);
                setMarksData(marksRes.data);
            } catch (err) {
                console.error('Error fetching dashboard data', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="team-page-loading text-center py-5">
                <div className="spinner-border text-primary" role="status" />
            </div>
        );
    }

    const hasProblem = !!selectedProblem;
    const teammatesCount = teammates.length;
    const marksVisibleByAdmin = !!marksData?.visible;
    const hasMarksData = marksData?.rounds?.length > 0 || marksData?.totalMarks != null;

    return (
        <div className="container-fluid page-fade-in team-dashboard-page">
            <div className="row mb-4">
                <div className="col-12">
                    <h2 className="fw-bold mb-1">Team Dashboard</h2>
                    <p className="text-muted mb-0">
                        Welcome, {user.teamName}. Use the left sidebar to navigate between dashboard and problem selection.
                    </p>
                </div>
            </div>

            {/* Summary: Problem status & Team members count only */}
            <div className="row g-3 mb-4">
                <div className="col-md-6">
                    <div className="card shadow-sm border-0 h-100">
                        <div className="card-body d-flex align-items-center justify-content-between">
                            <div>
                                <p className="text-muted text-uppercase small mb-1">Problem status</p>
                                <h5 className="fw-bold mb-0">{hasProblem ? 'Selected' : 'Not selected'}</h5>
                            </div>
                            <span className={`badge fs-6 px-3 ${hasProblem ? 'bg-success' : 'bg-secondary'}`}>
                                {hasProblem ? 'Locked' : 'Pending'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="col-md-6">
                    <div className="card shadow-sm border-0 h-100">
                        <div className="card-body d-flex align-items-center justify-content-between">
                            <div>
                                <p className="text-muted text-uppercase small mb-1">Team members</p>
                                <h5 className="fw-bold mb-0">{teammatesCount || '—'}</h5>
                            </div>
                            <i className="bi bi-people fs-3 text-primary" aria-hidden="true" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Team Information: only Team ID */}
            <div className="row g-4 mb-4">
                <div className="col-lg-3 col-md-4">
                    <div className="card shadow-sm border-0 h-100">
                        <div className="card-header bg-white border-0 pt-3 pb-2">
                            <h6 className="fw-bold mb-0 text-muted small text-uppercase">Team Information</h6>
                        </div>
                        <div className="card-body pt-0">
                            <p className="mb-1 small text-muted">Team ID</p>
                            <p className="fw-bold mb-0 text-primary">{user.teamId}</p>
                        </div>
                    </div>
                </div>
                <div className="col-lg-9 col-md-8">
                    <div className="card shadow-sm border-0 h-100">
                        <div className="card-header bg-white border-0 pt-3 pb-2">
                            <h6 className="fw-bold mb-0">Selected Problem Statement</h6>
                        </div>
                        <div className="card-body pt-0">
                            {selectedProblem ? (
                                <div className="alert alert-success border-0 shadow-sm mb-0">
                                    <h6 className="alert-heading fw-bold mb-2">{selectedProblem.title} ({selectedProblem.problemId})</h6>
                                    <p className="mb-2 small">{selectedProblem.description}</p>
                                    <p className="mb-0 text-muted small">
                                        <strong>Category:</strong> {selectedProblem.category} | <strong>Difficulty:</strong> {selectedProblem.difficulty}
                                    </p>
                                </div>
                            ) : (
                                <div className="alert alert-warning border-0 shadow-sm text-center py-3 mb-0">
                                    <p className="mb-2 fw-semibold small">No problem statement selected yet.</p>
                                    <a href="/team/problems" className="btn btn-primary btn-sm">Go to Selection Page</a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Team member details — full width */}
            <div className="row g-4 mb-4">
                <div className="col-12">
                    <div className="card shadow-sm border-0 theme-card">
                        <div className="card-header theme-card-header border-0 pt-3 pb-2">
                            <h6 className="fw-bold mb-0">Team member details</h6>
                        </div>
                        <div className="card-body">
                            {teammates.length === 0 ? (
                                <p className="text-muted mb-0 small">No teammate details available. (Teams created from the student list will show members here.)</p>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-sm table-hover align-middle mb-0 theme-table">
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
                                            {teammates.map((t, i) => (
                                                <tr key={i}>
                                                    <td className="fw-semibold">{t.teamName || t.teamLeader}</td>
                                                    <td>{t.registrationNumber}</td>
                                                    <td className="small">{t.email}</td>
                                                    <td className="small">{t.collegeName}</td>
                                                    <td>{t.year}</td>
                                                    <td>{t.dept}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Marks / Review details — visible only when admin has enabled it and data exists */}
            {marksVisibleByAdmin && hasMarksData && (
                <div className="row g-4">
                    <div className="col-12">
                        <div className="card shadow-sm border-0">
                            <div className="card-header bg-white border-0 pt-3 pb-2 d-flex align-items-center justify-content-between flex-wrap gap-2">
                                <h6 className="fw-bold mb-0">Marks & review details</h6>
                                <span className="badge bg-success">Visible by admin</span>
                            </div>
                            <div className="card-body">
                                {marksData?.rounds?.length > 0 ? (
                                    <>
                                        <div className="row g-3 mb-3">
                                            {marksData.rounds.map((r) => {
                                                const entry = (marksData.roundMarks || []).find(
                                                    (e) => e.round && (e.round._id || e.round) && String(e.round._id || e.round) === String(r._id)
                                                );
                                                const val = entry?.marks;
                                                return (
                                                    <div key={r._id} className="col-6 col-md-4 col-lg-3">
                                                        <div className="small text-muted">{r.name} ({r.weightage}%)</div>
                                                        <div className="fw-bold">{val != null ? val : '—'}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="pt-2 border-top">
                                            <span className="text-muted small">Total: </span>
                                            <strong className="fs-5">{marksData.totalMarks != null ? marksData.totalMarks : '—'}</strong>
                                        </div>
                                    </>
                                ) : (
                                    <p className="mb-0 small">Total: <strong>{marksData?.totalMarks != null ? marksData.totalMarks : '—'}</strong></p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamDashboard;
