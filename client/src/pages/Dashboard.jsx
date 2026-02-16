import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../lib/axios';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { ShoppingCart, ChefHat, Play, Check, ArrowRight, MousePointer2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditMode } from '../contexts/EditModeContext';
import { cn } from '../lib/utils';
import LoadingOverlay from '../components/LoadingOverlay';

export default function Dashboard() {
    const { editMode } = useEditMode();
    const [lists, setLists] = useState([]);
    const [menus, setMenus] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [activeStartDate, setActiveStartDate] = useState(new Date());
    const [direction, setDirection] = useState(0);
    const navigate = useNavigate();

    // DnD / Longpress State
    const [draggingList, setDraggingList] = useState(null);
    const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const longPressTimer = useRef(null);
    const calendarRef = useRef(null);

    // Swipe Logic for Calendar
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [touchStartY, setTouchStartY] = useState(null);
    const [touchEndY, setTouchEndY] = useState(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStartY(e.targetTouches[0].clientY);
        setTouchStart(e.targetTouches[0].clientX);

        // Longpress detection start
        if (editMode === 'view' || editMode === 'edit') {
            const tile = e.target.closest('.react-calendar__tile');
            if (tile) {
                const dateStr = tile.querySelector('[data-date]')?.getAttribute('data-date');
                const list = lists.find(l => l.date === dateStr);
                if (list) {
                    longPressTimer.current = setTimeout(() => {
                        setDraggingList(list);
                        setIsDragging(true);
                        setDragPos({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
                        // Provide haptic feedback if available
                        if (window.navigator.vibrate) window.navigator.vibrate(50);
                    }, 500); // 500ms for longpress
                }
            }
        }
    };

    const onTouchMove = (e) => {
        setTouchEndY(e.targetTouches[0].clientY);
        setTouchEnd(e.targetTouches[0].clientX);

        if (isDragging) {
            setDragPos({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
            e.preventDefault(); // Prevent scrolling while dragging
        } else if (longPressTimer.current) {
            // If moved significantly before longpress, cancel it
            const dx = Math.abs(e.targetTouches[0].clientX - touchStart);
            const dy = Math.abs(e.targetTouches[0].clientY - touchStartY);
            if (dx > 10 || dy > 10) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
        }
    };

    const onTouchEnd = (e) => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        if (isDragging) {
            handleDrop(dragPos.x, dragPos.y);
            setIsDragging(false);
            setDraggingList(null);
            return;
        }

        if (!touchStart || !touchEnd) return;
        const xDistance = touchStart - touchEnd;
        const yDistance = (touchStartY || 0) - (touchEndY || 0);

        if (Math.abs(yDistance) > Math.abs(xDistance)) return;

        const isLeftSwipe = xDistance > minSwipeDistance;
        const isRightSwipe = xDistance < -minSwipeDistance;

        if (isLeftSwipe) {
            setDirection(1);
            const nextMonth = new Date(activeStartDate);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            setActiveStartDate(nextMonth);
        }
        if (isRightSwipe) {
            setDirection(-1);
            const prevMonth = new Date(activeStartDate);
            prevMonth.setMonth(prevMonth.getMonth() - 1);
            setActiveStartDate(prevMonth);
        }
    };

    // Generic Pointer events for Mouse support
    const onPointerDown = (e) => {
        if (e.pointerType === 'touch') return; // Handled by onTouchStart
        const tile = e.target.closest('.react-calendar__tile');
        if (tile) {
            const dateStr = tile.querySelector('[data-date]')?.getAttribute('data-date');
            const list = lists.find(l => l.date === dateStr);
            if (list) {
                longPressTimer.current = setTimeout(() => {
                    setDraggingList(list);
                    setIsDragging(true);
                    setDragPos({ x: e.clientX, y: e.clientY });
                }, 500);
            }
        }
    };

    const onPointerMove = (e) => {
        if (e.pointerType === 'touch') return;
        if (isDragging) {
            setDragPos({ x: e.clientX, y: e.clientY });
        } else if (longPressTimer.current) {
            // Cancel timer on move
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const onPointerUp = (e) => {
        if (e.pointerType === 'touch') return;
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        if (isDragging) {
            handleDrop(e.clientX, e.clientY);
            setIsDragging(false);
            setDraggingList(null);
        }
    };

    const handleDrop = async (x, y) => {
        // Find target tile
        const elementsAtPos = document.elementsFromPoint(x, y);
        const tile = elementsAtPos.find(el => el.closest('.react-calendar__tile'))?.closest('.react-calendar__tile');

        if (!tile || !draggingList) return;

        const targetDateStr = tile.querySelector('[data-date]')?.getAttribute('data-date');
        if (!targetDateStr || targetDateStr === draggingList.date) return;

        const targetList = lists.find(l => l.date === targetDateStr);

        if (targetList) {
            // MERGE
            if (confirm(`Möchtest du die Liste vom ${new Date(draggingList.date).toLocaleDateString()} wirklich in die Liste vom ${new Date(targetDateStr).toLocaleDateString()} verschmelzen?`)) {
                try {
                    setLoading(true);
                    await api.post(`/lists/${targetList.id}/merge`, { sourceId: draggingList.id });
                    await fetchLists();
                } catch (err) {
                    console.error('Merge failed', err);
                    alert('Fehler beim Verschmelzen der Listen.');
                } finally {
                    setLoading(false);
                }
            }
        } else {
            // MOVE
            try {
                setLoading(true);
                await api.put(`/lists/${draggingList.id}`, { date: targetDateStr });
                await fetchLists();
            } catch (err) {
                console.error('Move failed', err);
                alert('Fehler beim Verschieben der Liste.');
            } finally {
                setLoading(false);
            }
        }
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

    const fetchLists = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/lists');
            setLists(data);
        } catch (err) {
            console.error('Failed to fetch lists', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchMenus = useCallback(async () => {
        try {
            const today = new Date();
            const start = getLocalDateStr(today);
            const end = new Date(today);
            end.setDate(end.getDate() + 14);
            const endStr = getLocalDateStr(end);
            const { data } = await api.get(`/menus?start=${start}&end=${endStr}`);
            setMenus(data);
        } catch (err) {
            console.error('Failed to fetch menus', err);
        }
    }, []);

    useEffect(() => {
        fetchLists();
        fetchMenus();
    }, [fetchLists, fetchMenus]);

    // Helper for local date string
    const getLocalDateStr = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleDateClick = async (date) => {
        const formattedDate = getLocalDateStr(date);

        const existingList = lists.find(l => l.date === formattedDate);

        if (editMode === 'create') {
            if (existingList) {
                alert('An diesem Tag existiert bereits eine Liste.');
                return;
            }
            try {
                await api.post('/lists', {
                    date: formattedDate,
                    name: `Einkauf ${date.toLocaleDateString('de-DE')}`
                });
                fetchLists();
            } catch (err) {
                console.error('Failed to create list', err);
            }
        } else if (editMode === 'delete') {
            if (existingList) {
                if (confirm(`Liste vom ${date.toLocaleDateString('de-DE')} wirklich löschen?`)) {
                    try {
                        await api.delete(`/lists/${existingList.id}`);
                        fetchLists();
                    } catch (err) {
                        console.error('Failed to delete list', err);
                    }
                }
            }
        } else if (editMode === 'view' || editMode === 'edit') {
            if (existingList) {
                navigate(`/lists/${existingList.id}`);
            }
        }
    };

    const tileClassName = ({ date, view }) => {
        if (view === 'month') {
            const dateStr = getLocalDateStr(date);
            const list = lists.find(l => l.date === dateStr);
            if (list) {
                if (list.status === 'archived') return 'has-list-archived';
                return 'has-list';
            }
        }
        return '';
    };

    // --- Compute "Nächster Einkauf" ---
    const nextShopping = useMemo(() => {
        const todayStr = getLocalDateStr(new Date());
        const futureLists = lists
            .filter(l => l.status === 'active' && l.date >= todayStr)
            .sort((a, b) => a.date.localeCompare(b.date));
        return futureLists.length > 0 ? futureLists[0] : null;
    }, [lists]);

    // --- Compute "Nächstes Rezept" based on time of day ---
    const nextRecipe = useMemo(() => {
        const now = new Date();
        const hour = now.getHours();
        const todayStr = getLocalDateStr(now);

        // Determine current meal type based on time
        // 0-10 = Frühstück (breakfast), 10-14 = Mittag (lunch), 14-24 = Abendessen (dinner)
        let currentMealType;
        let mealLabel;
        if (hour < 10) {
            currentMealType = 'breakfast';
            mealLabel = 'Frühstück';
        } else if (hour < 14) {
            currentMealType = 'lunch';
            mealLabel = 'Mittagessen';
        } else {
            currentMealType = 'dinner';
            mealLabel = 'Abendessen';
        }

        // Find today's menu entries with recipes
        const todayMenus = menus.filter(m => m.date === todayStr);
        const mealOrder = ['breakfast', 'lunch', 'dinner'];
        const mealLabels = { breakfast: 'Frühstück', lunch: 'Mittagessen', dinner: 'Abendessen' };

        // First try the current meal type
        const currentMeal = todayMenus.find(m => m.meal_type === currentMealType && m.Recipe);
        if (currentMeal) {
            return { recipe: currentMeal.Recipe, mealLabel, menuId: currentMeal.id };
        }

        // Fallback: find any later meal today with a recipe
        const currentIndex = mealOrder.indexOf(currentMealType);
        for (let i = currentIndex + 1; i < mealOrder.length; i++) {
            const meal = todayMenus.find(m => m.meal_type === mealOrder[i] && m.Recipe);
            if (meal) {
                return { recipe: meal.Recipe, mealLabel: mealLabels[mealOrder[i]], menuId: meal.id };
            }
        }

        // Nothing found today
        return null;
    }, [menus]);

    return (
        <LoadingOverlay isLoading={loading}>
            <div className="space-y-4">
                {/* Info Box */}
                <div className="mt-4">
                    <div className="bg-primary rounded-2xl p-2 grid grid-cols-2 gap-2">
                        {/* Nächster Einkauf */}
                        <button
                            onClick={() => nextShopping && navigate(`/lists/${nextShopping.id}`)}
                            className={cn(
                                "flex items-center gap-2 p-2 rounded-xl transition-all text-left",
                                nextShopping
                                    ? "bg-white/15 hover:bg-white/25 cursor-pointer active:scale-[0.97]"
                                    : "bg-white/5 opacity-50 cursor-default"
                            )}
                        >
                            <ShoppingCart size={18} className="text-white shrink-0" />
                            <div className="min-w-0">
                                <div className="text-[9px] uppercase tracking-widest font-bold text-white/80">
                                    Nächster Einkauf
                                </div>
                                <div className="text-xs font-bold text-white truncate">
                                    {nextShopping
                                        ? (() => {
                                            const d = new Date(nextShopping.date + 'T12:00:00');
                                            return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
                                        })()
                                        : 'Nicht geplant'
                                    }
                                </div>
                            </div>
                        </button>

                        {/* Nächstes Rezept */}
                        <button
                            onClick={() => {
                                if (nextRecipe) {
                                    navigate('/recipes', { state: { openRecipeId: nextRecipe.recipe.id, startCooking: true } });
                                }
                            }}
                            className={cn(
                                "flex items-center gap-2 p-2 rounded-xl transition-all text-left",
                                nextRecipe
                                    ? "bg-white/15 hover:bg-white/25 cursor-pointer active:scale-[0.97]"
                                    : "bg-white/5 opacity-50 cursor-default"
                            )}
                        >
                            <ChefHat size={18} className="text-white shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="text-[9px] uppercase tracking-widest font-bold text-white/80">
                                    {nextRecipe ? nextRecipe.mealLabel : 'Nächstes Rezept'}
                                </div>
                                <div className="text-xs font-bold text-white truncate">
                                    {nextRecipe ? nextRecipe.recipe.title : 'Heute keine Rezepte'}
                                </div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Calendar */}
                <div className="w-full relative">
                    <motion.div
                        key="calendar-view"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className="bg-card border border-border rounded-3xl p-6 backdrop-blur-2xl shadow-xl transition-colors duration-300"
                    >
                        <div
                            onTouchStart={onTouchStart}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onTouchEnd}
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerCancel={onPointerUp}
                            className="touch-pan-y overflow-hidden relative"
                            ref={calendarRef}
                        >
                            <AnimatePresence initial={false} custom={direction} mode="popLayout">
                                <motion.div
                                    key={activeStartDate.toISOString()}
                                    custom={direction}
                                    variants={variants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                                >
                                    <Calendar
                                        onChange={setSelectedDate}
                                        onClickDay={handleDateClick}
                                        value={selectedDate}
                                        activeStartDate={activeStartDate}
                                        onActiveStartDateChange={({ activeStartDate, action }) => {
                                            if (action === 'next') setDirection(1);
                                            if (action === 'prev') setDirection(-1);
                                            setActiveStartDate(activeStartDate);
                                        }}
                                        tileClassName={tileClassName}
                                        tileContent={({ date, view }) => {
                                            const dateStr = getLocalDateStr(date);
                                            if (view === 'month') {
                                                const list = lists.find(l => l.date === dateStr);
                                                return (
                                                    <div className="absolute inset-0 pointer-events-none" data-date={dateStr}>
                                                        {list && list.status === 'archived' && (
                                                            <div className="absolute bottom-0 right-0 p-1">
                                                                <div className="bg-white rounded-full p-0.5 shadow-sm">
                                                                    <Check size={8} className="text-green-600" strokeWidth={4} />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            return <div data-date={dateStr} className="pointer-events-none"></div>;
                                        }}
                                        locale="de-DE"
                                        prev2Label={null}
                                        next2Label={null}
                                        formatShortWeekday={(locale, date) => ['M', 'D', 'M', 'D', 'F', 'S', 'S'][date.getDay() === 0 ? 6 : date.getDay() - 1]}
                                    />
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>

                <AnimatePresence>
                    {isDragging && draggingList && (
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1.1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            style={{
                                position: 'fixed',
                                left: dragPos.x,
                                top: dragPos.y,
                                x: '-50%',
                                y: '-100%',
                                pointerEvents: 'none',
                                zIndex: 1000,
                            }}
                            className="bg-primary text-white p-3 rounded-2xl shadow-2xl flex items-center gap-2 border-2 border-white/50"
                        >
                            <ShoppingCart size={20} />
                            <div className="font-bold text-sm">
                                {new Date(draggingList.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <style dangerouslySetInnerHTML={{
                    __html: `
                /* 1. Global Reset: Remove default hover/active backgrounds */
                .react-calendar__tile:enabled:hover,
                .react-calendar__tile:enabled:focus,
                .react-calendar__tile--active,
                .react-calendar__tile--active:enabled:hover,
                .react-calendar__tile--active:enabled:focus {
                    background: transparent !important;
                    color: inherit !important;
                    box-shadow: none !important;
                    border: 4px solid transparent !important;
                }

                /* 2. Base Styles */
                
                /* Standard Tile */
                .react-calendar__tile {
                    color: hsl(var(--foreground)) !important;
                    background: transparent !important;
                    border: 4px solid transparent !important;
                    transition: none !important;
                    position: relative;
                    overflow: visible !important;
                }

                /* Today: Border in Primary Color */
                .react-calendar__tile--now {
                    border: 2px solid var(--ref-teal) !important;
                    border-radius: 0.75rem !important;
                }

                /* Active List Day (Unarchived): Secondary Color */
                .react-calendar__tile.has-list {
                    background: var(--ref-red) !important;
                    color: white !important;
                }
                
                /* Archived List Day: Primary Color */
                .react-calendar__tile.has-list-archived {
                    background: var(--ref-teal) !important;
                    color: white !important;
                }

                /* Today AND Active List: Secondary Background + Primary Border */
                .react-calendar__tile.has-list.react-calendar__tile--now {
                    border: 2px solid var(--ref-teal) !important;
                }
                
                /* Today AND Archived List: Primary Background + Primary Border (thick) */
                .react-calendar__tile.has-list-archived.react-calendar__tile--now {
                    border: 2px solid white !important;
                }

                /* 3. Persistent State (Force colors to stay same on Hover/Active) */

                /* Force Active List Days to KEEP Secondary Background on Hover/Active */
                .react-calendar__tile.has-list:enabled:hover,
                .react-calendar__tile.has-list:enabled:focus,
                .react-calendar__tile.has-list.react-calendar__tile--active {
                    background: var(--ref-red) !important;
                    color: white !important;
                }

                /* Force Archived List Days to KEEP Primary Background on Hover/Active */
                .react-calendar__tile.has-list-archived:enabled:hover,
                .react-calendar__tile.has-list-archived:enabled:focus,
                .react-calendar__tile.has-list-archived.react-calendar__tile--active {
                    background: var(--ref-teal) !important;
                    color: white !important;
                }

                /* Force Today to KEEP Border on Hover/Active */
                .react-calendar__tile--now:enabled:hover,
                .react-calendar__tile--now:enabled:focus,
                .react-calendar__tile--now.react-calendar__tile--active {
                    border: 2px solid var(--ref-teal) !important;
                }
            `}} />
            </div >
        </LoadingOverlay>
    );
}
