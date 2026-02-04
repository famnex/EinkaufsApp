import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Store as StoreIcon, Shield, Trash2, Plus, ArrowLeft, Check, X, Building2, Users, UserCog, User, Sparkles, Terminal, Loader2, CheckCircle } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useNavigate } from 'react-router-dom';
import { cn, getImageUrl } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useEditMode } from '../contexts/EditModeContext';
import StoreModal from '../components/StoreModal';
import UpdateModal from '../components/UpdateModal';
import api from '../lib/axios';

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
    const [registrationEnabled, setRegistrationEnabled] = useState(true);
    const [appVersion, setAppVersion] = useState('...');

    // User Management State
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // System Update State
    const [updateInfo, setUpdateInfo] = useState(null);
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

    useEffect(() => {
        fetchStores();
        fetchSettings();
        if (user?.role === 'admin') {
            fetchUsers();
        }
    }, [user]);

    useEffect(() => {
        if (editMode === 'create') {
            handleAdd();
        }
    }, [editMode]);

    const fetchStores = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/stores');
            setStores(data);
        } catch (err) {
            console.error('Failed to fetch stores', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const promises = [
                api.get('/settings/openai_key'),
                api.get('/settings/registration_enabled'),
                api.get('/settings/system/version')
            ];

            // Allow version fetch to fail gracefully if endpoint doesn't exist yet (though it should)
            const results = await Promise.allSettled(promises);

            const openaiRes = results[0].status === 'fulfilled' ? results[0].value : { data: {} };
            const regRes = results[1].status === 'fulfilled' ? results[1].value : { data: {} };
            const verRes = results[2].status === 'fulfilled' ? results[2].value : { data: { version: 'Unknown' } };

            setOpenaiKey(openaiRes.data.value || '');
            setRegistrationEnabled(regRes.data.value !== 'false');
            setAppVersion(verRes.data.version);
        } catch (err) {
            console.error('Failed to fetch settings', err);
        }
    };

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const { data } = await api.get('/users');
            setUsers(data);
        } catch (err) {
            console.error('Failed to fetch users', err);
        } finally {
            setLoadingUsers(false);
        }
    };

    const saveOpenaiKey = async () => {
        setSavingKey(true);
        try {
            await api.post('/settings', {
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

    const handleToggleRegistration = async (e) => {
        const newValue = e.target.checked;
        setRegistrationEnabled(newValue);
        try {
            await api.post('/settings', {
                key: 'registration_enabled',
                value: String(newValue)
            });
        } catch (err) {
            console.error('Failed to save setting', err);
            setRegistrationEnabled(!newValue); // Revert
            alert('Fehler beim Speichern');
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
            await api.delete(`/stores/${id}`);
            fetchStores();
        } catch (err) {
            alert('Löschen fehlgeschlagen.');
        }
    };

    const handleStoreClick = (store) => {
        if (editMode === 'edit') {
            handleEdit(store);
        } else if (editMode === 'delete') {
            handleDelete(store.id, store.name);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        if (editMode === 'create') {
            setEditMode('view');
        }
    };

    // User Management Handlers
    const handleRoleUpdate = async (userId, newRole) => {
        try {
            await api.put(`/users/${userId}/role`, { role: newRole });
            fetchUsers();
        } catch (err) {
            alert('Rollen-Update fehlgeschlagen');
        }
    };

    const handleDeleteUser = async (userId, username) => {
        if (!confirm(`Benutzer "${username}" wirklich löschen?`)) return;
        try {
            await api.delete(`/users/${userId}`);
            fetchUsers();
        } catch (err) {
            alert('Löschen fehlgeschlagen: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleCheckUpdate = async () => {
        setCheckingUpdate(true);
        try {
            const { data } = await api.get('/system/check');
            setUpdateInfo(data);
        } catch (err) {
            console.error('Update check failed', err);
            alert('Konnte nicht nach Updates suchen. Siehe Konsole.');
        } finally {
            setCheckingUpdate(false);
        }
    };

    // --- Component Sections ---

    const ProfileSection = (
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
                        window.location.href = '/login';
                    }}
                >
                    Abmelden
                </Button>
            </div>

            {/* Registration Toggle - Admin Only */}
            {user?.role === 'admin' && (
                <div className="pt-4 mt-6 border-t border-border">
                    <label className="flex items-center justify-between cursor-pointer group">
                        <span className="font-bold text-foreground">Öffentliche Registrierung</span>
                        <div className="relative">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={registrationEnabled}
                                onChange={handleToggleRegistration}
                            />
                            <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </div>
                    </label>
                    <p className="text-xs text-muted-foreground mt-2">
                        {registrationEnabled
                            ? "Neue Benutzer können sich registrieren."
                            : "Registrierung ist deaktiviert. Neue Benutzer können sich nicht selbst registrieren."}
                    </p>
                </div>
            )}
        </Card>
    );

    const StoresSection = (
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
                                            src={getImageUrl(item.logo_url)}
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
    );

    const ApiSection = user?.role === 'admin' ? (
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
    ) : null;

    const VersionSection = (
        <Card className="p-8 border-border bg-card shadow-lg">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                    <span className="font-mono text-xs font-bold">V</span>
                </div>
                Version & Update
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Installierte Version</p>
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="font-bold text-foreground text-lg font-mono">
                            {appVersion}
                        </p>
                        {updateInfo?.updates_available && (
                            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                Update verfügbar ({updateInfo.commits_behind} Commits)
                            </span>
                        )}
                    </div>

                    {updateInfo && !updateInfo.updates_available && (
                        <p className="text-xs text-green-600 flex items-center gap-1 pt-1">
                            <CheckCircle size={12} /> System ist aktuell
                        </p>
                    )}
                </div>

                <div className="shrink-0">
                    {!updateInfo ? (
                        <Button
                            variant="outline"
                            onClick={handleCheckUpdate}
                            disabled={checkingUpdate}
                            className="gap-2 whitespace-nowrap w-full sm:w-auto"
                        >
                            {checkingUpdate ? <Loader2 size={16} className="animate-spin" /> : <Terminal size={16} />}
                            Update suchen
                        </Button>
                    ) : updateInfo.updates_available ? (
                        <Button
                            onClick={() => setIsUpdateModalOpen(true)}
                            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap w-full sm:w-auto"
                        >
                            <Terminal size={16} />
                            Update starten
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={handleCheckUpdate}
                            disabled={checkingUpdate}
                            className="gap-2 whitespace-nowrap w-full sm:w-auto hover:bg-muted"
                        >
                            <CheckCircle size={16} />
                            Erneut prüfen
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    );

    const UsersSection = user?.role === 'admin' ? (
        <Card className="p-8 border-primary/20 bg-primary/5 shadow-lg">
            <h2 className="text-xl font-bold text-primary mb-6 flex items-center gap-2">
                <Users size={20} />
                Benutzerverwaltung
            </h2>
            {loadingUsers ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted/50 rounded-xl animate-pulse" />)}
                </div>
            ) : (
                <div className="space-y-3">
                    {users.map(u => (
                        <div key={u.id} className="p-3 bg-card border border-border rounded-xl flex items-center justify-between group hover:shadow-md transition-all">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg",
                                    u.role === 'admin' ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                                )}>
                                    {u.role === 'admin' ? <Shield size={18} /> : <User size={18} />}
                                </div>
                                <div>
                                    <div className="font-bold">{u.username}</div>
                                    <div className="text-xs text-muted-foreground flex gap-2">
                                        <span>{u.role}</span>
                                        {u.created_at && <span>• {new Date(u.created_at).toLocaleDateString()}</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                {u.id !== user.id && (
                                    <>
                                        <button
                                            onClick={() => handleRoleUpdate(u.id, u.role === 'admin' ? 'user' : 'admin')}
                                            className={cn(
                                                "p-2 rounded-lg transition-colors",
                                                u.role === 'admin' ? "hover:bg-orange-500/10 text-orange-600" : "hover:bg-green-500/10 text-green-600"
                                            )}
                                            title={u.role === 'admin' ? "Zum User degradieren" : "Zum Admin befördern"}
                                        >
                                            {u.role === 'admin' ? <UserCog size={18} /> : <Shield size={18} />}
                                        </button>

                                        <button
                                            onClick={() => handleDeleteUser(u.id, u.username)}
                                            className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                                            title="Benutzer löschen"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </>
                                )}
                                {u.id === user.id && (
                                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full font-bold uppercase">You</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    ) : null;

    return (
        <div className="space-y-8 pb-20">
            <div className="mb-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-3 bg-muted rounded-2xl text-muted-foreground hover:text-foreground transition-all active:scale-95"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-bold">Einstellungen</h1>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                    {ProfileSection}
                    {user?.role === 'admin' && StoresSection}
                </div>

                <div className="space-y-6">
                    {user?.role === 'admin' ? (
                        <>
                            {ApiSection}
                            {VersionSection}
                            {UsersSection}
                        </>
                    ) : (
                        StoresSection
                    )}
                </div>
            </div>

            <StoreModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={fetchStores}
                store={selectedStore}
            />

            <UpdateModal
                isOpen={isUpdateModalOpen}
                onClose={() => setIsUpdateModalOpen(false)}
            />
        </div>
    );
}
