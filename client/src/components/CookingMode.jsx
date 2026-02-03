import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Check, Minus, Plus, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from './Button';
import { cn, getImageUrl } from '../lib/utils';

export default function CookingMode({ recipe, onClose }) {
    const [step, setStep] = useState(0);
    const [checkedIngredients, setCheckedIngredients] = useState(new Set());
    const [textSize, setTextSize] = useState(1); // 0: Small, 1: Normal, 2: Large
    const [showIngredientsMobile, setShowIngredientsMobile] = useState(false); // For mobile toggle

    // Parse ingredients to ensure we handle the async fetched data structure
    const ingredients = recipe.RecipeIngredients?.map(ri => ({
        id: ri.id,
        name: ri.Product?.name || 'Unknown',
        amount: ri.quantity,
        unit: ri.unit || ri.Product?.unit
    })) || [];

    const steps = recipe.instructions || [];

    const toggleIngredient = (id) => {
        const next = new Set(checkedIngredients);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setCheckedIngredients(next);
    };

    const nextStep = () => {
        if (step < steps.length - 1) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 0) setStep(step - 1);
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') nextStep();
            if (e.key === 'ArrowLeft') prevStep();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [step]);

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

    const getTextSizeClass = () => {
        switch (textSize) {
            case 0: return 'text-base';
            case 1: return 'text-xl';
            case 2: return 'text-3xl leading-relaxed';
            default: return 'text-xl';
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-[200] bg-background flex flex-col md:flex-row overflow-hidden"
            >
                {/* Close Button & Controls (Top Right Overlay) - Desktop Only */}
                <div className="absolute top-4 right-4 z-50 hidden md:flex gap-2">
                    <div className="bg-card/80 backdrop-blur border border-border rounded-full p-1 flex items-center gap-1 shadow-lg">
                        <button onClick={() => setTextSize(Math.max(0, textSize - 1))} className="p-2 hover:bg-muted rounded-full w-8 h-8 flex items-center justify-center"><Minus size={16} /></button>
                        <span className="text-xs font-bold w-4 text-center">A</span>
                        <button onClick={() => setTextSize(Math.min(2, textSize + 1))} className="p-2 hover:bg-muted rounded-full w-8 h-8 flex items-center justify-center"><Plus size={16} /></button>
                    </div>
                    <Button variant="secondary" onClick={onClose} className="rounded-full w-12 h-12 p-0 shadow-lg">
                        <X size={24} />
                    </Button>
                </div>

                {/* LEFT SIDE: Info & Ingredients */}
                <div className={cn(
                    "w-full md:w-1/3 bg-muted/30 border-r border-border flex flex-col h-full transition-transform duration-300 absolute md:relative z-20 md:translate-x-0",
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
                            <h2 className="text-2xl font-bold leading-tight">{recipe.title}</h2>
                            <p className="opacity-80 text-sm">{recipe.servings} Portionen • {recipe.duration} Min</p>
                        </div>

                        {/* Mobile Close Ingredients Button (Overlay on Image) */}
                        <div className="absolute top-4 right-4 md:hidden">
                            <Button size="icon" variant="secondary" className="rounded-full h-10 w-10 shadow-lg" onClick={() => setShowIngredientsMobile(false)}>
                                <X size={20} />
                            </Button>
                        </div>
                    </div>

                    {/* Ingredients List */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <h3 className="font-bold text-lg uppercase tracking-wider text-muted-foreground">Zutaten</h3>
                        <div className="space-y-2">
                            {ingredients.map((ing, i) => (
                                <div
                                    key={i}
                                    onClick={() => toggleIngredient(i)}
                                    className={cn(
                                        "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border",
                                        checkedIngredients.has(i)
                                            ? "bg-muted text-muted-foreground border-transparent line-through opacity-60"
                                            : "bg-card border-border hover:border-primary/50 shadow-sm"
                                    )}
                                >
                                    <div className={cn(
                                        "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                                        checkedIngredients.has(i) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                                    )}>
                                        {checkedIngredients.has(i) && <Check size={14} strokeWidth={3} />}
                                    </div>
                                    <span className="font-medium text-lg">
                                        {ing.amount > 0 && <span className="font-bold mr-1">{ing.amount} {ing.unit}</span>}
                                        {ing.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDE: Steps */}
                <div className="flex-1 flex flex-col h-full relative bg-background">
                    {/* Mobile Header (When ingredients hidden) */}
                    <div className="md:hidden flex flex-col border-b border-border bg-background z-40">
                        {/* Top Row: Title & Close */}
                        <div className="flex items-center justify-between p-4 pb-2">
                            <h3 className="font-bold truncate pr-4 text-lg">{recipe.title}</h3>
                            <Button variant="ghost" size="icon" onClick={onClose} className="-mr-2">
                                <X size={24} />
                            </Button>
                        </div>

                        {/* Bottom Row: Actions */}
                        <div className="flex items-center justify-between px-4 pb-4">
                            <Button variant="outline" size="sm" onClick={() => setShowIngredientsMobile(true)}>
                                Zutaten ({ingredients.length})
                            </Button>

                            {/* Text Size (Mini Version) */}
                            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                                <button onClick={() => setTextSize(Math.max(0, textSize - 1))} className="w-8 h-8 flex items-center justify-center hover:bg-background rounded-md"><Minus size={14} /></button>
                                <span className="text-xs font-bold w-4 text-center">Aa</span>
                                <button onClick={() => setTextSize(Math.min(2, textSize + 1))} className="w-8 h-8 flex items-center justify-center hover:bg-background rounded-md"><Plus size={14} /></button>
                            </div>
                        </div>
                    </div>

                    {/* Step Content */}
                    <div className="flex-1 flex items-center justify-center p-8 md:p-16 overflow-y-auto">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={step}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="max-w-3xl w-full space-y-8"
                            >
                                <div className="flex items-center gap-4 text-primary font-bold uppercase tracking-widest text-sm mb-4">
                                    <span className="w-12 h-1 bg-primary/20 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
                                    </span>
                                    Schritt {step + 1} von {steps.length}
                                </div>

                                <p className={cn("font-medium transition-all duration-300 text-foreground", getTextSizeClass())}>
                                    {steps[step]}
                                </p>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Navigation Bar */}
                    <div className="p-6 border-t border-border bg-card/50 backdrop-blur-sm flex items-center justify-between gap-4">
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
            </motion.div>
        </AnimatePresence>
    );
}
