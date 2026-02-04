import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { ShoppingCart, Plus, Trash2, CheckCircle2, Circle, ArrowLeft, Package, Search, List, X, Euro, Settings, Lock, ZoomIn, ZoomOut } from 'lucide-react';
import { cn, getImageUrl } from '../lib/utils';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import ItemSettingsModal from '../components/ItemSettingsModal';
import QuantityModal from '../components/QuantityModal';
import { SessionSkeleton } from '../components/Skeleton';
import { Store as StoreIcon, Check } from 'lucide-react';
import { useEditMode } from '../contexts/EditModeContext';
import { useSync } from '../contexts/SyncContext';
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from '../components/SortableItem';

export default function ListDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { editMode } = useEditMode();
    const { addChange } = useSync();
    const [list, setList] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [allProducts, setAllProducts] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [zoomLevel, setZoomLevel] = useState(1); // 0: Small, 1: Normal, 2: Large
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false);
    const [pendingProduct, setPendingProduct] = useState(null);
    const [stores, setStores] = useState([]);
    const [activeStoreId, setActiveStoreId] = useState('');

    // UI State
    const [settingsItem, setSettingsItem] = useState(null);
    const [quantityItem, setQuantityItem] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeNoteId, setActiveNoteId] = useState(null);

    // DnD State
    const [activeId, setActiveId] = useState(null);
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
    );

    // Derived Lists
    const uncommittedItems = (list?.ListItems?.filter(i => !i.is_committed) || []).sort((a, b) => {
        if (a.is_bought !== b.is_bought) return a.is_bought ? 1 : -1;
        // Keep original index as secondary sort if possible, or just default to 0
        return 0;
    });
    const committedItems = list?.ListItems?.filter(i => i.is_committed) || [];

    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setList((prev) => {
                const currentUncommitted = prev.ListItems.filter(i => !i.is_committed);
                const currentCommitted = prev.ListItems.filter(i => i.is_committed);

                const uOldIndex = currentUncommitted.findIndex(i => i.id === active.id);
                const uNewIndex = currentUncommitted.findIndex(i => i.id === over.id);

                const newUncommitted = arrayMove(currentUncommitted, uOldIndex, uNewIndex);

                const fullList = [...newUncommitted, ...currentCommitted];

                // Save Order API
                const updates = newUncommitted.map((li, idx) => ({ id: li.id, sort_order: idx }));
                api.put(`/lists/${id}/reorder`, { items: updates }).catch(e => console.error(e));

                return { ...prev, ListItems: fullList };
            });
        }
        setActiveId(null);
    };
    const searchRef = useRef(null);

    const fetchListDetails = useCallback(async () => {
        try {
            const { data } = await api.get(`/lists/${id}`);
            setActiveStoreId(data.CurrentStoreId || '');

            // Server now handles smart sorting.
            // Client only needs to respect the order, but we can ensure bought items are at bottom visually just in case.
            // Actually, server sends [sorted_unbought, sorted_bought], so array order is already correct.
            setList(data);

            // Note: Data from server might have store set in DB, but UI starts empty.
        } catch (err) {
            console.error('Failed to fetch list details', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchStores = useCallback(async () => {
        try {
            const { data } = await api.get('/stores');
            setStores(data);
        } catch (err) {
            console.error('Failed to fetch stores', err);
        }
    }, []);

    const fetchProducts = useCallback(async () => {
        try {
            const { data } = await api.get('/products');
            setAllProducts(data);
        } catch (err) {
            console.error('Failed to fetch products', err);
        }
    }, []);

    useEffect(() => {
        fetchListDetails();
        fetchProducts();
        fetchStores();
    }, [fetchListDetails, fetchProducts, fetchStores]);

    // Close tooltips on click outside
    useEffect(() => {
        if (!activeNoteId) return;
        const handleGlobalClick = () => setActiveNoteId(null);
        document.addEventListener('click', handleGlobalClick);
        return () => document.removeEventListener('click', handleGlobalClick);
    }, [activeNoteId]);

    const handleAddItem = (product) => {
        setPendingProduct(product);
        setIsQuantityModalOpen(true);
        setSearchTerm('');
        setSuggestions([]);
    };

    const onConfirmQuantity = async (quantity, unit) => {
        if (!pendingProduct) return;
        try {
            let productId = pendingProduct.id;

            // If it's a new product string, create it first
            if (typeof pendingProduct === 'string') {
                const { data: newProd } = await api.post('/products', {
                    name: pendingProduct,
                    unit: unit
                });
                productId = newProd.id;
            }

            await api.post(`/lists/${id}/items`, {
                ProductId: productId,
                quantity: quantity,
                unit: unit
            });

            fetchListDetails();
            setPendingProduct(null);
        } catch (err) {
            console.error('Failed to add item', err);
        }
    };

    const updateCurrentStore = async (storeId) => {
        try {
            await api.put(`/lists/${id}`, {
                CurrentStoreId: storeId || null
            });
            setActiveStoreId(storeId);
            fetchListDetails(); // Reload to get new Sort Order!
        } catch (err) {
            console.error('Failed to update current store', err);
        }
    };
    const toggleBought = async (item) => {
        if (!activeStoreId) {
            alert("Bitte wähle zuerst ein Geschäft aus!");
            return;
        }

        const newBoughtState = !item.is_bought;

        // Optimistic UI update
        setList(prev => ({
            ...prev,
            ListItems: prev.ListItems.map(i =>
                i.id === item.id ? { ...i, is_bought: newBoughtState } : i
            )
        }));

        // Queue Change
        addChange('PUT', `/lists/items/${item.id}`, {
            is_bought: newBoughtState
        });
    };

    const deleteItem = async (itemId) => {
        // Optimistic UI update
        setList(prev => ({
            ...prev,
            ListItems: prev.ListItems.filter(i => i.id !== itemId)
        }));

        // Queue Change
        addChange('DELETE', `/lists/items/${itemId}`);
    };

    const handleUpdateItem = async (updates) => {
        if (!selectedItem) return;
        try {
            await api.put(`/lists/items/${selectedItem.id}`, updates);
            fetchListDetails();
        } catch (err) {
            console.error('Failed to update item', err);
        }
    };

    const handleSearch = (val) => {
        setSearchTerm(val);
        if (val.trim().length > 0) {
            const filtered = allProducts.filter(p =>
                p.name.toLowerCase().includes(val.toLowerCase()) ||
                p.category?.toLowerCase().includes(val.toLowerCase())
            ).slice(0, 5);
            setSuggestions(filtered);
        } else {
            setSuggestions([]);
        }
    };

    const completeSession = async () => {
        if (!activeStoreId) {
            alert("Bitte wähle zuerst ein Geschäft aus!");
            return;
        }
        try {
            await api.post(`/lists/${id}/commit`, {
                storeId: activeStoreId
            });
            fetchListDetails(); // Refresh to see locked items
        } catch (err) {
            console.error('Failed to commit session', err);
        }
    };

    if (loading && !list) return (
        <div className="min-h-screen bg-background p-4">
            <SessionSkeleton />
            <div className="grid grid-cols-3 gap-3 mt-4">
                {Array.from({ length: 9 }).map((_, i) => <div key={i} className="aspect-square bg-muted rounded-xl animate-pulse" />)}
            </div>
        </div>
    );

    if (!list) return <div className="p-10 text-foreground text-center">Liste nicht gefunden.</div>;

    const formattedDate = new Date(list.date).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    return (
        <div className="space-y-6">
            <div className="mb-4 md:mb-8">
                <div className="flex items-center gap-2 md:gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="hidden md:block p-3 bg-muted rounded-2xl text-muted-foreground hover:text-foreground transition-colors active:scale-95 shadow-sm"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-2xl md:text-4xl font-bebas tracking-tight text-foreground">
                            <span className="md:hidden">{list.ListItems?.length || 0} Artikel</span>
                            <span className="hidden md:inline">{list.name || new Date(list.date).toLocaleDateString('de-DE')}</span>
                        </h1>
                        <p className="text-muted-foreground text-xs md:text-sm font-medium">
                            <span className="md:hidden">{new Date(list.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                            <span className="hidden md:inline">Einkaufsliste • {list.ListItems?.length || 0} Artikel</span>
                        </p>
                    </div>

                    {/* Store Selector */}
                    <div className="flex items-center gap-3">
                        {(() => {
                            const activeStore = stores.find(s => s.id == activeStoreId);
                            if (activeStore?.logo_url) {
                                return (
                                    <img
                                        src={getImageUrl(activeStore.logo_url)}
                                        alt={activeStore.name}
                                        className="w-12 h-12 object-contain bg-white rounded-xl p-1 shadow-sm border border-border"
                                    />
                                );
                            }
                            return null;
                        })()}
                        <div className="relative group">
                            <select
                                value={activeStoreId}
                                onChange={(e) => updateCurrentStore(e.target.value)}
                                className="appearance-none bg-muted/50 border border-border rounded-xl px-4 pr-10 h-12 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                            >
                                <option value="">Kein Geschäft</option>
                                {stores.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                            <StoreIcon size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative" ref={searchRef}>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={20} />
                <Input
                    placeholder="Produkt suchen oder hinzufügen..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-12 pr-12 h-14 bg-card border-border rounded-2xl shadow-sm text-lg focus:ring-primary/20"
                />
                {searchTerm && (
                    <button
                        onClick={() => { setSearchTerm(''); setSuggestions([]); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                        <X size={20} />
                    </button>
                )}
                <AnimatePresence>
                    {(suggestions.length > 0 || searchTerm) && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl"
                        >
                            {suggestions.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => handleAddItem(p)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-muted border-b border-border last:border-0 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                                            <Package size={16} />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-foreground font-bold">{p.name}</div>
                                            <div className="text-xs text-muted-foreground">{p.category || 'Produkt'}</div>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-primary"></span>
                                </button>
                            ))}
                            {searchTerm && (
                                <button
                                    onClick={() => handleAddItem(searchTerm)}
                                    className="w-full flex items-center justify-between p-4 bg-primary/5 hover:bg-primary/10 transition-colors border-t border-border"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                                            <Plus size={16} />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-foreground font-bold italic">"{searchTerm}" neu anlegen</div>
                                            <div className="text-xs text-primary font-medium">Produkt erstellen & hinzufügen</div>
                                        </div>
                                    </div>
                                    <Check size={20} className="text-primary" />
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="product-grid pt-4">
                {list.ListItems?.length > 0 && (
                    <>
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                            onDragStart={handleDragStart}
                        >
                            {/* Active Items (Draggable) */}
                            <SortableContext
                                items={uncommittedItems.map(i => i.id)}
                                strategy={rectSortingStrategy}
                            >
                                <motion.div layout className={cn(
                                    "grid gap-4 transition-all duration-300",
                                    zoomLevel === 0 && "grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2",
                                    zoomLevel === 1 && "grid-cols-2 md:grid-cols-4 lg:grid-cols-5",
                                    zoomLevel === 2 && "grid-cols-1 md:grid-cols-3 lg:grid-cols-4"
                                )}>
                                    {uncommittedItems.map((item) => (
                                        <motion.div
                                            key={item.id}
                                            layout
                                            initial={false}
                                            transition={{
                                                layout: {
                                                    duration: 0.4,
                                                    ease: [0.4, 0, 0.2, 1]
                                                }
                                            }}
                                            className="relative group w-full aspect-square"
                                        >
                                            <SortableItem
                                                id={item.id}
                                                disabled={editMode !== 'view'}
                                                className="w-full h-full"
                                            >

                                                {/* Card Content - Restored Visual Identity */}
                                                <div
                                                    onClick={() => {
                                                        if (activeId) return;
                                                        if (editMode === 'view') toggleBought(item);
                                                        if (editMode === 'edit') {
                                                            setSelectedItem(item);
                                                            setIsSettingsOpen(true);
                                                        }
                                                        if (editMode === 'delete') {
                                                            if (window.confirm("Artikel wirklich löschen?")) deleteItem(item.id);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "w-full h-full rounded-3xl p-4 flex flex-col justify-between transition-all cursor-pointer shadow-sm border relative isolate group/tile select-none",
                                                        item.is_bought
                                                            ? "product-tile-teal" // Teal for bought
                                                            : "product-tile-red", // Red for unbought
                                                        editMode !== 'view' && "hover:scale-[1.02]", // Subtle hover in edit/delete
                                                        activeId === item.id && "opacity-30", // Dragging feedback
                                                        "hover:z-50" // Elevate tile on hover for tooltip overlap
                                                    )}
                                                >
                                                    {/* Background Layer - To handle clipping of watermarks while allowing tooltips to overflow the main card */}
                                                    <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-0">
                                                        {/* Mobile: Large Watermark (Base style for all) */}
                                                        <div className={cn(
                                                            "transition-all duration-300 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 flex items-center justify-center opacity-[0.15] scale-150 text-white",
                                                            zoomLevel > 0 && "md:hidden" // Hide mobile watermark on desktop if zoom is active
                                                        )}>
                                                            <ShoppingCart className="w-full h-full p-6" />
                                                        </div>

                                                        {/* Bought Overlay Indicator */}
                                                        {item.is_bought && (
                                                            <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                                                <CheckCircle2 className="w-full h-full p-8 text-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Note Indicator - Direct child for clean stacking. Only show in view mode to avoid overlapping with edit/delete icons. */}
                                                    {item.Product?.note && editMode === 'view' && (
                                                        <div
                                                            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-lg z-30 cursor-pointer group/note"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveNoteId(activeNoteId === item.id ? null : item.id);
                                                            }}
                                                            onTouchStart={(e) => {
                                                                e.stopPropagation();
                                                                e.preventDefault();
                                                                setActiveNoteId(activeNoteId === item.id ? null : item.id);
                                                            }}
                                                            onPointerDown={(e) => e.stopPropagation()}
                                                        >
                                                            <svg
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2.5"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                className="w-4 h-4 animate-pulse"
                                                            >
                                                                <circle cx="12" cy="12" r="10" />
                                                                <line x1="12" y1="8" x2="12" y2="12" />
                                                                <line x1="12" y1="16" x2="12.01" y2="16" />
                                                            </svg>

                                                            <div className={cn(
                                                                "absolute top-full mt-3 z-50 pointer-events-none transition-all duration-200",
                                                                "bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl border border-white/10 translate-y-2",
                                                                "whitespace-normal break-words",
                                                                // Mobile: nudge right and slightly narrower to stay on screen. Desktop: centered.
                                                                "right-[-20px] w-[200px] sm:w-[240px] sm:right-auto sm:left-1/2 sm:-translate-x-1/2",
                                                                (activeNoteId === item.id) ? "opacity-100 translate-y-0" : "opacity-0 group-hover/note:opacity-100 group-hover/note:translate-y-0"
                                                            )}>
                                                                {/* Tooltip Arrow - Responsive centering to icon */}
                                                                <div className="absolute -top-1.5 right-9 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45 border-l border-t border-white/10" />
                                                                <div className="text-[10px] font-bold uppercase tracking-wider text-orange-400 mb-1">Hinweis</div>
                                                                <div className="text-sm font-medium leading-relaxed">
                                                                    {item.Product.note}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {/* Top Row: Icon + Indicator */}
                                                    <div className="flex justify-between items-start z-10 md:relative pointer-events-none"> {/* Icon is purely visual now on mobile */}
                                                        {/* Desktop: Standard Icon (ONLY if NOT small zoom) */}
                                                        {zoomLevel > 0 && (
                                                            <div className="hidden md:relative md:flex md:w-10 md:h-10 md:rounded-full md:bg-white/20 md:opacity-100 md:scale-100 md:z-10 md:items-center md:justify-center">
                                                                <ShoppingCart className="w-full h-full p-2 text-white" />
                                                            </div>
                                                        )}
                                                        <div className="flex-grow" />

                                                        {/* Note Indicator + Mode Indicators - Always visible and on top */}
                                                        <div className="ml-auto flex gap-2 items-center pointer-events-auto">

                                                            {/* Mode Indicators */}
                                                            {editMode === 'edit' && (
                                                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur-sm">
                                                                    <Settings size={18} />
                                                                </div>
                                                            )}
                                                            {editMode === 'delete' && (
                                                                <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center animate-pulse shadow-lg">
                                                                    <Trash2 size={18} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Center: Name */}
                                                    <div className="text-center px-1 z-10 relative mt-0 mb-auto flex flex-col justify-center flex-grow pt-2 md:pt-0"> {/* Adjusted padding/flex */}
                                                        <div className={cn(
                                                            "font-bold leading-none tracking-wide text-white line-clamp-2 break-words text-shadow-sm hyphens-auto",
                                                            zoomLevel === 0 ? "text-sm md:text-lg" : "text-xl md:text-2xl"
                                                        )} lang="de">
                                                            {item.Product?.name}
                                                        </div>
                                                        {item.Product?.Manufacturer?.name && (
                                                            <div className={cn(
                                                                "text-white/70 mt-0.5 font-medium tracking-wide uppercase truncate",
                                                                zoomLevel === 0 ? "text-[8px]" : "text-[10px]"
                                                            )}>
                                                                {item.Product.Manufacturer.name}
                                                            </div>
                                                        )}
                                                        {zoomLevel > 0 && (
                                                            <div className="text-xs text-white/80 mt-1 font-medium tracking-wider uppercase truncate">
                                                                {item.Product?.category || 'Sonstiges'}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Bottom: Quantity */}
                                                    <div
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setQuantityItem(item);
                                                        }}
                                                        className="mx-auto bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wider transition-colors z-10 relative mt-2 backdrop-blur-sm"
                                                    >
                                                        {item.quantity} <span className="text-[10px] opacity-80">{(item.unit || item.Product?.unit) === 'Stück' ? 'Stk' : (item.unit || item.Product?.unit)}</span>
                                                    </div>


                                                </div>
                                            </SortableItem>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            </SortableContext>

                            {/* Drag Overlay */}
                            <DragOverlay>
                                {activeId ? (
                                    <div className="w-[100px] h-[100px] bg-white rounded-3xl shadow-2xl opacity-90 border-2 border-primary flex items-center justify-center">
                                        <ShoppingCart className="text-primary w-8 h-8" />
                                    </div>
                                ) : null}
                            </DragOverlay>

                        </DndContext>

                        {/* Complete Session Button */}
                        {uncommittedItems.length > 0 && (
                            <div className="pt-8 pb-4 flex justify-center">
                                <Button
                                    size="lg"
                                    onClick={completeSession}
                                    disabled={!activeStoreId || !uncommittedItems.some(item => item.is_bought)}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bebas tracking-wide text-xl px-8 py-6 rounded-2xl shadow-xl hover:scale-105 transition-all w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    <CheckCircle2 className="mr-2" />
                                    Einkauf abschließen
                                </Button>
                            </div>
                        )}

                        {/* Committed Items (Static / Locked) */}
                        {committedItems.length > 0 && (
                            <div className="pt-8 mt-4 border-t border-dashed border-slate-200 w-full">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 pl-2 flex items-center gap-2">
                                    <Lock size={14} /> Bereits Erledigt
                                </h3>
                                <div className={cn(
                                    "grid gap-4 opacity-60 pointer-events-none select-none grayscale-[0.8]",
                                    zoomLevel === 0 && "grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2",
                                    zoomLevel === 1 && "grid-cols-2 md:grid-cols-4 lg:grid-cols-5",
                                    zoomLevel === 2 && "grid-cols-1 md:grid-cols-3 lg:grid-cols-4"
                                )}>
                                    {committedItems.map(item => (
                                        <div key={item.id} className="relative w-full aspect-square bg-slate-50 rounded-3xl p-4 flex flex-col justify-between border border-transparent">
                                            <div className="flex justify-center pt-2"><CheckCircle2 className="w-6 h-6 text-slate-300" /></div>
                                            <div className="text-center font-bold text-xl text-slate-400 line-clamp-2 px-1">{item.Product?.name}</div>
                                            <div className="mx-auto text-xs text-slate-300 pb-2">{item.quantity} {item.unit}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {list.ListItems?.length === 0 && !loading && (
                    <div className="w-full py-20 text-center border-2 border-dashed border-border rounded-3xl">
                        <ShoppingCart size={48} className="mx-auto text-muted-foreground/20 mb-4" />
                        <p className="text-muted-foreground font-medium px-10">Deine Liste ist noch leer. Suche Artikel zum Hinzufügen.</p>
                    </div>
                )}
            </div>


            <ItemSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                item={selectedItem}
                onSave={handleUpdateItem}
                onDelete={deleteItem}
            />

            <QuantityModal
                isOpen={isQuantityModalOpen}
                onClose={() => setIsQuantityModalOpen(false)}
                productName={typeof pendingProduct === 'string' ? pendingProduct : pendingProduct?.name}
                defaultUnit={typeof pendingProduct === 'object' ? pendingProduct?.unit : 'Stück'}
                productNote={typeof pendingProduct === 'object' ? pendingProduct?.note : ''}
                onConfirm={onConfirmQuantity}
            />


            {/* Zoom Controls */}
            <div className="fixed bottom-24 right-4 flex flex-col gap-2 z-40">
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => setZoomLevel(prev => Math.min(prev + 1, 2))}
                    disabled={zoomLevel >= 2}
                    className="rounded-full shadow-lg bg-background/80 backdrop-blur border border-border"
                >
                    <ZoomIn size={20} />
                </Button>
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => setZoomLevel(prev => Math.max(prev - 1, 0))}
                    disabled={zoomLevel <= 0}
                    className="rounded-full shadow-lg bg-background/80 backdrop-blur border border-border"
                >
                    <ZoomOut size={20} />
                </Button>
            </div>

        </div>
    );
}
