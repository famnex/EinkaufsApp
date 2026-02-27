import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, RefreshCw, X, AlertCircle, Info, Tag, Scale, Layers } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';
import api from '../lib/axios';
import { cn } from '../lib/utils';

export default function AiCleanupCard({ product, onComplete, context = 'pipeline', allIntolerances = [], allVariants = [] }) {
    const [status, setStatus] = useState('loading'); // 'loading', 'review', 'error', 'refining'
    const [data, setData] = useState(null);
    const [intoleranceIds, setIntoleranceIds] = useState([]);
    const [feedback, setFeedback] = useState('');
    const [showFeedback, setShowFeedback] = useState(false);
    const [error, setError] = useState(null);

    const fetchAnalysis = async (userFeedback = '') => {
        setStatus(userFeedback ? 'refining' : 'loading');
        setError(null);
        try {
            const res = await api.post('/ai/analyze-product', {
                productName: product.name,
                userFeedback: userFeedback || undefined
            });
            setData(res.data);
            setIntoleranceIds(res.data.intoleranceIds || []);
            setStatus('review');
            setShowFeedback(false);
            setFeedback('');
        } catch (err) {
            console.error('AI Analysis failed:', err);
            setError(err.response?.data?.error || err.message);
            setStatus('error');
        }
    };

    useEffect(() => {
        fetchAnalysis();
    }, [product.id]);

    const handleRemoveVariant = (idx) => {
        setData(prev => {
            const nextVariants = prev.variants.filter((_, i) => i !== idx);
            return {
                ...prev,
                variants: nextVariants,
                hasVariants: nextVariants.length > 0
            };
        });
    };

    const handleOk = async () => {
        try {
            setStatus('saving');

            let finalCategory = data.category;
            let finalUnit = data.unit;
            let finalVariations = data.hasVariants ? data.variants : null;

            // Promotion logic: if only one variant, promote it to standard fields
            if (data.hasVariants && data.variants.length === 1) {
                finalCategory = data.variants[0].category;
                finalUnit = data.variants[0].unit;
                finalVariations = null;
            }

            // 1. Save product data
            const updatePayload = {
                category: finalCategory,
                unit: finalUnit,
                intolerances: data.intolerances,
                variations: finalVariations
            };

            // If variants exist, we might need a more complex save logic, 
            // but for now the user said "die Daten werden beim Produkt hinterlegt".
            // If it has variants, we should probably handle that too.
            // Our backend returns { hasVariants, variants: [...], category, unit, intoleranceIds }

            await api.put(`/products/${product.id}`, updatePayload);

            // 2. Hide for this context
            await api.post('/ai/cleanup/toggle-hidden', {
                productId: product.id,
                context
            });

            onComplete(product.id, 'ok');
        } catch (err) {
            console.error('Save failed:', err);
            setError('Speichern fehlgeschlagen');
            setStatus('review');
        }
    };

    const handleReject = async () => {
        try {
            setStatus('saving');
            // Just hide it
            await api.post('/ai/cleanup/toggle-hidden', {
                productId: product.id,
                context
            });
            onComplete(product.id, 'rejected');
        } catch (err) {
            console.error('Reject failed:', err);
            setError('Fehler beim Ausblenden');
            setStatus('review');
        }
    };

    const handleRefine = () => {
        if (!feedback.trim()) return;
        fetchAnalysis(feedback);
    };

    return (
        <Card className="flex flex-col h-full bg-card border-border overflow-hidden group shadow-sm hover:shadow-md transition-all duration-300">
            {/* Header */}
            <div className="p-4 border-b border-border bg-muted/30">
                <h3 className="font-bold text-lg truncate" title={product.name}>
                    {product.name}
                </h3>
            </div>

            {/* Content area with scrolling support */}
            <div className="flex-1 overflow-y-auto p-4 relative min-h-[200px] scrollbar-thin scrollbar-thumb-primary/10 hover:scrollbar-thumb-primary/20">
                <AnimatePresence mode="wait">
                    {(status === 'loading' || status === 'refining' || status === 'saving') && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-[2px] z-10"
                        >
                            <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                            <p className="text-xs font-medium text-muted-foreground">
                                {status === 'saving' ? 'Speichere...' : status === 'refining' ? 'Passe an...' : 'KI analysiert...'}
                            </p>
                        </motion.div>
                    )}

                    {status === 'error' && (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="h-full flex flex-col items-center justify-center text-center p-4"
                        >
                            <AlertCircle className="w-8 h-8 text-destructive mb-2" />
                            <p className="text-sm font-medium text-destructive mb-4">{error}</p>
                            <Button size="sm" variant="outline" onClick={() => fetchAnalysis()}>
                                Erneut versuchen
                            </Button>
                        </motion.div>
                    )}

                    {status === 'review' && data && (
                        <motion.div
                            key="review"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-5"
                        >
                            {/* Category & Unit (Only if NO variants) */}
                            {!data.hasVariants && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                            <Tag size={10} /> Kategorie
                                        </div>
                                        <div className="text-sm font-medium bg-muted/50 p-2 rounded-lg border border-border/50">
                                            {data.category || '---'}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                            <Scale size={10} /> Einheit
                                        </div>
                                        <div className="text-sm font-medium bg-muted/50 p-2 rounded-lg border border-border/50">
                                            {data.unit || '---'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Intolerances */}
                            <div className="space-y-1">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Unverträglichkeiten
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {intoleranceIds.length > 0 ? (
                                        intoleranceIds.map(id => {
                                            const intolerance = allIntolerances.find(i => i.id === id);
                                            const label = intolerance?.warningText || intolerance?.name || `ID: ${id}`;
                                            return (
                                                <span
                                                    key={id}
                                                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20 animate-in fade-in zoom-in-50"
                                                >
                                                    {label}
                                                    {data.intolerances?.find(i => i.id === id)?.probability !== undefined && (
                                                        <span className="opacity-60 font-medium ml-0.5">
                                                            {data.intolerances.find(i => i.id === id).probability}%
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={() => setIntoleranceIds(prev => prev.filter(i => i !== id))}
                                                        className="hover:text-destructive transition-colors ml-0.5"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                </span>
                                            );
                                        })
                                    ) : (
                                        <span className="text-[10px] text-muted-foreground italic">Keine erkannt</span>
                                    )}
                                </div>
                            </div>

                            {/* Variants List (Category/Unit per variant) */}
                            {data.hasVariants && data.variants?.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                        <Layers size={10} /> Varianten
                                    </div>
                                    <div className="space-y-2">
                                        {data.variants.map((v, idx) => {
                                            const variantTitle = allVariants.find(av => av.id === v.ProductVariantId)?.title || `Variante ${v.ProductVariantId}`;
                                            return (
                                                <div key={idx} className="bg-muted/30 p-2 rounded-xl border border-border/50 space-y-2 relative group-item">
                                                    <div className="text-xs font-bold text-foreground flex justify-between pr-6">
                                                        <span>{variantTitle}</span>
                                                        <span className="text-primary">{v.unit}</span>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground bg-background/50 px-2 py-1 rounded inline-block border border-border/30">
                                                        {v.category}
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveVariant(idx)}
                                                        className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors p-0.5 hover:bg-destructive/10 rounded"
                                                        title="Variante entfernen"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>

                                </div>
                            )}


                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer Actions */}
            <div className="p-3 bg-muted/30 border-t border-border mt-auto flex flex-col gap-3">
                <AnimatePresence>
                    {showFeedback && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-3">
                                <div className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                                    <RefreshCw size={10} /> Korrektur
                                </div>
                                <Input
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                                    placeholder="Feedback für KI..."
                                    className="text-xs h-10 bg-card border-primary/20 focus:border-primary shadow-inner"
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <Button size="sm" className="flex-1 h-8 text-[10px] font-bold uppercase tracking-wider" onClick={handleRefine}>
                                        Absenden
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" onClick={() => setShowFeedback(false)}>
                                        <X size={14} />
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="grid grid-cols-3 gap-2">
                    <Button
                        size="sm"
                        className="h-9 gap-1.5"
                        onClick={handleOk}
                        disabled={status !== 'review'}
                    >
                        <Check size={14} /> OK
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-9 gap-1.5"
                        onClick={() => setShowFeedback(true)}
                        disabled={status !== 'review' || showFeedback}
                    >
                        <RefreshCw size={14} /> Refine
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 gap-1.5 text-muted-foreground hover:text-destructive"
                        onClick={handleReject}
                        disabled={status !== 'review'}
                    >
                        <X size={14} /> Weg
                    </Button>
                </div>
            </div>
        </Card>
    );
}
