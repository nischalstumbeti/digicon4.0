import React, { useState, useEffect } from 'react';
import api from '../services/api';

const AdminLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        try {
            const res = await api.get('/admin/activity-logs');
            setLogs(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const handleExport = async () => {
        try {
            const res = await api.get('/admin/export-excel', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'hackathon_problem_selection.xlsx');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            alert('Error exporting Excel');
        }
    };

    if (loading) return <div className="text-center mt-5"><div className="spinner-border text-primary"></div></div>;

    return (
        <div className="container page-fade-in mt-4 mb-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="fw-bold m-0">Activity Logs & Export</h2>
                    <p className="text-muted m-0">Shows only the last 10 activities (logs & Excel export).</p>
                </div>
                <button className="btn btn-success fw-semibold shadow-sm" onClick={handleExport}>
                    <i className="bi bi-file-earmark-excel me-2"></i> Download Excel Report
                </button>
            </div>

            <div className="card shadow-sm border-0">
                <div className="card-header bg-white border-bottom pb-0 pt-4">
                    <h5 className="fw-bold mb-3">System Audit Log</h5>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th className="py-3 px-4">Timestamp</th>
                                <th className="py-3">Action</th>
                                <th className="py-3">User/Team Info</th>
                                <th className="py-3">Metadata</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr><td colSpan="4" className="text-center py-4 text-muted">No activity recorded yet.</td></tr>
                            ) : (
                                logs.map(log => (
                                    <tr key={log._id}>
                                        <td className="px-4 text-muted small">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className="fw-semibold"><span className="badge bg-secondary">{log.action}</span></td>
                                        <td>
                                            {log.user ? (
                                                <>
                                                    <div className="fw-bold">{log.user.teamName}</div>
                                                    <div className="small text-muted">{log.user.teamId}</div>
                                                </>
                                            ) : (
                                                <span className="text-muted fst-italic">System</span>
                                            )}
                                        </td>
                                        <td className="text-muted small" style={{ maxWidth: '300px' }}>
                                            <pre className="mb-0 bg-light p-2 rounded border" style={{ fontSize: '0.75rem', overflowX: 'auto' }}>
                                                {JSON.stringify(log.metadata, null, 2)}
                                            </pre>
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

export default AdminLogs;
