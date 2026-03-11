import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Check, Minus, Plus, AlertCircle, HelpCircle } from 'lucide-react';
import { Button } from './Button';
import { cn, getImageUrl } from '../lib/utils';
import { sortIngredientsBySteps, findIngredientsInText } from '../lib/recipe-parser';
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import api from '../lib/axios';

export default function SharedCookingMode({ recipe, conflicts = [], onClose }) {
    const [step, setStep] = useState(0);
    const [checkedIngredients, setCheckedIngredients] = useState(new Set());
    const [textSize, setTextSize] = useState(1); // 0: Small, 1: Normal, 2: Large
    const [showIngredientsMobile, setShowIngredientsMobile] = useState(true); // For mobile toggle
    const [direction, setDirection] = useState(0);
    const [substitutions, setSubstitutions] = useState({}); // { "Original Name": "New Name" }

    useLockBodyScroll(true);

    // Swipe Logic for Steps
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) nextStep();
        if (isRightSwipe) prevStep();
    };

    const variants = {
        enter: (direction) => ({
            x: direction > 0 ? 100 : -100,
            opacity: 0
        }),
        center: {
            x: 0,
            opacity: 1
        },
        exit: (direction) => ({
            x: direction < 0 ? 100 : -100,
            opacity: 0
        })
    };

    // Parse ingredients
    const rawIngredients = useMemo(() => recipe.RecipeIngredients?.map(ri => {
        const originalName = ri.Product?.name || 'Unknown';
        const sub = substitutions[originalName];
        return {
            id: ri.id,
            name: sub ? sub.name : originalName,
            originalName: originalName,
            isSubstituted: !!sub,
            amount: sub && sub.quantity !== null ? sub.quantity : ri.quantity,
            unit: (sub && sub.unit) ? sub.unit : (ri.unit || ri.Product?.unit),
            isOptional: !!ri.isOptional
        };
    }) || [], [recipe, substitutions]);

    const steps = recipe.instructions || [];

    // --- NEW: Sort Ingredients by Appearance ---
    const ingredients = useMemo(() => {
        return sortIngredientsBySteps(rawIngredients, steps);
    }, [rawIngredients, steps]);

    // Precompute cumulative occurrence offsets per step so duplicate ingredients
    // are mapped to the correct list entry (1st text occurrence -> 1st ingredient, etc.)
    const occurrencesByStep = useMemo(() => {
        const result = [{}]; // result[i] = occurrencesBefore for step i
        for (let i = 0; i < steps.length; i++) {
            const { localOccurrences } = findIngredientsInText(steps[i], ingredients, result[i]);
            const next = { ...result[i] };
            Object.entries(localOccurrences).forEach(([k, v]) => {
                next[k] = (next[k] || 0) + v;
            });
            result.push(next);
        }
        return result;
    }, [steps, ingredients]);

    // --- NEW: Parse Steps for Highlighting ---
    const stepFragments = useMemo(() => {
        const currentText = steps[step];
        if (!currentText) return [];

        const { matches } = findIngredientsInText(currentText, ingredients, occurrencesByStep[step] || {});

        // No matches -> return single text fragment
        if (!matches || matches.length === 0) return [{ text: currentText, type: 'text' }];

        const fragments = [];
        let lastIndex = 0;

        matches.sort((a, b) => a.index - b.index).forEach(match => {
            // Text before match
            if (match.index > lastIndex) {
                fragments.push({
                    text: currentText.substring(lastIndex, match.index),
                    type: 'text'
                });
            }

            // The match itself
            fragments.push({
                text: match.matchedText,
                type: 'ingredient',
                ingredient: match.ingredient,
                id: match.ingredientId
            });

            lastIndex = match.index + match.matchedText.length;
        });

        // Remaining text
        if (lastIndex < currentText.length) {
            fragments.push({
                text: currentText.substring(lastIndex),
                type: 'text'
            });
        }

        return fragments;
    }, [step, steps, ingredients]);


    const toggleIngredient = (id) => {
        const next = new Set(checkedIngredients);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setCheckedIngredients(next);
    };

    const nextStep = () => {
        if (step < steps.length - 1) {
            setDirection(1);
            setStep(step + 1);
        }
    };

    const prevStep = () => {
        if (step > 0) {
            setDirection(-1);
            setStep(step - 1);
        }
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') nextStep();
            if (e.key === 'ArrowLeft') prevStep();
            if (e.key === 'Escape') setIsExitModalOpen(true);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [step]);

    // fetchSavedSubstitutions is removed because data is now provided in 'recipe' prop for public recipes

    // Screen Wake Lock - Keep screen on while cooking
    useEffect(() => {
        let wakeLock = null;

        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('[CookingMode] Screen wake lock activated');
                }
            } catch (err) {
                console.warn('[CookingMode] Wake lock failed:', err);
            }
        };

        requestWakeLock();

        return () => {
            if (wakeLock) {
                wakeLock.release().then(() => {
                    console.log('[CookingMode] Screen wake lock released');
                });
            }
        };
    }, []);

    const getConflictForProduct = (productId) => {
        const productConflicts = conflicts.filter(c => Number(c.productId) === Number(productId));
        if (productConflicts.length === 0) return null;

        const messages = [];
        let maxProb = 0;
        productConflicts.forEach(pc => {
            if (pc.warnings) {
                pc.warnings.forEach(w => {
                    const householdLabel = pc.username ? ` (${pc.username})` : '';
                    messages.push(`🛑 ${w.message}${householdLabel}`);
                    const prob = w.probability !== undefined ? w.probability : 100;
                    if (prob > maxProb) maxProb = prob;
                });
            }
        });

        if (maxProb <= 30) return null;

        return {
            messages: [...new Set(messages)],
            maxProbability: maxProb
        };
    };

    const getTextSizeClass = () => {
        switch (textSize) {
            case 0: return 'text-base';
            case 1: return 'text-xl';
            case 2: return 'text-3xl leading-relaxed';
            default: return 'text-xl';
        }
    };


    // Tooltip for Ingredient details in Steps
    const [ingredientTooltip, setIngredientTooltip] = useState(null); // { x, y, ingredient }
    // Portal Tooltip for List warnings (matching CookingMode design)
    const [tooltipData, setTooltipData] = useState(null); // { x, y, items: [], maxProbability: number }

    const handleIngredientHover = (e, ing, productId) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setIngredientTooltip({
            x: rect.left + (rect.width / 2),
            y: rect.top - 10, // Above
            ingredient: ing,
            conflicts: productId ? getConflictForProduct(productId) : null
        });
    };

    const handleIngredientLeave = () => {
        setIngredientTooltip(null);
    };

    const handleTooltipShow = (e, conflict) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipData({
            x: rect.right + 10,
            y: rect.top,
            items: conflict.messages,
            maxProbability: conflict.maxProbability
        });
    };

    const handleTooltipHide = () => {
        setTooltipData(null);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-[2000] bg-background flex flex-col md:flex-row overflow-hidden select-none text-foreground"
            >
                {/* --- MOBILE HEADER (Shared, Sticky, Safe Area Aware) --- */}
                <div
                    className="md:hidden flex-none z-50 bg-background border-b border-border shadow-sm"
                    style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
                >
                    {/* Top Row: Title & Close */}
                    <div className="flex items-center justify-between p-4 pb-2">
                        <h3 className="font-bold truncate pr-4 text-lg">{recipe.title}</h3>
                        <Button variant="ghost" size="icon" onClick={onClose} className="-mr-2">
                            <X size={24} />
                        </Button>
                    </div>

                    {/* Bottom Row: Actions */}
                    <div className="flex items-center justify-between px-4 pb-4">
                        <Button
                            variant={showIngredientsMobile ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setShowIngredientsMobile(!showIngredientsMobile)}
                        >
                            {showIngredientsMobile ? <ChevronLeft className="mr-2 h-4 w-4" /> : null}
                            {showIngredientsMobile ? "Schritte" : `Zutaten (${ingredients.length})`}
                        </Button>

                        {/* Text Size (Mini Version) - Mobile Only */}
                        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 md:hidden">
                            <button onClick={() => setTextSize(Math.max(0, textSize - 1))} className="w-8 h-8 flex items-center justify-center hover:bg-background rounded-md"><Minus size={14} /></button>
                            <span className="text-xs font-bold w-4 text-center">Aa</span>
                            <button onClick={() => setTextSize(Math.min(2, textSize + 1))} className="w-8 h-8 flex items-center justify-center hover:bg-background rounded-md"><Plus size={14} /></button>
                        </div>
                    </div>
                </div>

                {/* --- MAIN CONTENT AREA --- */}
                <div className="flex-1 relative flex flex-col md:flex-row overflow-hidden">

                    {/* Close Button & Controls (Top Right Overlay) - Desktop Only */}
                    <div className="absolute top-4 right-4 z-50 hidden md:flex gap-2">
                        <Button variant="secondary" onClick={onClose} className="rounded-full w-12 h-12 p-0 shadow-lg">
                            <X size={24} />
                        </Button>
                    </div>

                    {/* LEFT SIDE: Info & Ingredients */}
                    <div className={cn(
                        "w-full md:w-1/3 bg-muted/30 border-r border-border flex flex-col h-full transition-transform duration-300 absolute md:relative z-20 md:translate-x-0 inset-0 md:inset-auto",
                        showIngredientsMobile ? "translate-x-0 bg-background" : "-translate-x-full md:translate-x-0"
                    )}>
                        {/* Header Image */}
                        <div className="relative h-48 md:h-64 shrink-0">
                            {recipe.image_url ? (
                                <img src={getImageUrl(recipe.image_url)} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">No Image</div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                            <div className="absolute bottom-4 left-4 right-4 text-white">
                                <h2 className="hidden md:block text-2xl font-bold leading-tight">{recipe.title}</h2>
                                <p className="opacity-80 text-sm">{recipe.servings} Portionen • {recipe.duration} Min</p>
                            </div>
                        </div>

                        {/* Ingredients List */}
                        <div
                            className="flex-1 overflow-y-auto p-6 space-y-4 pb-24 md:pb-6"
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                        >
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <h3 className="font-bold text-xs uppercase tracking-[0.2em] text-muted-foreground/60 mb-2 px-1">Zutaten</h3>
                                    {ingredients.filter(ing => !ing.isOptional).map((ing) => (
                                        <div
                                            key={ing.id}
                                            onClick={() => toggleIngredient(ing.id)}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border relative group",
                                                checkedIngredients.has(ing.id)
                                                    ? "bg-muted text-muted-foreground border-transparent line-through opacity-60"
                                                    : "bg-card border-border hover:border-primary/50 shadow-sm"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                                                checkedIngredients.has(ing.id) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                                            )}>
                                                {checkedIngredients.has(ing.id) && <Check size={14} strokeWidth={3} />}
                                            </div>
                                            <span className="font-medium text-lg flex-1">
                                                {ing.amount > 0 && <span className="font-bold mr-1">{ing.amount.toLocaleString('de-DE')}</span>}
                                                {ing.unit && <span className="font-bold mr-1">{ing.unit}</span>}
                                                <span className={cn(ing.isSubstituted && "text-primary italic")}>{ing.name}</span>
                                                {ing.isSubstituted && (
                                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                                        <span className="text-xs text-muted-foreground line-through opacity-60">Original: {ing.originalName}</span>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                                                            Achtung! Ersetzt
                                                        </span>
                                                    </div>
                                                )}
                                            </span>
                                            {(() => {
                                                const conflictsForProduct = getConflictForProduct(recipe?.RecipeIngredients?.find(ri => ri.id === ing.id)?.ProductId);
                                                return conflictsForProduct && !ing.isSubstituted ? (
                                                    <div
                                                        className="z-10 p-2 -m-2 shrink-0"
                                                        onMouseEnter={(e) => handleTooltipShow(e, conflictsForProduct)}
                                                        onMouseLeave={handleTooltipHide}
                                                        onTouchStart={(e) => {
                                                            e.stopPropagation();
                                                            handleTooltipShow(e, conflictsForProduct);
                                                        }}
                                                        onTouchEnd={(e) => {
                                                            e.stopPropagation();
                                                            handleTooltipHide();
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <div className={cn(
                                                            "w-8 h-8 flex items-center justify-center rounded-full ring-1 transition-all",
                                                            conflictsForProduct.maxProbability >= 80 ? "text-destructive bg-destructive/10 animate-pulse ring-destructive/20" : "text-orange-500 bg-orange-500/10 ring-orange-500/20"
                                                        )}>
                                                            {conflictsForProduct.maxProbability >= 80 ? <AlertCircle size={18} /> : <HelpCircle size={18} />}
                                                        </div>
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>
                                    ))}
                                </div>

                                {ingredients.some(ing => ing.isOptional) && (
                                    <div className="space-y-2">
                                        <h3 className="font-bold text-xs uppercase tracking-[0.2em] text-muted-foreground/60 mb-2 px-1">Optionale Zutaten</h3>
                                        {ingredients.filter(ing => ing.isOptional).map((ing) => (
                                            <div
                                                key={ing.id}
                                                onClick={() => toggleIngredient(ing.id)}
                                                className={cn(
                                                    "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border relative group",
                                                    checkedIngredients.has(ing.id)
                                                        ? "bg-muted text-muted-foreground border-transparent line-through opacity-60"
                                                        : "bg-card border-border hover:border-primary/50 shadow-sm"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                                                    checkedIngredients.has(ing.id) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                                                )}>
                                                    {checkedIngredients.has(ing.id) && <Check size={14} strokeWidth={3} />}
                                                </div>
                                                <span className="font-medium text-lg flex-1">
                                                    {ing.amount > 0 && <span className="font-bold mr-1">{ing.amount.toLocaleString('de-DE')}</span>}
                                                    {ing.unit && <span className="font-bold mr-1">{ing.unit}</span>}
                                                    <span className={cn(ing.isSubstituted && "text-primary italic")}>{ing.name}</span>
                                                    {ing.isSubstituted && (
                                                        <div className="flex flex-col gap-0.5 mt-0.5">
                                                            <span className="text-xs text-muted-foreground line-through opacity-60">Original: {ing.originalName}</span>
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                                                                Achtung! Ersetzt
                                                            </span>
                                                        </div>
                                                    )}
                                                </span>
                                                {(() => {
                                                    const conflictsForProduct = getConflictForProduct(recipe?.RecipeIngredients?.find(ri => ri.id === ing.id)?.ProductId);
                                                    return conflictsForProduct && !ing.isSubstituted ? (
                                                        <div
                                                            className="z-10 p-2 -m-2 shrink-0"
                                                            onMouseEnter={(e) => handleTooltipShow(e, conflictsForProduct)}
                                                            onMouseLeave={handleTooltipHide}
                                                            onTouchStart={(e) => {
                                                                e.stopPropagation();
                                                                handleTooltipShow(e, conflictsForProduct);
                                                            }}
                                                            onTouchEnd={(e) => {
                                                                e.stopPropagation();
                                                                handleTooltipHide();
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <div className={cn(
                                                                "w-8 h-8 flex items-center justify-center rounded-full ring-1 transition-all",
                                                                conflictsForProduct.maxProbability >= 80 ? "text-destructive bg-destructive/10 animate-pulse ring-destructive/20" : "text-orange-500 bg-orange-500/10 ring-orange-500/20"
                                                            )}>
                                                                {conflictsForProduct.maxProbability >= 80 ? <AlertCircle size={18} /> : <HelpCircle size={18} />}
                                                            </div>
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT SIDE: Steps */}
                    <div className="flex-1 flex flex-col h-full relative bg-background overflow-hidden">

                        {/* Step Content */}
                        <div
                            className="flex-1 flex items-center justify-center p-8 md:p-16 overflow-y-auto"
                            onTouchStart={onTouchStart}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onTouchEnd}
                        >
                            <AnimatePresence mode="popLayout" custom={direction}>
                                <motion.div
                                    key={step}
                                    custom={direction}
                                    variants={variants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                                    className="max-w-3xl w-full space-y-8"
                                >
                                    <div className="flex items-center gap-4 text-primary font-bold uppercase tracking-widest text-sm mb-4">
                                        <span className="w-12 h-1 bg-primary/20 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
                                        </span>
                                        Schritt {step + 1} von {steps.length}
                                    </div>

                                    {/* Highlighted Step Text */}
                                    <div className={cn("font-medium transition-all duration-300 text-foreground Select-text leading-loose", getTextSizeClass())}>
                                        {stepFragments.map((frag, idx) => (
                                            frag.type === 'text' ? (
                                                <span key={idx}>{frag.text}</span>
                                            ) : (
                                                <span
                                                    key={idx}
                                                    onClick={() => toggleIngredient(frag.id)}
                                                    onMouseEnter={(e) => handleIngredientHover(e, frag.ingredient, recipe.RecipeIngredients?.find(ri => ri.id === frag.id)?.ProductId)}
                                                    onMouseLeave={handleIngredientLeave}
                                                    onTouchStart={(e) => handleIngredientHover(e, frag.ingredient, recipe.RecipeIngredients?.find(ri => ri.id === frag.id)?.ProductId)}
                                                    className={cn(
                                                        "px-1.5 py-0.5 rounded-md cursor-pointer transition-colors mx-0.5 border-b-2 border-primary/30 hover:border-primary",
                                                        checkedIngredients.has(frag.id)
                                                            ? "bg-secondary text-secondary-foreground line-through decoration-secondary-foreground/50 opacity-60 dark:bg-secondary/30 dark:text-secondary-foreground"
                                                            : (frag.ingredient.isSubstituted
                                                                ? "bg-amber-500 text-white font-bold shadow-md"
                                                                : "bg-primary text-primary-foreground font-bold shadow-md dark:bg-primary dark:text-primary-foreground")
                                                    )}
                                                >
                                                    {frag.ingredient.isSubstituted ? frag.ingredient.name : frag.text}
                                                    {frag.ingredient.isOptional && <span className="text-[0.6em] ml-1 opacity-70">(optional)</span>}
                                                </span>
                                            )
                                        ))}
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Navigation Bar (Safe Area Bottom) */}
                        <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] border-t border-border bg-card/50 backdrop-blur-sm flex items-center justify-between gap-4">
                            <Button
                                variant="secondary"
                                onClick={prevStep}
                                disabled={step === 0}
                                className="h-14 px-6 rounded-2xl text-lg flex-1 md:flex-none"
                            >
                                <ChevronLeft size={24} className="mr-2" /> Zurück
                            </Button>

                            <div className="hidden md:flex gap-1">
                                {steps.map((_, i) => (
                                    <div
                                        key={i}
                                        className={cn("w-2 h-2 rounded-full transition-colors", i === step ? "bg-primary" : "bg-muted")}
                                    />
                                ))}
                            </div>

                            <Button
                                onClick={step === steps.length - 1 ? onClose : nextStep}
                                className={cn(
                                    "h-14 px-8 rounded-2xl text-lg flex-1 md:flex-none shadow-xl",
                                    step === steps.length - 1 ? "bg-green-600 hover:bg-green-700 text-white" : "bg-primary text-primary-foreground"
                                )}
                            >
                                {step === steps.length - 1 ? (
                                    <span className="flex items-center">Fertig <Check size={24} className="ml-2" /></span>
                                ) : (
                                    <span className="flex items-center">Weiter <ChevronRight size={24} className="ml-2" /></span>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Ingredient Detail Tooltip */}
                <AnimatePresence>
                    {ingredientTooltip && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="fixed z-[300] p-3 bg-card/95 backdrop-blur-md text-card-foreground text-sm rounded-xl shadow-xl border border-border pointer-events-none transform -translate-x-1/2 -translate-y-full min-w-[150px]"
                            style={{
                                top: Math.max(10, Math.min(window.innerHeight - 100, ingredientTooltip.y)),
                                left: Math.max(80, Math.min(window.innerWidth - 80, ingredientTooltip.x)),
                            }}
                        >
                            <div className="font-bold text-lg whitespace-nowrap">
                                {Number(ingredientTooltip.ingredient.amount.toFixed(2)).toLocaleString('de-DE')} {ingredientTooltip.ingredient.unit}
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap opacity-80 mb-1">
                                {ingredientTooltip.ingredient.name}
                                {ingredientTooltip.ingredient.isOptional && <span className="ml-1 text-[10px]">(optional)</span>}
                            </div>
                        </motion.div>
                    )}

                    {/* List Hover Tooltip (Intolerances) */}
                    {tooltipData && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="fixed z-[300] w-64 p-4 bg-popover text-popover-foreground text-sm rounded-2xl shadow-2xl border border-border pointer-events-none"
                            style={{
                                top: tooltipData.y,
                                left: (tooltipData.x + 256 > window.innerWidth) ? (window.innerWidth - 270) : tooltipData.x,
                                ...(tooltipData.y + 200 > window.innerHeight ? { top: 'auto', bottom: 20 } : {})
                            }}
                        >
                            <div className={cn("font-bold mb-2 flex items-center gap-2", tooltipData.maxProbability >= 80 ? "text-destructive" : "text-orange-500")}>
                                {tooltipData.maxProbability >= 80 ? <AlertCircle size={16} /> : <HelpCircle size={16} />}
                                {tooltipData.maxProbability >= 80 ? 'Achtung!' : 'Hinweis'} ({tooltipData.maxProbability}%)
                            </div>
                            <div className="text-muted-foreground mb-2 text-xs">Unverträglichkeit erkannt:</div>
                            <ul className="space-y-1">
                                {tooltipData.items.map((msg, idx) => (
                                    <li key={idx} className={cn(
                                        "flex items-start gap-2 text-xs font-semibold p-2 rounded-lg border",
                                        tooltipData.maxProbability >= 80 ? "bg-destructive/5 text-destructive border-destructive/10" : "bg-orange-500/5 text-orange-500 border-orange-500/10"
                                    )}>
                                        <span>{msg}</span>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </AnimatePresence>
    );
}
