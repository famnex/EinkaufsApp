import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sun, Soup, Utensils, Apple, Info, Plus, Trash2, ShoppingCart, ListChecks, CarFront, ChevronDown } from 'lucide-react';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { useEditMode } from '../contexts/EditModeContext';
import api from '../lib/axios';
import { cn } from '../lib/utils';
import MealSelectorModal from '../components/MealSelectorModal';
import BulkPlanningModal from '../components/BulkPlanningModal';
import CookingMode from '../components/CookingMode';
import { useNavigate } from 'react-router-dom';
import LoadingOverlay from '../components/LoadingOverlay';


function getMonday(d) {
    d = new Date(d);
    var day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function getKW(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export default function MenuPlan() {
    const { token } = useAuth();
    const { editMode } = useEditMode();
    const navigate = useNavigate();
    const [currentWeekStart, setCurrentWeekStart] = useState(getMonday(new Date()));
    const [menus, setMenus] = useState([]);
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(false);

    // UI States
    const [expandedDay, setExpandedDay] = useState(null);
    const [selectorOpen, setSelectorOpen] = useState(false);
    const [activeSlot, setActiveSlot] = useState(null);
    const [cookingRecipe, setCookingRecipe] = useState(null);
    const [tooltip, setTooltip] = useState(null);

    const [bulkModal, setBulkModal] = useState({ open: false, listId: null });

    const fetchData = async () => {
        setLoading(true);
        try {
            const startStr = currentWeekStart.toISOString().split('T')[0];
            const end = new Date(currentWeekStart);
            end.setDate(end.getDate() + 6);
            const endStr = end.toISOString().split('T')[0];
            const { data } = await api.get(`/menus?start=${startStr}&end=${endStr}`);
            const listsRes = await api.get('/lists');
            setMenus(data);
            setLists(listsRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentWeekStart]);

    // Close tooltip on global click
    useEffect(() => {
        if (!tooltip) return;
        const closeTooltip = () => setTooltip(null);
        // We use capture to ensure it runs, but we need to stopProp in the tooltip itself or button
        // Actually, easiest is a transparent overlay OR just document click.
        document.addEventListener('click', closeTooltip);
        return () => document.removeEventListener('click', closeTooltip);
    }, [tooltip]);

    const [direction, setDirection] = useState(0);

    const changeWeek = (offset) => {
        setDirection(offset);
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() + (offset * 7));
        setCurrentWeekStart(newDate);
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

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + i);
        return {
            date: d,
            dateStr: d.toISOString().split('T')[0],
            dayNum: d.getDate(),
            dayName: d.toLocaleDateString('de-DE', { weekday: 'short' })
        };
    });

    const getMealsForDay = (dateStr) => menus.filter(m => m.date === dateStr);
    const getListForDay = (dateStr) => lists.find(l => l.date && l.date.split('T')[0] === dateStr);


    const handleSlotClick = (dateStr, type, meal = null, e = null) => {
        // Close tooltip if open and clicking same or outside
        if (tooltip && tooltip.id === `${dateStr}-${type}`) {
            setTooltip(null);
            return;
        }

        if (editMode === 'delete') {
            if (meal) handleDelete(meal.id);
            return;
        }

        if (editMode === 'view') {
            if (meal && (meal.Recipe || meal.is_eating_out)) {
                if (e) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const isMobile = window.innerWidth < 640;

                    // On mobile, center horizontally. On desktop, center relative to button with bounds check.
                    let x = isMobile ? window.innerWidth / 2 : rect.left + rect.width / 2;

                    if (!isMobile) {
                        const margin = 160; // Safe margin (approx half max tooltip width)
                        x = Math.max(margin, Math.min(window.innerWidth - margin, x));
                    }

                    setTooltip({
                        id: `${dateStr}-${type}`,
                        text: meal.Recipe ? meal.Recipe.title : (meal.description || "Auswärts essen"),
                        x: x,
                        y: rect.top - 10,
                        recipe: meal.Recipe,
                        is_eating_out: meal.is_eating_out
                    });
                } else if (meal.Recipe) {
                    // Clicked from expanded view list -> Navigate to Cooking Mode directly (as requested)
                    navigate('/recipes', {
                        state: {
                            openRecipeId: meal.Recipe.id,
                            startCooking: true
                        }
                    });
                }
            } else if (editMode === 'view' && meal && !meal.Recipe && !e) {
                // Handle manual entry click in expanded view (optional: maybe do nothing or show toast)
            }
            return;
        }

        if (editMode === 'create' || editMode === 'edit') {
            setActiveSlot({ date: dateStr, type });
            setSelectorOpen(true);
        }
    };



    const handleMealSelect = async (selection) => {
        if (!activeSlot) return;
        try {
            const existing = menus.find(m => m.date === activeSlot.date && m.meal_type === activeSlot.type);
            const payload = {
                date: activeSlot.date,
                meal_type: activeSlot.type,
                description: selection.description,
                RecipeId: selection.RecipeId || null,
                is_eating_out: selection.is_eating_out || false
            };

            if (existing) {
                await api.put(`/menus/${existing.id}`, payload);
            } else {
                await api.post('/menus', payload);
            }
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (menuId) => {
        if (!confirm('Mahlzeit entfernen?')) return;
        try {
            await api.delete(`/menus/${menuId}`);
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const slots = [
        { type: 'breakfast', icon: Sun, label: 'Früh' },
        { type: 'lunch', icon: Soup, label: 'Mittag' },
        { type: 'dinner', icon: Utensils, label: 'Abend' },
        { type: 'snack', icon: Apple, label: 'Snack' }
    ];

    const filledCount = menus.length;
    const totalSlots = 7 * 4;

    // Swipe Logic
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);

    const minSwipeDistance = 50;

    const [touchStartY, setTouchStartY] = useState(null);
    const [touchEndY, setTouchEndY] = useState(null);

    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStartY(e.targetTouches[0].clientY);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => {
        setTouchEndY(e.targetTouches[0].clientY);
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (selectorOpen || bulkModal.open || cookingRecipe) return;
        if (!touchStart || !touchEnd) return;

        const xDistance = touchStart - touchEnd;
        const yDistance = (touchStartY || 0) - (touchEndY || 0);

        // Ignore if vertical swipe dominates (scrolling)
        if (Math.abs(yDistance) > Math.abs(xDistance)) return;

        const isLeftSwipe = xDistance > minSwipeDistance;
        const isRightSwipe = xDistance < -minSwipeDistance;

        if (isLeftSwipe) {
            changeWeek(1);
        }
        if (isRightSwipe) {
            changeWeek(-1);
        }
    };

    return (
        <div
            className="space-y-4"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{ touchAction: 'pan-y' }}
        >
            <div
                className="sticky z-30 bg-background/95 backdrop-blur-sm pt-4 pb-2 border-b border-border transition-all"
                style={{ top: 'calc(4rem + env(safe-area-inset-top))' }}
            >
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <ChevronLeft />
                    </button>
                    <div className="text-center">
                        <h2 className="text-xl font-bebas tracking-wide">KW {getKW(currentWeekStart)}</h2>
                        <p className="text-xs text-muted-foreground">
                            {weekDays[0].dayNum}.{weekDays[0].date.toLocaleDateString('de-DE', { month: 'short' })} – {weekDays[6].dayNum}.{weekDays[6].date.toLocaleDateString('de-DE', { month: 'short' })}
                        </p>
                    </div>
                    <button onClick={() => changeWeek(1)} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <ChevronRight />
                    </button>
                </div>


            </div>

            <LoadingOverlay isLoading={loading}>
                <div className="overflow-hidden">
                    <AnimatePresence initial={false} mode='wait' custom={direction}>
                        <motion.div
                            key={currentWeekStart.toISOString()}
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
                            className="space-y-3"
                        >
                            {weekDays.map(day => {
                                const meals = getMealsForDay(day.dateStr);
                                const shoppingList = getListForDay(day.dateStr);
                                const isToday = new Date().toDateString() === day.date.toDateString();
                                const isExpanded = expandedDay === day.dateStr;

                                return (
                                    <Card
                                        key={day.dateStr}
                                        className={cn(
                                            "border-border transition-all duration-300 overflow-hidden relative",
                                            isToday ? "border-primary/50 shadow-sm" : "shadow-sm",
                                            isExpanded ? "ring-1 ring-primary/20" : ""
                                        )}
                                    >
                                        <div
                                            onClick={() => setExpandedDay(isExpanded ? null : day.dateStr)}
                                            className="p-3 flex items-center gap-3 cursor-pointer"
                                        >
                                            <div className={cn(
                                                "flex flex-col items-center justify-center w-12 h-12 rounded-xl shrink-0 transition-colors relative",
                                                isToday ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                                                shoppingList && !isToday && "bg-secondary/10 text-secondary"
                                            )}>
                                                <span className="text-[10px] uppercase font-bold tracking-wider">{day.dayName}</span>
                                                <span className="text-lg font-bold leading-none">{day.dayNum}</span>
                                                {shoppingList && (
                                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-secondary rounded-full border border-card" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0 flex gap-2 overflow-hidden items-center">
                                                {!isExpanded && meals.length === 0 && !shoppingList && (
                                                    <span className="hidden md:flex text-xs text-muted-foreground italic pl-1 items-center h-full">Leer</span>
                                                )}

                                                {shoppingList && (
                                                    <>
                                                        <div className="hidden md:flex gap-2 items-center">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    navigate(`/lists/${shoppingList.id}`);
                                                                }}
                                                                className="inline-flex items-center gap-1.5 bg-secondary/10 text-secondary px-2 py-1 rounded-lg text-xs font-bold hover:bg-secondary/20 transition-colors shrink-0"
                                                            >
                                                                <ShoppingCart size={12} />
                                                                <span>Einkauf</span>
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setBulkModal({ open: true, listId: shoppingList.id });
                                                                }}
                                                                className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-2 py-1 rounded-lg text-xs font-bold hover:bg-primary/20 transition-colors shrink-0"
                                                            >
                                                                <ListChecks size={12} />
                                                                <span>Zutaten planen</span>
                                                            </button>
                                                        </div>
                                                        <ShoppingCart size={16} className="text-secondary md:hidden shrink-0" />
                                                    </>
                                                )}

                                                {!isExpanded && meals.slice(0, 2).map(m => {
                                                    const slotIcon = slots.find(s => s.type === m.meal_type);
                                                    let Icon = slotIcon ? slotIcon.icon : Info;
                                                    let styleClass = "bg-muted/50 text-foreground";

                                                    if (m.is_eating_out) {
                                                        Icon = CarFront;
                                                        styleClass = "bg-orange-500/10 text-orange-600";
                                                    }

                                                    return (
                                                        <div key={m.id} className={cn("hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium min-w-0 transition-colors", styleClass)}>
                                                            <Icon size={12} className={cn("shrink-0", m.is_eating_out ? "text-orange-600" : "text-primary")} />
                                                            <span className="truncate">{m.Recipe ? m.Recipe.title : m.description}</span>
                                                        </div>
                                                    );
                                                })}
                                                {!isExpanded && meals.length > 2 && (
                                                    <div className="hidden md:block bg-muted px-2 py-1 rounded-lg text-xs font-bold shrink-0">+{meals.length - 2}</div>
                                                )}
                                            </div>

                                            <div className="flex gap-1 md:gap-2 shrink-0 ml-auto pl-2" onClick={e => e.stopPropagation()}>
                                                {slots.map(s => {
                                                    const meal = meals.find(m => m.meal_type === s.type);
                                                    const isFilled = !!meal;
                                                    const handleClick = (e) => handleSlotClick(day.dateStr, s.type, meal, e);

                                                    return (
                                                        <button
                                                            key={s.type}
                                                            onClick={(e) => {
                                                                e.stopPropagation(); // prevent card expand
                                                                handleClick(e);
                                                            }}
                                                            disabled={false}
                                                            className={cn(
                                                                "w-8 h-8 rounded-full flex items-center justify-center transition-all relative group",
                                                                isFilled
                                                                    ? (meal.is_eating_out ? "bg-orange-500/10 text-orange-600" : "bg-primary/10 text-primary")
                                                                    : "bg-muted text-muted-foreground",
                                                                editMode === 'delete' && isFilled && "animate-pulse bg-destructive/10 text-destructive hover:bg-destructive hover:text-white cursor-pointer",
                                                                editMode !== 'delete' && isFilled && (meal.is_eating_out ? "hover:bg-orange-500/20" : "hover:bg-primary/20 cursor-pointer"),
                                                                editMode !== 'delete' && !isFilled && "hover:bg-muted-foreground/10",
                                                                editMode === 'view' && !isFilled && "opacity-50 cursor-default"
                                                            )}
                                                            title={s.label}
                                                        >
                                                            {isFilled && meal.is_eating_out ? <CarFront size={16} /> : <s.icon size={16} />}
                                                            {isFilled && editMode !== 'delete' && <span className={cn("absolute top-0 right-0 w-2 h-2 rounded-full border border-card", meal.is_eating_out ? "bg-orange-500" : "bg-primary")} />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <ChevronDown
                                                size={20}
                                                className={cn("text-muted-foreground transition-transform duration-300 ml-1 shrink-0", isExpanded && "rotate-180 text-primary")}
                                            />
                                        </div>

                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="p-3 pt-0 grid grid-cols-1 gap-2">
                                                        <div className="h-px bg-border/50 my-1 mx-2" />

                                                        {shoppingList && (
                                                            <div className="flex gap-2">
                                                                <div
                                                                    onClick={() => navigate(`/lists/${shoppingList.id}`)}
                                                                    className="flex-1 flex items-center gap-3 p-2 rounded-xl bg-secondary/10 text-secondary hover:bg-secondary/20 cursor-pointer transition-colors"
                                                                >
                                                                    <div className="w-8 h-8 rounded-lg bg-secondary text-white flex items-center justify-center shrink-0">
                                                                        <ShoppingCart size={16} />
                                                                    </div>
                                                                    <div className="flex-1 text-sm font-bold">
                                                                        Einkaufsliste anzeigen
                                                                    </div>
                                                                    <ChevronRight size={16} />
                                                                </div>
                                                                <div
                                                                    onClick={() => setBulkModal({ open: true, listId: shoppingList.id })}
                                                                    className="flex-1 flex items-center gap-3 p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors"
                                                                >
                                                                    <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
                                                                        <ListChecks size={16} />
                                                                    </div>
                                                                    <div className="flex-1 text-sm font-bold">
                                                                        Zutaten Planer
                                                                    </div>
                                                                    <ChevronRight size={16} />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {slots.map(s => {
                                                            const meal = meals.find(m => m.meal_type === s.type);

                                                            return (
                                                                <div
                                                                    key={s.type}
                                                                    onClick={() => handleSlotClick(day.dateStr, s.type, meal)}
                                                                    className={cn(
                                                                        "flex flex-col gap-2 p-2 rounded-xl transition-colors",
                                                                        meal ? "bg-muted/30" : "",
                                                                        editMode === 'delete' && meal ? "hover:bg-destructive/10 cursor-pointer border border-transparent hover:border-destructive/30" : "",
                                                                        (editMode === 'edit' || editMode === 'create' || (editMode === 'view' && meal?.Recipe)) && meal ? "hover:bg-primary/5 cursor-pointer" : "hover:bg-muted/20"
                                                                    )}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={cn(
                                                                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                                                            meal
                                                                                ? (meal.is_eating_out ? "bg-orange-500/10 text-orange-600" : "bg-primary/10 text-primary")
                                                                                : "bg-muted/50 text-muted-foreground",
                                                                            editMode === 'delete' && meal && "bg-destructive/10 text-destructive"
                                                                        )}>
                                                                            {meal && meal.is_eating_out ? <CarFront size={16} /> : <s.icon size={16} />}
                                                                        </div>
                                                                        <div className="flex-1 text-sm">
                                                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">{s.label}</span>
                                                                            {meal ? (
                                                                                <span className={cn("font-medium", meal.is_eating_out ? "text-orange-600" : "text-foreground")}>
                                                                                    {meal.Recipe ? meal.Recipe.title : (meal.description || 'Auswärts essen')}
                                                                                </span>
                                                                            ) : (
                                                                                (editMode === 'create' || editMode === 'edit') ? (
                                                                                    <button
                                                                                        onClick={() => handleSlotClick(day.dateStr, s.type)}
                                                                                        className="text-muted-foreground/60 text-xs italic hover:text-primary transition-colors flex items-center gap-1"
                                                                                    >
                                                                                        <Plus size={12} /> Planen...
                                                                                    </button>
                                                                                ) : <span className="text-muted-foreground/30 text-xs italic">-</span>
                                                                            )}
                                                                        </div>

                                                                        <div className="flex gap-2">
                                                                            {meal && editMode === 'delete' && (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleDelete(meal.id);
                                                                                    }}
                                                                                    className="p-1.5 bg-destructive/10 text-destructive rounded-lg transition-colors"
                                                                                >
                                                                                    <Trash2 size={16} />
                                                                                </button>
                                                                            )}

                                                                            {meal && (editMode === 'edit' || editMode === 'create') && (
                                                                                <button
                                                                                    onClick={() => handleSlotClick(day.dateStr, s.type)}
                                                                                    className="p-1.5 hover:bg-background rounded-lg text-muted-foreground transition-colors"
                                                                                >
                                                                                    <Info size={14} />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </Card>
                                );
                            })}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </LoadingOverlay>

            <MealSelectorModal
                isOpen={selectorOpen}
                onClose={() => setSelectorOpen(false)}
                onSelect={handleMealSelect}
                initialDate={activeSlot?.date}
                initialType={activeSlot?.type}
            />

            <BulkPlanningModal
                isOpen={bulkModal.open}
                onClose={() => setBulkModal({ ...bulkModal, open: false })}
                listId={bulkModal.listId}
                onConfirm={fetchData}
            />
            {cookingRecipe && (
                <CookingMode
                    recipe={cookingRecipe}
                    onClose={() => setCookingRecipe(null)}
                />
            )}

            {/* Global Tooltip */}
            <AnimatePresence>
                {tooltip && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="fixed z-50 px-4 py-3 bg-popover/95 backdrop-blur-md text-popover-foreground text-sm font-medium rounded-2xl shadow-2xl border border-border/50 pointer-events-auto flex flex-col items-center gap-2 max-w-[90vw] text-center"
                        style={{
                            left: tooltip.x,
                            top: tooltip.y,
                            transform: 'translate(-50%, -100%)'
                        }}

                        onClick={(e) => {
                            e.stopPropagation(); // Prevent closing when clicking inside
                            if (tooltip.recipe) {
                                setCookingRecipe(tooltip.recipe);
                                setTooltip(null);
                            }
                        }}
                    >
                        <span className="leading-tight">{tooltip.text}</span>
                        {tooltip.recipe && (
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase font-bold tracking-wider cursor-pointer hover:bg-primary/20 transition-colors">
                                Rezept öffnen
                            </span>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
