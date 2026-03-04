import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Play, LogOut, Timer, ChevronRight, Check, Sparkles, Lock, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../lib/utils';
import api from '../lib/axios';
import { useTutorial } from '../contexts/TutorialContext';

export default function CookingExitModal({
    isOpen,
    onClose,
    onConfirm,
    hasPaidAi = false,
    isSilbergabel = false,
    recipeDuration = 0,
    elapsedMinutes = 0,
    isForeign = false,
    recipe = null,
    userTier = 'Plastikgabel',
    substitutions = {}
}) {
    const [shouldUpdateDuration, setShouldUpdateDuration] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState(null);
    const [shouldApplyAiChanges, setShouldApplyAiChanges] = useState(false);
    const [diffItems, setDiffItems] = useState([]);
    const { notifyAction } = useTutorial();

    const getRoundedTime = (minutes) => {
        if (minutes <= 0) return 0;
        const lastDigit = minutes % 10;
        // 7, 8, 9, 0, 1 -> round to nearest 10 (auf 0 gesetzt am Ende)
        if ([7, 8, 9, 0, 1].includes(lastDigit)) {
            return Math.round(minutes / 10) * 10;
        }
        // 2, 3, 4, 5, 6 -> round to 5
        return Math.floor(minutes / 10) * 10 + 5;
    };

    const roundedElapsed = getRoundedTime(elapsedMinutes);
    const diff = Math.abs(roundedElapsed - recipeDuration);
    const threshold = recipeDuration * 0.1;
    const isSignificantDiff = diff > threshold || recipeDuration === 0;
    const showAdjustment = isSignificantDiff && !isForeign && roundedElapsed > 0;

    const normalizeRecipe = (r) => {
        if (!r) return { ingredients: [], steps: [] };
        const ings = (r.RecipeIngredients || r.ingredients || []).map(i => ({
            id: i.id,
            productId: i.ProductId || i.productId,
            name: (i.Product?.name || i.name || i.originalName || 'Unbekannt').trim(),
            quantity: parseFloat(i.quantity !== undefined ? i.quantity : (i.amount !== undefined ? i.amount : 0)),
            unit: (i.unit || '').trim()
        }));
        const steps = Array.isArray(r.steps)
            ? r.steps
            : (typeof r.instructions === 'string'
                ? JSON.parse(r.instructions)
                : (Array.isArray(r.instructions) ? r.instructions : []));
        return { ingredients: ings, steps };
    };

    const getRecipeDiff = (oldRecipe, newRecipe) => {
        const changes = [];
        const old = normalizeRecipe(oldRecipe);
        const current = normalizeRecipe(newRecipe);

        const oldIngs = old.ingredients;
        const newIngs = current.ingredients;

        const substitutedNames = new Set(Object.keys(substitutions).map(s => s.toLowerCase()));

        newIngs.forEach(n => {
            // Check if this ingredient (or its original version) was manually substituted
            if (substitutedNames.has(n.name.toLowerCase())) return;

            const o = oldIngs.find(i => i.name.toLowerCase() === n.name.toLowerCase());
            if (o) {
                // Also check if the original name in old recipe was substituted
                if (substitutedNames.has(o.name.toLowerCase())) return;

                if (Math.abs(o.quantity - n.quantity) > 0.01 || o.unit !== n.unit) {
                    changes.push({
                        type: 'ingredient',
                        name: n.name,
                        oldQuantity: o.quantity,
                        oldUnit: o.unit,
                        newQuantity: n.quantity,
                        newUnit: n.unit,
                        text: `Menge: ${o.quantity} ${o.unit} → ${n.quantity} ${n.unit} bei ${n.name}`
                    });
                }
            } else {
                changes.push({
                    type: 'ingredient_add',
                    name: n.name,
                    newQuantity: n.quantity,
                    newUnit: n.unit,
                    text: `Neu: ${n.quantity} ${n.unit} ${n.name}`
                });
            }
        });

        oldIngs.forEach(o => {
            if (substitutedNames.has(o.name.toLowerCase())) return;

            if (!newIngs.find(n => n.name.toLowerCase() === o.name.toLowerCase())) {
                changes.push({ type: 'ingredient_remove', name: o.name, oldQuantity: o.quantity, oldUnit: o.unit, text: `Entfernt: ${o.name}` });
            }
        });

        const oldSteps = old.steps;
        const newSteps = current.steps;

        newSteps.forEach((s, idx) => {
            if (idx < oldSteps.length) {
                if (s.trim() !== oldSteps[idx].trim()) {
                    changes.push({
                        type: 'step_change',
                        index: idx + 1,
                        oldText: oldSteps[idx],
                        newText: s,
                        text: `Schritt ${idx + 1} angepasst`
                    });
                }
            } else {
                changes.push({
                    type: 'step_add',
                    index: idx + 1,
                    newText: s,
                    text: `Neuer Schritt ${idx + 1}`
                });
            }
        });

        if (oldSteps.length > newSteps.length) {
            for (let i = newSteps.length; i < oldSteps.length; i++) {
                changes.push({
                    type: 'step_remove',
                    index: i + 1,
                    oldText: oldSteps[i],
                    text: `Schritt ${i + 1} entfernt`
                });
            }
        }

        return changes;
    };

    const handleAiRequest = async () => {
        if (!aiPrompt.trim() || isAiLoading) return;
        if (userTier === 'Plastikgabel') return;
        setIsAiLoading(true);
        try {
            const response = await api.post('/ai/modify', {
                recipe: {
                    ...recipe,
                    // Pass current normalized ingredients to AI so it sees what we have
                    ingredients: normalizeRecipe(recipe).ingredients
                },
                input: aiPrompt
            });
            const result = response.data;
            const diffs = getRecipeDiff(recipe, result);
            setAiResult(result);
            setDiffItems(diffs);
            setShouldApplyAiChanges(true);
        } catch (err) {
            alert(err.response?.data?.error || 'KI-Fehler beim Anpassen.');
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleConfirm = () => {
        let finalRecipe = aiResult;

        // Final safeguard: if applying AI changes, ensure we don't accidentally overwrite
        // ingredients that were manually substituted during the session.
        if (shouldApplyAiChanges && aiResult && Object.keys(substitutions).length > 0) {
            const normalizedOld = normalizeRecipe(recipe);
            const substitutedNames = new Set(Object.keys(substitutions).map(s => s.toLowerCase()));

            // Map original ingredients by name for easy lookup
            const oldIngsMap = new Map(normalizedOld.ingredients.map(i => [i.name.toLowerCase(), i]));

            finalRecipe = {
                ...aiResult,
                ingredients: aiResult.ingredients.map(ni => {
                    const originalName = ni.name.toLowerCase();
                    if (substitutedNames.has(originalName)) {
                        // Revert to original (manual session) state for this ingredient
                        const originalInfo = oldIngsMap.get(originalName);
                        if (originalInfo) {
                            return {
                                ...ni,
                                quantity: originalInfo.quantity,
                                unit: originalInfo.unit
                            };
                        }
                    }
                    return ni;
                })
            };
        }

        notifyAction('cook-mode-finish');
        onConfirm({
            newDuration: shouldUpdateDuration ? roundedElapsed : undefined,
            newRecipe: shouldApplyAiChanges ? finalRecipe : undefined
        });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    />

                    <motion.div
                        id="tutorial-cooking-exit-modal"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[90vh]"
                    >
                        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                                    <AlertTriangle size={20} />
                                </div>
                                <h3 className="font-bold text-foreground">Kochmodus beenden?</h3>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors text-foreground/60">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                            <div className="space-y-4">
                                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                                    Möchtest du den Kochmodus wirklich beenden? Dein aktueller Fortschritt und aktive Timer gehen verloren.
                                </p>

                                {isSilbergabel && hasPaidAi && (
                                    <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold leading-relaxed">
                                            Hinweis: Da du den KI-Assistenten bereits aktiviert hast, fallen bei einem Neustart des Kochmodus erneut Kosten (10 Coins) an.
                                        </p>
                                    </div>
                                )}

                                {showAdjustment && (
                                    <div
                                        onClick={() => setShouldUpdateDuration(!shouldUpdateDuration)}
                                        className={cn(
                                            "p-4 rounded-2xl border transition-all cursor-pointer group",
                                            shouldUpdateDuration
                                                ? "bg-primary/5 border-primary shadow-sm"
                                                : "bg-muted/30 border-border hover:border-primary/30"
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "p-1.5 rounded-lg transition-colors",
                                                    shouldUpdateDuration ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                                )}>
                                                    <Timer size={14} />
                                                </div>
                                                <span className="text-xs font-bold uppercase tracking-wider text-foreground">Kochzeit anpassen?</span>
                                            </div>
                                            <div className={cn(
                                                "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                                                shouldUpdateDuration ? "bg-primary border-primary text-primary-foreground" : "bg-muted-foreground/20 border-transparent"
                                            )}>
                                                {shouldUpdateDuration && <Check size={12} strokeWidth={4} />}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-center gap-4 py-1">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Geplant</span>
                                                <span className="font-bold text-lg text-foreground">{recipeDuration} min</span>
                                            </div>
                                            <div className="text-muted-foreground/40">
                                                {roundedElapsed > recipeDuration ? <ChevronRight size={20} /> : <div className="scale-x-[-1]"><ChevronRight size={20} /></div>}
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-primary uppercase tracking-widest mb-1">Tatsächlich</span>
                                                <span className="font-bold text-lg text-primary">{roundedElapsed} min</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!isForeign && (
                                    <div className={cn(
                                        "p-4 rounded-2xl border transition-all space-y-4",
                                        shouldApplyAiChanges ? "bg-purple-500/5 border-purple-500/50 shadow-sm" : "bg-muted/30 border-border"
                                    )}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "p-1.5 rounded-lg transition-colors",
                                                    shouldApplyAiChanges ? "bg-purple-500 text-white" : "bg-muted text-muted-foreground"
                                                )}>
                                                    <Sparkles size={14} className="fill-current" />
                                                </div>
                                                <span className="text-xs font-bold uppercase tracking-wider text-foreground">KI-Änderungswünsche?</span>
                                            </div>
                                            {userTier === 'Plastikgabel' ? (
                                                <div className="p-1 px-2 rounded-lg bg-muted text-muted-foreground text-[10px] flex items-center gap-1 font-bold">
                                                    <Lock size={10} /> Nur Pro
                                                </div>
                                            ) : aiResult && (
                                                <div
                                                    onClick={() => setShouldApplyAiChanges(!shouldApplyAiChanges)}
                                                    className={cn(
                                                        "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer",
                                                        shouldApplyAiChanges ? "bg-purple-500 border-purple-500 text-white" : "bg-muted-foreground/20 border-transparent"
                                                    )}
                                                >
                                                    {shouldApplyAiChanges && <Check size={12} strokeWidth={4} />}
                                                </div>
                                            )}
                                        </div>

                                        {!aiResult ? (
                                            <div className="space-y-3">
                                                <div className="relative">
                                                    <textarea
                                                        value={aiPrompt}
                                                        onChange={(e) => setAiPrompt(e.target.value)}
                                                        placeholder="z.B. 'Zutat X durch Y ersetzen', 'Mehr Schärfe'..."
                                                        className="w-full h-24 p-3 text-sm bg-background/50 border border-border rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all resize-none text-foreground placeholder:text-muted-foreground/30"
                                                        disabled={userTier === 'Plastikgabel' || isAiLoading}
                                                    />
                                                    {userTier === 'Plastikgabel' && (
                                                        <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px] flex items-center justify-center rounded-xl cursor-not-allowed">
                                                            <div className="bg-background/90 p-2 px-3 rounded-lg border border-border flex items-center gap-2 text-xs font-bold text-muted-foreground shadow-sm">
                                                                <Lock size={12} /> Exklusiv für Silbergabel & Goldgabel
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <Button
                                                    size="sm"
                                                    onClick={handleAiRequest}
                                                    disabled={userTier === 'Plastikgabel' || isAiLoading || !aiPrompt.trim()}
                                                    className="w-full h-10 gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl shadow-lg border-none"
                                                >
                                                    {isAiLoading ? (
                                                        <>
                                                            <Loader2 size={16} className="animate-spin" /> Analysiere...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles size={16} className="fill-current" /> KI-Vorschlag (10 Coins)
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="text-[10px] font-bold text-purple-500 uppercase tracking-widest flex items-center justify-between">
                                                    <span>Änderungsvorschläge:</span>
                                                    <button onClick={() => { setAiResult(null); setDiffItems([]); setShouldApplyAiChanges(false); }} className="text-muted-foreground hover:text-foreground">Abbrechen</button>
                                                </div>
                                                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-purple-500/20 scrollbar-track-transparent">
                                                    {diffItems.length > 0 ? diffItems.map((item, idx) => (
                                                        <div key={idx} className="group p-3 bg-background/40 rounded-2xl border border-purple-500/10 hover:border-purple-500/30 transition-all shadow-sm">
                                                            <div className="flex items-center gap-2 mb-2 text-purple-600 dark:text-purple-300 font-bold uppercase tracking-widest text-[9px]">
                                                                <div className="w-4 h-4 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                                                                    <Check size={10} strokeWidth={3} />
                                                                </div>
                                                                {item.text}
                                                            </div>

                                                            {(item.oldText || item.newText) ? (
                                                                <div className="space-y-2 pl-6 relative">
                                                                    <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500/30 via-purple-500/10 to-transparent rounded-full" />
                                                                    {item.oldText && (
                                                                        <div className="text-[10px] text-muted-foreground/60 line-through italic leading-relaxed">
                                                                            {item.oldText}
                                                                        </div>
                                                                    )}
                                                                    {item.newText && (
                                                                        <div className="text-[11px] text-foreground font-medium leading-relaxed bg-purple-500/5 p-2 rounded-lg border border-purple-500/5">
                                                                            {item.newText}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    )) : <div className="text-[11px] text-muted-foreground italic text-center py-4 bg-muted/20 rounded-2xl">Keine Änderungen identifiziert.</div>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-border bg-muted/30 shrink-0 space-y-3">
                            <Button
                                onClick={handleConfirm}
                                variant="secondary"
                                className="w-full h-14 gap-2 shadow-lg shadow-secondary/20 rounded-2xl font-bold"
                                disabled={isAiLoading}
                            >
                                <LogOut size={18} />
                                Modus beenden & Speichern
                            </Button>
                            <button
                                onClick={onClose}
                                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
                            >
                                Weiterkochen
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
