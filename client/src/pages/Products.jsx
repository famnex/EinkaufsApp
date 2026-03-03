import { useState, useEffect, useMemo, useRef } from 'react';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import api from '../lib/axios';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Package, Plus, Search, Filter, Edit2, Trash2, Factory, Sparkles, Radio, X, Globe, Layers, Eye, Menu, MoreVertical, MoreHorizontal, Loader2, Inbox, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import ProductModal from '../components/ProductModal';
import AiCleanupModal from '../components/AiCleanupModal';
import { SessionSkeleton } from '../components/Skeleton';
import { cn } from '../lib/utils';
import MergeProductModal from '../components/MergeProductModal';
import { useEditMode } from '../contexts/EditModeContext';
import LoadingOverlay from '../components/LoadingOverlay';

export default function Products() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAiCleanupOpen, setIsAiCleanupOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const { user } = useAuth();
    const { editMode, setEditMode } = useEditMode();
    const [viewTab, setViewTab] = useState('eigene'); // 'eigene', 'inbox', 'global', 'variants'
    const [variants, setVariants] = useState([]);
    const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [globalizing, setGlobalizing] = useState(false);
    const menuRef = useRef(null);

    // Globalizing own products
    const handleGlobalizeProducts = async () => {
        if (!confirm('Möchtest du wirklich alle deine eigenen Produkte zu globalen Produkten machen? Die UserId wird dabei auf null gesetzt. Dieser Vorgang kann nicht rückgängig gemacht werden.')) return;

        setGlobalizing(true);
        try {
            const { data } = await api.post('/products/bulk-globalize');
            alert(data.message);
            fetchProducts();
            setIsMenuOpen(false);
        } catch (err) {
            console.error(err);
            alert('Fehler beim Globalisieren: ' + (err.response?.data?.error || err.message));
        } finally {
            setGlobalizing(false);
        }
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        fetchProducts();
        fetchVariants();
    }, [viewTab]);

    useEffect(() => {
        if (editMode === 'create') {
            handleAdd();
        }
    }, [editMode]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const url = viewTab === 'inbox' ? '/products/inbox' : '/products';
            const { data } = await api.get(url);
            setProducts(data);
        } catch (err) {
            console.error('Failed to fetch products', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchVariants = async () => {
        try {
            const { data } = await api.get('/variants');
            setVariants(data);
        } catch (err) {
            console.error('Failed to fetch variants', err);
        }
    };



    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!confirm('Produkt wirklich löschen?')) return;
        try {
            await api.delete(`/products/${id}`);
            fetchProducts();
        } catch (err) {
            console.error('Failed to delete product', err);
        }
    };



    const handleEdit = (product) => {
        if (viewTab === 'variants') {
            setSelectedVariant(product);
            setIsVariantModalOpen(true);
        } else {
            setSelectedProduct(viewTab === 'inbox' ? { ...product, isInbox: true } : product);
            setIsModalOpen(true);
        }
    };

    const handleAdd = () => {
        if (viewTab === 'variants') {
            setSelectedVariant(null);
            setIsVariantModalOpen(true);
        } else {
            setSelectedProduct(null);
            setIsModalOpen(true);
        }
    };

    const handleDeleteVariant = async (id, e) => {
        e.stopPropagation();
        if (!confirm('Variante wirklich löschen?')) return;
        try {
            await api.delete(`/variants/${id}`);
            fetchVariants();
        } catch (err) {
            console.error('Failed to delete variant', err);
        }
    };

    const filteredProducts = useMemo(() => {
        let list = products.filter(p => {
            const name = p.name || '';
            const category = p.category || '';
            return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                category.toLowerCase().includes(searchTerm.toLowerCase());
        });

        if (viewTab === 'eigene') {
            // Currently backend only returns user products
            list = list.filter(p => p.UserId);
        } else if (viewTab === 'inbox') {
            // Backend already filtered for UserId != null
            return list.sort((a, b) => a.name.localeCompare(b.name));
        } else if (viewTab === 'global') {
            list = list.filter(p => !p.UserId);
        } else if (viewTab === 'variants') {
            return variants
                .filter(v => v.title.toLowerCase().includes(searchTerm.toLowerCase()))
                .sort((a, b) => a.title.localeCompare(b.title));
        }

        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [products, variants, searchTerm, viewTab]);



    const { visibleItems: renderedProducts, observerTarget } = useInfiniteScroll(filteredProducts, 20);

    const [mergeSource, setMergeSource] = useState(null);
    const [mergeTarget, setMergeTarget] = useState(null);
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

    // Drag Handlers
    const handleDragStart = (e, product) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify(product));
        setMergeSource(product);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, targetProduct) => {
        e.preventDefault();
        const sourceData = e.dataTransfer.getData('application/json');
        if (!sourceData) return;
        const sourceProduct = JSON.parse(sourceData);

        if (sourceProduct.id === targetProduct.id) return;

        setMergeSource(sourceProduct);
        setMergeTarget(targetProduct);
        setIsMergeModalOpen(true);
    };

    return (
        <LoadingOverlay isLoading={loading}>
            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex bg-muted p-1 rounded-2xl gap-1 w-full sm:w-auto">
                        <button
                            onClick={() => setViewTab('eigene')}
                            className={cn(
                                "flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                                viewTab === 'eigene' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/50"
                            )}
                        >
                            <Package size={18} />
                            <span className={cn(viewTab !== 'eigene' && "hidden sm:inline")}>Eigene</span>
                        </button>
                        {user?.role === 'admin' && (
                            <button
                                onClick={() => setViewTab('inbox')}
                                className={cn(
                                    "flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                                    viewTab === 'inbox' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/50"
                                )}
                            >
                                <Inbox size={18} />
                                <span className={cn(viewTab !== 'inbox' && "hidden sm:inline")}>Inbox</span>
                            </button>
                        )}
                        <button
                            onClick={() => setViewTab('global')}
                            className={cn(
                                "flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                                viewTab === 'global' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/50"
                            )}
                        >
                            <Globe size={18} />
                            <span className={cn(viewTab !== 'global' && "hidden sm:inline")}>Global</span>
                        </button>
                        {user?.role === 'admin' && (
                            <button
                                onClick={() => {
                                    setViewTab('variants');
                                    fetchVariants();
                                }}
                                className={cn(
                                    "flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                                    viewTab === 'variants' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/50"
                                )}
                            >
                                <Layers size={18} />
                                <span className={cn(viewTab !== 'variants' && "hidden sm:inline")}>Varianten</span>
                            </button>
                        )}
                    </div>

                    {/* Burger Menu Container */}
                    {(() => {
                        const hasNeu = viewTab === 'eigene' || (user?.role === 'admin' && viewTab !== 'inbox');
                        const hasCleanup = user?.role === 'admin' && user?.tier !== 'Plastikgabel';
                        const hasGlobalize = user?.role === 'admin' && viewTab === 'eigene'; // Only show globalize in 'eigene' tab
                        const hasMenuItems = hasNeu || hasCleanup || hasGlobalize;

                        if (!hasMenuItems) return null;

                        return (
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end relative" ref={menuRef}>
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className={cn(
                                        "flex items-center justify-center w-11 h-11 rounded-xl transition-all active:scale-95 border-2",
                                        isMenuOpen ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"
                                    )}
                                >
                                    <Menu size={20} />
                                </button>

                                <AnimatePresence>
                                    {isMenuOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                            className="absolute top-full right-0 mt-2 w-64 bg-card border border-border shadow-2xl rounded-2xl z-50 overflow-hidden"
                                        >
                                            <div className="p-2 space-y-1">
                                                {/* Neu Button - restricted to Eigene for users, plus Global/Variants for admins (meaning Not Inbox) */}
                                                {(viewTab === 'eigene' || (user?.role === 'admin' && viewTab !== 'inbox')) && (
                                                    <button
                                                        onClick={() => {
                                                            handleAdd();
                                                            setIsMenuOpen(false);
                                                        }}
                                                        className="w-full flex items-center gap-3 p-3 text-sm font-bold text-foreground hover:bg-primary/10 rounded-xl transition-all text-left"
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                            <Plus size={18} />
                                                        </div>
                                                        <span>Neu</span>
                                                    </button>
                                                )}

                                                {/* Cleanup - show only for non-plastic admins or special tier */}
                                                {user?.role === 'admin' && user?.tier !== 'Plastikgabel' && (
                                                    <button
                                                        onClick={() => {
                                                            setIsAiCleanupOpen(true);
                                                            setIsMenuOpen(false);
                                                        }}
                                                        className="w-full flex items-center gap-3 p-3 text-sm font-bold text-foreground hover:bg-indigo-500/10 rounded-xl transition-all text-left"
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                                                            <Sparkles size={18} />
                                                        </div>
                                                        <span>Cleanup</span>
                                                    </button>
                                                )}

                                                {/* Globalize Own Products - ADMIN ONLY */}
                                                {user?.role === 'admin' && (
                                                    <button
                                                        onClick={handleGlobalizeProducts}
                                                        disabled={globalizing}
                                                        className="w-full flex items-center gap-3 p-3 text-sm font-bold text-foreground hover:bg-emerald-500/10 rounded-xl transition-all text-left"
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                                            {globalizing ? <Loader2 className="animate-spin" /> : <Globe size={18} />}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span>Eigene Produkte globalisieren</span>
                                                        </div>
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )
                    })()}
                </div>

                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-col sm:flex-row gap-4"
                >
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <Input
                            placeholder="Suchen nach Namen, Kategorien..."
                            className="pl-10 h-12 bg-card border-border shadow-md rounded-2xl"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </motion.div>

                <AnimatePresence mode="wait">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                    >
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => <SessionSkeleton key={i} />)
                        ) : filteredProducts.length > 0 ? (
                            <>
                                {renderedProducts.map((product, index) => (
                                    <motion.div
                                        key={product.id}
                                        layout
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, product)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, product)}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        onClick={() => {
                                            if (editMode === 'edit' || viewTab === 'inbox') {
                                                handleEdit(product);
                                            } else if (editMode === 'delete') {
                                                handleDelete(product.id, { stopPropagation: () => { } });
                                            }
                                        }}
                                        className={cn(
                                            "bg-card border p-4 rounded-2xl flex items-center justify-between group transition-all",
                                            viewTab === 'inbox' ? "hover:shadow-lg hover:border-primary/20 cursor-pointer" : "hover:shadow-lg hover:border-primary/20 cursor-grab active:cursor-grabbing"
                                        )}
                                    >
                                        <div className="flex-1 min-w-0 text-left pointer-events-none">
                                            <h3 className="font-bold text-foreground truncate text-lg leading-tight">
                                                {viewTab === 'variants' ? product.title : product.name}
                                            </h3>
                                            {viewTab !== 'variants' && (
                                                <>
                                                    <p className="text-sm text-muted-foreground truncate mt-1">{product.category || 'Keine Kategorie'}</p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-medium">
                                                            {product.unit || 'Stück'}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            {(product.UserId === null && user?.role !== 'admin') ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEdit(product);
                                                    }}
                                                    className="h-9 w-9 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                                                >
                                                    <Eye size={18} />
                                                </Button>
                                            ) : (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEdit(product);
                                                        }}
                                                        className="h-9 w-9 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                                                    >
                                                        {viewTab === 'inbox' ? <Download size={18} /> : <Edit2 size={18} />}
                                                    </Button>
                                                    {viewTab !== 'inbox' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (viewTab === 'variants') {
                                                                    handleDeleteVariant(product.id, e);
                                                                } else {
                                                                    handleDelete(product.id, e);
                                                                }
                                                            }}
                                                            className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                                                        >
                                                            <Trash2 size={18} />
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                                {/* Observer Target for Infinite Scroll */}
                                <div ref={observerTarget} className="h-4 w-full col-span-full" />
                            </>
                        ) : (
                            <div className="col-span-full py-20 text-center border-2 border-dashed border-border rounded-3xl">
                                Keine Produkte gefunden.
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                <ProductModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setEditMode('view');
                    }}
                    product={selectedProduct}
                    onSave={fetchProducts}
                />

                <MergeProductModal
                    isOpen={isMergeModalOpen}
                    onClose={() => setIsMergeModalOpen(false)}
                    sourceProduct={mergeSource}
                    targetProduct={mergeTarget}
                    onConfirm={fetchProducts}
                />

                <AiCleanupModal
                    isOpen={isAiCleanupOpen}
                    onClose={() => setIsAiCleanupOpen(false)}
                    products={products.filter(p => p.UserId === null)}
                    onRefresh={fetchProducts}
                />

                <VariantModal
                    isOpen={isVariantModalOpen}
                    onClose={() => setIsVariantModalOpen(false)}
                    variant={selectedVariant}
                    onSave={fetchVariants}
                />
            </div >
        </LoadingOverlay>
    );
}

function VariantModal({ isOpen, onClose, variant, onSave }) {
    const [title, setTitle] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (variant) setTitle(variant.title);
        else setTitle('');
    }, [variant, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (variant) {
                await api.put(`/variants/${variant.id}`, { title });
            } else {
                await api.post('/variants', { title });
            }
            onSave();
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="w-full max-w-md relative z-10 max-h-[80vh] flex flex-col"
                    >
                        <Card className="p-4 sm:p-8 border-border shadow-2xl bg-card flex flex-col overflow-hidden">
                            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 shrink-0">{variant ? 'Variante bearbeiten' : 'Neue Variante'}</h2>
                            <form onSubmit={handleSubmit} className="flex flex-col min-h-0 overflow-hidden">
                                <div className="space-y-4 overflow-y-auto pr-1 -mr-1 pb-2">
                                    <Input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Titel der Variante"
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-4 shrink-0 border-t border-border mt-4">
                                    <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
                                    <Button type="submit" disabled={loading}>{loading ? 'Speichern...' : 'Speichern'}</Button>
                                </div>
                            </form>
                        </Card>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
