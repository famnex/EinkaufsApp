import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Check, Minus, Plus, Maximize2, Minimize2, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from './Button';
import { cn, getImageUrl } from '../lib/utils';
import api from '../lib/axios';
import CookingAssistant from './CookingAssistant';

export default function CookingMode({ recipe, onClose }) {
    const [step, setStep] = useState(0);
    const [checkedIngredients, setCheckedIngredients] = useState(new Set());
    const [textSize, setTextSize] = useState(1); // 0: Small, 1: Normal, 2: Large
    const [showIngredientsMobile, setShowIngredientsMobile] = useState(false); // For mobile toggle
    const [showAssistant, setShowAssistant] = useState(false);
    const [futureUsage, setFutureUsage] = useState({}); // { ingredientId: [{ date, recipeName }] }
    const [direction, setDirection] = useState(0);

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

    // Portal Tooltip State
    const [tooltipData, setTooltipData] = useState(null); // { x, y, items: [] }

    // Parse ingredients to ensure we handle the async fetched data structure
    const ingredients = recipe.RecipeIngredients?.map(ri => ({
        id: ri.id,
        productId: ri.ProductId, // IMPORTANT: Match by ProductId
        name: ri.Product?.name || 'Unknown',
        amount: ri.quantity,
        unit: ri.unit || ri.Product?.unit
    })) || [];

    const steps = recipe.instructions || [];

    // Fetch future usage
    useEffect(() => {
        const checkFutureUsage = async () => {
            try {
                // 1. Fetch Lists to find determining "Next Shopping Date"
                const { data: allLists } = await api.get('/lists');

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // Helper to get local YYYY-MM-DD
                const getLocalISODate = (d) => {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                // Find the closest list in the future (Date > Today)
                // API returns desc, so reverse or sort
                const futureLists = allLists
                    .filter(l => new Date(l.date) > today)
                    .sort((a, b) => new Date(a.date) - new Date(b.date));

                const nextShoppingList = futureLists[0];

                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                let end = new Date(today);
                if (nextShoppingList) {
                    // Range goes UNTIL the day before the shopping list (but API uses inclusive usually, or we filter)
                    // We set end date TO the list date.
                    end = new Date(nextShoppingList.date);
                } else {
                    // Fallback: 7 days if no list planned
                    end.setDate(end.getDate() + 7);
                }

                const startStr = getLocalISODate(tomorrow);
                const endStr = getLocalISODate(end);

                console.log(`[CookingMode] Warning Check Window: ${startStr} to ${endStr} (Next List: ${nextShoppingList?.date || 'None'})`);

                const { data: menus } = await api.get(`/menus?start=${startStr}&end=${endStr}`);

                const usageMap = {};

                for (const menu of menus) {
                    // Stop if we hit the shopping list date (just to be safe/precise)
                    // Also filter out any accidental "today" or past dates if API returns them
                    // (Though query params should handle it, we safeguard)
                    const menuDate = new Date(menu.date);
                    if (menuDate < tomorrow) continue;
                    if (nextShoppingList && menuDate >= new Date(nextShoppingList.date)) break;

                    if (!menu.Recipe || !menu.Recipe.RecipeIngredients) continue;

                    menu.Recipe.RecipeIngredients.forEach(ri => {
                        const pid = ri.ProductId;
                        if (!pid) return;

                        // Check if this product is in OUR current recipe
                        const isNeededNow = ingredients.some(i => i.productId === pid);

                        if (isNeededNow) {
                            if (!usageMap[pid]) usageMap[pid] = [];
                            usageMap[pid].push({
                                date: menu.date,
                                recipeName: menu.Recipe.title
                            });
                        }
                    });
                }
                setFutureUsage(usageMap);

            } catch (err) {
                console.error("Failed to check future usage", err);
            }
        };

        if (recipe) {
            checkFutureUsage();
        }
    }, [recipe]);


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

    // Tooltip Interaction Handlers
    const handleTooltipShow = (e, items) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipData({
            x: rect.right + 10, // Default to right
            y: rect.top,
            items: items,
            targetRect: rect // Store to adjust if off-screen
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
                className="fixed inset-0 z-[200] bg-background flex flex-col md:flex-row overflow-hidden select-none"
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
                        {/* Text Size Controls removed for desktop per request */}
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
                            <h3 className="font-bold text-lg uppercase tracking-wider text-muted-foreground">Zutaten</h3>
                            <div className="space-y-2">
                                {ingredients.map((ing, i) => (
                                    <div
                                        key={i}
                                        onClick={() => toggleIngredient(i)}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border relative group",
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
                                        <span className="font-medium text-lg flex-1">
                                            {ing.amount > 0 && <span className="font-bold mr-1">{ing.amount} {ing.unit}</span>}
                                            {ing.name}
                                        </span>

                                        {/* Future Usage Warning */}
                                        {futureUsage[ing.productId] && (
                                            <div
                                                className="relative z-10 p-2 -m-2"
                                                onMouseEnter={(e) => handleTooltipShow(e, futureUsage[ing.productId])}
                                                onMouseLeave={handleTooltipHide}
                                                onTouchStart={(e) => {
                                                    e.stopPropagation(); // Prevent card check logic
                                                    handleTooltipShow(e, futureUsage[ing.productId]);
                                                }}
                                                onTouchEnd={(e) => {
                                                    e.stopPropagation();
                                                    handleTooltipHide();
                                                }}
                                                onClick={(e) => e.stopPropagation()} // Prevent card check
                                            >
                                                <div className="w-8 h-8 flex items-center justify-center text-amber-500 bg-amber-500/10 rounded-full animate-pulse ring-1 ring-amber-500/20">
                                                    <AlertTriangle size={18} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
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

                                    <p className={cn("font-medium transition-all duration-300 text-foreground Select-text", getTextSizeClass())}>
                                        {steps[step]}
                                    </p>
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

                {/* AI Assistant FAB - Repositioned to be less intrusive */}
                <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowAssistant(true)}
                    className="fixed top-20 right-4 md:top-auto md:right-auto md:bottom-6 md:left-6 z-[100] w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-full shadow-lg flex items-center justify-center text-white border-2 border-white/20"
                >
                    <Sparkles size={20} />
                </motion.button>

                <CookingAssistant
                    isOpen={showAssistant}
                    onClose={() => setShowAssistant(false)}
                    recipe={recipe}
                />

                {/* --- FIXED TOOLTIP LAYER --- */}
                <AnimatePresence>
                    {tooltipData && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="fixed z-[300] w-64 p-4 bg-popover text-popover-foreground text-sm rounded-2xl shadow-2xl border border-border pointer-events-none"
                            style={{
                                top: tooltipData.y,
                                // Smart positioning: Flip to left if too close to right edge
                                left: (tooltipData.x + 256 > window.innerWidth)
                                    ? (window.innerWidth - 270) // 16px padding + width
                                    : tooltipData.x,
                                // Vertically: Flip up if close to bottom (simplified check)
                                ...(tooltipData.y + 200 > window.innerHeight ? { top: 'auto', bottom: 20 } : {})
                            }}
                        >
                            <div className="font-bold mb-2 text-amber-500 flex items-center gap-2">
                                <AlertTriangle size={16} /> Aufgepasst!
                            </div>
                            <div className="text-muted-foreground mb-2">Wird bis zum nächsten Einkauf nochmal gebraucht:</div>
                            <ul className="space-y-1">
                                {tooltipData.items.map((u, idx) => (
                                    <li key={idx} className="flex gap-2 text-xs font-medium bg-muted/50 p-1.5 rounded-lg">
                                        <span className="text-foreground shrink-0 w-10">{new Date(u.date).toLocaleDateString('de-DE', { weekday: 'short' })}</span>
                                        <span className="truncate">{u.recipeName}</span>
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
