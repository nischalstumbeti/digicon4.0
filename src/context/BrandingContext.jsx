import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

export const BrandingContext = createContext();

const DEFAULT_BRANDING = {
    loginMarqueeText: '',
    loginMarqueeLink: '',
    appName: 'Hackathon Portal',
    footerText: 'Designed & Developed by Web Development Division, KARE ACM SIGBED Student Chapter',
    headerLogoUrl: '',
    headerImagePosition: 'left',
    headerTagline: '',
    loginHeader: '',
    loginHeaderImageUrl: '',
    loginHeaderImagePosition: 'left',
    loginHeaderTagline: '',
    loginTitle: 'Hackathon Portal Login',
    loginHelpText: '',
    loginPromoImageUrl: '/digicon-promo.png',
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
};

export const BrandingProvider = ({ children }) => {
    const [branding, setBranding] = useState(DEFAULT_BRANDING);
    const [loadingBranding, setLoadingBranding] = useState(true);

    const applyCssVars = useCallback((b) => {
        if (typeof document === 'undefined') return;
        const root = document.documentElement;
        if (b?.primaryColor) root.style.setProperty('--primary', b.primaryColor);
        if (b?.accentColor) root.style.setProperty('--accent', b.accentColor);
        if (b?.bgColor) root.style.setProperty('--bg', b.bgColor);
    }, []);

    const refreshBranding = useCallback(async () => {
        try {
            const res = await api.get('/public/branding');
            const next = { ...DEFAULT_BRANDING, ...(res.data || {}) };
            setBranding(next);
            applyCssVars(next);
        } catch (e) {
            setBranding(DEFAULT_BRANDING);
            applyCssVars(DEFAULT_BRANDING);
        } finally {
            setLoadingBranding(false);
        }
    }, [applyCssVars]);

    useEffect(() => {
        refreshBranding();
    }, [refreshBranding]);

    // Apply favicon from CMS
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const href = branding?.faviconUrl?.trim();
        let link = document.querySelector('link[rel="icon"]');
        if (href) {
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            link.href = href;
        }
    }, [branding?.faviconUrl]);

    const value = useMemo(() => ({
        branding,
        loadingBranding,
        refreshBranding,
    }), [branding, loadingBranding, refreshBranding]);

    return (
        <BrandingContext.Provider value={value}>
            {children}
        </BrandingContext.Provider>
    );
};

