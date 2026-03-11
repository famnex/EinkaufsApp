import { useState, useMemo, useEffect } from 'react';
import useLockBodyScroll from '../hooks/useLockBodyScroll';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, Sparkles, Loader2, Play, CheckCircle2, ChevronRight, LayoutGrid } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { cn } from '../lib/utils';
import api from '../lib/axios';
import BulkGlobalizeCard from './BulkGlobalizeCard';

export default function BulkGlobalizeModal({ isOpen, onClose, products = [], onRefresh }) {
    const [step, setStep] = useState('selection'); // 'selection' | 'pipeline'
    const [queue, setQueue] = useState([]);
    const [activeIds, setActiveIds] = useState([]); // Up to 6
    const [globalProducts, setGlobalProducts] = useState([]);
    const [allIntolerances, setAllIntolerances] = useState([]);
    const [allVariants, setAllVariants] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
            setStep('selection');
            setActiveIds([]);
            setQueue([]);
        }
    }, [isOpen]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [prodRes, intolRes, varRes] = await Promise.all([
                api.get('/products'),
                api.get('/intolerances'),
                api.get('/variants')
            ]);
            setGlobalProducts(prodRes.data.filter(p => p.UserId === null));
            setAllIntolerances(intolRes.data);
            setAllVariants(varRes.data);
        } catch (err) {
            console.error('Failed to fetch initial data:', err);
        } finally {
            setLoading(false);
        }
    };

    useLockBodyScroll(isOpen);

    const inboxProducts = useMemo(() => {
        return products.filter(p => p.UserId !== null);
    }, [products]);

    const startPipeline = () => {
        if (inboxProducts.length === 0) return;
        const initialQueue = [...inboxProducts];
        const initialActive = initialQueue.splice(0, 6);
        setQueue(initialQueue);
        setActiveIds(initialActive.map(p => p.id));
        setStep('pipeline');
    };

    const handleCardComplete = (productId, action) => {
        if (onRefresh) onRefresh();

        setActiveIds(prev => {
            const nextIds = prev.filter(id => id !== productId);
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
                                        <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
                                            <Globe size={20} />
                                        </div>
                                        Bulk-Globalisierung
                                    </h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {step === 'selection'
                                            ? 'Verarbeite Produkte aus der Inbox und ordne sie globalen Produkten zu.'
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
                                                <div className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-xl shadow-sm">
                                                    <LayoutGrid size={16} className="text-primary" />
                                                    <span className="font-bold">{inboxProducts.length}</span>
                                                    <span className="text-muted-foreground text-sm pl-1">Produkte in der Inbox</span>
                                                </div>
                                            </div>

                                            <Button
                                                onClick={startPipeline}
                                                disabled={inboxProducts.length === 0 || loading}
                                                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-8 h-12 rounded-xl shadow-lg shadow-primary/20 font-bold"
                                            >
                                                {loading ? <Loader2 className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                                                Pipeline starten
                                                <ChevronRight size={18} />
                                            </Button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                {inboxProducts.map(product => (
                                                    <div
                                                        key={product.id}
                                                        className="p-4 rounded-2xl border bg-card border-border hover:border-primary/40 hover:shadow-md transition-all flex items-center justify-between group"
                                                    >
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-semibold truncate">{product.name}</span>
                                                            <span className="text-[10px] text-muted-foreground truncate uppercase font-bold tracking-tight">
                                                                {product.category || 'Keine Kategorie'} • {product.unit || 'Keine Einheit'}
                                                            </span>
                                                        </div>
                                                        <div className="w-8 h-8 rounded-lg bg-blue-500/5 flex items-center justify-center text-blue-500/40 group-hover:text-blue-500 transition-colors">
                                                            <Globe size={18} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {inboxProducts.length === 0 && !loading && (
                                                <div className="h-full flex flex-col items-center justify-center p-20 text-center text-muted-foreground opacity-60">
                                                    <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-6">
                                                        <CheckCircle2 size={40} />
                                                    </div>
                                                    <p className="text-xl font-bold text-foreground mb-2">Inbox leer!</p>
                                                    <p className="text-sm">Es gibt keine Produkte, die globalisiert werden müssen.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* Pipeline Step */
                                    <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
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
                                                            className="min-h-[520px]"
                                                        >
                                                            <BulkGlobalizeCard
                                                                product={product}
                                                                globalProducts={globalProducts}
                                                                allIntolerances={allIntolerances}
                                                                allVariants={allVariants}
                                                                onComplete={(id, action) => handleCardComplete(id, action)}
                                                            />
                                                        </motion.div>
                                                    );
                                                })}
                                            </AnimatePresence>
                                        </div>

                                        {activeIds.length === 0 && (
                                            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center text-white mb-8 shadow-2xl shadow-green-500/20"
                                                >
                                                    <CheckCircle2 size={48} />
                                                </motion.div>
                                                <h3 className="text-3xl font-bold mb-3 text-foreground">Hervorragend!</h3>
                                                <p className="text-muted-foreground text-lg mb-10">Alle Produkte aus der Inbox wurden erfolgreich verarbeitet.</p>
                                                <Button size="lg" className="rounded-2xl px-12 h-16 font-bold text-lg shadow-xl" onClick={onClose}>
                                                    Zurück zur Übersicht
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Global Footer */}
                            {step === 'selection' && (
                                <div className="p-6 border-t border-border bg-muted/5 flex justify-between items-center shrink-0">
                                    <div className="text-sm text-muted-foreground italic flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                        Produkte werden entweder mit globalen gematcht oder als neue globale Produkte angelegt.
                                    </div>
                                    <Button variant="ghost" onClick={onClose} className="hover:bg-muted font-semibold">
                                        Abbrechen
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
