import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { ShoppingCart, Plus, Trash2, CheckCircle2, Circle, ArrowLeft, Package, Search, List, X, Euro, Settings, Lock, ZoomIn, ZoomOut, Archive } from 'lucide-react';
import { cn, getImageUrl } from '../lib/utils';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import ItemSettingsModal from '../components/ItemSettingsModal';
import QuantityModal from '../components/QuantityModal';
import ProductSubstituteModal from '../components/ProductSubstituteModal';
import AiListUrlModal from '../components/AiListUrlModal';
import { SessionSkeleton } from '../components/Skeleton';
import { Store as StoreIcon, Check, Wand2, Import } from 'lucide-react';
import { useEditMode } from '../contexts/EditModeContext';
import { useSync } from '../contexts/SyncContext';
import { useAuth } from '../contexts/AuthContext';
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from '../components/SortableItem';
import AiActionConfirmModal from '../components/AiActionConfirmModal';
import SubscriptionModal from '../components/SubscriptionModal';
import AiLockedModal from '../components/AiLockedModal';

export default function ListDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, refreshUser } = useAuth();
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
    const [intoleranceMessages, setIntoleranceMessages] = useState([]);
    const [conflicts, setConflicts] = useState([]);

    // UI State
    const [settingsItem, setSettingsItem] = useState(null);
    const [quantityItem, setQuantityItem] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeNoteId, setActiveNoteId] = useState(null);
    const [ingredientSources, setIngredientSources] = useState({});
    const [activeSourceId, setActiveSourceId] = useState(null);
    const [anchorRect, setAnchorRect] = useState(null);
    const [bubbleDirection, setBubbleDirection] = useState('up');

    // Product Substitution State
    const [substituteModalOpen, setSubstituteModalOpen] = useState(false);
    const [substituteTarget, setSubstituteTarget] = useState(null);
    const [substituteSuggestions, setSubstituteSuggestions] = useState([]);
    const [substituteLoading, setSubstituteLoading] = useState(false);

    // AI List Import State
    const [aiImportModalOpen, setAiImportModalOpen] = useState(false);

    // AI Confirmation State
    const [aiConfirmModalOpen, setAiConfirmModalOpen] = useState(false);
    const [aiActionData, setAiActionData] = useState(null);
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
    const [isAiLockedOpen, setIsAiLockedOpen] = useState(false);

    // Double-Tap Detection (use ref to avoid closure issues)
    const lastTapTimeRef = useRef(null);
    const lastTapItemRef = useRef(null);
    const singleTapTimeoutRef = useRef(null);

    // Track locally deleted items to prevent them from reappearing during polling
    const pendingDeletesRef = useRef(new Set());
    // Track locally toggled bought states to prevent flickering during polling
    const pendingTogglesRef = useRef(new Map());

    // Track known item IDs to only animate truly new items (not on re-render/rotation)
    const knownItemIdsRef = useRef(new Set());

    // DnD State
    const [activeId, setActiveId] = useState(null);
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
    );

    // Derived Lists
    const uncommittedItemsRaw = list?.ListItems?.filter(i => !i.is_committed) || [];
    const unbought = uncommittedItemsRaw.filter(i => !i.is_bought);
    const bought = uncommittedItemsRaw.filter(i => i.is_bought).sort((a, b) => {
        return new Date(a.bought_at || 0) - new Date(b.bought_at || 0);
    });
    const uncommittedItems = [...unbought, ...bought];
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
            const { data } = await api.get(`/lists/${id}`, { skipCache: true });
            setActiveStoreId(data.CurrentStoreId || '');

            // Filter out items that were optimistically deleted but server hasn't caught up yet
            if (pendingDeletesRef.current.size > 0) {
                data.ListItems = data.ListItems.filter(i => !pendingDeletesRef.current.has(i.id));
            }

            // Apply pending toggle states over server data
            if (pendingTogglesRef.current.size > 0) {
                data.ListItems = data.ListItems.map(i => {
                    const toggle = pendingTogglesRef.current.get(i.id);
                    if (toggle) {
                        return { ...i, is_bought: toggle.is_bought, bought_at: toggle.bought_at };
                    }
                    return i;
                });
            }

            setList(data);
            return data;
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

    const fetchIngredientSources = useCallback(async () => {
        if (!id) return;
        try {
            const { data } = await api.get(`/lists/${id}/ingredient-sources`);
            setIngredientSources(data);
        } catch (err) {
            console.error('Failed to fetch ingredient sources', err);
        }
    }, [id]);

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
        fetchIngredientSources();
    }, [fetchListDetails, fetchProducts, fetchStores, fetchIngredientSources]);

    // Live polling every 5s for collaborative shopping
    // Use refs so the interval callback always reads the latest state and function
    const isPollingPausedRef = useRef(false);
    isPollingPausedRef.current = isSettingsOpen || isQuantityModalOpen || substituteModalOpen || aiImportModalOpen || aiConfirmModalOpen || !!searchTerm || !!activeId;

    const fetchListDetailsRef = useRef(fetchListDetails);
    fetchListDetailsRef.current = fetchListDetails;

    useEffect(() => {
        const interval = setInterval(() => {
            if (!isPollingPausedRef.current) {
                console.log('[ListDetail] Polling list...');
                fetchListDetailsRef.current();
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [id]); // Re-create interval only when list ID changes

    useEffect(() => {
        if (!activeNoteId) return;
        const handleGlobalClick = () => setActiveNoteId(null);
        document.addEventListener('click', handleGlobalClick);
        return () => document.removeEventListener('click', handleGlobalClick);
    }, [activeNoteId]);

    // Close ingredient source bubble on scroll or click outside
    useEffect(() => {
        if (!activeSourceId) return;
        const handleClose = () => setActiveSourceId(null);
        window.addEventListener('scroll', handleClose, { passive: true });
        document.addEventListener('click', handleClose);
        return () => {
            window.removeEventListener('scroll', handleClose);
            document.removeEventListener('click', handleClose);
        };
    }, [activeSourceId]);

    const fetchIntoleranceConflicts = useCallback(async (productId) => {
        if (!productId) return { messages: [], maxProbability: 0 };
        const canAccessCheck = ['Plastikgabel', 'Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.tier) ||
            ['Plastikgabel', 'Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.householdOwnerTier) ||
            user?.tier?.includes('Admin') || user?.role === 'admin';
        if (!canAccessCheck) return { messages: [], maxProbability: 0 };
        try {
            const { data: conflicts } = await api.post('/intolerances/check', { productIds: [productId] });
            if (conflicts && conflicts.length > 0) {
                const messages = [];
                let maxProb = 0;
                conflicts.forEach(pc => {
                    if (pc.warnings) {
                        pc.warnings.forEach(w => {
                            const householdName = (pc.username && pc.username !== user?.username) ? ` (${pc.username})` : '';
                            messages.push(`🛑 Unverträglichkeit: ${w.message}${householdName}`);
                            const prob = w.probability !== undefined ? w.probability : 100;
                            if (prob > maxProb) maxProb = prob;
                        });
                    }
                });
                return {
                    messages: [...new Set(messages)],
                    maxProbability: maxProb
                };
            }
        } catch (err) {
            console.error('Failed to check intolerances', err);
            if (err.response?.status === 429) {
                alert(err.response.data.error);
            }
        }
        return { messages: [], maxProbability: 0 };
    }, [user?.username, user?.tier, user?.householdOwnerTier, user?.role]);

    useEffect(() => {
        if (selectedItem?.Product?.id && isSettingsOpen) {
            fetchIntoleranceConflicts(selectedItem.Product.id).then(setIntoleranceMessages);
        } else if (!isQuantityModalOpen) {
            // Keep messages if quantity modal is open (since it uses them too)
            // But reset if everything is closed
            if (!isSettingsOpen && !isQuantityModalOpen) {
                setIntoleranceMessages([]);
            }
        }
    }, [selectedItem, isSettingsOpen, isQuantityModalOpen, fetchIntoleranceConflicts]);

    const handleAddItem = async (product) => {
        setPendingProduct(product);
        setSearchTerm('');
        setSuggestions([]);

        if (product && typeof product === 'object' && product.id) {
            const conflictData = await fetchIntoleranceConflicts(product.id);
            setIntoleranceMessages(conflictData);
        } else {
            setIntoleranceMessages({ messages: [], maxProbability: 0 });
        }

        setIsQuantityModalOpen(true);
    };

    const onConfirmQuantity = async (quantity, unit, note, variationId) => {
        if (!pendingProduct) return;
        try {
            let productId = pendingProduct.id;

            // If it's a new product string, create it first
            if (typeof pendingProduct === 'string') {
                const { data: newProd } = await api.post('/products', {
                    name: pendingProduct,
                    unit: unit,
                    note: note
                });
                productId = newProd.id;
            }

            await api.post(`/lists/${id}/items`, {
                ProductId: productId,
                quantity: quantity,
                unit: unit,
                note: note,
                ProductVariationId: variationId || null
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

    // === Product Substitution Handlers ===
    const handleOpenSubstituteModal = async (item) => {
        // Double-Tap Substitution ist immer kostenlos und für alle Tiers verfügbar
        startSubstituteSearch(item);
    };

    const startSubstituteSearch = async (item) => {
        setSubstituteTarget(item);
        setSubstituteModalOpen(true);
        setSubstituteLoading(true);
        setSubstituteSuggestions([]);

        try {
            const { data } = await api.post('/ai/suggest-substitute', {
                productName: item.Product.name,
                context: 'Einkaufen'
            });

            const suggestedProducts = data.suggestions || [];
            setSubstituteSuggestions(suggestedProducts);

            // Fetch intolerance conflicts for suggestions
            if (suggestedProducts.length > 0) {
                // We need names to check against intolerances, but the check endpoint usually wants IDs.
                // However, let's see if we can find existing products for these names.
                const productNames = suggestedProducts.map(s => s.name.toLowerCase());
                const matchingProducts = allProducts.filter(p => productNames.includes(p.name.toLowerCase()));

                if (matchingProducts.length > 0) {
                    const productIds = matchingProducts.map(p => p.id);
                    const canAccessCheck = ['Plastikgabel', 'Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.tier) ||
                        ['Plastikgabel', 'Silbergabel', 'Goldgabel', 'Rainbowspoon', 'Regenbogengabel'].includes(user?.householdOwnerTier) ||
                        user?.tier?.includes('Admin') || user?.role === 'admin';
                    if (canAccessCheck) {
                        api.post('/intolerances/check', { productIds })
                            .then(res => setConflicts(res.data))
                            .catch(err => {
                                console.error("Failed to check substitute intolerances", err);
                                if (err.response?.status === 429) {
                                    alert(err.response.data.error);
                                }
                            });
                    }
                }
            }

            // Refresh user credits
            refreshUser();
        } catch (err) {
            console.error('Failed to get AI suggestions:', err);
            // Error handling already in modal logic usually, but here we provide a fallback
            alert(err.response?.data?.error || 'KI-Vorschläge konnten nicht geladen werden.');
            setSubstituteModalOpen(false);
        } finally {
            setSubstituteLoading(false);
        }
    };

    const handleSelectSubstitute = async (suggestion) => {
        if (!window.confirm(`"${substituteTarget.Product.name}" durch "${suggestion.name}" ersetzen?`)) {
            return;
        }

        try {
            // 1. Check if product exists, create if not
            let substituteProduct = allProducts.find(p =>
                p.name.toLowerCase() === suggestion.name.toLowerCase()
            );

            if (!substituteProduct) {
                // Create new product
                const { data: newProduct } = await api.post('/products', {
                    name: suggestion.name,
                    category: substituteTarget.Product.category,
                    unit: substituteTarget.Product.unit || 'Stück'
                });
                substituteProduct = newProduct;

                // Refresh products list
                fetchProducts();
            }

            // 2. Add substitute to list (same quantity/unit)
            await api.post(`/lists/${id}/items`, {
                ProductId: substituteProduct.id,
                quantity: substituteTarget.quantity,
                unit: substituteTarget.unit || substituteTarget.Product.unit
            });

            // 3. Delete original product from list
            await api.delete(`/lists/items/${substituteTarget.id}`);

            // 4. Refresh list
            await fetchListDetails();

            // 5. Close modal
            setSubstituteModalOpen(false);
            setSubstituteTarget(null);

        } catch (err) {
            console.error('Failed to substitute product:', err);
            alert('Austausch fehlgeschlagen.');
        }
    };

    const toggleBought = async (item) => {
        if (!activeStoreId) {
            alert("Bitte wähle zuerst ein Geschäft aus!");
            return;
        }

        const newBoughtState = !item.is_bought;
        const newBoughtAt = newBoughtState ? new Date().toISOString() : null;

        // Track this toggle so polling doesn't revert the state
        pendingTogglesRef.current.set(item.id, { is_bought: newBoughtState, bought_at: newBoughtAt });
        setTimeout(() => pendingTogglesRef.current.delete(item.id), 10000);

        // Optimistic UI update
        setList(prev => ({
            ...prev,
            ListItems: prev.ListItems.map(i =>
                i.id === item.id ? { ...i, is_bought: newBoughtState, bought_at: newBoughtAt } : i
            )
        }));

        // Queue Change
        addChange('PUT', `/lists/items/${item.id}`, {
            is_bought: newBoughtState
        });
    };

    const deleteItem = async (itemId) => {
        // Track this deletion so polling doesn't resurrect the item
        pendingDeletesRef.current.add(itemId);
        setTimeout(() => pendingDeletesRef.current.delete(itemId), 10000); // Clear after 10s

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
            const lowerVal = val.toLowerCase();
            const filtered = allProducts.map(p => {
                // Return object with match details or null
                // 1. Name Match
                if (p.name.toLowerCase().includes(lowerVal)) return { ...p, matchedSynonym: null };

                // 2. Synonym Match
                let syns = [];
                try {
                    syns = Array.isArray(p.synonyms) ? p.synonyms : JSON.parse(p.synonyms || '[]');
                } catch (e) { syns = []; }

                if (Array.isArray(syns)) {
                    const match = syns.find(s => s.toLowerCase().includes(lowerVal));
                    if (match) return { ...p, matchedSynonym: match };
                }

                // 3. Category Match (lowest priority)
                if (p.category?.toLowerCase().includes(lowerVal)) return { ...p, matchedSynonym: null };

                return null;
            }).filter(p => p !== null).slice(0, 5);
            setSuggestions(filtered);
        } else {
            setSuggestions([]);
        }
    };

    const handleArchive = async () => {
        try {
            await api.put(`/lists/${id}`, { status: 'archived' });
            navigate('/');
        } catch (err) {
            console.error('Failed to archive list', err);
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
            const updatedList = await fetchListDetails(); // Refresh to see locked items

            // Check if archiving is appropriate
            const uncommitted = updatedList.ListItems.filter(i => !i.is_committed);
            if (uncommitted.length === 0 && updatedList.status === 'active') {
                if (window.confirm("Die Einkaufsliste ist erledigt. Möchtest du sie archivieren?")) {
                    handleArchive();
                }
            }
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

                    {/* Store Selector & AI Import */}
                    <div className="flex items-center gap-2 md:gap-3 shrink-0">
                        <button
                            onClick={() => setAiImportModalOpen(true)}
                            className="w-10 h-10 md:w-12 md:h-12 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 rounded-xl flex items-center justify-center transition-colors border border-indigo-500/20 shrink-0"
                            title="Smart Import"
                        >
                            <Import size={20} className="md:size-[24px]" />
                        </button>

                        {(() => {
                            const activeStore = stores.find(s => s.id == activeStoreId);
                            if (activeStore?.logo_url) {
                                return (
                                    <img
                                        src={getImageUrl(activeStore.logo_url)}
                                        alt={activeStore.name}
                                        className="w-10 h-10 md:w-12 md:h-12 object-contain bg-white rounded-xl p-1 shadow-sm border border-border shrink-0"
                                    />
                                );
                            }
                            return null;
                        })()}
                        <div className="relative group max-w-[110px] sm:max-w-[140px] md:max-w-none">
                            <select
                                value={activeStoreId}
                                onChange={(e) => updateCurrentStore(e.target.value)}
                                className="w-full appearance-none bg-muted/50 border border-border rounded-xl px-3 md:px-4 pr-8 md:pr-10 h-10 md:h-12 text-[11px] md:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer truncate"
                            >
                                <option value="">Geschäft...</option>
                                {stores.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                            <StoreIcon size={14} className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none md:size-4" />
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
                                            <div className="text-xs text-muted-foreground">
                                                {p.matchedSynonym ? (
                                                    <span className="text-primary italic">Synonym: "{p.matchedSynonym}"</span>
                                                ) : (
                                                    p.category || 'Produkt'
                                                )}
                                            </div>
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
                                    <AnimatePresence mode="popLayout">
                                        {uncommittedItems.map((item) => {
                                            const isNew = !knownItemIdsRef.current.has(item.id);
                                            if (isNew) knownItemIdsRef.current.add(item.id);
                                            return (
                                                <motion.div
                                                    key={item.id}
                                                    layout
                                                    initial={isNew ? { opacity: 0, scale: 0.8 } : false}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.25 } }}
                                                    transition={{
                                                        layout: {
                                                            duration: 0.4,
                                                            ease: [0.4, 0, 0.2, 1]
                                                        },
                                                        opacity: { duration: 0.3 },
                                                        scale: { duration: 0.3 }
                                                    }}
                                                    className={cn(
                                                        "relative group w-full aspect-square",
                                                        (activeNoteId === item.id || activeSourceId === item.id) && "z-[150]"
                                                    )}
                                                >
                                                    <SortableItem
                                                        id={item.id}
                                                        disabled={editMode !== 'view'}
                                                        className="w-full h-full"
                                                    >

                                                        {/* Card Content - Restored Visual Identity */}
                                                        <div
                                                            onClick={() => {
                                                                if (activeId) return; // Ignore during drag

                                                                // DOUBLE-TAP DETECTION (only in view mode)
                                                                if (editMode === 'view') {
                                                                    const now = Date.now();

                                                                    // Check for double-tap
                                                                    if (lastTapTimeRef.current && now - lastTapTimeRef.current < 300 && lastTapItemRef.current === item.id) {
                                                                        // DOUBLE TAP DETECTED!
                                                                        // Cancel pending single-tap action
                                                                        if (singleTapTimeoutRef.current) {
                                                                            clearTimeout(singleTapTimeoutRef.current);
                                                                            singleTapTimeoutRef.current = null;
                                                                        }

                                                                        handleOpenSubstituteModal(item);
                                                                        lastTapTimeRef.current = null;
                                                                        lastTapItemRef.current = null;
                                                                        return;
                                                                    }

                                                                    // SINGLE TAP - Delayed execution (wait for potential 2nd tap)
                                                                    lastTapTimeRef.current = now;
                                                                    lastTapItemRef.current = item.id;

                                                                    // Clear any existing timeout
                                                                    if (singleTapTimeoutRef.current) {
                                                                        clearTimeout(singleTapTimeoutRef.current);
                                                                    }

                                                                    // Execute after 300ms (if no 2nd tap arrives)
                                                                    singleTapTimeoutRef.current = setTimeout(() => {
                                                                        toggleBought(item);
                                                                        singleTapTimeoutRef.current = null;
                                                                    }, 300);
                                                                    return;
                                                                }

                                                                // Other modes (edit, delete) - immediate action
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
                                                                (activeNoteId === item.id || activeSourceId === item.id) && "z-[100]", // Elevate active tile
                                                                "hover:z-50" // Elevate tile on hover
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
                                                            {item.note && editMode === 'view' && (
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
                                                                            {item.note}
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
                                                            <div className={cn(
                                                                "text-center px-1 z-10 relative mt-0 flex flex-col justify-center flex-grow pt-2 md:pt-0",
                                                                zoomLevel === 0 ? "pb-8" : "mb-auto" // Add bottom padding for quantity in small tiles
                                                            )}>
                                                                <div className={cn(
                                                                    "font-bold leading-none tracking-wide text-white line-clamp-2 break-words text-shadow-sm hyphens-auto",
                                                                    zoomLevel === 0 ? "text-sm md:text-lg" : "text-xl md:text-2xl"
                                                                )} lang="de">
                                                                    {item.Product?.name}
                                                                    {item.ProductVariation?.ProductVariant?.title && (
                                                                        <span className="text-[0.7em] block opacity-90 mt-0.5 leading-tight">
                                                                            {item.ProductVariation.ProductVariant.title}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-white/80 mt-1 font-medium tracking-wider uppercase truncate">
                                                                    {item.ProductVariation?.category || item.Product?.category || 'Sonstiges'}
                                                                </div>
                                                            </div>

                                                            {/* Bottom: Quantity */}
                                                            <div
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setQuantityItem(item);
                                                                }}
                                                                className={cn(
                                                                    "mx-auto bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wider transition-colors z-10 backdrop-blur-sm",
                                                                    zoomLevel === 0
                                                                        ? "absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap" // Fixed bottom in small tiles
                                                                        : "relative mt-2" // Standard flow for larger tiles
                                                                )}
                                                            >
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <span>{item.quantity}</span>
                                                                    <span className="text-[10px] opacity-80">{(item.unit || item.Product?.unit) === 'Stück' ? 'Stk' : (item.unit || item.Product?.unit)}</span>
                                                                    {ingredientSources[item.ProductId] && (() => {
                                                                        const sources = ingredientSources[item.ProductId];
                                                                        const totalRecipeQty = sources.reduce((sum, src) => sum + Number(src.quantity), 0);
                                                                        const firstUnit = sources[0]?.unit;
                                                                        const sameQty = Math.abs(totalRecipeQty - Number(item.quantity)) < 0.001 && firstUnit === item.unit;
                                                                        if (sameQty) return null;

                                                                        return (
                                                                            <div className="relative isolate flex items-center">
                                                                                <Search
                                                                                    size={12}
                                                                                    className={cn(
                                                                                        "cursor-pointer transition-all hover:scale-125 z-50",
                                                                                        activeSourceId === item.id ? "text-primary opacity-100" : "opacity-50 hover:opacity-100"
                                                                                    )}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                                        setAnchorRect(rect);
                                                                                        const spaceAbove = rect.top;
                                                                                        setBubbleDirection(spaceAbove < 250 ? 'down' : 'up');
                                                                                        setActiveSourceId(activeSourceId === item.id ? null : item.id);
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </div>


                                                        </div>
                                                    </SortableItem>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
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
                        {uncommittedItems.length > 0 ? (
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
                        ) : list.ListItems?.length > 0 && list.status === 'active' && (
                            <div className="pt-8 pb-4 flex justify-center">
                                <Button
                                    size="lg"
                                    onClick={handleArchive}
                                    className="bg-green-600 hover:bg-green-700 text-white font-bebas tracking-wide text-xl px-8 py-6 rounded-2xl shadow-xl hover:scale-105 transition-all w-full md:w-auto"
                                >
                                    <Archive className="mr-2" />
                                    Liste archivieren
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
                )
                }

                {
                    list.ListItems?.length === 0 && !loading && (
                        <div className="w-full py-20 text-center border-2 border-dashed border-border rounded-3xl">
                            <ShoppingCart size={48} className="mx-auto text-muted-foreground/20 mb-4" />
                            <p className="text-muted-foreground font-medium px-10">Deine Liste ist noch leer. Suche Artikel zum Hinzufügen.</p>
                        </div>
                    )
                }
            </div >


            <AiListUrlModal
                isOpen={aiImportModalOpen}
                onClose={() => setAiImportModalOpen(false)}
                listId={id}
                onItemsAdded={fetchListDetails}
            />

            <ItemSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                item={selectedItem}
                onSave={handleUpdateItem}
                onDelete={deleteItem}
                intoleranceData={intoleranceMessages}
            />

            <QuantityModal
                isOpen={isQuantityModalOpen}
                onClose={() => {
                    setIsQuantityModalOpen(false);
                    setIntoleranceMessages({ messages: [], maxProbability: 0 });
                }}
                productName={typeof pendingProduct === 'string' ? pendingProduct : pendingProduct?.name}
                defaultUnit={typeof pendingProduct === 'object' ? pendingProduct?.unit : 'Stück'}
                productNote={typeof pendingProduct === 'object' ? pendingProduct?.note : ''}
                variations={pendingProduct?.ProductVariations || []}
                onConfirm={onConfirmQuantity}
                intoleranceData={intoleranceMessages}
            />

            <ProductSubstituteModal
                isOpen={substituteModalOpen}
                onClose={() => {
                    setSubstituteModalOpen(false);
                    setSubstituteTarget(null);
                    setConflicts([]);
                }}
                originalProduct={substituteTarget?.Product}
                suggestions={substituteSuggestions}
                loading={substituteLoading}
                onSelect={handleSelectSubstitute}
                conflicts={conflicts}
                allProducts={allProducts}
            />


            {/* Zoom Controls */}
            <div className="fixed bottom-24 right-4 flex flex-col gap-2 z-40">
                <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setZoomLevel(prev => Math.min(prev + 1, 2))}
                    disabled={zoomLevel >= 2}
                    className="rounded-full shadow-lg bg-background/80 backdrop-blur border border-border text-foreground"
                >
                    <ZoomIn size={20} />
                </Button>
                <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setZoomLevel(prev => Math.max(prev - 1, 0))}
                    disabled={zoomLevel <= 0}
                    className="rounded-full shadow-lg bg-background/80 backdrop-blur border border-border text-foreground"
                >
                    <ZoomOut size={20} />
                </Button>
            </div>

            <AiActionConfirmModal
                isOpen={aiConfirmModalOpen}
                onClose={() => setAiConfirmModalOpen(false)}
                onConfirm={() => {
                    aiActionData?.onConfirm();
                    setAiConfirmModalOpen(false);
                }}
                actionTitle={aiActionData?.title}
                actionDescription={aiActionData?.description}
                cost={aiActionData?.cost}
            />

            <SubscriptionModal
                isOpen={isSubscriptionModalOpen}
                onClose={() => setIsSubscriptionModalOpen(false)}
                currentTier={user?.tier}
            />

            <AiLockedModal
                isOpen={isAiLockedOpen}
                onClose={() => setIsAiLockedOpen(false)}
                featureName="Smart Import"
            />

            {/* Ingredient Source Portal */}
            {activeSourceId && anchorRect && createPortal(
                <div
                    className="fixed z-[900] pointer-events-none"
                    style={{
                        top: bubbleDirection === 'up' ? anchorRect.top : anchorRect.bottom,
                        left: anchorRect.left + anchorRect.width / 2,
                        transform: 'translateX(-50%)',
                    }}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeSourceId}
                            initial={{ opacity: 0, y: bubbleDirection === 'up' ? 10 : -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: bubbleDirection === 'up' ? 10 : -10, scale: 0.95 }}
                            className={cn(
                                "relative w-48 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl border border-white/10 pointer-events-auto",
                                bubbleDirection === 'up' ? "-translate-y-full mb-3" : "mt-3"
                            )}
                        >
                            <div className={cn(
                                "absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45 border-white/10",
                                bubbleDirection === 'up' ? "-bottom-1.5 border-r border-b" : "-top-1.5 border-l border-t"
                            )} />
                            <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2 border-b border-white/10 pb-1">Verwendung</div>
                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                {ingredientSources[list.ListItems.find(i => i.id === activeSourceId)?.ProductId]?.map((src, idx) => (
                                    <div key={idx} className="text-[11px] leading-tight flex flex-col gap-0.5 whitespace-normal">
                                        <div className="font-bold text-white/90 line-clamp-2 text-left">{src.recipeTitle}</div>
                                        <div className="flex justify-between items-center text-white/50 text-[10px]">
                                            <span>{new Date(src.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                                            <span className="font-mono bg-white/5 px-1 rounded whitespace-nowrap">{src.quantity} {src.unit}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>,
                document.body
            )}
        </div >
    );
}
