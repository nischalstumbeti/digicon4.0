import React, { useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { BrandingContext } from '../context/BrandingContext';

const AdminCMS = () => {
    const { refreshBranding } = useContext(BrandingContext);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    const [form, setForm] = useState({
        appName: '',
        footerText: '',
        headerLogoUrl: '',
        headerImagePosition: 'left',
        headerTagline: '',
        loginMarqueeText: '',
        loginMarqueeLink: '',
        loginHeader: '',
        loginHeaderImageUrl: '',
        loginHeaderImagePosition: 'left',
        loginHeaderTagline: '',
        loginTitle: '',
        loginHelpText: '',
        loginPromoImageUrl: '',
        loginPromoImageFit: 'cover',
        brandLogoUrl: '',
        faviconUrl: '',
        loginHeaderBg: '',
        loginHeaderTextColor: '',
        loginButtonColor: '',
        loginCardBg: '',
        primaryColor: '#2563eb',
        accentColor: '#0ea5e9',
        bgColor: '#f0f4f8',
    });

    const previewPromo = useMemo(() => form.loginPromoImageUrl?.trim(), [form.loginPromoImageUrl]);
    const previewLogo = useMemo(() => form.brandLogoUrl?.trim(), [form.brandLogoUrl]);
    const previewFavicon = useMemo(() => form.faviconUrl?.trim(), [form.faviconUrl]);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.get('/admin/settings');
                setForm((prev) => ({
                    ...prev,
                    appName: res.data.appName ?? prev.appName,
                    footerText: res.data.footerText ?? prev.footerText,
                    headerLogoUrl: res.data.headerLogoUrl ?? prev.headerLogoUrl,
                    headerImagePosition: res.data.headerImagePosition ?? prev.headerImagePosition,
                    headerTagline: res.data.headerTagline ?? prev.headerTagline,
                    loginMarqueeText: res.data.loginMarqueeText ?? prev.loginMarqueeText,
                    loginMarqueeLink: res.data.loginMarqueeLink ?? prev.loginMarqueeLink,
                    loginHeader: res.data.loginHeader ?? prev.loginHeader,
                    loginHeaderImageUrl: res.data.loginHeaderImageUrl ?? prev.loginHeaderImageUrl,
                    loginHeaderImagePosition: res.data.loginHeaderImagePosition ?? prev.loginHeaderImagePosition,
                    loginHeaderTagline: res.data.loginHeaderTagline ?? prev.loginHeaderTagline,
                    loginTitle: res.data.loginTitle ?? prev.loginTitle,
                    loginHelpText: res.data.loginHelpText ?? prev.loginHelpText,
                    loginPromoImageUrl: res.data.loginPromoImageUrl ?? prev.loginPromoImageUrl,
                    loginPromoImageFit: res.data.loginPromoImageFit ?? prev.loginPromoImageFit,
                    brandLogoUrl: res.data.brandLogoUrl ?? prev.brandLogoUrl,
                    faviconUrl: res.data.faviconUrl ?? prev.faviconUrl,
                    loginHeaderBg: res.data.loginHeaderBg ?? prev.loginHeaderBg,
                    loginHeaderTextColor: res.data.loginHeaderTextColor ?? prev.loginHeaderTextColor,
                    loginButtonColor: res.data.loginButtonColor ?? prev.loginButtonColor,
                    loginCardBg: res.data.loginCardBg ?? prev.loginCardBg,
                    primaryColor: res.data.primaryColor ?? prev.primaryColor,
                    accentColor: res.data.accentColor ?? prev.accentColor,
                    bgColor: res.data.bgColor ?? prev.bgColor,
                }));
            } catch (e) {
                setMsg({ type: 'danger', text: e.response?.data?.message || 'Failed to load CMS settings' });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const onChange = (key) => (e) => {
        const value = e.target.value;
        setForm((p) => ({ ...p, [key]: value }));
    };

    const fileToDataUrl = (file, maxBytes = 650 * 1024) => new Promise((resolve, reject) => {
        if (!file) return resolve('');
        if (file.size > maxBytes) {
            return reject(new Error(`Image too large. Please use an image under ${Math.round(maxBytes / 1024)} KB.`));
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });

    const handleImagePick = (key, maxKb = 650) => async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setMsg({ type: '', text: '' });
        try {
            const dataUrl = await fileToDataUrl(file, maxKb * 1024);
            setForm((p) => ({ ...p, [key]: dataUrl }));
            setMsg({ type: 'success', text: 'Image selected. Click “Save CMS settings” to apply.' });
        } catch (err) {
            setMsg({ type: 'danger', text: err.message || 'Invalid image' });
        } finally {
            e.target.value = '';
        }
    };

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMsg({ type: '', text: '' });
        try {
            await api.put('/admin/settings', {
                appName: form.appName,
                footerText: form.footerText,
                headerLogoUrl: form.headerLogoUrl,
                headerImagePosition: form.headerImagePosition,
                headerTagline: form.headerTagline,
                loginMarqueeText: form.loginMarqueeText,
                loginMarqueeLink: form.loginMarqueeLink,
                loginHeader: form.loginHeader,
                loginHeaderImageUrl: form.loginHeaderImageUrl,
                loginHeaderImagePosition: form.loginHeaderImagePosition,
                loginHeaderTagline: form.loginHeaderTagline,
                loginTitle: form.loginTitle,
                loginHelpText: form.loginHelpText,
                loginPromoImageUrl: form.loginPromoImageUrl,
                loginPromoImageFit: form.loginPromoImageFit,
                brandLogoUrl: form.brandLogoUrl,
                faviconUrl: form.faviconUrl,
                loginHeaderBg: form.loginHeaderBg,
                loginHeaderTextColor: form.loginHeaderTextColor,
                loginButtonColor: form.loginButtonColor,
                loginCardBg: form.loginCardBg,
                primaryColor: form.primaryColor,
                accentColor: form.accentColor,
                bgColor: form.bgColor,
            });
            setMsg({ type: 'success', text: 'CMS branding updated. Login page will reflect these changes.' });
            await refreshBranding();
        } catch (e2) {
            setMsg({ type: 'danger', text: e2.response?.data?.message || 'Failed to save CMS settings' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-center mt-5"><div className="spinner-border text-primary"></div></div>;

    const cardClass = 'card shadow-sm border-0';
    const sectionTitle = 'fw-bold mb-3 text-primary';

    return (
        <div className="container page-fade-in mt-2 mb-5">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
                <div>
                    <h2 className="fw-bold m-0">CMS & Branding</h2>
                    <p className="text-muted m-0 small">Manage site identity, login page content, images, and colors.</p>
                </div>
                <div className="d-flex flex-wrap gap-2">
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => refreshBranding()}>
                        Refresh preview
                    </button>
                </div>
            </div>

            {msg.text && <div className={`alert alert-${msg.type || 'info'} mb-4`}>{msg.text}</div>}

            <form onSubmit={save}>
                {/* 1. Site identity & common header (after login) */}
                <div className="mb-4">
                    <div className={cardClass}>
                        <div className="card-body">
                            <h5 className={sectionTitle}>1. Site identity</h5>
                            <div className="row g-3">
                                <div className="col-12 col-md-6">
                                    <label className="form-label fw-semibold">App name (navbar)</label>
                                    <input className="form-control" value={form.appName} onChange={onChange('appName')} placeholder="e.g. Hackathon Portal" />
                                </div>
                                <div className="col-12 col-md-6">
                                    <label className="form-label fw-semibold">Footer text</label>
                                    <input className="form-control" value={form.footerText} onChange={onChange('footerText')} placeholder="e.g. Designed & Developed by ..." />
                                </div>
                            </div>
                            <hr className="my-4" />
                            <h6 className="fw-bold mb-3 text-primary">Common header (after login)</h6>
                            <p className="text-muted small mb-3">Shown in the top navbar when users are logged in. Optionally add an image (left or right of text) and a tagline below the title.</p>
                            <div className="row g-3">
                                <div className="col-12 col-md-6">
                                    <label className="form-label fw-semibold">Header image (optional)</label>
                                    <input className="form-control form-control-sm" value={form.headerLogoUrl} onChange={onChange('headerLogoUrl')} placeholder="URL or upload below" />
                                    <input className="form-control form-control-sm mt-2" type="file" accept="image/*" onChange={handleImagePick('headerLogoUrl')} />
                                    <div className="form-text small">If set, image is shown in navbar; else only app name + tagline.</div>
                                </div>
                                <div className="col-12 col-md-6">
                                    <label className="form-label fw-semibold">Image position</label>
                                    <select className="form-select" value={form.headerImagePosition} onChange={(e) => setForm((p) => ({ ...p, headerImagePosition: e.target.value }))}>
                                        <option value="left">Image on left, text on right</option>
                                        <option value="right">Image on right, text on left</option>
                                    </select>
                                </div>
                                <div className="col-12">
                                    <label className="form-label fw-semibold">Tagline (below title in header)</label>
                                    <input className="form-control" value={form.headerTagline} onChange={onChange('headerTagline')} placeholder="e.g. Hackathon 2025 — Leave empty to hide" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Icons & login page images */}
                <div className="mb-4">
                    <div className={cardClass}>
                        <div className="card-body">
                            <h5 className={sectionTitle}>2. Icons & login page images</h5>
                            <p className="text-muted small mb-3">Favicon for the browser tab; brand logo and promo image for the login page. Images are fitted to their areas for a clean look.</p>
                            <div className="row g-4">
                                <div className="col-12 col-lg-4">
                                    <label className="form-label fw-semibold">Favicon (browser tab icon)</label>
                                    <input className="form-control form-control-sm" value={form.faviconUrl} onChange={onChange('faviconUrl')} placeholder="URL or upload below" />
                                    <input className="form-control form-control-sm mt-2" type="file" accept="image/*" onChange={handleImagePick('faviconUrl', 100)} />
                                    <div className="form-text small">Small image (e.g. 32×32), max 100 KB. Good option: square PNG.</div>
                                    {previewFavicon && (
                                        <div className="mt-2 d-flex align-items-center gap-2">
                                            <div className="border rounded p-1 bg-light" style={{ width: 32, height: 32 }}>
                                                <img src={previewFavicon} alt="Favicon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            </div>
                                            <span className="small text-muted">Preview</span>
                                        </div>
                                    )}
                                </div>
                                <div className="col-12 col-lg-4">
                                    <label className="form-label fw-semibold">Brand logo (above login form)</label>
                                    <input className="form-control form-control-sm" value={form.brandLogoUrl} onChange={onChange('brandLogoUrl')} placeholder="URL or upload" />
                                    <input className="form-control form-control-sm mt-2" type="file" accept="image/*" onChange={handleImagePick('brandLogoUrl')} />
                                    <div className="form-text small">Shown above the login title. Good option: logo with transparent background, max 650 KB.</div>
                                    {previewLogo && (
                                        <div className="mt-2">
                                            <div className="border rounded p-2 bg-light d-inline-block" style={{ width: 80, height: 80 }}>
                                                <img src={previewLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="col-12 col-lg-4">
                                    <label className="form-label fw-semibold">Login promo image (left panel)</label>
                                    <input className="form-control form-control-sm" value={form.loginPromoImageUrl} onChange={onChange('loginPromoImageUrl')} placeholder="URL or upload" />
                                    <input className="form-control form-control-sm mt-2" type="file" accept="image/*" onChange={handleImagePick('loginPromoImageUrl')} />
                                    <div className="mt-2">
                                        <label className="form-label small fw-semibold mb-1">Image fit</label>
                                        <select className="form-select form-select-sm" value={form.loginPromoImageFit} onChange={(e) => setForm((p) => ({ ...p, loginPromoImageFit: e.target.value }))}>
                                            <option value="cover">Cover (fill area, may crop)</option>
                                            <option value="contain">Contain (fit fully, no crop)</option>
                                        </select>
                                        <div className="form-text small">Cover = filled panel; Contain = full image visible. Good option: landscape image with Cover.</div>
                                    </div>
                                    {previewPromo && (
                                        <div className="mt-2 rounded overflow-hidden border" style={{ maxWidth: 200, maxHeight: 120 }}>
                                            <img src={previewPromo} alt="Promo" style={{ width: '100%', height: 120, objectFit: form.loginPromoImageFit || 'cover' }} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Login page content & colors */}
                <div className="mb-4">
                    <div className={cardClass}>
                        <div className="card-body">
                            <h5 className={sectionTitle}>3. Login page content</h5>
                            <p className="text-muted small mb-3">Text and colors for the login page. All options here are configurable and give a consistent, professional look.</p>
                            <div className="row g-3">
                                <div className="col-12">
                                    <label className="form-label fw-semibold">Login page header text</label>
                                    <input className="form-control" value={form.loginHeader} onChange={onChange('loginHeader')} placeholder="e.g. KARE ACM SIGBED Digicon 4.0 — Leave empty to hide" />
                                    <div className="form-text small">Banner text at the very top. If no image is set, only this text (and tagline) is shown.</div>
                                </div>
                                <div className="col-12 col-md-6">
                                    <label className="form-label fw-semibold">Login page header image (optional)</label>
                                    <input className="form-control form-control-sm" value={form.loginHeaderImageUrl} onChange={onChange('loginHeaderImageUrl')} placeholder="URL or upload" />
                                    <input className="form-control form-control-sm mt-2" type="file" accept="image/*" onChange={handleImagePick('loginHeaderImageUrl')} />
                                    <div className="form-text small">If uploaded, header shows image + text; else only text (and tagline).</div>
                                </div>
                                <div className="col-12 col-md-6">
                                    <label className="form-label fw-semibold">Header image position</label>
                                    <select className="form-select" value={form.loginHeaderImagePosition} onChange={(e) => setForm((p) => ({ ...p, loginHeaderImagePosition: e.target.value }))}>
                                        <option value="left">Image on left, text on right</option>
                                        <option value="right">Image on right, text on left</option>
                                    </select>
                                </div>
                                <div className="col-12">
                                    <label className="form-label fw-semibold">Tagline (below header text)</label>
                                    <input className="form-control" value={form.loginHeaderTagline} onChange={onChange('loginHeaderTagline')} placeholder="e.g. Innovation & Collaboration — Leave empty to hide" />
                                </div>
                                <div className="col-12">
                                    <label className="form-label fw-semibold">Login title</label>
                                    <input className="form-control" value={form.loginTitle} onChange={onChange('loginTitle')} placeholder="e.g. Hackathon Portal Login" />
                                    <div className="form-text small">Heading above the login form. Good option: short, clear title.</div>
                                </div>
                                <div className="col-12">
                                    <label className="form-label fw-semibold">Login help text (one line per bullet)</label>
                                    <textarea className="form-control" rows={4} value={form.loginHelpText} onChange={onChange('loginHelpText')} placeholder="Admin: use admin credentials&#10;Team: use Team ID / email&#10;Participant: use registration number" />
                                    <div className="form-text small">Instructions for different user types. One line = one bullet. Good option: who uses what to log in.</div>
                                </div>
                            </div>
                            <hr className="my-4" />
                            <h6 className="fw-bold mb-3 text-primary">Login page color palette</h6>
                            <p className="text-muted small mb-3">Override colors for the login page only. Leave blank to use the site primary/accent/background from section 5. Use hex codes (e.g. #2563eb).</p>
                            <div className="row g-3">
                                <div className="col-12 col-sm-6 col-lg-3">
                                    <label className="form-label fw-semibold">Header background</label>
                                    <div className="d-flex align-items-center gap-2">
                                        <input type="color" className="form-control form-control-color" style={{ width: 40, height: 38 }} value={form.loginHeaderBg || '#2563eb'} onChange={onChange('loginHeaderBg')} />
                                        <input className="form-control flex-grow-1" value={form.loginHeaderBg} onChange={onChange('loginHeaderBg')} placeholder="#2563eb or blank" />
                                    </div>
                                    <div className="form-text small">Top banner. Blank = site primary.</div>
                                </div>
                                <div className="col-12 col-sm-6 col-lg-3">
                                    <label className="form-label fw-semibold">Header text color</label>
                                    <div className="d-flex align-items-center gap-2">
                                        <input type="color" className="form-control form-control-color" style={{ width: 40, height: 38 }} value={form.loginHeaderTextColor || '#ffffff'} onChange={onChange('loginHeaderTextColor')} />
                                        <input className="form-control flex-grow-1" value={form.loginHeaderTextColor} onChange={onChange('loginHeaderTextColor')} placeholder="#ffffff or blank" />
                                    </div>
                                    <div className="form-text small">Text on banner. Blank = white.</div>
                                </div>
                                <div className="col-12 col-sm-6 col-lg-3">
                                    <label className="form-label fw-semibold">Login button color</label>
                                    <div className="d-flex align-items-center gap-2">
                                        <input type="color" className="form-control form-control-color" style={{ width: 40, height: 38 }} value={form.loginButtonColor || '#dc3545'} onChange={onChange('loginButtonColor')} />
                                        <input className="form-control flex-grow-1" value={form.loginButtonColor} onChange={onChange('loginButtonColor')} placeholder="#dc3545 or blank" />
                                    </div>
                                    <div className="form-text small">Submit button. Blank = default red.</div>
                                </div>
                                <div className="col-12 col-sm-6 col-lg-3">
                                    <label className="form-label fw-semibold">Login card background</label>
                                    <div className="d-flex align-items-center gap-2">
                                        <input type="color" className="form-control form-control-color" style={{ width: 40, height: 38 }} value={form.loginCardBg || '#ffffff'} onChange={onChange('loginCardBg')} />
                                        <input className="form-control flex-grow-1" value={form.loginCardBg} onChange={onChange('loginCardBg')} placeholder="#ffffff or blank" />
                                    </div>
                                    <div className="form-text small">Form card. Blank = white.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Marquee (CMS) */}
                <div className="mb-4">
                    <div className={cardClass}>
                        <div className="card-body">
                            <h5 className={sectionTitle}>4. Marquee</h5>
                            <p className="text-muted small mb-3">Scrolling banner on the login page. Managed here in CMS.</p>
                            <div className="row g-3">
                                <div className="col-12 col-md-6">
                                    <label className="form-label fw-semibold">Marquee text</label>
                                    <input className="form-control" value={form.loginMarqueeText} onChange={onChange('loginMarqueeText')} placeholder="Scrolling message (leave empty to hide)" />
                                </div>
                                <div className="col-12 col-md-6">
                                    <label className="form-label fw-semibold">Marquee link (optional)</label>
                                    <input className="form-control" type="url" value={form.loginMarqueeLink} onChange={onChange('loginMarqueeLink')} placeholder="https://... — makes marquee clickable" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5. Color palette */}
                <div className="mb-4">
                    <div className={cardClass}>
                        <div className="card-body">
                            <h5 className={sectionTitle}>5. Color palette</h5>
                            <div className="row g-3">
                                <div className="col-12 col-sm-6 col-lg-4">
                                    <label className="form-label fw-semibold">Primary</label>
                                    <div className="d-flex align-items-center gap-2">
                                        <input type="color" className="form-control form-control-color" style={{ width: 48, height: 38 }} value={form.primaryColor} onChange={onChange('primaryColor')} />
                                        <input className="form-control flex-grow-1" value={form.primaryColor} onChange={onChange('primaryColor')} />
                                    </div>
                                </div>
                                <div className="col-12 col-sm-6 col-lg-4">
                                    <label className="form-label fw-semibold">Accent</label>
                                    <div className="d-flex align-items-center gap-2">
                                        <input type="color" className="form-control form-control-color" style={{ width: 48, height: 38 }} value={form.accentColor} onChange={onChange('accentColor')} />
                                        <input className="form-control flex-grow-1" value={form.accentColor} onChange={onChange('accentColor')} />
                                    </div>
                                </div>
                                <div className="col-12 col-sm-6 col-lg-4">
                                    <label className="form-label fw-semibold">Background</label>
                                    <div className="d-flex align-items-center gap-2">
                                        <input type="color" className="form-control form-control-color" style={{ width: 48, height: 38 }} value={form.bgColor} onChange={onChange('bgColor')} />
                                        <input className="form-control flex-grow-1" value={form.bgColor} onChange={onChange('bgColor')} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="d-flex flex-wrap gap-2 align-items-center">
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? 'Saving…' : 'Save all CMS settings'}
                    </button>
                    <span className="small text-muted">Changes apply to login page, navbar, footer, and site colors.</span>
                </div>
            </form>
        </div>
    );
};

export default AdminCMS;

