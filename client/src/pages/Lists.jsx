import { useState, useEffect } from 'react';
import api from '../lib/axios';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Trash2, Calendar, ChevronRight, Settings, X, List, Euro, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditMode } from '../contexts/EditModeContext';

export default function Lists() {
    const { editMode } = useEditMode();
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchLists();
    }, []);

    const fetchLists = async () => {
        try {
            const { data } = await api.get('/lists');
            setLists(data);
        } catch (err) {
            console.error('Failed to fetch lists', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateList = async () => {
        const dateStr = new Date().toISOString().split('T')[0];
        try {
            const { data } = await api.post('/lists', { date: dateStr });
            fetchLists();
            navigate(`/lists/${data.id}`);
        } catch (err) {
            console.error('Failed to create list', err);
        }
    };

    const handleDeleteList = async (id, e) => {
        e.stopPropagation();
        if (!confirm('Liste wirklich löschen?')) return;
        try {
            await api.delete(`/lists/${id}`);
            fetchLists();
        } catch (err) {
            console.error('Failed to delete list', err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="mb-8">
                <h1 className="text-4xl font-bebas tracking-tight text-foreground">
                    Einkaufssitzungen
                </h1>
                <p className="text-muted-foreground text-sm font-medium">Verwalte deine vergangenen und aktuellen Einkaufslisten</p>
            </div>

            <div className="space-y-4">
                <AnimatePresence>
                    {loading ? (
                        <div className="py-20 text-center text-muted-foreground italic animate-pulse">Synchronisierung...</div>
                    ) : (
                        lists.map((list, index) => (
                            <motion.div
                                key={list.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => {
                                    if (editMode === 'delete') {
                                        handleDeleteList(list.id, { stopPropagation: () => { } });
                                    } else {
                                        navigate(`/lists/${list.id}`);
                                    }
                                }}
                                className={cn(
                                    "bg-card border border-border rounded-2xl p-6 flex items-center justify-between group active:scale-[0.98] transition-all cursor-pointer overflow-hidden relative shadow-sm hover:shadow-md",
                                    editMode === 'delete'
                                        ? "border-destructive/30 hover:bg-destructive/5 hover:border-destructive/50"
                                        : (list.status === 'active' ? "hover:border-secondary/20" : "hover:border-primary/20")
                                )}
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/[0.02] rounded-bl-full pointer-events-none" />

                                <div className="flex items-center sm:gap-5 relative z-10 w-full overflow-hidden">
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-all",
                                        // Mobile styles: absolute, faded, big
                                        "absolute left-0 top-1/2 -translate-y-1/2 opacity-20 scale-150 sm:scale-100 sm:opacity-100 sm:relative sm:translate-y-0",
                                        list.status === 'active' ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
                                    )}>
                                        <ShoppingCart size={24} />
                                    </div>
                                    <div className="flex-1 min-w-0 pl-12 sm:pl-0 z-10">
                                        <h3 className="text-xl font-bold text-foreground leading-tight truncate">Sitzung {new Date(list.date).toLocaleDateString('de-DE')}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className={cn(
                                                "w-2 h-2 rounded-full",
                                                list.status === 'active' ? "bg-secondary animate-pulse" : "bg-primary"
                                            )} />
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                                {list.status === 'active' ? 'AKTIV' : 'ARCHIVIERT'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right relative z-10 flex flex-col items-end">
                                    {/* Stats Display */}
                                    <div className="flex flex-col items-end gap-1">
                                        {list.category_stats && Object.keys(list.category_stats).length > 0 ? (
                                            <>
                                                {Object.entries(list.category_stats).slice(0, 3).map(([cat, count]) => (
                                                    <span key={cat} className="text-xs bg-muted/50 px-2 py-0.5 rounded-full text-foreground/80 font-medium whitespace-nowrap">
                                                        {count}x <span className="hidden sm:inline">{cat}</span>
                                                    </span>
                                                ))}
                                                {Object.keys(list.category_stats).length > 3 && (
                                                    <span className="text-[10px] text-muted-foreground">+ {Object.keys(list.category_stats).length - 3} <span className="hidden sm:inline">weitere</span></span>
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-sm text-muted-foreground italic">Leer</span>
                                        )}
                                    </div>

                                    {editMode === 'delete' && (
                                        <button
                                            onClick={(e) => handleDeleteList(list.id, e)}
                                            className="mt-2 text-destructive transition-colors p-1"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>

                {!loading && lists.length === 0 && (
                    <div className="py-20 text-center border-2 border-dashed border-border rounded-3xl">
                        <Plus size={48} className="mx-auto text-muted-foreground/10 mb-4" />
                        <p className="text-muted-foreground font-medium">Bisher keine Sitzungen vorhanden.</p>
                        <button
                            onClick={handleCreateList}
                            className="mt-6 px-8 py-3 bg-primary text-primary-foreground font-bold rounded-xl active:scale-95 transition-transform shadow-lg shadow-primary/20"
                        >
                            Erste Liste erstellen
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
