import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sun, Soup, Utensils, Apple, Info, Plus, Trash2, ShoppingCart, ListChecks } from 'lucide-react';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { useEditMode } from '../contexts/EditModeContext';
import axios from 'axios';
import { cn } from '../lib/utils';
import MealSelectorModal from '../components/MealSelectorModal';
import BulkPlanningModal from '../components/BulkPlanningModal';
import CookingMode from '../components/CookingMode';
import { useNavigate } from 'react-router-dom';


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

    const [bulkModal, setBulkModal] = useState({ open: false, listId: null });

    const fetchData = async () => {
        try {
            const startStr = currentWeekStart.toISOString().split('T')[0];
            const end = new Date(currentWeekStart);
            end.setDate(end.getDate() + 6);
            const endStr = end.toISOString().split('T')[0];
            const { data } = await axios.get(`http://localhost:5000/api/menus?start=${startStr}&end=${endStr}`);
            const listsRes = await axios.get('http://localhost:5000/api/lists');
            setMenus(data);
            setLists(listsRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentWeekStart]);

    const changeWeek = (offset) => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() + (offset * 7));
        setCurrentWeekStart(newDate);
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

    const handleSlotClick = (dateStr, type, meal = null) => {
        if (editMode === 'delete') {
            if (meal) handleDelete(meal.id);
            return;
        }

        if (editMode === 'view' && meal?.Recipe) {
            setCookingRecipe(meal.Recipe);
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
                RecipeId: selection.RecipeId || null
            };

            if (existing) {
                await axios.put(`http://localhost:5000/api/menus/${existing.id}`, payload);
            } else {
                await axios.post('http://localhost:5000/api/menus', payload);
            }
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (menuId) => {
        if (!confirm('Mahlzeit entfernen?')) return;
        try {
            await axios.delete(`http://localhost:5000/api/menus/${menuId}`);
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

    return (
        <div className="pb-24 space-y-4">
            <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pt-4 pb-2 border-b border-border transition-all">
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

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none px-4">
                    <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold whitespace-nowrap">
                        {filledCount}/{totalSlots} Slots belegt
                    </div>
                </div>
            </div>

            <div className="space-y-3">
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
                                    shoppingList && !isToday && "bg-teal-500/10 text-teal-600"
                                )}>
                                    <span className="text-[10px] uppercase font-bold tracking-wider">{day.dayName}</span>
                                    <span className="text-lg font-bold leading-none">{day.dayNum}</span>
                                    {shoppingList && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-teal-500 rounded-full border border-card" />
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
                                                    className="inline-flex items-center gap-1.5 bg-teal-500/10 text-teal-600 px-2 py-1 rounded-lg text-xs font-bold hover:bg-teal-500/20 transition-colors shrink-0"
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
                                            <ShoppingCart size={16} className="text-teal-600 md:hidden shrink-0" />
                                        </>
                                    )}

                                    {!isExpanded && meals.slice(0, 2).map(m => {
                                        const slotIcon = slots.find(s => s.type === m.meal_type);
                                        const Icon = slotIcon ? slotIcon.icon : Info;
                                        return (
                                            <div key={m.id} className="hidden md:inline-flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-lg text-xs font-medium truncate shrink-0 max-w-[120px]">
                                                <Icon size={12} className="shrink-0 text-primary" />
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
                                        const handleClick = () => handleSlotClick(day.dateStr, s.type, meal);

                                        return (
                                            <button
                                                key={s.type}
                                                onClick={handleClick}
                                                disabled={editMode === 'view'}
                                                className={cn(
                                                    "w-8 h-8 rounded-full flex items-center justify-center transition-all relative group",
                                                    isFilled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                                                    editMode === 'delete' && isFilled && "animate-pulse bg-destructive/10 text-destructive hover:bg-destructive hover:text-white cursor-pointer",
                                                    editMode !== 'delete' && isFilled && "hover:bg-primary/20",
                                                    editMode !== 'delete' && !isFilled && "hover:bg-muted-foreground/10",
                                                    editMode === 'view' && "opacity-80 cursor-default hover:bg-transparent"
                                                )}
                                                title={s.label}
                                            >
                                                <s.icon size={16} />
                                                {isFilled && editMode !== 'delete' && <span className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full border border-card" />}
                                            </button>
                                        );
                                    })}
                                </div>
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
                                                        className="flex-1 flex items-center gap-3 p-2 rounded-xl bg-teal-500/10 text-teal-700 hover:bg-teal-500/20 cursor-pointer transition-colors"
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-teal-500 text-white flex items-center justify-center shrink-0">
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
                                                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                                                meal ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground",
                                                                editMode === 'delete' && meal && "bg-destructive/10 text-destructive"
                                                            )}>
                                                                <s.icon size={16} />
                                                            </div>
                                                            <div className="flex-1 text-sm">
                                                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">{s.label}</span>
                                                                {meal ? (
                                                                    <span className="font-medium text-foreground">{meal.Recipe ? meal.Recipe.title : meal.description}</span>
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
            </div>

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
        </div>
    );
}
