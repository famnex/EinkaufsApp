import { useState, useEffect } from 'react';
import axios from 'axios';
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
            const { data } = await axios.get('http://localhost:5000/api/lists');
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
            const { data } = await axios.post('http://localhost:5000/api/lists', { date: dateStr });
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
            await axios.delete(`http://localhost:5000/api/lists/${id}`);
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
                                    editMode === 'delete' ? "border-destructive/30 hover:bg-destructive/5 hover:border-destructive/50" : "hover:border-primary/20"
                                )}
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/[0.02] rounded-bl-full pointer-events-none" />

                                <div className="flex items-center gap-5 relative z-10">
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-colors",
                                        list.status === 'active' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                    )}>
                                        <ShoppingCart size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-foreground leading-tight">Sitzung {new Date(list.date).toLocaleDateString('de-DE')}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className={cn(
                                                "w-2 h-2 rounded-full",
                                                list.status === 'active' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]" : "bg-muted-foreground/30"
                                            )} />
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                                {list.status === 'active' ? 'AKTIV' : 'ARCHIVIERT'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right relative z-10">
                                    <p className="text-2xl font-bebas font-bold text-foreground">€{parseFloat(list.total_cost || 0).toFixed(2)}</p>
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
