import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, RefreshCw, AlertCircle, ArrowRight, Check } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../lib/utils';
import api from '../lib/axios';
import useLockBodyScroll from '../hooks/useLockBodyScroll';

export default function RecipeIntoleranceResolverModal({
    isOpen,
    onClose,
    recipe,
    conflicts,
    onResolved
}) {
    const [resolutions, setResolutions] = useState({}); // { productId: suggestionObject }
    const [loading, setLoading] = useState({}); // { productId: boolean }
    const [suggestions, setSuggestions] = useState({}); // { productId: [suggestions] }
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isRewriting, setIsRewriting] = useState(false);

    useLockBodyScroll(isOpen);

    const productsWithConflicts = conflicts.map(c => c.productId);
    const uniqueConflictedProducts = [...new Set(productsWithConflicts)];

    useEffect(() => {
        if (isOpen && recipe && uniqueConflictedProducts.length > 0) {
            uniqueConflictedProducts.forEach(pid => {
                if (!suggestions[pid]) {
                    fetchSuggestions(pid);
                }
            });
        }
    }, [isOpen, recipe]);

    const fetchSuggestions = async (productId) => {
        setLoading(prev => ({ ...prev, [productId]: true }));
        try {
            const recipeIngredient = recipe.RecipeIngredients.find(ri => ri.ProductId === productId);
            const product = recipeIngredient?.Product;
            const { data } = await api.post('/ai/suggest-recipe-substitute', {
                productName: product?.name || 'Produkt',
                recipeId: recipe.id,
                originalAmount: recipeIngredient?.quantity,
                originalUnit: recipeIngredient?.unit
            });
            setSuggestions(prev => ({ ...prev, [productId]: data.suggestions }));
        } catch (err) {
            console.error('Failed to fetch suggestions for product', productId, err);
        } finally {
            setLoading(prev => ({ ...prev, [productId]: false }));
        }
    };

    const handleSelectSubstitute = (originalProductId, suggestion) => {
        if (suggestion.isOmitted) {
            setResolutions(prev => ({
                ...prev,
                [originalProductId]: {
                    isOmitted: true,
                    name: 'Wird weggelassen'
                }
            }));
            return;
        }

        setResolutions(prev => ({
            ...prev,
            [originalProductId]: {
                ...suggestion,
                substituteQuantity: suggestion.substituteQuantity !== undefined ? suggestion.substituteQuantity : recipe.RecipeIngredients.find(ri => ri.ProductId === originalProductId)?.quantity,
                substituteUnit: suggestion.substituteUnit || recipe.RecipeIngredients.find(ri => ri.ProductId === originalProductId)?.unit
            }
        }));
    };

    const handleQuantityChange = (pid, val) => {
        setResolutions(prev => ({
            ...prev,
            [pid]: { ...prev[pid], substituteQuantity: parseFloat(val) || 0 }
        }));
    };

    const handleUnitChange = (pid, val) => {
        setResolutions(prev => ({
            ...prev,
            [pid]: { ...prev[pid], substituteUnit: val }
        }));
    };

    const handleConfirm = async () => {
        setError(null);
        setIsSaving(true);
        try {
            // Check if all conflicts are resolved
            const unresolved = uniqueConflictedProducts.filter(pid => !resolutions[pid]);
            if (unresolved.length > 0) {
                setError('Bitte wähle für alle kritischen Zutaten einen Ersatz aus.');
                setIsSaving(false);
                return;
            }

            // Save substitutions to backend
            for (const pid of uniqueConflictedProducts) {
                const suggestion = resolutions[pid];

                if (suggestion.isOmitted) {
                    const recipeIngredient = recipe.RecipeIngredients.find(ri => ri.ProductId === pid);
                    await api.post('/substitutions', {
                        recipeId: recipe.id,
                        originalProductId: pid,
                        substituteProductId: null,
                        originalQuantity: recipeIngredient?.quantity,
                        originalUnit: recipeIngredient?.unit,
                        substituteQuantity: null,
                        substituteUnit: null,
                        isOmitted: true
                    });
                    continue;
                }

                // 1. Find or Create the substitute product
                // We use the search endpoint to see if product exists
                const { data: searchResults } = await api.get(`/products?search=${encodeURIComponent(suggestion.name)}`);
                let substituteProductId;

                const exactMatch = searchResults.find(p => p.name.toLowerCase() === suggestion.name.toLowerCase());

                if (exactMatch) {
                    substituteProductId = exactMatch.id;
                } else {
                    // Create new product
                    const { data: createData } = await api.post('/products', {
                        name: suggestion.name,
                        source: 'ai'
                    });
                    substituteProductId = createData.id;
                }

                const recipeIngredient = recipe.RecipeIngredients.find(ri => ri.ProductId === pid);

                await api.post('/substitutions', {
                    recipeId: recipe.id,
                    originalProductId: pid,
                    substituteProductId: substituteProductId,
                    originalQuantity: recipeIngredient?.quantity,
                    originalUnit: recipeIngredient?.unit,
                    substituteQuantity: suggestion.substituteQuantity,
                    substituteUnit: suggestion.substituteUnit,
                    isOmitted: false
                });
            }

            // Trigger AI Rewrite of instructions
            setIsSaving(false);
            setIsRewriting(true);
            try {
                await api.post('/ai/rewrite-instructions', { recipeId: recipe.id });
            } catch (rewriteErr) {
                console.error('Failed to rewrite instructions', rewriteErr);
                // We don't block the whole process if rewriting fails
            }

            onResolved();
            onClose();
        } catch (err) {
            console.error('Failed to save substitutions', err);
            setError('Fehler beim Speichern der Ersetzungen. Bitte versuche es erneut.');
        } finally {
            setIsSaving(false);
            setIsRewriting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-border bg-gradient-to-br from-primary/5 to-transparent shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-destructive/20 flex items-center justify-center">
                                    <AlertCircle className="text-destructive" size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-xl font-bebas tracking-wide text-foreground truncate">
                                        Unverträglichkeits-Check
                                    </h2>
                                    <p className="text-xs text-muted-foreground font-medium truncate">
                                        {recipe?.title}
                                    </p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-6 overflow-y-auto space-y-8 flex-1 scrollbar-hide">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Einige Zutaten in diesem Rezept könnten Unverträglichkeiten auslösen.
                            Wähle einen passenden Ersatz, um das Rezept dauerhaft für deinen Haushalt anzupassen.
                        </p>

                        {uniqueConflictedProducts.map(pid => {
                            const product = recipe.RecipeIngredients.find(ri => ri.ProductId === pid)?.Product;
                            const conflict = conflicts.find(c => c.productId === pid);
                            const selected = resolutions[pid];

                            return (
                                <div key={pid} className="space-y-4">
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                                        <div className="flex-1 p-4 rounded-2xl bg-destructive/5 border border-destructive/20">
                                            <div className="font-bold text-destructive flex items-center gap-2 text-sm">
                                                <AlertCircle size={14} />
                                                {product?.name}
                                            </div>
                                            <div className="text-[10px] text-destructive/70 mt-1 font-medium">
                                                {conflict?.warnings?.map(w => w.message).join(', ')}
                                            </div>
                                        </div>
                                        <div className="flex justify-center shrink-0">
                                            <ArrowRight className="text-muted-foreground rotate-90 sm:rotate-0" size={20} />
                                        </div>
                                        <div className={cn(
                                            "flex-1 p-4 rounded-2xl border-2 transition-all flex items-center min-h-[64px]",
                                            selected ? "bg-primary/5 border-primary shadow-sm" : "bg-muted/30 border-dashed border-border"
                                        )}>
                                            {selected ? (
                                                <div className="flex items-center justify-between gap-2 w-full">
                                                    <div className="font-bold text-primary truncate text-sm">{selected.name}</div>
                                                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                                                        <Check size={14} strokeWidth={3} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-xs text-muted-foreground italic w-full text-center">Ersatz wählen...</div>
                                            )}
                                        </div>
                                    </div>

                                    {selected && !selected.isOmitted && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-primary/5 border border-primary/20"
                                        >
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-primary uppercase flex items-center gap-1">
                                                    Menge (für Ersatz)
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={selected.substituteQuantity ?? ''}
                                                    onChange={(e) => handleQuantityChange(pid, e.target.value)}
                                                    className="w-full bg-card border border-primary/20 rounded-xl px-3 py-2 text-sm focus:ring-2 ring-primary/20 outline-none transition-all font-bold text-primary"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-primary uppercase">Einheit</label>
                                                <input
                                                    type="text"
                                                    value={selected.substituteUnit ?? ''}
                                                    onChange={(e) => handleUnitChange(pid, e.target.value)}
                                                    className="w-full bg-card border border-primary/20 rounded-xl px-3 py-2 text-sm focus:ring-2 ring-primary/20 outline-none transition-all font-bold text-primary"
                                                />
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* AI Suggestions Row */}
                                    <div className="relative">
                                        {loading[pid] ? (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground p-4 bg-muted/20 rounded-2xl border border-dashed border-border">
                                                <RefreshCw size={14} className="animate-spin" />
                                                KI sucht kulinarische Alternativen...
                                            </div>
                                        ) : (
                                            <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x scrollbar-hide">
                                                {/* Omit Option */}
                                                <button
                                                    onClick={() => handleSelectSubstitute(pid, { isOmitted: true })}
                                                    className={cn(
                                                        "shrink-0 p-4 rounded-2xl border text-left transition-all w-48 sm:w-56 space-y-2 snap-start group",
                                                        resolutions[pid]?.isOmitted
                                                            ? "border-destructive bg-destructive/5 ring-1 ring-destructive shadow-md"
                                                            : "border-border bg-card hover:border-destructive/50 shadow-sm"
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between gap-1">
                                                        <div className="font-bold text-xs sm:text-sm truncate group-hover:text-destructive transition-colors pr-2 text-destructive">Zutat weglassen</div>
                                                        <div className="w-5 h-5 rounded-full border border-destructive/30 flex items-center justify-center shrink-0">
                                                            <X className="text-destructive" size={12} />
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">
                                                        Streiche diese Zutat ersatzlos aus dem Rezept. Die Schritte werden entsprechend angepasst.
                                                    </div>
                                                </button>

                                                {suggestions[pid]?.map((s, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleSelectSubstitute(pid, s)}
                                                        className={cn(
                                                            "shrink-0 p-4 rounded-2xl border text-left transition-all w-48 sm:w-56 space-y-2 snap-start group",
                                                            resolutions[pid]?.name === s.name
                                                                ? "border-primary bg-primary/5 ring-1 ring-primary shadow-md"
                                                                : "border-border bg-card hover:border-primary/50 shadow-sm"
                                                        )}
                                                    >
                                                        <div className="flex items-start justify-between gap-1">
                                                            <div className="font-bold text-xs sm:text-sm truncate group-hover:text-primary transition-colors pr-2">{s.name}</div>
                                                            <div className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-bold shrink-0">
                                                                {Math.round(s.confidence * 100)}%
                                                            </div>
                                                        </div>
                                                        {(s.substituteQuantity || s.substituteUnit) && (
                                                            <div className="text-[10px] font-bold text-primary/80 bg-primary/5 px-2 py-0.5 rounded-lg w-fit">
                                                                Empfehlung: {s.substituteQuantity > 0 && <span className="mr-1">{s.substituteQuantity}</span>}{s.substituteUnit}
                                                            </div>
                                                        )}
                                                        <div className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">
                                                            {s.reason}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-6 border-t border-border bg-muted/10 shrink-0">
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-xs text-destructive font-bold flex items-center gap-2"
                                >
                                    <AlertCircle size={16} />
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                                variant="ghost"
                                className="flex-1 rounded-2xl h-12 font-bold"
                                onClick={onClose}
                                disabled={isSaving}
                            >
                                Abbrechen
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1 rounded-2xl h-12 font-bold group"
                                onClick={() => {
                                    onResolved();
                                    onClose();
                                }}
                                disabled={isSaving}
                            >
                                <ArrowRight className="mr-2 group-hover:translate-x-1 transition-transform" size={18} />
                                Dennoch einplanen
                            </Button>
                            <Button
                                className="flex-1 rounded-2xl h-12 font-bold shadow-lg shadow-primary/20 gap-2"
                                onClick={handleConfirm}
                                disabled={uniqueConflictedProducts.some(pid => !resolutions[pid]) || isSaving || isRewriting}
                            >
                                {isSaving ? (
                                    <>
                                        <RefreshCw size={18} className="animate-spin" />
                                        Ersatz wird gespeichert...
                                    </>
                                ) : isRewriting ? (
                                    <>
                                        <RefreshCw size={18} className="animate-spin" />
                                        Schritte werden angepasst...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={18} />
                                        Ersetzen & Fortfahren
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
