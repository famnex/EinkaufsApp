import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight, ShoppingCart, Calendar, Book, Info, Sparkles } from 'lucide-react';
import { Button } from './Button';
import api from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';

export default function OnboardingModal({ isOpen, onComplete }) {
    const { user, setUser } = useAuth();
    const [selections, setSelections] = useState({
        shopping: true,
        planning: true,
        recipes: true
    });
    const [loading, setLoading] = useState(false);

    // Disable body scroll and pull-to-refresh when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.body.style.overscrollBehaviorY = 'none';
            document.documentElement.style.overscrollBehaviorY = 'none';
        } else {
            document.body.style.overflow = '';
            document.body.style.overscrollBehaviorY = '';
            document.documentElement.style.overscrollBehaviorY = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.body.style.overscrollBehaviorY = '';
            document.documentElement.style.overscrollBehaviorY = '';
        };
    }, [isOpen]);

    const options = [
        {
            id: 'shopping',
            title: 'Zum Einkaufen',
            description: 'Einkaufslisten, Smarte Laufwege, Listen- und Rezeptscan, Produkttausch.',
            icon: ShoppingCart,
            color: 'bg-green-100 text-green-600 dark:bg-green-900/30'
        },
        {
            id: 'planning',
            title: 'Zum Planen meiner Woche',
            description: 'Mahlzeitenplanung.',
            icon: Calendar,
            color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
        },
        {
            id: 'recipes',
            title: 'Als Rezeptebuch & Community',
            description: 'Lieblingsrezepte speichern & teilen.',
            icon: Book,
            color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30'
        }
    ];

    const toggleSelection = (id) => {
        setSelections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSave = async () => {
        if (!Object.values(selections).some(v => v)) return;

        setLoading(true);
        try {
            await api.post('/auth/onboarding/complete', { preferences: selections });
            setUser(prev => ({
                ...prev,
                isOnboardingCompleted: true,
                onboardingPreferences: selections
            }));
            onComplete();
        } catch (error) {
            console.error('Error saving onboarding preferences:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const isAnySelected = Object.values(selections).some(v => v);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[2000] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="relative w-full max-w-xl bg-card border border-border shadow-2xl rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden"
                >
                    <div className="p-5 sm:p-8 pb-8 sm:pb-10 overflow-y-auto max-h-[98vh] custom-scrollbar">
                        {/* Forky & Speech Bubble */}
                        <div className="flex items-start gap-2 sm:gap-6 mb-5 sm:mb-10">
                            <motion.div
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="shrink-0 pt-1"
                            >
                                <img
                                    src="/images/forky.png"
                                    alt="Forky Mascot"
                                    className="w-12 h-12 sm:w-24 sm:h-24 object-contain"
                                />
                            </motion.div>

                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.4, type: 'spring' }}
                                className="relative bg-muted p-4 sm:p-7 rounded-[1.8rem] sm:rounded-[3rem] border border-border/40 shadow-sm"
                            >
                                {/* Refined Tail - positioned to flow into the curve */}
                                <div className="absolute top-6 sm:top-10 -left-2.5 w-3.5 h-5 bg-muted border-l border-t border-border/40 -rotate-[12deg]" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />

                                <h2 className="text-base sm:text-2xl font-black mb-0.5 sm:mb-2 leading-tight">Willkommen, {user?.username}!</h2>
                                <p className="text-muted-foreground text-[11px] sm:text-base leading-snug font-medium">
                                    Ich bin Forky! Ich helfe dir, deinen Küchenalltag zu meistern.
                                </p>
                            </motion.div>
                        </div>

                        {/* Question */}
                        <div className="space-y-3 sm:space-y-6">
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold mb-0.5 sm:mb-1">Wozu nutzt du GabelGuru?</h3>
                                <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wider font-bold opacity-70">Wähle mindestens eine Option</p>
                            </div>

                            <div className="grid gap-2 sm:gap-4">
                                {options.map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => toggleSelection(opt.id)}
                                        className={`flex items-center gap-3 sm:gap-4 p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl border-2 transition-all text-left animate-in fade-in slide-in-from-bottom-2 ${selections[opt.id]
                                            ? 'border-primary bg-primary/5 shadow-inner'
                                            : 'border-border/50 hover:border-primary/30 bg-muted/20'
                                            }`}
                                    >
                                        <div className={`p-1.5 sm:p-3 rounded-xl sm:rounded-2xl shrink-0 transition-transform ${opt.color}`}>
                                            <opt.icon size={16} className="sm:w-6 sm:h-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className="font-bold text-sm sm:text-lg truncate">{opt.title}</span>
                                                {selections[opt.id] && (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        className="bg-primary text-white rounded-full p-0.5"
                                                    >
                                                        <Check size={10} className="sm:w-3 sm:h-3" strokeWidth={4} />
                                                    </motion.div>
                                                )}
                                            </div>
                                            <p className="text-[10px] sm:text-sm text-muted-foreground leading-tight sm:leading-relaxed">
                                                {opt.description}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-col items-stretch gap-3 pt-3 mt-3 border-t border-border/50">
                                <div className="flex items-center gap-2 text-[9px] sm:text-xs text-muted-foreground justify-center py-1.5 px-3 bg-muted/30 rounded-xl">
                                    <Info size={10} className="shrink-0 text-primary" />
                                    <span>Änderbar in den Einstellungen unter Präferenzen.</span>
                                </div>
                                <Button
                                    onClick={handleSave}
                                    disabled={!isAnySelected || loading}
                                    className="w-full py-5 sm:py-7 rounded-2xl text-base sm:text-lg font-bold gap-3 shadow-xl shadow-primary/20 relative group overflow-hidden"
                                >
                                    <span className="relative z-10">{loading ? 'Wird gespeichert...' : 'App starten'}</span>
                                    <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                                    {isAnySelected && !loading && (
                                        <motion.div
                                            className="absolute inset-0 bg-primary-foreground/10"
                                            initial={{ x: '-100%' }}
                                            animate={{ x: '100%' }}
                                            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                                        />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
