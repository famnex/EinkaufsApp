import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Sparkles, Star } from 'lucide-react';
import { Button } from './Button';
import { useNavigate } from 'react-router-dom';

/**
 * AiLockedModal – Small upsell popup shown when Plastikgabel users click any AI feature.
 * Usage:
 *   <AiLockedModal isOpen={show} onClose={() => setShow(false)} featureName="AI Assistant" />
 */
export default function AiLockedModal({ isOpen, onClose, featureName = 'KI-Funktion' }) {
    const navigate = useNavigate();

    const handleUpgrade = () => {
        onClose();
        navigate('/settings?tab=subscription&openModal=true');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="relative z-10 w-full max-w-sm"
                    >
                        <div className="bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
                            {/* Decorative header gradient */}
                            <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-6 text-white text-center relative">
                                <button
                                    onClick={onClose}
                                    className="absolute top-3 right-3 p-1.5 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
                                >
                                    <X size={16} />
                                </button>

                                <div className="flex justify-center mb-3">
                                    <div className="relative">
                                        <div className="p-4 bg-white/20 rounded-2xl">
                                            <Sparkles size={32} />
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 p-1.5 bg-white rounded-full shadow-lg">
                                            <Lock size={14} className="text-indigo-600" />
                                        </div>
                                    </div>
                                </div>

                                <h2 className="text-xl font-bold mb-1">{featureName}</h2>
                                <p className="text-white/80 text-sm">Diese Funktion ist gesperrt</p>
                            </div>

                            {/* Body */}
                            <div className="p-6 text-center space-y-4">
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    <span className="font-semibold text-foreground">{featureName}</span> ist ab dem{' '}
                                    <span className="font-bold text-purple-600 dark:text-purple-400">Silbergabel-Abo</span>{' '}
                                    verfügbar. Upgrade jetzt und nutze alle KI-Funktionen!
                                </p>

                                {/* Feature teaser  */}
                                <div className="flex items-center gap-3 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-3 text-left">
                                    <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500 shrink-0">
                                        <Star size={18} />
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-snug">
                                        Mit <strong className="text-foreground">Silbergabel</strong> oder <strong className="text-foreground">Goldgabel</strong> erhältst du Zugang zu: KI-Rezept-Import, Foto-Scan, Smart Import und mehr.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2 pt-1">
                                    <Button
                                        onClick={handleUpgrade}
                                        className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/20 font-bold gap-2"
                                    >
                                        <Sparkles size={16} />
                                        Jetzt upgraden
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={onClose}
                                        className="w-full h-9 rounded-xl text-muted-foreground text-sm"
                                    >
                                        Vielleicht später
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
