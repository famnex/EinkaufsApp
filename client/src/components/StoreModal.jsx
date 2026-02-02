import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Store as StoreIcon } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import api from '../lib/axios';

export default function StoreModal({ isOpen, onClose, store, onSave }) {
    const [name, setName] = useState('');
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (store) {
                setName(store.name);
                setLogoPreview(store.logo_url ? (store.logo_url.startsWith('http') ? store.logo_url : `http://localhost:5000${store.logo_url}`) : null);
            } else {
                resetForm();
            }
        }
    }, [isOpen, store]);

    const resetForm = () => {
        setName('');
        setLogoFile(null);
        setLogoPreview(null);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData();
        formData.append('name', name);
        if (logoFile) {
            formData.append('logo', logoFile);
        }

        try {
            if (store) {
                await api.put(`/stores/${store.id}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                await api.post('/stores', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            onSave();
            onClose();
        } catch (err) {
            console.error('Failed to save store', err);
            alert('Fehler beim Speichern');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed inset-0 m-auto z-50 w-full max-w-md h-fit p-6"
                    >
                        <div className="bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
                            <div className="p-6 border-b border-border flex items-center justify-between">
                                <h2 className="text-2xl font-bebas tracking-wide text-foreground">
                                    {store ? 'Geschäft bearbeiten' : 'Neues Geschäft'}
                                </h2>
                                <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                                    <X size={20} className="text-muted-foreground" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                                        Name
                                    </label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Name des Geschäfts..."
                                        className="h-12 bg-muted/50 border-transparent focus:bg-background focus:border-primary transition-all"
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                                        Logo
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center border-2 border-dashed border-border overflow-hidden relative group cursor-pointer">
                                            <input
                                                type="file"
                                                onChange={handleFileChange}
                                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                accept="image/*"
                                            />
                                            {logoPreview ? (
                                                <img src={logoPreview} alt="Preview" className="w-full h-full object-contain p-2" />
                                            ) : (
                                                <StoreIcon size={24} className="text-muted-foreground/50" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-foreground">Logo hochladen</p>
                                            <p className="text-xs text-muted-foreground">Klicken zum Auswählen (PNG, JPG)</p>
                                        </div>
                                    </div>
                                </div>

                                <Button type="submit" disabled={loading} className="w-full h-12 text-lg font-bebas tracking-wide">
                                    {loading ? 'Speichert...' : (store ? 'Aktualisieren' : 'Erstellen')}
                                </Button>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
