import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2, Sparkles, AlertTriangle, Info, Save } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';
import api from '../lib/axios';
import { cn } from '../lib/utils';

export default function IntoleranceCheckModal({ isOpen, onClose, onSave }) {
    const [step, setStep] = useState('input'); // 'input', 'processing', 'review'
    const [name, setName] = useState('');
    const [warningText, setWarningText] = useState('');
    const [products, setProducts] = useState([]);
    const [results, setResults] = useState({}); // productId -> isIntolerant (bool)
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);

    // Fetch products when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchProducts();
            setStep('input');
            setName('');
            setWarningText('');
            setResults({});
            setError(null);
        }
    }, [isOpen]);

    const fetchProducts = async () => {
        try {
            const { data } = await api.get('/products');
            setProducts(data);
        } catch (err) {
            console.error('Failed to fetch products:', err);
            setError('Produkte konnten nicht geladen werden.');
        }
    };

    const handleStartCheck = async () => {
        if (!name.trim() || !warningText.trim()) return;
        setStep('processing');
        setLoading(true);
        setProgress(0);
        setError(null);

        const batchSize = 25;
        const total = products.length;
        const newResults = {};

        try {
            for (let i = 0; i < total; i += batchSize) {
                const batch = products.slice(i, i + batchSize).map(p => ({ id: p.id, name: p.name }));
                const { data } = await api.post('/ai/check-intolerance', {
                    intoleranceWarning: warningText,
                    products: batch
                });

                data.forEach(res => {
                    newResults[res.id] = res.isIntolerant;
                });

                const currentProgress = Math.min(100, Math.round(((i + batchSize) / total) * 100));
                setProgress(currentProgress);
            }

            setResults(newResults);
            setStep('review');
        } catch (err) {
            console.error('AI Check failed:', err);
            setError('Ein Fehler ist bei der KI-Analyse aufgetreten. Bitte versuche es erneut.');
            setStep('input');
        } finally {
            setLoading(false);
        }
    };

    const toggleResult = (id) => {
        setResults(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const handleFinalSave = async () => {
        setLoading(true);
        try {
            const productIds = Object.entries(results)
                .filter(([_, isIntolerant]) => isIntolerant)
                .map(([id, _]) => parseInt(id));

            await api.post('/intolerances/bulk-assign', {
                name,
                warningText,
                productIds
            });

            if (onSave) onSave();
            onClose();
        } catch (err) {
            console.error('Final Save failed:', err);
            setError('Fehler beim Speichern der Ergebnisse.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-foreground leading-none mb-1">KI Unverträglichkeits-Check</h2>
                                <p className="text-xs text-muted-foreground">Prüfe alle Produkte auf eine neue Unverträglichkeit</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
                            <X size={20} />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                        {error && (
                            <div className="mb-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
                                <AlertTriangle size={18} />
                                {error}
                            </div>
                        )}

                        {step === 'input' && (
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted-foreground px-1">Name der Unverträglichkeit</label>
                                        <Input
                                            placeholder="z.B. Gluten, Laktose, Nüsse"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="text-lg py-6 rounded-2xl bg-muted/30 border-transparent focus:bg-background"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted-foreground px-1">Warnung / Prüf-Text (Prompt)</label>
                                        <Input
                                            placeholder="z.B. enthält Gluten, ist milchhaltig"
                                            value={warningText}
                                            onChange={(e) => setWarningText(e.target.value)}
                                            className="py-6 rounded-2xl bg-muted/30 border-transparent focus:bg-background"
                                        />
                                        <p className="text-[10px] text-muted-foreground/60 px-1 italic">
                                            Dieser Text wird verwendet, um die KI zu fragen, ob ein Produkt problematisch ist.
                                        </p>
                                    </div>
                                </div>

                                <Card className="p-4 bg-primary/5 border-primary/10 rounded-2xl space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                            <Info size={12} />
                                        </div>
                                        <p className="text-xs leading-relaxed text-muted-foreground">
                                            Es werden insgesamt <strong>{products.length}</strong> Produkte analysiert.
                                            Dies kann einen Moment dauern und verbraucht KI-Credits.
                                            Du kannst die Ergebnisse danach manuell korrigieren.
                                        </p>
                                    </div>
                                </Card>

                                <Button
                                    className="w-full py-6 text-lg rounded-2xl shadow-lg shadow-primary/20"
                                    onClick={handleStartCheck}
                                    disabled={!name.trim() || !warningText.trim() || loading}
                                >
                                    {loading ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" size={20} />}
                                    Analyse starten
                                </Button>
                            </div>
                        )}

                        {step === 'processing' && (
                            <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
                                <div className="relative">
                                    <div className="h-24 w-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center text-primary">
                                        <Sparkles size={32} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold">KI analysiert Produkte...</h3>
                                    <p className="text-muted-foreground">{progress}% abgeschlossen</p>
                                </div>
                                <div className="w-full max-w-xs bg-muted rounded-full h-2 overflow-hidden">
                                    <motion.div
                                        className="h-full bg-primary"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {step === 'review' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-bold flex items-center gap-2">
                                        Ergebnisse für <span className="text-primary">{name}</span>
                                    </h3>
                                    <div className="text-xs text-muted-foreground">
                                        {Object.values(results).filter(v => v).length} von {products.length} Produkten betroffen
                                    </div>
                                </div>

                                <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border bg-card/50">
                                    {products.map(product => (
                                        <div
                                            key={product.id}
                                            className={cn(
                                                "p-3 flex items-center justify-between transition-colors cursor-pointer hover:bg-muted/40",
                                                results[product.id] ? "bg-red-500/5" : "bg-transparent opacity-60"
                                            )}
                                            onClick={() => toggleResult(product.id)}
                                        >
                                            <div className="flex flex-col min-w-0 pr-4">
                                                <span className="font-medium text-sm truncate">{product.name}</span>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{product.category || 'Keine Kategorie'}</span>
                                            </div>
                                            <div className={cn(
                                                "h-6 w-12 rounded-full relative flex items-center px-1 transition-colors shrink-0",
                                                results[product.id] ? "bg-red-500 shadow-lg shadow-red-500/20" : "bg-primary"
                                            )}>
                                                <motion.div
                                                    animate={{ x: results[product.id] ? 24 : 0 }}
                                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                    className="h-4 w-4 rounded-full bg-white shadow-sm flex items-center justify-center"
                                                >
                                                    {results[product.id] ? <AlertTriangle size={10} className="text-red-500" /> : <Check size={10} className="text-primary" />}
                                                </motion.div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {step === 'review' && (
                        <div className="p-6 border-t border-border bg-muted/20 flex gap-3 shrink-0">
                            <Button variant="outline" className="flex-1 rounded-2xl py-6" onClick={() => setStep('input')} disabled={loading}>
                                Zurück
                            </Button>
                            <Button className="flex-[2] rounded-2xl py-6 shadow-xl shadow-primary/20" onClick={handleFinalSave} disabled={loading}>
                                {loading ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={20} />}
                                Speichern
                            </Button>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
