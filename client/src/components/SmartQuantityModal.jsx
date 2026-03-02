import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ShoppingCart, AlertCircle, HelpCircle } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../lib/utils';
import api from '../lib/axios';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { useAuth } from '../contexts/AuthContext';

export default function SmartQuantityModal({ isOpen, onClose, recipe, menuId, listId, onConfirm, existingItems = [] }) {
    useLockBodyScroll(isOpen);
    const { user } = useAuth();
    const [selection, setSelection] = useState({});
    const [loading, setLoading] = useState(false);
    const [conflicts, setConflicts] = useState([]);

    useEffect(() => {
        if (isOpen && recipe) {
            const initial = {};
            const hasExisting = existingItems.length > 0;
            const productIds = recipe.RecipeIngredients.map(ri => ri.Product.id);

            recipe.RecipeIngredients.forEach(ri => {
                if (hasExisting) {
                    const found = existingItems.find(i => i.ProductId === ri.Product.id);
                    initial[ri.Product.id] = !!found;
                } else {
                    initial[ri.Product.id] = true;
                }
            });
            setSelection(initial);

            // Fetch intolerance conflicts (only for Silbergabel+ users)
            const hasSpecialTier = ['Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.tier) ||
                ['Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.householdOwnerTier) ||
                user?.tier?.includes('Admin') || user?.role === 'admin';
            if (hasSpecialTier) {
                api.post('/intolerances/check', { productIds })
                    .then(res => setConflicts(res.data))
                    .catch(err => console.error("Failed to check intolerances in planner", err));
            }
        }
    }, [isOpen, recipe, existingItems]);

    const toggleItem = (productId) => {
        setSelection(prev => ({ ...prev, [productId]: !prev[productId] }));
    };

    const handleAdd = async () => {
        setLoading(true);
        try {
            const itemsToAdd = recipe.RecipeIngredients
                .filter(ri => selection[ri.Product.id])
                .map(ri => ({
                    ProductId: ri.Product.id,
                    quantity: ri.amount // Use recipe amount
                }));

            // Sync (PUT)
            await api.put(`/lists/${listId}/recipe-items`, {
                MenuId: menuId,
                items: itemsToAdd
            });

            onConfirm();
            onClose();
        } catch (err) {
            console.error(err);
            alert('Fehler beim Speichern');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveAll = async () => {
        if (!confirm('Alle Zutaten dieses Rezepts von der Liste entfernen?')) return;
        setLoading(true);
        try {
            await api.delete(`/lists/${listId}/recipe-items/${menuId}`);
            onConfirm();
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !recipe) return null;

    const hasExisting = existingItems.length > 0;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card/80 backdrop-blur-md z-10">
                        <div>
                            <h2 className="text-xl font-bebas tracking-wide">Zutatenplaner</h2>
                            <p className="text-xs text-muted-foreground font-medium">Was brauchst du für "{recipe.title}"?</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {recipe.RecipeIngredients.map(ri => {
                            const isSelected = !!selection[ri.Product.id];
                            return (
                                <div
                                    key={ri.id}
                                    onClick={() => toggleItem(ri.Product.id)}
                                    className={cn(
                                        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                                        isSelected
                                            ? "bg-primary/5 border-primary/20 shadow-sm"
                                            : "bg-muted/30 border-transparent opacity-60 hover:opacity-100"
                                    )}
                                >
                                    <div className={cn(
                                        "w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0",
                                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-transparent"
                                    )}>
                                        <Check size={14} strokeWidth={3} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <div className="font-bold text-sm text-foreground">
                                                {ri.Product.name}
                                                {ri.isOptional && <span className="text-muted-foreground text-[10px] ml-1 font-normal">(optional)</span>}
                                            </div>
                                            {(() => {
                                                const conflict = conflicts.find(c => Number(c.productId) === Number(ri.Product.id));
                                                if (!conflict || !conflict.warnings || conflict.warnings.length === 0) return null;

                                                const maxProb = conflict.warnings.reduce((max, w) => Math.max(max, w.probability || 0), 0);
                                                if (maxProb <= 30) return null;

                                                return maxProb >= 80 ? (
                                                    <AlertCircle size={14} className="text-destructive animate-pulse shrink-0" />
                                                ) : (
                                                    <HelpCircle size={14} className="text-orange-500 shrink-0" />
                                                );
                                            })()}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {ri.amount > 0 && <span className="mr-1">{ri.amount.toLocaleString('de-DE')}</span>}
                                            {ri.unit}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-4 border-t border-border bg-muted/20 space-y-3">


                        <div className="flex gap-3">
                            {hasExisting && (
                                <Button
                                    variant="outline"
                                    className="flex-1 text-destructive hover:bg-destructive/10 border-destructive/20 h-12"
                                    onClick={handleRemoveAll}
                                    disabled={loading}
                                >
                                    Alles entfernen
                                </Button>
                            )}
                            <Button
                                className="flex-1 h-12 text-base font-bold shadow-lg shadow-primary/20"
                                onClick={handleAdd}
                                disabled={loading}
                            >
                                {loading ? 'Speichere...' : (hasExisting ? 'Aktualisieren / Ergänzen' : 'Auf die Liste')}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
