import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Trash2, Save, Scale, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import api from '../lib/axios';
import useLockBodyScroll from '../hooks/useLockBodyScroll';

export default function RecipeSubstitutionsModal({ isOpen, onClose, recipeId, recipeTitle, onUpdate }) {
    const [substitutions, setSubstitutions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(null); // ID of being saved sub
    const [error, setError] = useState(null);

    useLockBodyScroll(isOpen);

    useEffect(() => {
        if (isOpen && recipeId) {
            fetchSubstitutions();
        }
    }, [isOpen, recipeId]);

    const fetchSubstitutions = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/substitutions/recipe/${recipeId}`);
            setSubstitutions(data);
        } catch (err) {
            console.error('Failed to fetch substitutions', err);
            setError('Fehler beim Laden der Ersetzungen.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateSub = async (sub) => {
        setSaving(sub.id);
        try {
            await api.post('/substitutions', {
                recipeId,
                originalProductId: sub.originalProductId,
                substituteProductId: sub.substituteProductId,
                originalQuantity: sub.originalQuantity,
                originalUnit: sub.originalUnit,
                substituteQuantity: sub.substituteQuantity,
                substituteUnit: sub.substituteUnit
            });
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error('Failed to update substitution', err);
            setError('Fehler beim Aktualisieren der Ersetzung.');
        } finally {
            setSaving(null);
        }
    };

    const handleDeleteSub = async (subId) => {
        if (!window.confirm('Möchtest du diese Ersetzung wirklich löschen?')) return;
        try {
            await api.delete(`/substitutions/${subId}`);
            setSubstitutions(prev => prev.filter(s => s.id !== subId));
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error('Failed to delete substitution', err);
            setError('Fehler beim Löschen der Ersetzung.');
        }
    };

    const handleFieldChange = (id, field, value) => {
        setSubstitutions(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <div className="px-6 py-5 border-b border-border bg-gradient-to-br from-primary/5 to-transparent flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                                <RefreshCw className="text-amber-500" size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bebas tracking-wide text-foreground">Ersetzungen verwalten</h2>
                                <p className="text-xs text-muted-foreground font-medium truncate max-w-[300px]">{recipeTitle}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
                            <X size={20} className="text-muted-foreground" />
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-hide">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-4">
                                <RefreshCw className="animate-spin text-primary" size={32} />
                                <p className="text-sm text-muted-foreground">Lade Ersetzungen...</p>
                            </div>
                        ) : substitutions.length === 0 ? (
                            <div className="text-center py-12 space-y-3">
                                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                                    <RefreshCw size={32} />
                                </div>
                                <p className="text-muted-foreground italic">Keine Ersetzungen für dieses Rezept vorhanden.</p>
                            </div>
                        ) : (
                            substitutions.map(sub => (
                                <div key={sub.id} className="p-4 rounded-2xl border border-border bg-muted/20 space-y-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Original</div>
                                            <div className="font-bold text-foreground">{sub.OriginalProduct?.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {sub.originalQuantity} {sub.originalUnit}
                                            </div>
                                        </div>
                                        <div className="pt-6">
                                            <RefreshCw size={16} className="text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="text-[10px] uppercase tracking-wider font-bold text-primary">Ersatz</div>
                                            <div className="font-bold text-primary">{sub.SubstituteProduct?.name}</div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleDeleteSub(sub.id)}
                                                className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                                <Scale size={10} /> Menge (Ersatz)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={sub.substituteQuantity || ''}
                                                onChange={(e) => handleFieldChange(sub.id, 'substituteQuantity', parseFloat(e.target.value))}
                                                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 ring-primary/20 outline-none transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Einheit (Ersatz)</label>
                                            <input
                                                type="text"
                                                value={sub.substituteUnit || ''}
                                                onChange={(e) => handleFieldChange(sub.id, 'substituteUnit', e.target.value)}
                                                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 ring-primary/20 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-2">
                                        <Button
                                            size="sm"
                                            className="rounded-xl gap-2 text-xs h-9"
                                            onClick={() => handleUpdateSub(sub)}
                                            disabled={saving === sub.id}
                                        >
                                            {saving === sub.id ? (
                                                <RefreshCw size={14} className="animate-spin" />
                                            ) : (
                                                <Save size={14} />
                                            )}
                                            Anpassungen speichern
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}

                        {error && (
                            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-xs text-destructive font-bold flex items-center gap-2">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-6 border-t border-border bg-muted/10 shrink-0 flex justify-end">
                        <Button
                            variant="primary"
                            className="rounded-2xl h-11 px-8 font-bold"
                            onClick={onClose}
                        >
                            Schließen
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
