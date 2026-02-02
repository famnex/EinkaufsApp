import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Settings, X, List, Plus, Euro, Search, ShoppingCart, Trash2, ChevronRight, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ViewSwitcher from '../components/ViewSwitcher';
import { useEditMode } from '../contexts/EditModeContext';
import { cn } from '../lib/utils';

export default function Dashboard() {
    const { editMode } = useEditMode();
    const [view, setView] = useState(() => localStorage.getItem('dashboard_view') || 'calendar');
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [editingListId, setEditingListId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const navigate = useNavigate();

    const fetchLists = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('http://localhost:5000/api/lists');
            setLists(data);
        } catch (err) {
            console.error('Failed to fetch lists', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLists();
    }, [fetchLists]);

    useEffect(() => {
        localStorage.setItem('dashboard_view', view);
    }, [view]);

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
                await axios.post('http://localhost:5000/api/lists', {
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
                        await axios.delete(`http://localhost:5000/api/lists/${existingList.id}`);
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

    const handleCreateList = async (date = new Date()) => {
        const dateStr = getLocalDateStr(date);
        try {
            const { data } = await axios.post('http://localhost:5000/api/lists', { date: dateStr });
            fetchLists();
            if (data?.id) {
                navigate(`/lists/${data.id}`);
            }
        } catch (err) {
            console.error('Failed to create list', err);
        }
    };

    const handleDeleteList = async (id, e) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        if (!confirm('Sitzung wirklich löschen?')) return;
        try {
            await axios.delete(`http://localhost:5000/api/lists/${id}`);
            fetchLists();
        } catch (err) {
            console.error('Failed to delete list', err);
        }
    };

    const handleRename = async (id, e) => {
        e.stopPropagation();
        try {
            await axios.put(`http://localhost:5000/api/lists/${id}`, { name: editingName });
            setEditingListId(null);
            fetchLists();
        } catch (err) {
            console.error('Failed to rename list', err);
        }
    };

    const handleToggleStatus = async (list, e) => {
        e.stopPropagation();
        const newStatus = list.status === 'active' ? 'archived' : 'active';
        try {
            await axios.put(`http://localhost:5000/api/lists/${list.id}`, { status: newStatus });
            fetchLists();
        } catch (err) {
            console.error('Failed to toggle status', err);
        }
    };

    const tileClassName = ({ date, view }) => {
        if (view === 'month') {
            const dateStr = getLocalDateStr(date);
            const list = lists.find(l => l.date === dateStr);
            if (list) return 'has-list';
        }
        return '';
    };

    return (
        <div className="space-y-6">


            <div className="w-full pt-6 relative">
                {/* Pull to Refresh Indicator */}
                <motion.div
                    className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center justify-center p-2 text-muted-foreground"
                    style={{ opacity: 0 }}
                    animate={{ opacity: loading ? 1 : 0 }}
                >
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    >
                        <ShoppingCart size={24} />
                    </motion.div>
                </motion.div>

                <ViewSwitcher activeView={view} onViewChange={setView} />

                <AnimatePresence mode="wait">
                    {view === 'calendar' ? (
                        <motion.div
                            key="calendar-view"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.2 }}
                            className="bg-card border border-border rounded-3xl p-6 backdrop-blur-2xl shadow-xl transition-colors duration-300"
                        >
                            <Calendar
                                onChange={setSelectedDate}
                                onClickDay={handleDateClick}
                                value={selectedDate}
                                tileClassName={tileClassName}
                                locale="de-DE"
                                prev2Label={null}
                                next2Label={null}
                                formatShortWeekday={(locale, date) => ['M', 'D', 'M', 'D', 'F', 'S', 'S'][date.getDay() === 0 ? 6 : date.getDay() - 1]}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="sessions-view"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-4"
                        >
                            {loading ? (
                                <div className="py-20 text-center text-muted-foreground italic animate-pulse">Lade Sitzungen...</div>
                            ) : lists.length > 0 ? (
                                lists.map((list, index) => (
                                    <motion.div
                                        key={list.id}
                                        layout
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        onClick={() => {
                                            if (editMode === 'delete') {
                                                handleDeleteList(list.id, { stopPropagation: () => { } });
                                            } else {
                                                navigate(`/lists/${list.id}`);
                                            }
                                        }}
                                        className={cn(
                                            "group relative flex items-center justify-between p-5 rounded-3xl transition-all border border-border/50",
                                            "hover:bg-primary/5 hover:border-primary/20",
                                            editMode === 'delete' ? "border-destructive/30 hover:bg-destructive/5 hover:border-destructive/50 cursor-pointer" : "cursor-pointer"
                                        )}
                                    >
                                        <div className="flex items-center gap-5 relative z-10 text-left flex-1 min-w-0">
                                            <div
                                                className={cn(
                                                    "w-12 h-12 rounded-xl flex items-center justify-center shadow-md shrink-0 transition-transform active:scale-90",
                                                    list.status === 'active' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                                )}
                                            >
                                                <ShoppingCart size={24} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-xl font-bold text-foreground leading-tight truncate">
                                                        {list.name || new Date(list.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                    </h3>
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1 block">
                                                    {list.status === 'active' ? 'AKTIV' : 'ARCHIVIERT'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-right relative z-10 flex flex-col items-end">
                                            <p className="text-2xl font-bebas font-bold text-foreground">€{parseFloat(list.total_cost || 0).toFixed(2)}</p>
                                            {editMode === 'delete' && (
                                                <div className="mt-2 text-destructive">
                                                    <Trash2 size={18} />
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <div className="py-20 text-center border-2 border-dashed border-border rounded-3xl">
                                    <Plus size={48} className="mx-auto text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground font-medium">Bisher keine Sitzungen vorhanden.</p>
                                    <button
                                        onClick={() => handleCreateList()}
                                        className="mt-6 px-8 py-3 bg-primary text-primary-foreground font-bold rounded-xl active:scale-95 transition-transform shadow-lg shadow-primary/20"
                                    >
                                        Erste Sitzung starten
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .react-calendar__tile--active {
                    background: transparent !important;
                    color: inherit !important;
                }
                .react-calendar__tile--active:enabled:hover,
                .react-calendar__tile--active:enabled:focus {
                    background: hsl(var(--muted)) !important;
                }
                .react-calendar__tile--now {
                    border: 2px solid #b91c1c !important;
                    border-radius: 0.75rem !important;
                    background: transparent !important;
                }
                .react-calendar__tile--now.has-list {
                    background: hsl(var(--primary)) !important;
                    color: hsl(var(--primary-foreground)) !important;
                }
                /* Maintain dots/indicators if any (none in current implementation except has-list bg) */
            `}} />
        </div >
    );
}
