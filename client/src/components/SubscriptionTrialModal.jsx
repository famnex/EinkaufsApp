import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Sparkles, ShieldAlert, Users, Zap, Info, Loader2, Crown } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { cn } from '../lib/utils';
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import { useState } from 'react';

export default function SubscriptionTrialModal({ isOpen, onClose, onActivate }) {
    const [loading, setLoading] = useState(false);
    useLockBodyScroll(isOpen);

    const handleActivate = async () => {
        setLoading(true);
        try {
            await onActivate();
            onClose();
        } catch (err) {
            console.error('Failed to activate trial:', err);
        } finally {
            setLoading(false);
        }
    };

    const benefits = [
        {
            title: 'KI-Sternekoch',
            desc: 'Rezeptgenerierung, smarter Rezept-Import & KI-Kochassistent.',
            icon: Sparkles,
            color: 'text-purple-500',
            bg: 'bg-purple-500/10'
        },
        {
            title: 'Unverträglichkeitsassistent',
            desc: 'KI-gestützte Analyse deiner Produkte auf Unverträglichkeiten.',
            icon: ShieldAlert,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10'
        },
        {
            title: 'Alexa Integration',
            desc: 'Einkaufsliste & Rezepte bequem per Sprachsteuerung.',
            icon: Zap,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10'
        },
        {
            title: 'Gemeinsamer Haushalt',
            desc: 'Plane und koche zusammen mit deiner Familie oder Mitbewohnern.',
            icon: Users,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10'
        }
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <div key="trial-modal-overlay" className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <motion.div
                        key="trial-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    />

                    <motion.div
                        key="trial-modal-content"
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        className="relative w-full max-w-lg bg-background rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden border border-border flex flex-col max-h-[95vh] sm:max-h-[90vh]"
                    >
                        {/* Hero Section (Ultra Compact on Mobile) */}
                        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-4 sm:p-8 text-white relative shrink-0">
                            <button
                                onClick={onClose}
                                className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                            >
                                <X size={18} />
                            </button>

                            <div className="flex items-center justify-center gap-3 sm:flex-col sm:gap-0">
                                <div className="p-2 sm:p-4 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner mb-0 sm:mb-3">
                                    <Crown className="text-white w-6 h-6 sm:w-10 sm:h-10" />
                                </div>
                                <div className="text-left sm:text-center">
                                    <h2 className="text-lg sm:text-2xl font-black leading-tight">Silbergabel Testen</h2>
                                    <p className="text-white/80 text-[10px] sm:text-sm font-medium">7 Tage Premium-Features erleben</p>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-4 sm:space-y-6">
                            {/* Benefits Grid - 2 columns on desktop, 1 on mobile */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                                {benefits.map((benefit, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 border border-border/50">
                                        <div className={cn("w-8 h-8 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center shrink-0", benefit.bg)}>
                                            <benefit.icon className={cn("w-4 h-4 sm:w-6 sm:h-6", benefit.color)} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-[11px] sm:text-sm truncate">{benefit.title}</h4>
                                            <p className="text-[9px] sm:text-xs text-muted-foreground leading-tight line-clamp-2">{benefit.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-2.5">
                                <Info size={14} className="text-primary shrink-0 mt-0.5" />
                                <p className="text-[9px] sm:text-[11px] text-muted-foreground leading-snug">
                                    Der Testzeitraum <strong>endet automatisch</strong>. Keine Kündigung notwendig. Danach kehrst du zur Plastikgabel zurück.
                                </p>
                            </div>
                        </div>

                        {/* Footer (Static) */}
                        <div className="p-4 sm:p-8 pt-0 shrink-0">
                            <Button
                                onClick={handleActivate}
                                disabled={loading}
                                className="w-full h-11 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black shadow-xl shadow-purple-500/20 text-xs sm:text-lg transition-all active:scale-95"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 w-4 h-4 sm:w-5 sm:h-5" />
                                        Gratis Test Starten
                                    </>
                                )}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
