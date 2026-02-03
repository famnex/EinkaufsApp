import { useState, useEffect } from 'react';
import api from '../lib/axios';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Package, Plus, Search, Filter, Edit2, Trash2, Factory, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import ProductModal from '../components/ProductModal';
import AiCleanupModal from '../components/AiCleanupModal';
import { SessionSkeleton } from '../components/Skeleton';
import { cn } from '../lib/utils';
import MergeProductModal from '../components/MergeProductModal';
import { useEditMode } from '../contexts/EditModeContext';

export default function Products() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAiCleanupOpen, setIsAiCleanupOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [view, setView] = useState('products'); // 'products' or 'manufacturers'
    const [manufacturers, setManufacturers] = useState([]);
    const { user } = useAuth();
    const { editMode, setEditMode } = useEditMode();

    useEffect(() => {
        fetchProducts();
        fetchManufacturers();
    }, []);

    useEffect(() => {
        if (editMode === 'create') {
            if (view === 'products') {
                handleAdd();
            } else if (view === 'manufacturers') {
                // Use setTimeout to ensure we don't block render or conflict with state updates
                setTimeout(() => {
                    const name = prompt('Neuer Hersteller Name:');
                    if (name) {
                        api.post('/manufacturers', { name })
                            .then(() => {
                                fetchManufacturers();
                                setEditMode('view'); // Reset after creation
                            })
                            .catch(() => setEditMode('view'));
                    } else {
                        setEditMode('view'); // Cancelled
                    }
                }, 100);
            }
        }
    }, [editMode, view]);

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

    const fetchManufacturers = async () => {
        try {
            const { data } = await api.get('/manufacturers');
            setManufacturers(data);
        } catch (err) {
            console.error('Failed to fetch manufacturers', err);
        }
    };

    const handleDeleteManufacturer = async (id) => {
        if (!confirm('Hersteller wirklich löschen?')) return;
        try {
            await api.delete(`/manufacturers/${id}`);
            fetchManufacturers();
        } catch (err) {
            alert('Löschen fehlgeschlagen. Möglicherweise sind noch Produkte verknüpft.');
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

    const handleEditManufacturer = async (manufacturer) => {
        const newName = prompt('Hersteller Name bearbeiten:', manufacturer.name);
        if (newName && newName !== manufacturer.name) {
            try {
                await api.put(`/manufacturers/${manufacturer.id}`, { name: newName });
                fetchManufacturers();
            } catch (err) {
                console.error('Update failed', err);
                alert('Fehler beim Aktualisieren: ' + err.message);
            }
        }
    };

    const handleEdit = (product) => {
        setSelectedProduct(product);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setSelectedProduct(null);
        setIsModalOpen(true);
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
        <div className="space-y-6">
            {/* View Switcher Tabs */}
            {/* ... (Start of Tabs code unchanged, but re-render for clarity if needed. ) ... */}
            <div className="flex bg-muted p-1 rounded-2xl mb-6">
                <button
                    onClick={() => {
                        setView('products');
                        setEditMode('view');
                    }}
                    className={cn(
                        "flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                        view === 'products' ? "bg-card text-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Package size={18} />
                    Produkte
                </button>
                <button
                    onClick={() => {
                        setView('manufacturers');
                        setEditMode('view');
                    }}
                    className={cn(
                        "flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                        view === 'manufacturers' ? "bg-card text-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Factory size={18} />
                    Hersteller
                </button>

                {/* AI Cleanup Button */}
                <button
                    onClick={() => setIsAiCleanupOpen(true)}
                    className="px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20"
                    title="AI Cleanup"
                >
                    <Sparkles size={18} />
                    AI Cleanup
                </button>
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
                        className="pl-10 h-12 bg-card border-border shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </motion.div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={view}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                >
                    {view === 'products' ? (
                        loading ? (
                            Array.from({ length: 6 }).map((_, i) => <SessionSkeleton key={i} />)
                        ) : filteredProducts.length > 0 ? (
                            filteredProducts.map((product, index) => (
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
                                        "hover:shadow-md cursor-grab active:cursor-grabbing",
                                        editMode === 'edit' && "border-primary/30 hover:bg-primary/5 cursor-pointer",
                                        editMode === 'delete' && "border-destructive/30 hover:bg-destructive/5 cursor-pointer"
                                    )}
                                >
                                    <div className="flex-1 min-w-0 text-left pointer-events-none">
                                        <h3 className="font-bold text-foreground truncate text-lg leading-tight">{product.name}</h3>
                                        <p className="text-sm text-muted-foreground truncate mt-1">{product.category || 'Keine Kategorie'}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-medium">
                                                {product.unit || 'Stück'}
                                            </span>
                                        </div>
                                    </div>
                                    {editMode === 'edit' && (
                                        <div className="text-primary">
                                            <Edit2 size={18} />
                                        </div>
                                    )}
                                    {editMode === 'delete' && (
                                        <div className="text-destructive">
                                            <Trash2 size={18} />
                                        </div>
                                    )}
                                </motion.div>
                            ))
                        ) : (
                            <div className="col-span-full py-20 text-center border-2 border-dashed border-border rounded-3xl">
                                Keine Produkte gefunden.
                            </div>
                        )
                    ) : (
                        manufacturers.map((m, index) => (
                            <motion.div
                                key={m.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                onClick={() => {
                                    if (editMode === 'edit') {
                                        handleEditManufacturer(m);
                                    } else if (editMode === 'delete') {
                                        handleDeleteManufacturer(m.id);
                                    }
                                }}
                                className={cn(
                                    "bg-card border p-4 rounded-2xl flex items-center justify-between group transition-all",
                                    editMode === 'edit' && "border-primary/30 hover:bg-primary/5 cursor-pointer",
                                    editMode === 'delete' && "border-destructive/30 hover:bg-destructive/5 cursor-pointer"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                        <Factory size={20} />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-foreground">{m.name}</h3>
                                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-black">Hersteller</p>
                                    </div>
                                </div>
                                {editMode === 'edit' && (
                                    <div className="text-primary">
                                        <Edit2 size={18} />
                                    </div>
                                )}
                                {editMode === 'delete' && (
                                    <div className="text-destructive">
                                        <Trash2 size={18} />
                                    </div>
                                )}
                            </motion.div>
                        ))
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
        </div>
    );
}
