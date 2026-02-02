import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Store as StoreIcon, Shield, Trash2, Plus, ArrowLeft, Check, X, Building2 } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useEditMode } from '../contexts/EditModeContext';
import StoreModal from '../components/StoreModal';



export default function SettingsPage() {
    const navigate = useNavigate();
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { editMode, setEditMode } = useEditMode();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStore, setSelectedStore] = useState(null);
    const [openaiKey, setOpenaiKey] = useState('');
    const [savingKey, setSavingKey] = useState(false);

    useEffect(() => {
        fetchStores();
        fetchSettings();
    }, []);

    useEffect(() => {
        if (editMode === 'create') {
            handleAdd();
        }
    }, [editMode]);

    const fetchStores = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('http://localhost:5000/api/stores');
            setStores(data);
        } catch (err) {
            console.error('Failed to fetch stores', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const { data } = await axios.get('http://localhost:5000/api/settings/openai_key');
            setOpenaiKey(data.value || '');
        } catch (err) {
            console.error('Failed to fetch settings', err);
        }
    };

    const saveOpenaiKey = async () => {
        setSavingKey(true);
        try {
            await axios.post('http://localhost:5000/api/settings', {
                key: 'openai_key',
                value: openaiKey
            });
            alert('API Key gespeichert');
        } catch (err) {
            console.error('Failed to save key', err);
            alert('Fehler beim Speichern');
        } finally {
            setSavingKey(false);
        }
    };

    const handleAdd = () => {
        setSelectedStore(null);
        setIsModalOpen(true);
    };

    const handleEdit = (store) => {
        setSelectedStore(store);
        setIsModalOpen(true);
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Geschäft "${name}" wirklich löschen?`)) return;
        try {
            await axios.delete(`http://localhost:5000/api/stores/${id}`);
            fetchStores();
        } catch (err) {
            alert('Löschen fehlgeschlagen.');
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        if (editMode === 'create') {
            setEditMode('view');
        }
    };

    const handleStoreClick = (store) => {
        if (editMode === 'edit') {
            handleEdit(store);
        } else if (editMode === 'delete') {
            handleDelete(store.id, store.name);
        }
    };

    return (
        <div className="space-y-8">
            <div className="mb-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-3 bg-muted rounded-2xl text-muted-foreground hover:text-foreground transition-all active:scale-95"
                    >
                        <ArrowLeft size={24} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                    <Card className="p-8 border-border bg-card shadow-lg">
                        <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                            <Shield size={20} className="text-primary" />
                            Sicherheit & Profil
                        </h2>
                        <div className="space-y-4">
                            <div className="p-4 bg-muted rounded-2xl">
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Angemeldet als</p>
                                <p className="font-bold text-foreground">{user?.username || 'Gast'}</p>
                                <p className="text-sm text-primary font-medium">{user?.role === 'admin' ? 'Administrator' : 'Standard-Benutzer'}</p>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full h-12 text-destructive hover:bg-destructive/10 border-destructive/20"
                                onClick={() => {
                                    localStorage.removeItem('token');
                                    window.location.reload();
                                }}
                            >
                                Abmelden
                            </Button>
                        </div>
                    </Card>

                    <Card className="p-8 border-border bg-card shadow-lg">
                        <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                            <Building2 size={20} className="text-primary" />
                            API Integration
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">OpenAI API Key</label>
                                <div className="flex gap-2">
                                    <Input
                                        type="password"
                                        placeholder="sk-..."
                                        value={openaiKey}
                                        onChange={(e) => setOpenaiKey(e.target.value)}
                                        className="bg-muted border-transparent focus:bg-background transition-colors"
                                    />
                                    <Button onClick={saveOpenaiKey} disabled={savingKey}>
                                        {savingKey ? 'Wait...' : 'Speichern'}
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2">Wird benötigt für den KI-Rezept-Import.</p>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-foreground mb-2 px-2 flex items-center gap-2">
                        <StoreIcon size={20} className="text-primary" />
                        Alle Geschäfte
                    </h2>
                    <AnimatePresence mode="popLayout">
                        {loading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)}
                            </div>
                        ) : stores.length > 0 ? (
                            stores.map((item, index) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: index * 0.03 }}
                                >
                                    <Card
                                        onClick={() => handleStoreClick(item)}
                                        className={cn(
                                            "p-4 flex items-center justify-between group border-border bg-card/50 hover:bg-card transition-all shadow-sm",
                                            (editMode === 'edit' || editMode === 'delete') && "cursor-pointer hover:shadow-md hover:scale-[1.02]",
                                            editMode === 'delete' && "hover:border-destructive/50 hover:bg-destructive/5"
                                        )}
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            {item.logo_url ? (
                                                <img
                                                    src={`http://localhost:5000${item.logo_url}`}
                                                    alt={item.name}
                                                    className="w-10 h-10 object-contain bg-white rounded-lg p-1"
                                                />
                                            ) : (
                                                <div className="p-2 bg-muted rounded-lg text-muted-foreground group-hover:text-primary transition-colors">
                                                    <StoreIcon size={20} />
                                                </div>
                                            )}
                                            <span className="font-bold text-foreground text-lg">{item.name}</span>
                                        </div>

                                        {editMode === 'edit' && (
                                            <div className="p-2 bg-muted rounded-lg text-muted-foreground">
                                                <Settings size={18} />
                                            </div>
                                        )}
                                        {editMode === 'delete' && (
                                            <div className="p-2 bg-destructive/10 rounded-lg text-destructive">
                                                <Trash2 size={18} />
                                            </div>
                                        )}
                                    </Card>
                                </motion.div>
                            ))
                        ) : (
                            <div className="text-center py-10 bg-muted/20 border border-dashed border-border rounded-3xl text-muted-foreground italic">
                                Keine Geschäfte hinterlegt.
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <StoreModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={fetchStores}
                store={selectedStore}
            />
        </div>
    );
}
