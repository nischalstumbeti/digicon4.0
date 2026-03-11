import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { BrandingContext } from '../context/BrandingContext';
import { useNavigate, Link } from 'react-router-dom';

const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const { branding } = useContext(BrandingContext);
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (!user) return null;

    const appName = branding?.appName || 'Hackathon Portal';
    const headerLogoUrl = branding?.headerLogoUrl?.trim();
    const headerImagePosition = branding?.headerImagePosition === 'right' ? 'right' : 'left';
    const headerTagline = branding?.headerTagline?.trim() || '';

    return (
        <nav className="navbar navbar-expand-lg theme-navbar mb-4">
            <div className="container">
                <Link className="navbar-brand fw-bold theme-brand d-flex align-items-center gap-2" to="/">
                    {headerLogoUrl && headerImagePosition === 'left' && (
                        <img src={headerLogoUrl} alt="" style={{ maxHeight: 36, maxWidth: 100, objectFit: 'contain' }} />
                    )}
                    <span className="d-flex flex-column">
                        <span>{appName}</span>
                        {headerTagline && <span className="small fw-normal opacity-85" style={{ fontSize: '0.7rem' }}>{headerTagline}</span>}
                    </span>
                    {headerLogoUrl && headerImagePosition === 'right' && (
                        <img src={headerLogoUrl} alt="" style={{ maxHeight: 36, maxWidth: 100, objectFit: 'contain' }} />
                    )}
                </Link>
                <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse" id="navbarNav">
                    <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                        {(user.role === 'Admin' || user.role === 'StudentCoordinator' || user.role === 'FacultyCoordinator') ? (
                            <li className="nav-item">
                                <Link className="nav-link" to="/admin">Admin</Link>
                            </li>
                        ) : user.role === 'Student' ? (
                            <>
                                <li className="nav-item"><Link className="nav-link" to="/team/form">Form Team</Link></li>
                            </>
                        ) : (
                            <>
                                <li className="nav-item"><Link className="nav-link" to="/team">Dashboard</Link></li>
                                <li className="nav-item"><Link className="nav-link" to="/team/problems">Select Problem</Link></li>
                            </>
                        )}
                    </ul>
                    <div className="d-flex align-items-center gap-2">
                        <span className="theme-nav-text me-2 fw-semibold">Hello, {user.role === 'Admin' ? 'Admin' : user.role === 'StudentCoordinator' ? (user.teamName || 'Coordinator') : user.role === 'FacultyCoordinator' ? (user.teamName || 'Faculty') : user.role === 'Student' ? (user.teamName || 'Student') : user.teamName}</span>
                        {((user.role === 'Admin' || user.role === 'StudentCoordinator' || user.role === 'FacultyCoordinator') || (user.role === 'Team' && user.teamId && String(user.teamId).includes('_digicon_'))) && (
                            <Link className="btn btn-outline-secondary btn-sm" to="/change-password">Change Password</Link>
                        )}
                        <button className="btn btn-outline-danger btn-sm" onClick={handleLogout}>Logout</button>
                    </div>
                </div>
            </div>
        </nav >
    );
};

export default Navbar;
