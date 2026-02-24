import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, AlertCircle, Loader2, Play } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { cn } from '../lib/utils';

export default function AiActionConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    actionTitle,
    actionDescription,
    cost,
    balance = 0,
    loading = false
}) {
    const safeBalance = parseFloat(balance) || 0;
    const safeCost = parseFloat(cost) || 0;
    const canAfford = safeBalance >= safeCost;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-background rounded-3xl shadow-2xl overflow-hidden border border-border"
                    >
                        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                                    <Sparkles size={20} />
                                </div>
                                <h3 className="font-bold">KI-Aktion bestätigen</h3>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="text-center space-y-2">
                                <p className="text-muted-foreground text-sm">Möchtest du folgende Aktion ausführen?</p>
                                <h4 className="text-xl font-black">{actionTitle}</h4>
                                {actionDescription && <p className="text-xs text-muted-foreground leading-relaxed px-4">{actionDescription}</p>}
                            </div>

                            <Card className="p-6 bg-muted/50 flex items-center justify-between border-border/50">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Kosten</p>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-5 h-5 flex items-center justify-center">
                                            <img src="/coin.png" alt="Coins" className="w-full h-full object-contain" />
                                        </div>
                                        <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{safeCost} Coins</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Dein Guthaben</p>
                                    <div className="flex items-center gap-1.5 justify-end">
                                        <span className={cn(
                                            "text-xl font-black",
                                            canAfford ? "text-foreground" : "text-destructive"
                                        )}>
                                            {safeBalance}
                                        </span>
                                        <div className="w-5 h-5 flex items-center justify-center">
                                            <img src="/coin.png" alt="Coins" className="w-full h-full object-contain" />
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {!canAfford && (
                                <div className="p-4 bg-destructive/10 rounded-2xl border border-destructive/20 flex gap-3 items-start">
                                    <AlertCircle className="text-destructive shrink-0 mt-0.5" size={18} />
                                    <p className="text-xs text-destructive font-bold leading-relaxed">
                                        Ups! Dein Guthaben reicht für diese Aktion leider nicht aus.
                                        Bitte lade dein Konto in den Einstellungen auf.
                                    </p>
                                </div>
                            )}

                            <div className="flex flex-col gap-3 pt-2">
                                <Button
                                    onClick={onConfirm}
                                    disabled={!canAfford || loading}
                                    className="w-full h-14 gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Play size={18} />}
                                    Aktion jetzt starten
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={onClose}
                                    className="w-full"
                                >
                                    Abbrechen
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
