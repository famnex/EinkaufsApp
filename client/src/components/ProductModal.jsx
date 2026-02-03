import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Package, Tag, Euro, Store as StoreIcon, Plus, Sparkles } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';
import api from '../lib/axios';

export default function ProductModal({ isOpen, onClose, product, onSave }) {
    const [categories, setCategories] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        price_hint: '',
        unit: 'Stück',
        ManufacturerId: ''
    });
    const [manufacturers, setManufacturers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingAi, setLoadingAi] = useState(false);
    const [aiManufacturers, setAiManufacturers] = useState([]);

    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name || '',
                category: product.category || '',
                price_hint: product.price_hint || '',
                unit: product.unit || 'Stück',
                ManufacturerId: product.ManufacturerId || ''
            });
        } else {
            setFormData({ name: '', category: '', price_hint: '', unit: 'Stück', ManufacturerId: '' });
            setAiManufacturers([]); // Reset on new
        }

        if (isOpen) {
            fetchMetadata();
        }
    }, [product, isOpen]);

    const fetchMetadata = async () => {
        try {
            const [productsRes, manufacturersRes] = await Promise.all([
                api.get('/products'),
                api.get('/manufacturers')
            ]);
            const uniqueCats = [...new Set(productsRes.data.map(p => p.category).filter(Boolean))].sort();
            setCategories(uniqueCats);
            setManufacturers(manufacturersRes.data);
        } catch (err) {
            console.error('Failed to fetch metadata', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const dataToSave = {
                ...formData,
                StoreId: null, // Removed Standard Store
                ManufacturerId: formData.ManufacturerId || null,
                price_hint: formData.price_hint || null
            };
            if (product?.id) {
                await api.put(`/products/${product.id}`, dataToSave);
            } else {
                await api.post('/products', dataToSave);
            }
            onSave();
            onClose();
        } catch (err) {
            console.error('Failed to save product', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAiLookup = async () => {
        if (!formData.name) return alert("Bitte geben Sie zuerst einen Produktnamen ein.");
        setLoadingAi(true);
        setAiManufacturers([]);
        try {
            const { data } = await api.post('/ai/lookup', { name: formData.name });

            // Auto-fill fields
            setFormData(prev => ({
                ...prev,
                category: data.category || prev.category,
                unit: data.unit ? `${data.amount || 1} ${data.unit}` : prev.unit
            }));

            // Handle manufacturers
            if (data.manufacturers && data.manufacturers.length > 0) {
                setAiManufacturers(data.manufacturers);
            }

        } catch (err) {
            console.error(err);
            alert("AI Lookup fehlgeschlagen: " + (err.response?.data?.error || err.message));
        } finally {
            setLoadingAi(false);
        }
    };

    const handleSelectManufacturer = async (manufName) => {
        // Check if exists
        const existing = manufacturers.find(m => m.name.toLowerCase() === manufName.toLowerCase());
        if (existing) {
            setFormData(prev => ({ ...prev, ManufacturerId: existing.id }));
        } else {
            // Create new
            try {
                const { data } = await api.post('/manufacturers', { name: manufName });
                setManufacturers(prev => [...prev, data]);
                setFormData(prev => ({ ...prev, ManufacturerId: data.id }));
            } catch (err) {
                console.error(err);
                alert("Fehler beim Erstellen des Herstellers");
            }
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
                        className="w-full max-w-lg relative z-10"
                    >
                        <Card className="p-8 border-border shadow-2xl bg-card transition-colors duration-300">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                                    <div className="p-2 bg-primary rounded-lg">
                                        <Package size={20} className="text-primary-foreground" />
                                    </div>
                                    {product ? 'Produkt bearbeiten' : 'Neues Produkt'}
                                </h2>
                                <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Produktname</label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="z.B. Bio-Milch"
                                        required
                                        className="bg-muted/50 border-border h-12"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Kategorie</label>
                                        <Input
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            placeholder="z.B. Milchprodukte"
                                            className="bg-muted/50 border-border h-12"
                                            list="category-suggestions"
                                        />
                                        <datalist id="category-suggestions">
                                            {categories.map(cat => <option key={cat} value={cat} />)}
                                        </datalist>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Standard-Einheit</label>
                                        <Input
                                            value={formData.unit}
                                            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                            placeholder="z.B. Stück, kg, Packung"
                                            className="bg-muted/50 border-border h-12"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Hersteller</label>

                                    {/* AI Manufacturer Suggestions */}
                                    {aiManufacturers.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            <span className="text-xs text-muted-foreground self-center mr-1">Vorschläge:</span>
                                            {aiManufacturers.map(m => (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onClick={() => handleSelectManufacturer(m)}
                                                    className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full border border-indigo-200 hover:bg-indigo-100 transition-colors flex items-center gap-1"
                                                >
                                                    <Sparkles size={10} />
                                                    {m}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <select
                                            value={formData.ManufacturerId}
                                            onChange={(e) => setFormData({ ...formData, ManufacturerId: e.target.value })}
                                            className="flex-1 bg-muted/50 border border-border rounded-xl h-12 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none text-sm"
                                        >
                                            <option value="">Keiner</option>
                                            {manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const name = prompt('Neuer Hersteller Name:');
                                                if (name) {
                                                    try {
                                                        const { data } = await api.post('/manufacturers', { name });
                                                        setManufacturers([...manufacturers, data]);
                                                        setFormData({ ...formData, ManufacturerId: data.id });
                                                    } catch (err) {
                                                        alert('Fehler beim Erstellen des Herstellers');
                                                    }
                                                }
                                            }}
                                            className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center hover:bg-primary/20 transition-colors shrink-0"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={onClose}
                                        className="h-12 px-6"
                                    >
                                        Abbrechen
                                    </Button>

                                    <div className="flex-1" /> {/* Spacer */}

                                    <Button
                                        type="button"
                                        onClick={handleAiLookup}
                                        disabled={loadingAi || !formData.name}
                                        className="h-12 gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20"
                                    >
                                        {loadingAi ? <Sparkles size={18} className="animate-spin" /> : <Sparkles size={18} />}
                                        {loadingAi ? 'AI sucht...' : 'AI Lookup'}
                                    </Button>

                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className="h-12 gap-2 px-8"
                                    >
                                        <Save size={18} />
                                        {loading ? 'Speichern...' : 'Speichern'}
                                    </Button>
                                </div>
                            </form>
                        </Card>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
