import { useState, useMemo, useEffect } from 'react';
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Loader2, Play, Eye, EyeOff, CheckCircle2, ChevronRight, LayoutGrid } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';
import { Card } from './Card';
import { cn } from '../lib/utils';
import api from '../lib/axios';
import AiCleanupCard from './AiCleanupCard';

export default function AiCleanupModal({ isOpen, onClose, products = [], onRefresh }) {
    const [step, setStep] = useState('selection'); // 'selection' | 'pipeline'
    const [showHidden, setShowHidden] = useState(false);
    const [queue, setQueue] = useState([]);
    const [activeIds, setActiveIds] = useState([]); // Up to 6
    const [allIntolerances, setAllIntolerances] = useState([]);
    const [allVariants, setAllVariants] = useState([]);
    const { user } = useAuth();

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [intolRes, varRes] = await Promise.all([
                    api.get('/intolerances'),
                    api.get('/variants')
                ]);
                setAllIntolerances(intolRes.data);
                setAllVariants(varRes.data);
            } catch (err) {
                console.error('Failed to fetch metadata:', err);
            }
        };
        fetchMetadata();
    }, [isOpen]);

    useLockBodyScroll(isOpen);

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setStep('selection');
            setActiveIds([]);
            setQueue([]);
        }
    }, [isOpen]);

    // Cleanup Pipeline Context Name
    const CONTEXT = 'pipeline';

    const visibleProducts = useMemo(() => {
        return products.filter(p => !p.HiddenCleanups?.some(h => h.context === CONTEXT));
    }, [products]);

    const hiddenProducts = useMemo(() => {
        return products.filter(p => p.HiddenCleanups?.some(h => h.context === CONTEXT));
    }, [products]);

    const handleToggleHidden = async (productId) => {
        try {
            await api.post('/ai/cleanup/toggle-hidden', { productId, context: CONTEXT });
            if (onRefresh) onRefresh();
        } catch (e) {
            console.error(e);
        }
    };

    const startPipeline = () => {
        if (visibleProducts.length === 0) return;
        const initialQueue = [...visibleProducts];
        const initialActive = initialQueue.splice(0, 6);
        setQueue(initialQueue);
        setActiveIds(initialActive.map(p => p.id));
        setStep('pipeline');
    };

    const handleCardComplete = (productId, action) => {
        // If the product was saved or rejected, it's now hidden in the DB.
        // We call onRefresh to update the products list in the parent.
        if (action === 'ok' || action === 'rejected') {
            if (onRefresh) onRefresh();
        }

        setActiveIds(prev => {
            const nextIds = prev.filter(id => id !== productId);
            // If we have items in queue, pick the next one
            if (queue.length > 0) {
                const nextInQueue = queue[0];
                setQueue(prevQueue => prevQueue.slice(1));
                return [...nextIds, nextInQueue.id];
            }
            return nextIds;
        });
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="w-full max-w-6xl h-[90vh] relative z-10 flex flex-col pointer-events-auto"
                    >
                        <Card className="flex-1 flex flex-col overflow-hidden border-border shadow-2xl bg-card">
                            {/* Header */}
                            <div className="p-6 border-b border-border flex items-center justify-between shrink-0 bg-background/50 backdrop-blur">
                                <div>
                                    <h2 className="text-2xl font-bold flex items-center gap-3">
                                        <div className="p-2 bg-gradient-to-r from-teal-500 to-emerald-600 rounded-xl text-white shadow-lg shadow-teal-500/20">
                                            <Sparkles size={20} />
                                        </div>
                                        AI Product Cleanup
                                    </h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {step === 'selection'
                                            ? 'Wähle Produkte aus, die du bereinigen möchtest. Verstecke Produkte, die bereits korrekt sind.'
                                            : `Pipeline: ${queue.length + activeIds.length} Produkte verbleibend.`}
                                    </p>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Main Context */}
                            <div className="flex-1 overflow-hidden relative flex flex-col">
                                {step === 'selection' ? (
                                    <div className="flex-1 flex flex-col min-h-0">
                                        <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between sticky top-0 z-10">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-xl shadow-sm">
                                                    <LayoutGrid size={16} className="text-primary" />
                                                    <span className="font-bold">{visibleProducts.length}</span>
                                                    <span className="text-muted-foreground text-sm">Produkte zu prüfen</span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setShowHidden(!showHidden)}
                                                    className={cn("gap-2", showHidden && "bg-primary/10 text-primary")}
                                                >
                                                    {showHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                                                    {showHidden ? 'Versteckte ausblenden' : 'Versteckte zeigen'}
                                                </Button>
                                            </div>

                                            <Button
                                                onClick={startPipeline}
                                                disabled={visibleProducts.length === 0}
                                                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-6 h-11 rounded-xl shadow-lg shadow-primary/20"
                                            >
                                                Start AI Cleanup
                                                <ChevronRight size={18} />
                                            </Button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                {(showHidden ? products : visibleProducts).map(product => {
                                                    const isHidden = product.HiddenCleanups?.some(h => h.context === CONTEXT);
                                                    return (
                                                        <div
                                                            key={product.id}
                                                            className={cn(
                                                                "p-4 rounded-2xl border transition-all flex items-center justify-between group",
                                                                isHidden
                                                                    ? "bg-muted/30 border-transparent opacity-60 grayscale"
                                                                    : "bg-card border-border hover:border-primary/40 hover:shadow-md"
                                                            )}
                                                        >
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-semibold truncate">{product.name}</span>
                                                                <span className="text-xs text-muted-foreground truncate">
                                                                    {product.category || 'Keine Kategorie'} • {product.unit || 'Keine Einheit'}
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => handleToggleHidden(product.id)}
                                                                className={cn(
                                                                    "p-2 rounded-xl transition-colors shrink-0",
                                                                    isHidden
                                                                        ? "bg-primary/10 text-primary"
                                                                        : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                                                )}
                                                                title={isHidden ? "Wieder einblenden" : "Für Pipeline verstecken"}
                                                            >
                                                                {isHidden ? <Eye size={18} /> : <EyeOff size={18} />}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {(showHidden ? products : visibleProducts).length === 0 && (
                                                <div className="h-full flex flex-col items-center justify-center p-20 text-center text-muted-foreground">
                                                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                                        <CheckCircle2 size={32} />
                                                    </div>
                                                    <p className="text-lg font-medium">Alles erledigt!</p>
                                                    <p className="text-sm">Es gibt keine weiteren Produkte zum Bereinigen.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* Pipeline Step */
                                    <div className="flex-1 overflow-y-auto p-6 bg-muted/20">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <AnimatePresence mode="popLayout">
                                                {activeIds.map(productId => {
                                                    const product = products.find(p => p.id === productId);
                                                    if (!product) return null;
                                                    return (
                                                        <motion.div
                                                            key={productId}
                                                            layout
                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.9, y: -20 }}
                                                            className="h-[480px]"
                                                        >
                                                            <AiCleanupCard
                                                                product={product}
                                                                onComplete={(id, action) => handleCardComplete(id, action)}
                                                                context={CONTEXT}
                                                                allIntolerances={allIntolerances}
                                                                allVariants={allVariants}
                                                            />
                                                        </motion.div>
                                                    );
                                                })}
                                            </AnimatePresence>
                                        </div>

                                        {activeIds.length === 0 && (
                                            <div className="h-full flex flex-col items-center justify-center p-20 text-center">
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white mb-6 shadow-xl shadow-green-500/20"
                                                >
                                                    <CheckCircle2 size={40} />
                                                </motion.div>
                                                <h3 className="text-2xl font-bold mb-2">Fertig!</h3>
                                                <p className="text-muted-foreground mb-8">Alle ausgewählten Produkte wurden verarbeitet.</p>
                                                <Button size="lg" className="rounded-xl px-10 h-14 font-bold" onClick={onClose}>
                                                    Schließen
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Global Footer (only for selection maybe?) */}
                            {step === 'selection' && (
                                <div className="p-4 md:p-6 border-t border-border bg-muted/10 flex justify-between items-center shrink-0">
                                    <div className="text-sm text-muted-foreground italic">
                                        Versteckte Produkte werden nicht in der Pipeline angezeigt.
                                    </div>
                                    <Button variant="ghost" onClick={onClose}>
                                        Schließen
                                    </Button>
                                </div>
                            )}
                        </Card>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
