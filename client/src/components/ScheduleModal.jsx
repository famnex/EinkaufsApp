import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Sun, Soup, Utensils, Apple, Check, ChevronDown } from 'lucide-react';
import api from '../lib/axios';
import { Button } from './Button';
import { cn } from '../lib/utils'; // Ensure cn utility is available

const MEAL_TYPES = [
    { id: 'breakfast', label: 'Früh', icon: Sun },
    { id: 'lunch', label: 'Mittag', icon: Soup },
    { id: 'dinner', label: 'Abend', icon: Utensils },
    { id: 'snack', label: 'Snack', icon: Apple },
];

export default function ScheduleModal({ isOpen, onClose, recipe }) {
    const [dates, setDates] = useState([]);
    const [existingMenus, setExistingMenus] = useState([]);
    const [loading, setLoading] = useState(false);
    const [visibleDays, setVisibleDays] = useState(7);

    useEffect(() => {
        if (isOpen) {
            generateDates();
            fetchExistingMenus();
        }
    }, [isOpen, visibleDays]);

    const generateDates = () => {
        const list = [];
        const today = new Date();
        for (let i = 0; i < visibleDays; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            list.push(d);
        }
        setDates(list);
    };

    const fetchExistingMenus = async () => {
        setLoading(true);
        try {
            const start = new Date().toISOString().split('T')[0];
            const end = new Date(Date.now() + visibleDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const { data } = await api.get(`/menus?start=${start}&end=${end}`);
            setExistingMenus(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getMenuForDateAndType = (dateObj, typeId) => {
        const dateStr = dateObj.toISOString().split('T')[0];
        return existingMenus.find(m => m.date === dateStr && m.meal_type === typeId);
    };

    const handleSchedule = async (dateObj, typeId) => {
        const dateStr = dateObj.toISOString().split('T')[0];
        const existing = getMenuForDateAndType(dateObj, typeId);

        if (existing) {
            if (!confirm(`An diesem Termin ist bereits "${existing.Recipe?.title || existing.description || 'etwas'}" geplant. Überschreiben?`)) {
                return;
            }
        }

        try {
            if (existing) {
                // Update existing
                await api.put(`/menus/${existing.id}`, {
                    RecipeId: recipe.id,
                    description: null // Clear manual description if any
                });
            } else {
                // Create new
                await api.post('/menus', {
                    date: dateStr,
                    meal_type: typeId,
                    RecipeId: recipe.id
                });
            }
            alert(`"${recipe.title}" erfolgreich eingeplant!`);
            onClose();
        } catch (err) {
            console.error(err);
            alert('Fehler beim Einplanen: ' + err.message);
        }
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-card w-full max-w-md rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[80vh]"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                        <div>
                            <h2 className="text-lg font-bold">Rezept einplanen</h2>
                            <p className="text-sm text-muted-foreground line-clamp-1">{recipe?.title}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="overflow-y-auto p-4 space-y-3 flex-1">
                        {dates.map((date) => (
                            <div key={date.toISOString()} className="flex items-center gap-4 p-3 rounded-xl bg-muted/20 border border-transparent hover:border-border transition-all">
                                <div className="w-16 text-center shrink-0">
                                    <div className="text-xs text-muted-foreground uppercase font-bold">{date.toLocaleDateString('de-DE', { weekday: 'short' })}</div>
                                    <div className="text-lg font-bold">{date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>
                                </div>
                                <div className="flex-1 grid grid-cols-4 gap-2">
                                    {MEAL_TYPES.map((type) => {
                                        const existing = getMenuForDateAndType(date, type.id);
                                        const Icon = type.icon;
                                        return (
                                            <button
                                                key={type.id}
                                                onClick={() => handleSchedule(date, type.id)}
                                                className={cn(
                                                    "h-10 rounded-lg flex items-center justify-center transition-all relative group",
                                                    existing
                                                        ? "bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive"
                                                        : "bg-background border border-border hover:border-primary hover:text-primary"
                                                )}
                                                title={`${type.label}${existing ? `: ${existing.Recipe?.title || 'Belegt'}` : ''}`}
                                            >
                                                <Icon size={18} />
                                                {existing && (
                                                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-card group-hover:bg-destructive transition-colors" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={() => setVisibleDays(prev => prev + 7)}
                            className="w-full py-3 mt-2 flex items-center justify-center gap-2 text-primary bg-primary/5 hover:bg-primary/10 rounded-xl transition-colors font-medium text-sm"
                        >
                            <ChevronDown size={16} />
                            Mehr laden...
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
