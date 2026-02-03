import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { ShoppingCart, Plus, Trash2, CheckCircle2, Circle, ArrowLeft, Package, Search, List, X, Euro, Settings, Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ItemSettingsModal from '../components/ItemSettingsModal';
import QuantityModal from '../components/QuantityModal';
import { SessionSkeleton } from '../components/Skeleton';
import { Store as StoreIcon, Check } from 'lucide-react';
import { useEditMode } from '../contexts/EditModeContext';

export default function ListDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { editMode } = useEditMode();
    const [list, setList] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [allProducts, setAllProducts] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false);
    const [pendingProduct, setPendingProduct] = useState(null);
    const [stores, setStores] = useState([]);
    const [activeStoreId, setActiveStoreId] = useState('');
    const searchRef = useRef(null);

    const fetchListDetails = useCallback(async () => {
        try {
            const { data } = await api.get(`/lists/${id}`);
            setActiveStoreId(data.CurrentStoreId || '');

            const sortedItems = data.ListItems?.sort((a, b) => {
                if (a.is_bought !== b.is_bought) return a.is_bought ? 1 : -1;

                // Prioritize items from the active store
                if (activeStoreId) {
                    const aIsActive = a.Product?.StoreId === parseInt(activeStoreId);
                    const bIsActive = b.Product?.StoreId === parseInt(activeStoreId);
                    if (aIsActive !== bIsActive) return aIsActive ? -1 : 1;
                }

                return 0; // Keep current order otherwise
            });

            setList({ ...data, ListItems: sortedItems });
        } catch (err) {
            console.error('Failed to fetch list details', err);
        } finally {
            setLoading(false);
        }
    }, [id, activeStoreId]);

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
        } catch (err) {
            console.error('Failed to update current store', err);
        }
    };

    const toggleBought = async (item) => {
        try {
            const newBoughtState = !item.is_bought;

            // Optimistic UI update
            setList(prev => ({
                ...prev,
                ListItems: prev.ListItems.map(i =>
                    i.id === item.id ? { ...i, is_bought: newBoughtState } : i
                ).sort((a, b) => {
                    if (a.is_bought !== b.is_bought) return a.is_bought ? 1 : -1;
                    return 0;
                })
            }));

            await api.put(`/lists/items/${item.id}`, {
                is_bought: newBoughtState
            });
        } catch (err) {
            console.error('Failed to toggle item', err);
            fetchListDetails(); // Revert on failure
        }
    };

    const deleteItem = async (itemId) => {
        try {
            await api.delete(`/lists/items/${itemId}`);
            fetchListDetails(); // Sync with server for sums
        } catch (err) {
            console.error('Failed to delete item', err);
            fetchListDetails();
        }
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
        try {
            await api.put(`/lists/${id}`, {
                status: 'completed'
            });
            fetchListDetails();
        } catch (err) {
            console.error('Failed to complete session', err);
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
            <div className="mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="p-3 bg-muted rounded-2xl text-muted-foreground hover:text-foreground transition-colors active:scale-95 shadow-sm"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-4xl font-bebas tracking-tight text-foreground">
                            {list.name || new Date(list.date).toLocaleDateString('de-DE')}
                        </h1>
                        <p className="text-muted-foreground text-sm font-medium">Einkaufsliste • {list.ListItems?.length || 0} Artikel</p>
                    </div>

                    {/* Store Selector */}
                    <div className="flex items-center gap-3">
                        {(() => {
                            const activeStore = stores.find(s => s.id == activeStoreId);
                            if (activeStore?.logo_url) {
                                return (
                                    <img
                                        src={activeStore.logo_url}
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
                <AnimatePresence mode="popLayout">
                    {list.ListItems?.map((item, index) => (
                        <div key={item.id} className="relative group w-[100px] md:w-[200px] aspect-square">
                            <div className="absolute inset-0 bg-destructive rounded-2xl flex items-center justify-end px-6 shadow-inner">
                                <Trash2 size={24} className="text-destructive-foreground animate-pulse" />
                            </div>

                            <motion.div
                                layout
                                drag={editMode === 'edit' ? "x" : false}
                                dragConstraints={{ left: -100, right: 0 }}
                                onDragEnd={(_, info) => {
                                    if (editMode === 'edit' && info.offset.x < -80) {
                                        setSelectedItem(item);
                                        setIsSettingsOpen(true);
                                    }
                                }}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                transition={{ duration: 0.2, delay: index * 0.02 }}
                                className={cn(
                                    "product-tile shadow-lg hover:shadow-xl relative z-10 transition-shadow w-full h-full flex flex-col justify-between p-1 md:p-3",
                                    item.is_bought ? "product-tile-teal" : "product-tile-red",
                                    editMode === 'view' ? "cursor-pointer" : "cursor-default",
                                    editMode === 'delete' && "border-2 border-destructive animate-pulse cursor-pointer"
                                )}
                                onClick={() => {
                                    if (editMode === 'view') {
                                        toggleBought(item);
                                    } else if (editMode === 'edit') {
                                        setSelectedItem(item);
                                        setIsSettingsOpen(true);
                                    } else if (editMode === 'delete') {
                                        if (item.MenuId) {
                                            alert("Diese Zutat stammt aus einem Menü und kann nur über den Menüplan ('Zutatenplaner') entfernt werden.");
                                            return;
                                        }
                                        if (confirm(`Möchtest du "${item.Product?.name}" wirklich aus der Liste entfernen?`)) {
                                            deleteItem(item.id);
                                        }
                                    }
                                }}
                            >
                                {editMode === 'edit' && (
                                    <div className="absolute top-2 right-1 md:right-2 z-20">
                                        <div className="p-1 rounded-lg bg-black/10 text-white/40">
                                            <Settings size={14} className="md:w-4 md:h-4" />
                                        </div>
                                    </div>
                                )}
                                {editMode === 'delete' && (
                                    <div className="absolute top-2 right-1 md:right-2 z-20">
                                        {item.MenuId ? (
                                            <div className="p-1 rounded-lg bg-black/20 text-white/60 shadow-lg">
                                                <Lock size={14} className="md:w-4 md:h-4" />
                                            </div>
                                        ) : (
                                            <div className="p-1 rounded-lg bg-destructive text-destructive-foreground shadow-lg">
                                                <Trash2 size={14} className="md:w-4 md:h-4" />
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="product-icon mb-1 flex-1 flex items-center justify-center">
                                    <ShoppingCart size={24} strokeWidth={1.5} className="opacity-80 md:w-8 md:h-8" />
                                </div>

                                <div className="w-full text-center mb-1">
                                    <span className="text-[10px] md:text-xs font-bold leading-tight line-clamp-2 px-0.5 block break-words">
                                        {item.Product?.name}
                                    </span>
                                    {item.Product?.Manufacturer && (
                                        <span className="text-[9px] md:text-[10px] uppercase tracking-wider opacity-70 block truncate">
                                            {item.Product.Manufacturer.name}
                                        </span>
                                    )}
                                </div>

                                <div className={cn(
                                    "absolute top-1 left-1 md:top-2 md:left-2 shadow-md flex items-center justify-center text-[10px] md:text-xs font-bold rounded-full min-w-[1.5rem] md:min-w-[2rem] h-6 md:h-8 px-1.5 md:px-2",
                                    item.is_bought ? "bg-teal-500 text-white" : "bg-red-500 text-white"
                                )}>
                                    {item.quantity} <span className="text-[8px] md:text-[9px] ml-0.5 opacity-90">{(item.unit || item.Product?.unit) === 'Stück' ? 'Stk' : (item.unit || item.Product?.unit)}</span>
                                </div>


                            </motion.div>
                        </div>
                    ))}
                </AnimatePresence>

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
                onConfirm={onConfirmQuantity}
            />

            <style dangerouslySetInnerHTML={{
                __html: `
                .product-tile-red {
                    background-color: #ef4444;
                    color: white;
                }
                .product-tile-teal {
                    background-color: #5eead4;
                    color: hsl(var(--background));
                }
            ` }} />
        </div>
    );
}
