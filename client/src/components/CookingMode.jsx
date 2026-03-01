import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Check, Minus, Plus, Maximize2, Minimize2, AlertTriangle, AlertCircle, HelpCircle, Sparkles, Share2, Mic, Lock } from 'lucide-react';
import { Button } from './Button';
import { cn, getImageUrl } from '../lib/utils';
import api from '../lib/axios';
import CookingAssistant from './CookingAssistant';
import { useAuth } from '../contexts/AuthContext';
import ShareConfirmationModal from './ShareConfirmationModal';
import { sortIngredientsBySteps, findIngredientsInText, findTimesInText } from '../lib/recipe-parser';
import TimerOverlay from './TimerOverlay';
import AiActionConfirmModal from './AiActionConfirmModal';
import SubscriptionModal from './SubscriptionModal';
import CookingExitModal from './CookingExitModal';
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import AiLockedModal from './AiLockedModal';

export default function CookingMode({ recipe, conflicts = [], onClose }) {
    const [step, setStep] = useState(0);
    const [checkedIngredients, setCheckedIngredients] = useState(new Set());
    const [textSize, setTextSize] = useState(1); // 0: Small, 1: Normal, 2: Large
    const [showIngredientsMobile, setShowIngredientsMobile] = useState(true); // For mobile toggle
    const [showAssistant, setShowAssistant] = useState(false);
    const [assistantStatus, setAssistantStatus] = useState({ isListening: false, isStandby: false });
    const { user, refreshUser } = useAuth();
    const [futureUsage, setFutureUsage] = useState({}); // { ingredientId: [{ date, recipeName }] }
    const [direction, setDirection] = useState(0);
    const [timers, setTimers] = useState([]); // [{ id, label, duration, remaining, isRunning }]

    useLockBodyScroll(true);
    const [scaleFactor, setScaleFactor] = useState(1);
    const audioContextRef = useRef(null);

    // AI Voice Control State
    const [substitutions, setSubstitutions] = useState({}); // { "Original Name": "New Name" }

    // Subscription & AI Credits
    const [aiConfirmModalOpen, setAiConfirmModalOpen] = useState(false);
    const [aiActionData, setAiActionData] = useState(null);
    const [hasPaidForAi, setHasPaidForAi] = useState(false);
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const [isAiLockedOpen, setIsAiLockedOpen] = useState(false);

    // Swipe Logic for Steps
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const minSwipeDistance = 50;

    const [isImageExpanded, setIsImageExpanded] = useState(false);

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
    const [tooltipData, setTooltipData] = useState(null); // { x, y, items: [], maxProbability: number }

    // Parse ingredients to ensure we handle the async fetched data structure
    const rawIngredients = useMemo(() => recipe.RecipeIngredients?.map(ri => {
        const originalName = ri.Product?.name || 'Unknown';
        const sub = substitutions[originalName];

        // Parse synonyms safely (may be JSON string or array)
        let synonyms = ri.Product?.synonyms || [];
        if (typeof synonyms === 'string') { try { synonyms = JSON.parse(synonyms); } catch { synonyms = []; } }

        return {
            id: ri.id,
            productId: ri.ProductId,
            name: sub ? sub.name : originalName,
            originalName: originalName,
            isSubstituted: !!sub,
            amount: (sub && sub.quantity !== null ? sub.quantity : ri.quantity) * scaleFactor,
            unit: (sub && sub.unit) ? sub.unit : (ri.unit || ri.Product?.unit),
            synonyms: Array.isArray(synonyms) ? synonyms : []
        };
    }) || [], [recipe, substitutions, scaleFactor]);

    const steps = recipe.instructions || [];

    // --- NEW: Sort Ingredients by Appearance ---
    const ingredients = useMemo(() => {
        return sortIngredientsBySteps(rawIngredients, steps);
    }, [rawIngredients, steps]);

    // Precompute cumulative occurrence offsets per step so duplicate ingredients
    // are mapped to the correct list entry (1st text occurrence → 1st ingredient, etc.)
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

        const { matches: ingredientMatches } = findIngredientsInText(currentText, ingredients, occurrencesByStep[step] || {});
        const timeMatches = findTimesInText(currentText);

        const allMatches = [
            ...ingredientMatches.map(m => ({ ...m, category: 'ingredient' })),
            ...timeMatches.map(m => ({ ...m, category: 'time' }))
        ].sort((a, b) => a.index - b.index);

        // Filter overlapping matches (prefer ingredients over times if they overlap, though rare)
        const filteredMatches = [];
        let lastEnd = 0;
        allMatches.forEach(match => {
            if (match.index >= lastEnd) {
                filteredMatches.push(match);
                lastEnd = match.index + match.length;
            }
        });

        const fragments = [];
        let currentIndex = 0;

        filteredMatches.forEach(match => {
            // Text before match
            if (match.index > currentIndex) {
                fragments.push({
                    text: currentText.substring(currentIndex, match.index),
                    type: 'text'
                });
            }

            // The match itself
            if (match.category === 'ingredient') {
                fragments.push({
                    text: match.matchedText,
                    type: 'ingredient',
                    ingredient: match.ingredient,
                    id: match.ingredientId
                });
            } else {
                fragments.push({
                    text: match.matchedText,
                    type: 'time',
                    label: match.label,
                    totalSeconds: match.totalSeconds
                });
            }

            currentIndex = match.index + match.length;
        });

        // Remaining text
        if (currentIndex < currentText.length) {
            fragments.push({
                text: currentText.substring(currentIndex),
                type: 'text'
            });
        }

        return fragments;
    }, [step, steps, ingredients, occurrencesByStep]);

    const getConflictForProduct = useCallback((productId) => {
        if (!productId || !conflicts || conflicts.length === 0) return null;

        // Filter conflicts for this product (handle Number vs String)
        const productConflicts = conflicts.filter(c => Number(c.productId) === Number(productId));
        if (productConflicts.length === 0) return null;

        const messages = [];
        let maxProb = 0;
        productConflicts.forEach(pc => {
            if (pc.warnings && Array.isArray(pc.warnings)) {
                pc.warnings.forEach(w => {
                    const householdName = (pc.username && pc.username !== user?.username) ? ` (${pc.username})` : '';
                    messages.push(`🛑 Unverträglichkeit: ${w.message}${householdName}`);
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
    }, [conflicts, user]);

    useEffect(() => {
        const checkFutureUsage = async () => {
            try {
                // 1. Fetch Lists to find determining "Next Shopping Date"
                const { data: allLists } = await api.get('/lists');

                // Helper to get local YYYY-MM-DD
                const getLocalISODate = (d) => {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                const today = new Date();
                const todayStr = getLocalISODate(today);

                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = getLocalISODate(tomorrow);

                // Find the closest list in the future (Date > Today)
                const futureLists = allLists
                    .filter(l => l.date > todayStr)
                    .sort((a, b) => a.date.localeCompare(b.date));

                const nextShoppingList = futureLists[0];

                let endStr;
                if (nextShoppingList) {
                    endStr = nextShoppingList.date;
                } else {
                    // Fallback: 7 days if no list planned
                    const fallbackEnd = new Date(today);
                    fallbackEnd.setDate(fallbackEnd.getDate() + 7);
                    endStr = getLocalISODate(fallbackEnd);
                }

                console.log(`[CookingMode] Warning Check Window: ${tomorrowStr} to ${endStr} (Next List: ${nextShoppingList?.date || 'None'})`);

                const { data: menus } = await api.get(`/menus?start=${tomorrowStr}&end=${endStr}`);

                const usageMap = {};

                for (const menu of menus) {
                    // Safety: ignore everything <= today or >= next list date
                    if (menu.date <= todayStr) continue;
                    if (nextShoppingList && menu.date >= nextShoppingList.date) break;

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
                                recipeName: menu.Recipe.title,
                                quantity: ri.quantity,
                                unit: ri.unit
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
    }, [recipe]); // Note: removed ingredients dep to avoid loop if object ref changes, handled by memo

    useEffect(() => {
        if (recipe?.id) {
            fetchSavedSubstitutions();
        }
    }, [recipe?.id]);

    const fetchSavedSubstitutions = async () => {
        try {
            const { data } = await api.get(`/substitutions/recipe/${recipe.id}`);
            const subMap = {};
            data.forEach(sub => {
                if (sub.OriginalProduct?.name && sub.SubstituteProduct?.name) {
                    subMap[sub.OriginalProduct.name] = {
                        name: sub.SubstituteProduct.name,
                        quantity: sub.substituteQuantity,
                        unit: sub.substituteUnit
                    };
                }
            });
            setSubstitutions(prev => ({ ...prev, ...subMap }));
        } catch (err) {
            console.error('Failed to fetch saved substitutions', err);
        }
    };


    // iOS Audio: Create and keep a single shared AudioContext.
    // It must be resumed on every user gesture to stay unlocked.
    useEffect(() => {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext && !audioContextRef.current) {
            audioContextRef.current = new AudioContext();
            console.log('[CookingMode] AudioContext created, state:', audioContextRef.current.state);
        }
        return () => {
            // Don't close – TimerOverlay may still need it briefly after unmount
        };
    }, []);

    // Helper to resume AudioContext synchronously during a user gesture.
    // Call this at the start of every click/tap handler.
    const resumeAudio = useCallback(() => {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
    }, []);

    const toggleIngredient = (id) => {
        resumeAudio(); // iOS: keep AudioContext alive
        const next = new Set(checkedIngredients);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setCheckedIngredients(next);
    };

    const nextStep = () => {
        resumeAudio();
        if (step < steps.length - 1) {
            setDirection(1);
            setStep(step + 1);
        }
    };

    const prevStep = () => {
        resumeAudio();
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
    const handleTooltipShow = (e, conflict) => {
        const rect = e.currentTarget.getBoundingClientRect();
        // Check if conflict is an array (future usage) or object (intolerances)
        const isIntolerance = conflict && !Array.isArray(conflict) && conflict.messages;

        setTooltipData({
            x: rect.right + 10, // Default to right
            y: rect.top,
            items: isIntolerance ? conflict.messages : conflict,
            maxProbability: isIntolerance ? conflict.maxProbability : null,
            targetRect: rect // Store to adjust if off-screen
        });
    };

    // NEW: Tooltip for Ingredient details in Steps
    const [ingredientTooltip, setIngredientTooltip] = useState(null); // { x, y, ingredient }
    const leaveTimeoutRef = useRef(null);

    const handleIngredientHover = (e, ing) => {
        if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
        const rect = e.currentTarget.getBoundingClientRect();
        setIngredientTooltip({
            x: rect.left + (rect.width / 2),
            y: rect.top - 10, // Above
            ingredient: ing,
            conflicts: ing.productId ? getConflictForProduct(ing.productId) : null
        });
    };

    const handleIngredientLeave = () => {
        leaveTimeoutRef.current = setTimeout(() => {
            setIngredientTooltip(null);
        }, 100);
    };

    const handleTooltipHide = () => {
        setTooltipData(null);
    };

    const handleTimeClick = (text, seconds, label) => {
        const newTimer = {
            id: Date.now(),
            label: label || text,
            duration: seconds,
            remaining: seconds,
            isRunning: true
        };
        setTimers(prev => [...prev, newTimer]);
    };

    const updateTimer = (id, updates) => {
        setTimers(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    };

    const deleteTimer = (id) => {
        setTimers(prev => prev.filter(t => t.id !== id));
    };

    const handleVoiceAction = (action) => {
        if (!action) return;
        switch (action.type) {
            case 'NEXT_STEP':
                nextStep();
                break;
            case 'PREV_STEP':
                prevStep();
                break;
            case 'GOTO_STEP':
                if (action.payload?.index !== undefined) {
                    const idx = Math.max(0, Math.min(steps.length - 1, action.payload.index));
                    setDirection(idx > step ? 1 : -1);
                    setStep(idx);
                }
                break;
            case 'SCALE':
                if (action.payload?.factor) {
                    setScaleFactor(action.payload.factor);
                }
                break;
            case 'SUBSTITUTE':
                if (action.payload?.original && action.payload?.replacement) {
                    setSubstitutions(prev => ({
                        ...prev,
                        [action.payload.original]: action.payload.replacement
                    }));
                }
                break;
            case 'START_TIMER':
                if (action.payload?.seconds) {
                    handleTimeClick(
                        action.payload.text || `${Math.floor(action.payload.seconds / 60)} Min`,
                        action.payload.seconds,
                        action.payload.label
                    );
                }
                break;
            default:
                break;
        }
    };

    // Share Logic Consolidation
    const [shareModalConfig, setShareModalConfig] = useState(null);
    const { setUser } = useAuth(); // Ensure we can update user state locally if needed

    const executeShare = async (title, text, url) => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title,
                    text,
                    url
                });
            } catch (err) {
                console.error('Error sharing', err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(`${text}: ${url}`); // Modified to copy text+url for clipboard fallback compatibility
                alert('Link in Zwischenablage kopiert!');
            } catch (err) {
                console.error('Failed to copy', err);
                alert('Link konnte nicht kopiert werden.');
            }
        }
    };

    const handleShareRequest = () => {
        if (!user || !user.sharingKey) {
            alert('Kein Sharing-Key gefunden. Bitte in den Einstellungen generieren.');
            return;
        }

        const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL}shared/${user.sharingKey}/recipe/${recipe.id}`.replace(/\/\//g, '/').replace('http:/', 'http://').replace('https:/', 'https://');
        const shareTitle = recipe.title;
        const shareText = `Probier mal dieses Rezept: ${recipe.title}`;

        if (user.isPublicCookbook) {
            executeShare(shareTitle, shareText, shareUrl);
        } else {
            setShareModalConfig({ title: shareTitle, text: shareText, url: shareUrl });
        }
    };

    const handleConfirmShare = async () => {
        if (!shareModalConfig) return;
        try {
            await api.put('/auth/profile', { isPublicCookbook: true });
            if (user && setUser) {
                setUser({ ...user, isPublicCookbook: true });
            }
            executeShare(shareModalConfig.title, shareModalConfig.text, shareModalConfig.url);
        } catch (err) {
            console.error('Failed to enable public cookbook', err);
            alert('Fehler beim Aktivieren.');
        } finally {
            setShareModalConfig(null);
        }
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
                        <div className="flex items-center gap-2">
                            <Button size="sm" onClick={handleShareRequest} className="bg-secondary text-secondary-foreground hover:bg-secondary/90 px-4">
                                <Share2 size={20} />
                            </Button>
                            <Button size="sm" onClick={() => setIsExitModalOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4">
                                <X size={20} />
                            </Button>
                        </div>
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
                        <Button onClick={handleShareRequest} className="rounded-full w-12 h-12 p-0 shadow-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 border-none">
                            <Share2 size={24} />
                        </Button>
                        <Button onClick={() => setIsExitModalOpen(true)} className="rounded-full w-12 h-12 p-0 shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 border-none">
                            <X size={24} />
                        </Button>
                    </div>

                    {/* LEFT SIDE: Info & Ingredients */}
                    <div className={cn(
                        "w-full md:w-1/3 bg-muted/30 border-r border-border flex flex-col h-full transition-transform duration-300 absolute md:relative z-20 md:translate-x-0 inset-0 md:inset-auto",
                        showIngredientsMobile ? "translate-x-0 bg-background" : "-translate-x-full md:translate-x-0"
                    )}>
                        {/* Header Image */}
                        <motion.div
                            animate={{ height: isImageExpanded ? 'auto' : (window.innerWidth < 768 ? 192 : 256) }}
                            transition={{ type: "spring", stiffness: 300, damping: 35 }}
                            className="relative shrink-0 cursor-pointer overflow-hidden group bg-black/10"
                            onClick={() => setIsImageExpanded(!isImageExpanded)}
                        >
                            {recipe.image_url ? (
                                <img
                                    src={getImageUrl(recipe.image_url)}
                                    className="absolute inset-0 w-full h-full object-cover object-center"
                                />
                            ) : (
                                <div className="absolute inset-0 w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-xs uppercase tracking-widest font-bold">Kein Bild</div>
                            )}

                            {/* Stable spacer for smooth animation */}
                            <div className="w-full opacity-0 pointer-events-none">
                                {recipe.image_url ? (
                                    <img
                                        src={getImageUrl(recipe.image_url)}
                                        className="w-full h-auto"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <div className="h-64" />
                                )}
                            </div>

                            <div
                                className={cn(
                                    "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-700",
                                    isImageExpanded ? "opacity-30" : "opacity-100"
                                )}
                            />
                            <div className="absolute bottom-4 left-4 right-4 text-white">
                                <h2 className="hidden md:block text-2xl font-bold leading-tight drop-shadow-md">{recipe.title}</h2>
                                <p className="opacity-90 text-sm font-medium drop-shadow-sm">
                                    {(recipe.servings * scaleFactor).toLocaleString('de-DE')} Portionen • {recipe.duration} Min
                                    {scaleFactor !== 1 && <span className="ml-2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-sm">Skaliert {scaleFactor}x</span>}
                                </p>
                            </div>

                            {/* Expand/Collapse Hint */}
                            <div className="absolute top-4 left-4 p-2 bg-black/20 backdrop-blur-md rounded-full text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                                {isImageExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                            </div>
                        </motion.div>

                        {/* Ingredients List */}
                        <div
                            className="flex-1 overflow-y-auto p-6 space-y-4 pb-24 md:pb-6"
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                        >
                            <h3 className="font-bold text-lg uppercase tracking-wider text-muted-foreground">Zutaten</h3>
                            <div className="space-y-2">
                                {ingredients.map((ing) => ( // Note: we use ing.id for key ideally
                                    <div
                                        key={ing.id} // Changed to ID from index for safety with sorting
                                        onClick={() => toggleIngredient(ing.id)} // Use ID
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border relative group",
                                            checkedIngredients.has(ing.id) // Use ID
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
                                            {ing.amount > 0 && <span className={cn("font-bold mr-1", scaleFactor !== 1 && "text-primary")}>
                                                {Number(ing.amount.toFixed(2)).toLocaleString('de-DE')} {ing.unit}
                                            </span>}
                                            <span className={cn(ing.isSubstituted && "text-primary italic")}>{ing.name}</span>
                                            {ing.isSubstituted && (
                                                <div className="flex flex-col gap-0.5 mt-0.5">
                                                    <span className="text-xs text-muted-foreground line-through opacity-60">Original: {ing.originalName}</span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                                                        <Sparkles size={10} className="fill-current" /> Ersetzt
                                                    </span>
                                                </div>
                                            )}
                                        </span>

                                        {/* Future Usage Warning */}
                                        {futureUsage[ing.productId] && (
                                            <div
                                                className="z-10 p-2 -m-2 shrink-0"
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

                                        {/* Intolerance Warning */}
                                        {(() => {
                                            const conflict = getConflictForProduct(ing.productId);
                                            return conflict && !ing.isSubstituted && (
                                                <div
                                                    className="z-10 p-2 -m-2 shrink-0"
                                                    onMouseEnter={(e) => handleTooltipShow(e, conflict)}
                                                    onMouseLeave={handleTooltipHide}
                                                    onTouchStart={(e) => {
                                                        e.stopPropagation();
                                                        handleTooltipShow(e, conflict);
                                                    }}
                                                    onTouchEnd={(e) => {
                                                        e.stopPropagation();
                                                        handleTooltipHide();
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className={cn(
                                                        "w-8 h-8 flex items-center justify-center rounded-full ring-1 transition-all",
                                                        conflict.maxProbability >= 80 ? "text-destructive bg-destructive/10 animate-pulse ring-destructive/20" : "text-orange-500 bg-orange-500/10 ring-orange-500/20"
                                                    )}>
                                                        {conflict.maxProbability >= 80 ? <AlertCircle size={18} /> : <HelpCircle size={18} />}
                                                    </div>
                                                </div>
                                            );
                                        })()}
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

                                    {/* Highlighted Step Text */}
                                    <div className={cn("font-medium transition-all duration-300 text-foreground Select-text leading-loose", getTextSizeClass())}>
                                        {stepFragments.map((frag, idx) => (
                                            frag.type === 'text' ? (
                                                <span key={idx}>{frag.text}</span>
                                            ) : frag.type === 'ingredient' ? (
                                                <span
                                                    key={idx}
                                                    onClick={(e) => handleIngredientHover(e, frag.ingredient)}
                                                    onMouseEnter={(e) => handleIngredientHover(e, frag.ingredient)}
                                                    onMouseLeave={handleIngredientLeave}
                                                    className={cn(
                                                        "px-1.5 py-0.5 rounded-md cursor-pointer transition-colors mx-0.5 border-b-2 border-primary/40 hover:border-primary shadow-sm",
                                                        checkedIngredients.has(frag.id)
                                                            ? "bg-secondary text-secondary-foreground line-through decoration-secondary-foreground/60 opacity-60 dark:bg-secondary/40 dark:text-secondary-foreground"
                                                            : (frag.ingredient.isSubstituted
                                                                ? "bg-amber-500 text-white font-black shadow-md"
                                                                : "bg-primary text-primary-foreground font-black shadow-md dark:bg-primary dark:text-primary-foreground")
                                                    )}
                                                >
                                                    {frag.ingredient.isSubstituted ? frag.ingredient.name : frag.text}
                                                </span>
                                            ) : (
                                                <span
                                                    key={idx}
                                                    onClick={() => handleTimeClick(frag.text, frag.totalSeconds, frag.label)}
                                                    className="px-1.5 py-0.5 rounded-md cursor-pointer transition-colors ml-[5px] mx-0.5 border-b-2 border-secondary/40 hover:border-secondary shadow-sm bg-secondary text-secondary-foreground font-black shadow-md dark:bg-secondary dark:text-secondary-foreground"
                                                >
                                                    {frag.text}
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
                                onClick={step === steps.length - 1 ? () => setIsExitModalOpen(true) : nextStep}
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

                {/* AI Assistant Toggle Button - visible for all tiers, locked for Plastikgabel */}
                {user?.tier !== 'Plastikgabel' ? (
                    <motion.button
                        initial={{ scale: 0 }}
                        animate={{
                            scale: 1,
                            boxShadow: (assistantStatus.isListening || assistantStatus.isStandby)
                                ? ["0 0 0 0px rgba(139, 92, 246, 0.4)", "0 0 0 15px rgba(139, 92, 246, 0)"]
                                : "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
                        }}
                        transition={(assistantStatus.isListening || assistantStatus.isStandby) ? {
                            boxShadow: {
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "easeOut"
                            }
                        } : {}}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                            resumeAudio();
                            if (showAssistant) {
                                setShowAssistant(false);
                                return;
                            }

                            // 1. Tier Check - Handled by visibility wrapper, but keeping for safety if triggered via key
                            if (user?.tier === 'Plastikgabel') return;

                            // 2. Credit Confirmation (if Silbergabel)
                            if (user?.tier === 'Silbergabel' && !hasPaidForAi) {
                                setAiActionData({
                                    type: 'COOKING_SESSION',
                                    title: 'KI Koch-Assistent',
                                    description: 'Aktiviere den KI-Assistenten für dieses Rezept. Die Kosten fallen nur einmalig pro Kochvorgang an.',
                                    cost: 10,
                                    onConfirm: async () => {
                                        try {
                                            await api.post('/ai/deduct', {
                                                type: 'COOKING_SESSION',
                                                description: `KI Assistent: ${recipe.title}`
                                            });
                                            setHasPaidForAi(true);
                                            setShowAssistant(true);
                                            refreshUser();
                                        } catch (err) {
                                            alert(err.response?.data?.error || "Fehler beim Abbuchen der Coins");
                                        }
                                    }
                                });
                                setAiConfirmModalOpen(true);
                                return;
                            }

                            // 3. Free for Goldgabel
                            setShowAssistant(true);
                        }}
                        className={cn(
                            "fixed top-[calc(120px+env(safe-area-inset-top))] right-4 md:top-auto md:right-auto md:bottom-6 md:left-6 z-[100] w-12 h-12 rounded-full flex items-center justify-center text-white border-2 border-white/20 transition-colors",
                            (assistantStatus.isListening || assistantStatus.isStandby)
                                ? "bg-gradient-to-br from-red-500 via-purple-600 to-indigo-600"
                                : "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg"
                        )}
                    >
                        {assistantStatus.isListening ? <Mic size={20} className="animate-pulse" /> : <Sparkles size={20} />}
                        {user?.tier === 'Silbergabel' && !hasPaidForAi && (
                            <div className="absolute -top-1 -right-1 bg-white text-primary text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-sm border border-primary/20">
                                10
                            </div>
                        )}
                    </motion.button>
                ) : (
                    <motion.button
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        title="KI Koch-Assistent (ab Silbergabel)"
                        onClick={() => setIsAiLockedOpen(true)}
                        className="fixed top-[calc(120px+env(safe-area-inset-top))] right-4 md:bottom-6 md:left-6 md:top-auto md:right-auto z-[100] w-12 h-12 rounded-full flex items-center justify-center bg-muted/80 text-muted-foreground border-2 border-border shadow-lg hover:bg-muted transition-colors"
                    >
                        <Sparkles size={20} />
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-background border border-border rounded-full flex items-center justify-center shadow-sm">
                            <Lock size={10} className="text-muted-foreground" />
                        </div>
                    </motion.button>
                )}

                <CookingAssistant
                    isOpen={showAssistant}
                    onClose={() => setShowAssistant(false)}
                    recipe={recipe}
                    currentStep={step}
                    servings={recipe.servings * scaleFactor}
                    onAction={handleVoiceAction}
                    audioContext={audioContextRef.current}
                    hasActiveAlarm={timers.some(t => t.remaining === 0 && t.isRunning)}
                    onStatusChange={setAssistantStatus}
                />

                <TimerOverlay
                    timers={timers}
                    onUpdate={updateTimer}
                    onDelete={deleteTimer}
                    audioContext={audioContextRef.current}
                />

                {/* --- FIXED TOOLTIP LAYER --- */}
                <AnimatePresence>
                    {/* Future Usage Tooltip */}
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
                            {tooltipData.items[0]?.recipeName ? (
                                <>
                                    <div className="font-bold mb-2 text-amber-500 flex items-center gap-2">
                                        <AlertTriangle size={16} /> Aufgepasst!
                                    </div>
                                    <div className="text-muted-foreground mb-2 text-xs">Wird bis zum nächsten Einkauf nochmal gebraucht:</div>
                                    <ul className="space-y-1">
                                        {tooltipData.items.map((u, idx) => (
                                            <li key={idx} className="flex flex-col gap-0.5 text-xs font-medium bg-muted/50 p-2 rounded-lg">
                                                <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase tracking-widest">
                                                    <span>{new Date(u.date).toLocaleDateString('de-DE', { weekday: 'short' })}</span>
                                                    <span className="text-amber-500 font-bold">{u.quantity} {u.unit}</span>
                                                </div>
                                                <span className="truncate text-foreground font-semibold">{u.recipeName}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            ) : (
                                <>
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
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* Ingredient Detail Tooltip */}
                    {ingredientTooltip && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            onMouseEnter={() => {
                                if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
                            }}
                            onMouseLeave={handleIngredientLeave}
                            className="fixed z-[300] p-4 bg-card/95 backdrop-blur-md text-card-foreground text-sm rounded-2xl shadow-2xl border border-border flex items-center gap-4 transform -translate-x-1/2 -translate-y-[calc(100%+12px)]"
                            style={{
                                top: ingredientTooltip.y,
                                left: ingredientTooltip.x,
                            }}
                        >
                            <div className="flex-1">
                                <div className="font-bold text-lg whitespace-nowrap">
                                    {Number(ingredientTooltip.ingredient.amount.toFixed(2)).toLocaleString('de-DE')} {ingredientTooltip.ingredient.unit}
                                </div>
                                <div className="text-xs text-muted-foreground whitespace-nowrap opacity-80">
                                    {ingredientTooltip.ingredient.name}
                                </div>
                            </div>

                            {ingredientTooltip.conflicts && (
                                <div className="mt-2 pt-2 border-t border-border/50 min-w-[200px]">
                                    <div className={cn("font-bold text-[10px] flex items-center gap-1 mb-1", ingredientTooltip.conflicts.maxProbability >= 80 ? "text-destructive" : "text-orange-500")}>
                                        {ingredientTooltip.conflicts.maxProbability >= 80 ? <AlertCircle size={12} /> : <HelpCircle size={12} />}
                                        {ingredientTooltip.conflicts.maxProbability >= 80 ? 'Achtung!' : 'Hinweis'} ({ingredientTooltip.conflicts.maxProbability}%)
                                    </div>
                                    <div className="space-y-1">
                                        {ingredientTooltip.conflicts.messages.map((msg, i) => (
                                            <div key={i} className={cn("text-[10px] font-medium leading-tight", ingredientTooltip.conflicts.maxProbability >= 80 ? "text-destructive/80" : "text-orange-500/80")}>
                                                {msg}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Button
                                size="icon"
                                variant={checkedIngredients.has(ingredientTooltip.ingredient.id) ? "secondary" : "primary"}
                                onClick={() => {
                                    toggleIngredient(ingredientTooltip.ingredient.id);
                                    handleIngredientLeave();
                                }}
                                className={cn(
                                    "w-10 h-10 rounded-xl shrink-0 transition-all",
                                    checkedIngredients.has(ingredientTooltip.ingredient.id)
                                        ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                                        : "shadow-lg shadow-primary/20"
                                )}
                            >
                                <Check size={20} className={cn(
                                    "transition-transform duration-300",
                                    checkedIngredients.has(ingredientTooltip.ingredient.id) ? "scale-110" : "scale-100"
                                )} />
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <ShareConfirmationModal
                    isOpen={!!shareModalConfig}
                    onClose={() => setShareModalConfig(null)}
                    onConfirm={handleConfirmShare}
                />
                <AiActionConfirmModal
                    isOpen={aiConfirmModalOpen}
                    onClose={() => setAiConfirmModalOpen(false)}
                    onConfirm={() => {
                        aiActionData?.onConfirm();
                        setAiConfirmModalOpen(false);
                        // Refresh user credits
                        refreshUser();
                    }}
                    actionTitle={aiActionData?.title}
                    actionDescription={aiActionData?.description}
                    cost={aiActionData?.cost}
                    balance={user?.aiCredits}
                />

                <SubscriptionModal
                    isOpen={isSubscriptionModalOpen}
                    onClose={() => setIsSubscriptionModalOpen(false)}
                    currentTier={user?.tier}
                />

                <AiLockedModal
                    isOpen={isAiLockedOpen}
                    onClose={() => setIsAiLockedOpen(false)}
                    featureName="KI Koch-Assistent"
                />

                <CookingExitModal
                    isOpen={isExitModalOpen}
                    onClose={() => setIsExitModalOpen(false)}
                    onConfirm={onClose}
                    hasPaidAi={hasPaidForAi}
                    isSilbergabel={user?.tier === 'Silbergabel'}
                />
            </motion.div>
        </AnimatePresence>
    );
}
