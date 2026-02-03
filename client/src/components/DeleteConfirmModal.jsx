import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Trash2, Calendar } from 'lucide-react';
import { Button } from './Button';

export default function DeleteConfirmModal({ isOpen, onClose, onConfirm, recipe, usage }) {
    if (!recipe) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-card border border-destructive/30 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 bg-destructive/10 border-b border-destructive/20 flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center text-destructive mb-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                <AlertTriangle size={32} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">Rezept löschen?</h3>
                                <p className="text-muted-foreground text-sm mt-1">
                                    Möchtest du <span className="font-bold text-foreground">"{recipe.title}"</span> wirklich unwiderruflich löschen?
                                </p>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Usage Stats Warning */}
                            {(usage && (usage.past > 0 || usage.future > 0)) && (
                                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center gap-2 text-orange-500 font-bold text-sm">
                                        <AlertTriangle size={16} />
                                        <span>Achtung: Rezept in Verwendung</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-background/50 p-3 rounded-lg flex flex-col items-center justify-center text-center">
                                            <span className="text-2xl font-bold text-foreground">{usage.past}x</span>
                                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
                                                <Calendar size={10} /> Vergangenheit
                                            </span>
                                        </div>
                                        <div className="bg-background/50 p-3 rounded-lg flex flex-col items-center justify-center text-center">
                                            <span className={`text-2xl font-bold ${usage.future > 0 ? 'text-destructive' : 'text-foreground'}`}>
                                                {usage.future}x
                                            </span>
                                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
                                                <Calendar size={10} /> Zukunft
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-orange-500/80 text-center leading-relaxed">
                                        Das Löschen dieses Rezepts entfernt es auch aus diesen Menüplänen.
                                    </p>
                                </div>
                            )}

                            {(!usage || (usage.past === 0 && usage.future === 0)) && (
                                <div className="text-center text-sm text-muted-foreground">
                                    Dieses Rezept wird aktuell in keinem Menüplan verwendet.
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-muted/30 border-t border-border flex gap-3">
                            <Button
                                variant="ghost"
                                onClick={onClose}
                                className="flex-1 font-bold"
                            >
                                Abbrechen
                            </Button>
                            <Button
                                onClick={onConfirm}
                                className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg shadow-destructive/20 font-bold"
                            >
                                <Trash2 size={18} className="mr-2" />
                                Löschen
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
