import React, { useMemo, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { BrandingContext } from '../context/BrandingContext';

const Login = () => {
    const { login } = useContext(AuthContext);
    const { branding } = useContext(BrandingContext);
    const navigate = useNavigate();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const helpLines = useMemo(() => {
        const raw = String(branding?.loginHelpText || '').replace(/\r/g, '').trim();
        if (!raw) return [];
        return raw.split('\n').map(s => s.trim()).filter(Boolean);
    }, [branding?.loginHelpText]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const user = await login(identifier, password);
            if (user.mustChangePassword) {
                navigate('/change-password');
            } else if (user.role === 'Admin') {
                navigate('/admin');
            } else if (user.role === 'Student') {
                navigate('/team/form');
            } else {
                navigate('/team');
            }
        } catch (err) {
            const msg = err.response?.data?.message
                || (err.response ? `Request failed (${err.response.status})` : 'Cannot reach server. Make sure the backend is running on http://localhost:5000 and you have run: npm run seed');
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const hasLoginHeaderText = !!branding?.loginHeader?.trim();
    const hasLoginHeaderImage = !!branding?.loginHeaderImageUrl?.trim();
    const showLoginHeader = hasLoginHeaderText || hasLoginHeaderImage;
    const headerBg = branding?.loginHeaderBg?.trim() || 'var(--primary)';
    const headerTextColor = branding?.loginHeaderTextColor?.trim() || '#fff';
    const buttonColor = branding?.loginButtonColor?.trim() || '#dc3545';
    const cardBg = branding?.loginCardBg?.trim() || '#fff';
    const promoFit = (branding?.loginPromoImageFit === 'contain' || branding?.loginPromoImageFit === 'cover') ? branding.loginPromoImageFit : 'cover';
    const loginHeaderImagePosition = branding?.loginHeaderImagePosition === 'right' ? 'right' : 'left';
    const loginHeaderTagline = branding?.loginHeaderTagline?.trim() || '';

    return (
        <div className="container-fluid page-fade-in flex-grow-1 d-flex flex-column theme-page theme-login-bg">
            {showLoginHeader && (
                <header className="login-page-header py-3 px-3" style={{ background: headerBg, color: headerTextColor, borderBottom: '2px solid var(--accent)' }}>
                    <div className="container-fluid d-flex align-items-center justify-content-center gap-3 flex-wrap">
                        {hasLoginHeaderImage && loginHeaderImagePosition === 'left' && (
                            <img src={branding.loginHeaderImageUrl} alt="" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }} />
                        )}
                        <div className="text-center">
                            {hasLoginHeaderText && <h1 className="h4 fw-bold mb-0">{branding.loginHeader}</h1>}
                            {loginHeaderTagline && <p className="small mb-0 mt-1 opacity-90">{loginHeaderTagline}</p>}
                        </div>
                        {hasLoginHeaderImage && loginHeaderImagePosition === 'right' && (
                            <img src={branding.loginHeaderImageUrl} alt="" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }} />
                        )}
                    </div>
                </header>
            )}
            {!!branding?.loginMarqueeText && (
                <div className="login-marquee py-2 px-3 text-center small fw-semibold" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', borderBottom: '1px solid var(--border)' }}>
                    {branding.loginMarqueeLink ? (
                        <a href={branding.loginMarqueeLink} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                            <marquee behavior="scroll" direction="left" scrollamount="4">{branding.loginMarqueeText}</marquee>
                        </a>
                    ) : (
                        <marquee behavior="scroll" direction="left" scrollamount="4">{branding.loginMarqueeText}</marquee>
                    )}
                </div>
            )}
            <div className="row flex-grow-1 w-100 justify-content-center align-items-center py-3">
                {/* Left: promotional image (replace src with your promo image path) */}
                <div className="col-12 col-lg-5 mb-4 mb-lg-0 d-none d-lg-flex justify-content-center">
                    <div className="glass-panel p-0 overflow-hidden" style={{ maxWidth: 480, minHeight: 280 }}>
                        <img
                            src={branding?.loginPromoImageUrl || '/digicon-promo.png'}
                            alt="Promotion"
                            style={{ width: '100%', height: '100%', minHeight: 280, objectFit: promoFit }}
                        />
                    </div>
                </div>

                {/* Right: instructions + login */}
                <div className="col-12 col-md-8 col-lg-5 col-xl-4">
                    <div className="mb-3 text-center text-lg-start">
                        <div className="mb-2">
                            <img
                                src={branding?.brandLogoUrl || '/vite.svg'}
                                alt="Logo"
                                style={{ maxHeight: 52, maxWidth: '100%', objectFit: 'contain' }}
                            />
                        </div>
                        <h2 className="fw-bold mb-2 theme-heading">{branding?.loginTitle || 'Hackathon Portal Login'}</h2>
                        {helpLines.length > 0 ? (
                            <ul className="theme-muted small mb-0 text-start">
                                {helpLines.map((line, idx) => <li key={idx}>{line}</li>)}
                            </ul>
                        ) : null}
                    </div>
                    <div className="card theme-card theme-card-glow animate__animated animate__fadeInUp" style={{ backgroundColor: cardBg }}>
                        <div className="card-body p-4">
                            {error && <div className="alert alert-danger animate__animated animate__shakeX">{error}</div>}

                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Team ID / Email / Reg. No.</label>
                                    <input
                                        type="text"
                                        className="form-control form-control-lg"
                                        placeholder="Enter Team ID, Email, or Registration Number"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="form-label fw-semibold">Password</label>
                                    <input
                                        type="password"
                                        className="form-control form-control-lg"
                                        placeholder="Enter password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="d-grid gap-2">
                                    <button
                                        type="submit"
                                        className="btn btn-lg fw-bold theme-btn-neon"
                                        style={{ backgroundColor: buttonColor, borderColor: buttonColor, color: '#fff' }}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        ) : 'Login'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
