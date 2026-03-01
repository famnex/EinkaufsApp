import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share, MoreVertical, PlusSquare, Smartphone, ArrowBigUp } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export default function InstallPWAOverlay() {
    const { user } = useAuth();
    const [show, setShow] = useState(false);
    const [platform, setPlatform] = useState(null); // 'ios', 'android'

    useEffect(() => {
        // 1. Check if running in standalone mode
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        if (isStandalone) return;

        // 2. Platform detection
        const ua = window.navigator.userAgent.toLowerCase();
        const isIos = /iphone|ipad|ipod/.test(ua);
        const isAndroid = /android/.test(ua);

        if (!isIos && !isAndroid) return;

        // 3. Check if user is logged in
        if (!user) return;

        // 4. Check dismissal in localStorage
        const lastDismissed = localStorage.getItem('pwa_install_prompt_dismissed');
        const now = Date.now();
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

        if (lastDismissed && (now - parseInt(lastDismissed)) < SEVEN_DAYS) {
            return;
        }

        // Show after a small delay
        setPlatform(isIos ? 'ios' : 'android');
        const timer = setTimeout(() => setShow(true), 3000);
        return () => clearTimeout(timer);
    }, []);

    const dismiss = () => {
        setShow(false);
        localStorage.setItem('pwa_install_prompt_dismissed', Date.now().toString());
    };

    if (!show) return null;

    return (
        <AnimatePresence>
            {show && (
                <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-none p-4 pb-12 sm:pb-24">
                    {/* Backdrop (semi-transparent) */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={dismiss}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
                    />

                    {/* Content Card */}
                    <motion.div
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ duration: 0.5, type: 'spring', damping: 25, stiffness: 200 }}
                        className="relative w-full max-w-md mx-auto bg-card border border-border rounded-3xl shadow-2xl overflow-hidden pointer-events-auto"
                    >
                        {/* Header with Icon */}
                        <div className="p-6 pb-0 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                    <Smartphone size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg tracking-tight">App installieren</h3>
                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">GabelGuru als PWA nutzen</p>
                                </div>
                            </div>
                            <button
                                onClick={dismiss}
                                className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Description */}
                        <div className="p-6 space-y-6">
                            <p className="text-sm text-foreground/80 leading-relaxed">
                                Installiere GabelGuru auf deinem Home-Bildschirm für schnellen Zugriff, Offline-Modus und ein besseres Erlebnis.
                            </p>

                            {/* OS-Specific Steps */}
                            <div className="bg-muted/50 rounded-2xl p-4 border border-border/50">
                                {platform === 'ios' ? (
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-background flex items-center justify-center text-primary font-black border border-border shadow-sm">1</div>
                                            <p className="text-sm">
                                                Tippe unten auf das <span className="inline-flex bg-primary/10 p-1 rounded-md text-primary align-middle"><Share size={14} /></span> <b>Teilen-Symbol</b>.
                                            </p>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-background flex items-center justify-center text-primary font-black border border-border shadow-sm">2</div>
                                            <p className="text-sm">
                                                Wische nach oben und tippe auf <br />
                                                <span className="inline-flex items-center gap-2 bg-primary/10 px-2 py-1 rounded-md text-primary font-bold text-xs mt-1">
                                                    <PlusSquare size={14} /> Zum Home-Bildschirm
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-background flex items-center justify-center text-primary font-black border border-border shadow-sm">1</div>
                                            <p className="text-sm">
                                                Tippe oben rechts auf das <span className="inline-flex bg-primary/10 p-1 rounded-md text-primary align-middle"><MoreVertical size={14} /></span> <b>Menü-Symbol</b>.
                                            </p>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-background flex items-center justify-center text-primary font-black border border-border shadow-sm">2</div>
                                            <p className="text-sm">
                                                Wähle <span className="inline-flex items-center gap-2 bg-primary/10 px-2 py-1 rounded-md text-primary font-bold text-xs">App installieren</span> oder <b>"Zum Startbildschirm hinzufügen"</b>.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Button onClick={dismiss} className="w-full h-12 rounded-2xl font-bold shadow-lg shadow-primary/20">
                                    Verstanden
                                </Button>
                                <button
                                    onClick={dismiss}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium py-2"
                                >
                                    Vielleicht später
                                </button>
                            </div>
                        </div>

                        {/* Visual Hint (Arrow pointing to buttons) */}
                        {platform === 'ios' && (
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-40 animate-bounce">
                                <ArrowBigUp size={24} className="rotate-180 text-primary" />
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
