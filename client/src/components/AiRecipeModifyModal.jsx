import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Send, Loader2, Info } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { cn } from '../lib/utils';
import api from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';

export default function AiRecipeModifyModal({
    isOpen,
    onClose,
    recipe,
    onSuccess,
    credits = 0,
    userTier = 'Plastikgabel'
}) {
    const { refreshUser } = useAuth();
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const cost = userTier === 'Goldgabel' ? 0 : 10;
    const canAfford = credits >= cost;

    const handleSubmit = async () => {
        if (!prompt.trim() || !canAfford || loading) return;

        setLoading(true);
        setError(null);

        try {
            const { data } = await api.post('/ai/modify', {
                recipe,
                input: prompt
            });
            await refreshUser(); // Update credit balance in UI
            onSuccess(data);
            onClose();
        } catch (err) {
            console.error('AI Modify Error:', err);
            setError(err.response?.data?.error || 'Die KI konnte dein Rezept leider nicht anpassen.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
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
                        className="relative w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold">KI Änderungswunsch</h3>
                                    <p className="text-xs text-muted-foreground">Was möchtest du anpassen?</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="space-y-4">
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="z.B. 'Mache das Rezept vegan', 'Für 6 Personen umrechnen' oder 'Füge 2 Zehen Knoblauch hinzu und passe die Schritte an'"
                                    className="w-full min-h-[150px] p-4 rounded-2xl bg-muted/30 border border-transparent focus:bg-background focus:border-indigo-500/50 transition-all resize-none outline-none shadow-inner text-sm leading-relaxed"
                                    autoFocus
                                />

                                <div className="flex items-start gap-3 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                                    <Info className="text-indigo-500 shrink-0 mt-0.5" size={16} />
                                    <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 leading-relaxed italic">
                                        Die KI wird die Zutatenmengen anpassen, neue Zutaten hinzufügen oder ersetzen und die Zubereitungsschritte entsprechend umschreiben. Du kannst die Änderungen nachher prüfen und speichern.
                                    </p>
                                </div>
                            </div>

                            {error && (
                                <div className="p-4 bg-destructive/10 text-destructive text-xs font-bold rounded-2xl border border-destructive/20">
                                    {error}
                                </div>
                            )}

                            <div className="flex flex-col gap-3">
                                <Card className="p-4 bg-muted/50 flex items-center justify-between border-border/50">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5">
                                            <img src="/coin.png" alt="Coins" className="w-full h-full object-contain" />
                                        </div>
                                        <span className="text-sm font-bold">Kosten: {cost} Coin</span>
                                    </div>
                                    <div className="text-right">
                                        <span className={cn("text-xs font-bold", canAfford ? "text-muted-foreground" : "text-destructive")}>
                                            Guthaben: {credits} Coins
                                        </span>
                                    </div>
                                </Card>

                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        onClick={onClose}
                                        className="flex-1"
                                        disabled={loading}
                                    >
                                        Abbrechen
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={!prompt.trim() || !canAfford || loading}
                                        className="flex-[2] h-12 gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="animate-spin" size={18} />
                                                KI arbeitet...
                                            </>
                                        ) : (
                                            <>
                                                <Send size={18} />
                                                Änderung anfragen
                                            </>
                                        )}
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
