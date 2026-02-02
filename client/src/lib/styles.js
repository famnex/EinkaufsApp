export const tokens = {
    colors: {
        background: '#03060a',
        card: 'rgba(255, 255, 255, 0.03)',
        cardBorder: 'rgba(255, 255, 255, 0.1)',
        primary: '#ef4444',
        secondary: '#5eead4',
        text: {
            main: '#ffffff',
            muted: 'rgba(255, 255, 255, 0.5)',
            dim: 'rgba(255, 255, 255, 0.2)',
        },
        header: '#4a3f3f',
        tealBadge: '#064e3b',
        redBadge: '#7f1d1d',
    },
    animations: {
        transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
        tap: { scale: 0.98 },
        hover: { scale: 1.02 },
    },
    blur: 'backdrop-filter: blur(20px)',
};

export const glassmorphism = `
    bg-white/[0.03] 
    backdrop-blur-xl 
    border border-white/10 
    shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]
`;

export const buttonBase = `
    relative overflow-hidden 
    transition-all duration-200 
    active:scale-95 
    disabled:opacity-50 
    disabled:pointer-events-none
`;
