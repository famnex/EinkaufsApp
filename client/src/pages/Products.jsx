import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Package, Plus, Search, Filter, Edit2, Trash2, Factory } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import ProductModal from '../components/ProductModal';
import { SessionSkeleton } from '../components/Skeleton';
import { cn } from '../lib/utils';
import { useEditMode } from '../contexts/EditModeContext';

export default function Products() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
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
                        axios.post('http://localhost:5000/api/manufacturers', { name })
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
            const { data } = await axios.get('http://localhost:5000/api/products');
            setProducts(data);
        } catch (err) {
            console.error('Failed to fetch products', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchManufacturers = async () => {
        try {
            const { data } = await axios.get('http://localhost:5000/api/manufacturers');
            setManufacturers(data);
        } catch (err) {
            console.error('Failed to fetch manufacturers', err);
        }
    };

    const handleDeleteManufacturer = async (id) => {
        if (!confirm('Hersteller wirklich löschen?')) return;
        try {
            await axios.delete(`http://localhost:5000/api/manufacturers/${id}`);
            fetchManufacturers();
        } catch (err) {
            alert('Löschen fehlgeschlagen. Möglicherweise sind noch Produkte verknüpft.');
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!confirm('Produkt wirklich löschen?')) return;
        try {
            await axios.delete(`http://localhost:5000/api/products/${id}`);
            fetchProducts();
        } catch (err) {
            console.error('Failed to delete product', err);
        }
    };

    const handleEditManufacturer = async (manufacturer) => {
        const newName = prompt('Hersteller Name bearbeiten:', manufacturer.name);
        if (newName && newName !== manufacturer.name) {
            try {
                await axios.put(`http://localhost:5000/api/manufacturers/${manufacturer.id}`, { name: newName });
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

    return (
        <div className="space-y-6">
            <div className="mb-8">
                <div className="flex items-center justify-end">
                    {user && (
                        <button
                            onClick={handleAdd}
                            className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                        >
                            <Plus size={24} />
                        </button>
                    )}
                </div>
            </div>

            {/* View Switcher Tabs */}
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                    {view === 'products' ? (
                        loading ? (
                            Array.from({ length: 6 }).map((_, i) => <SessionSkeleton key={i} />)
                        ) : filteredProducts.length > 0 ? (
                            filteredProducts.map((product, index) => (
                                <motion.div
                                    layout
                                    key={product.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ delay: index * 0.03 }}
                                >
                                    <motion.div
                                        key={product.id}
                                        layout
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
                                            "hover:shadow-md",
                                            editMode === 'edit' && "border-primary/30 hover:bg-primary/5 cursor-pointer",
                                            editMode === 'delete' && "border-destructive/30 hover:bg-destructive/5 cursor-pointer"
                                        )}
                                    >
                                        <div className="flex-1 min-w-0 text-left">
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
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                            >
                                <motion.div
                                    key={m.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
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
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            <ProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                product={selectedProduct}
                onSave={fetchProducts}
            />
        </div>
    );
}
