import { useState, useEffect, useMemo } from 'react';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import api from '../lib/axios';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Package, Plus, Search, Filter, Edit2, Trash2, Factory, Sparkles, Radio, X, Globe, Layers, Eye } from 'lucide-react'; // Added Eye icon
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
    const [viewTab, setViewTab] = useState('eigene'); // 'eigene', 'global', 'variants'
    const [variants, setVariants] = useState([]);
    const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState(null);

    useEffect(() => {
        fetchProducts();
        fetchVariants();
    }, []);

    useEffect(() => {
        if (editMode === 'create') {
            handleAdd();
        }
    }, [editMode]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/products');
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
            setSelectedProduct(product);
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
                            Eigene
                        </button>
                        <button
                            onClick={() => setViewTab('global')}
                            className={cn(
                                "flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                                viewTab === 'global' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/50"
                            )}
                        >
                            <Globe size={18} />
                            Global
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
                                Varianten
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {user?.tier !== 'Plastikgabel' && (
                            <Button
                                variant="outline"
                                onClick={() => setIsAiCleanupOpen(true)}
                                className="h-11 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-600/10 border-indigo-500/20 text-indigo-600 hover:from-indigo-500/20 hover:to-purple-600/20"
                            >
                                <Sparkles size={18} className="mr-2" />
                                Cleanup
                            </Button>
                        )}
                        <Button
                            onClick={handleAdd}
                            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all active:scale-95"
                        >
                            <Plus size={18} className="mr-2" />
                            Neu
                        </Button>
                    </div>
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
                                            if (editMode === 'edit') {
                                                handleEdit(product);
                                            } else if (editMode === 'delete') {
                                                handleDelete(product.id, { stopPropagation: () => { } });
                                            }
                                        }}
                                        className={cn(
                                            "bg-card border p-4 rounded-2xl flex items-center justify-between group transition-all",
                                            "hover:shadow-lg hover:border-primary/20 cursor-grab active:cursor-grabbing"
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
                                            {product.UserId === null && user?.role !== 'admin' ? (
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
                                                        <Edit2 size={18} />
                                                    </Button>
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
                    products={products}
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
                        className="w-full max-w-md relative z-10"
                    >
                        <Card className="p-8 border-border shadow-2xl bg-card">
                            <h2 className="text-2xl font-bold mb-6">{variant ? 'Variante bearbeiten' : 'Neue Variante'}</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Titel der Variante"
                                    required
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2 pt-4">
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
