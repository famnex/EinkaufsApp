import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Store as StoreIcon, Shield, Trash2, Plus, ArrowLeft, Check, X, Building2, Users, UserCog, User, Sparkles, Terminal, Loader2, CheckCircle, ChefHat, Share2, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useNavigate } from 'react-router-dom';
import { cn, getImageUrl } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useEditMode } from '../contexts/EditModeContext';
import StoreModal from '../components/StoreModal';
import UpdateModal from '../components/UpdateModal';
import AlexaLogsModal from '../components/AlexaLogsModal';
import UserDetailModal from '../components/UserDetailModal';
import api from '../lib/axios';
import { Search } from 'lucide-react';

export default function SettingsPage() {
    const navigate = useNavigate();
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user, setUser } = useAuth();
    const { editMode, setEditMode } = useEditMode();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStore, setSelectedStore] = useState(null);
    const [openaiKey, setOpenaiKey] = useState('');
    const [alexaKey, setAlexaKey] = useState('');
    const [savingKey, setSavingKey] = useState(false);
    const [registrationEnabled, setRegistrationEnabled] = useState(true);
    const [appVersion, setAppVersion] = useState('...');

    // Cookbook Customization State
    const [cookbookTitle, setCookbookTitle] = useState(user?.cookbookTitle || 'MEIN KOCHBUCH');
    const [cookbookImage, setCookbookImage] = useState(user?.cookbookImage || null);
    const [savingCookbook, setSavingCookbook] = useState(false);
    const [sharingKey, setSharingKey] = useState(user?.sharingKey || '');

    // User Management State
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // System Update State
    const [updateInfo, setUpdateInfo] = useState(null);
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
    const [generatingInvite, setGeneratingInvite] = useState(false);
    const [householdMembers, setHouseholdMembers] = useState([]);
    const [fetchingMembers, setFetchingMembers] = useState(false);
    const [isUserDetailModalOpen, setIsUserDetailModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState('all');

    // Tab State
    const [activeTab, setActiveTab] = useState('profile');

    // Email/Password Change State
    const [emailChangeData, setEmailChangeData] = useState({ currentPassword: '', newEmail: '' });
    const [passwordChangeData, setPasswordChangeData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [changingEmail, setChangingEmail] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        fetchStores();
        fetchSettings();
        if (user?.role === 'admin') {
            fetchUsers();
        }
        fetchHouseholdMembers();
        // Keep local cookbook state in sync with user context
        if (user) {
            setCookbookTitle(user.cookbookTitle || 'MEIN KOCHBUCH');
            setCookbookImage(user.cookbookImage || null);
            setSharingKey(user.sharingKey || '');
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
                api.get('/settings/system/version'),
                api.get('/settings/alexa_key')
            ];

            // Allow version fetch to fail gracefully if endpoint doesn't exist yet (though it should)
            const results = await Promise.allSettled(promises);

            const openaiRes = results[0].status === 'fulfilled' ? results[0].value : { data: {} };
            const regRes = results[1].status === 'fulfilled' ? results[1].value : { data: {} };
            const verRes = results[2].status === 'fulfilled' ? results[2].value : { data: { version: 'Unknown' } };
            const alexaRes = results[3]?.status === 'fulfilled' ? results[3].value : { data: {} };

            setOpenaiKey(openaiRes.data.value || '');
            setRegistrationEnabled(regRes.data.value !== 'false');
            setAppVersion(verRes.data.version);
            setAlexaKey(alexaRes.data.value || '');
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

    const fetchHouseholdMembers = async () => {
        if (!user) return;
        setFetchingMembers(true);
        try {
            const { data } = await api.get('/auth/household/members');
            setHouseholdMembers(data);
        } catch (err) {
            console.error('Failed to fetch members', err);
        } finally {
            setFetchingMembers(false);
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

    const handleGenerateAlexaKey = async () => {
        if (alexaKey) {
            const confirmed = window.confirm(
                'ACHTUNG: Es ist bereits ein Alexa API Key vorhanden.\n\n' +
                'Wenn Sie einen neuen generieren, müssen Sie diesen auch in Ihrem Alexa Skill aktualisieren, ' +
                'sonst funktioniert die Verbindung nicht mehr.\n\n' +
                'Wollen Sie wirklich einen neuen Key generieren?'
            );
            if (!confirmed) return;
        }

        setSavingKey(true);
        // Generate a random UUID-like string and remove hyphens for a cleaner key, or keep them.
        // Using native crypto.randomUUID() if available, else a fallback.
        let newKey;
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            newKey = crypto.randomUUID().replace(/-/g, '');
        } else {
            newKey = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        }

        try {
            await api.post('/settings', {
                key: 'alexa_key',
                value: newKey
            });
            setAlexaKey(newKey);
            // alert('Neuer Alexa API Key generiert: ' + newKey); // Optional, field is visible
        } catch (err) {
            console.error('Failed to save alexa key', err);
            alert('Fehler beim Generieren des Keys');
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

    const handleSaveCookbook = async () => {
        setSavingCookbook(true);
        try {
            const { data } = await api.put('/auth/profile', { cookbookTitle });
            setUser(data);
            localStorage.setItem('user', JSON.stringify(data));
            alert('Kochbuch-Titel gespeichert');
        } catch (err) {
            console.error('Failed to save cookbook settings', err);
            alert('Fehler beim Speichern');
        } finally {
            setSavingCookbook(false);
        }
    };

    const handleCookbookImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        setSavingCookbook(true);
        try {
            const { data } = await api.put('/auth/profile', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setCookbookImage(data.cookbookImage);
            setUser(data);
            localStorage.setItem('user', JSON.stringify(data));
            alert('Bild hochgeladen');
        } catch (err) {
            console.error('Upload failed', err);
            alert('Upload fehlgeschlagen');
        } finally {
            setSavingCookbook(false);
        }
    };

    const handleRegenerateKey = async () => {
        const confirmed = window.confirm(
            'ACHTUNG: Alle bisher geteilten Links (Kochbuch und Rezepte) werden ungültig!\n\n' +
            'Möchtest du wirklich einen neuen Freigabe-Key generieren?'
        );
        if (!confirmed) return;

        try {
            const { data } = await api.post('/auth/regenerate-sharing-key');
            setSharingKey(data.sharingKey);
            const updatedUser = { ...user, sharingKey: data.sharingKey };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            alert('Neuer Key generiert!');
        } catch (err) {
            console.error('Regeneration failed', err);
            alert('Fehler bei der Generierung');
        }
    };

    const handleGenerateHouseholdInvite = async () => {
        setGeneratingInvite(true);
        try {
            const { data } = await api.get('/auth/household/invite');
            const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/';
            const inviteUrl = `${window.location.origin}${baseUrl}join-household?token=${data.token}`;

            const fullInviteMessage = `Werde Teil meines Haushalts bei EinkaufsApp: ${inviteUrl}`;

            if (navigator.share) {
                await navigator.share({
                    title: 'Haushalt beitreten - EinkaufsApp',
                    text: `Werde Teil meines Haushalts bei EinkaufsApp: `,
                    url: inviteUrl
                });
            } else {
                await navigator.clipboard.writeText(fullInviteMessage);
                alert('Einladungs-Link in die Zwischenablage kopiert!');
            }
        } catch (err) {
            console.error('Failed to generate invite', err);
            if (err.name !== 'AbortError') {
                alert('Fehler beim Generieren der Einladung');
            }
        } finally {
            setGeneratingInvite(false);
        }
    };

    const handleChangeEmail = async () => {
        if (!emailChangeData.currentPassword || !emailChangeData.newEmail) {
            alert('Bitte alle Felder ausfüllen');
            return;
        }

        setChangingEmail(true);
        try {
            const { data } = await api.put('/auth/email', emailChangeData);
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
            alert('Email erfolgreich geändert');
            setEmailChangeData({ currentPassword: '', newEmail: '' });
        } catch (err) {
            alert(err.response?.data?.error || 'Fehler beim Ändern der Email');
        } finally {
            setChangingEmail(false);
        }
    };

    const handleChangePassword = async () => {
        if (!passwordChangeData.currentPassword || !passwordChangeData.newPassword || !passwordChangeData.confirmPassword) {
            alert('Bitte alle Felder ausfüllen');
            return;
        }

        setChangingPassword(true);
        try {
            await api.put('/auth/password', passwordChangeData);
            alert('Passwort erfolgreich geändert');
            setPasswordChangeData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            alert(err.response?.data?.error || 'Fehler beim Ändern des Passworts');
        } finally {
            setChangingPassword(false);
        }
    };

    const handleClearCache = async () => {
        if (!confirm('Möchtest du den App-Cache wirklich leeren und die Seite neu laden? Dies kann Probleme mit der PWA beheben.')) return;
        try {
            const names = await caches.keys();
            await Promise.all(names.map(name => caches.delete(name)));

            // Unregister all service workers
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }

            alert('Cache geleert. Die Seite wird jetzt neu geladen.');
            window.location.reload(true);
        } catch (err) {
            console.error('Failed to clear cache', err);
            alert('Fehler beim Leeren des Caches.');
        }
    };

    // Tab Definitions
    const tabs = [
        { id: 'profile', label: 'Profil & Sicherheit', icon: User },
        { id: 'household', label: 'Haushalt', icon: Users },
        { id: 'cookbook', label: 'Öffentliches Kochbuch', icon: ChefHat },
        { id: 'stores', label: 'Geschäfte', icon: StoreIcon },
        { id: 'integration', label: 'Integration', icon: Building2 },
        ...(user?.role === 'admin' ? [
            { id: 'users', label: 'Benutzerverwaltung', icon: UserCog },
            { id: 'system', label: 'System', icon: Terminal }
        ] : [])
    ];

    // --- Component Sections ---

    const ProfileSection = (
        <div className="space-y-6">
            <Card className="p-8 border-border bg-card/50 shadow-lg backdrop-blur-sm">
                <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <User size={20} className="text-primary" />
                    Benutzerprofil
                </h2>
                <div className="p-4 bg-muted rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Angemeldet als</p>
                        <p className="font-bold text-foreground text-lg">{user?.username || 'Gast'}</p>
                        <p className="text-sm text-primary font-medium">{user?.role === 'admin' ? 'Administrator' : 'Standard-Benutzer'}</p>
                    </div>
                    <Button
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => {
                            localStorage.removeItem('token');
                            const baseUrl = import.meta.env.BASE_URL || '/';
                            window.location.href = `${baseUrl}login`.replace('//', '/');
                        }}
                    >
                        Abmelden
                    </Button>
                </div>
            </Card>

            <Card className="p-8 border-border bg-card/50 shadow-lg backdrop-blur-sm">
                <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <Mail size={20} className="text-primary" />
                    Email-Adresse ändern
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Neue Email-Adresse</label>
                        <Input
                            type="email"
                            placeholder="neue@email.de"
                            value={emailChangeData.newEmail}
                            onChange={(e) => setEmailChangeData({ ...emailChangeData, newEmail: e.target.value })}
                            className="bg-muted border-transparent focus:bg-background"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Aktuelles Passwort zur Bestätigung</label>
                        <div className="relative">
                            <Input
                                type={showCurrentPassword ? "text" : "password"}
                                placeholder="Dein Passwort"
                                value={emailChangeData.currentPassword}
                                onChange={(e) => setEmailChangeData({ ...emailChangeData, currentPassword: e.target.value })}
                                className="bg-muted border-transparent focus:bg-background"
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <Button
                        onClick={handleChangeEmail}
                        disabled={changingEmail}
                        className="w-full"
                    >
                        {changingEmail ? <Loader2 size={18} className="animate-spin" /> : "Email speichern"}
                    </Button>
                </div>
            </Card>

            <Card className="p-8 border-border bg-card/50 shadow-lg backdrop-blur-sm">
                <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <Lock size={20} className="text-primary" />
                    Passwort ändern
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Aktuelles Passwort</label>
                        <div className="relative">
                            <Input
                                type={showCurrentPassword ? "text" : "password"}
                                value={passwordChangeData.currentPassword}
                                onChange={(e) => setPasswordChangeData({ ...passwordChangeData, currentPassword: e.target.value })}
                                className="bg-muted border-transparent focus:bg-background"
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Neues Passwort</label>
                        <div className="relative">
                            <Input
                                type={showNewPassword ? "text" : "password"}
                                value={passwordChangeData.newPassword}
                                onChange={(e) => setPasswordChangeData({ ...passwordChangeData, newPassword: e.target.value })}
                                className="bg-muted border-transparent focus:bg-background"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Neues Passwort bestätigen</label>
                        <div className="relative">
                            <Input
                                type={showConfirmPassword ? "text" : "password"}
                                value={passwordChangeData.confirmPassword}
                                onChange={(e) => setPasswordChangeData({ ...passwordChangeData, confirmPassword: e.target.value })}
                                className="bg-muted border-transparent focus:bg-background"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <Button
                        onClick={handleChangePassword}
                        disabled={changingPassword}
                        className="w-full"
                    >
                        {changingPassword ? <Loader2 size={18} className="animate-spin" /> : "Passwort aktualisieren"}
                    </Button>
                </div>
            </Card>
        </div>
    );

    const CookbookSection = (
        <Card className="p-8 border-border bg-card/50 shadow-lg backdrop-blur-sm">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                <ChefHat size={20} className="text-primary" />
                Dein öffentliches Kochbuch
            </h2>
            <div className="space-y-6">
                <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Kochbuch-Titel</label>
                    <div className="flex gap-2">
                        <Input
                            value={cookbookTitle}
                            onChange={(e) => setCookbookTitle(e.target.value)}
                            placeholder="Z.B. MEIN REZEPTSCHREIN"
                            className="bg-muted border-transparent focus:bg-background"
                        />
                        <Button onClick={handleSaveCookbook} disabled={savingCookbook}>
                            {savingCookbook ? '...' : 'OK'}
                        </Button>
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Hero-Bild (Startseite)</label>
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-2xl bg-muted overflow-hidden border border-border flex items-center justify-center shrink-0">
                            {cookbookImage ? (
                                <img src={getImageUrl(cookbookImage)} className="w-full h-full object-cover" alt="Cookbook Preview" />
                            ) : (
                                <ChefHat size={32} className="text-muted-foreground/30" />
                            )}
                        </div>
                        <div className="space-y-2">
                            <input
                                type="file"
                                id="cookbook-image"
                                className="hidden"
                                accept="image/*"
                                onChange={handleCookbookImageUpload}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => document.getElementById('cookbook-image').click()}
                                disabled={savingCookbook}
                            >
                                Bild ändern
                            </Button>
                            <p className="text-[10px] text-muted-foreground">Empfohlen: 300x300px</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-2xl border border-border/50">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Dein öffentlicher Link</label>
                    <div className="flex gap-2">
                        <Input
                            type="text"
                            readOnly
                            value={`${window.location.origin}${import.meta.env.BASE_URL}shared/${sharingKey}/cookbook`.replace(/([^:]\/)\/+/g, "$1")}
                            className="bg-background border-border text-sm font-mono truncate"
                            onClick={(e) => e.target.select()}
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const url = `${window.location.origin}${import.meta.env.BASE_URL}shared/${sharingKey}/cookbook`.replace(/([^:]\/)\/+/g, "$1");
                                navigator.clipboard.writeText(url);
                                alert('Link kopiert!');
                            }}
                        >
                            Copy
                        </Button>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-3 text-[10px] text-muted-foreground hover:text-destructive gap-1"
                        onClick={handleRegenerateKey}
                    >
                        <X size={12} /> Neuen Key generieren (alte Links werden ungültig)
                    </Button>
                </div>
            </div>
        </Card>
    );

    const HouseholdSection = (
        <Card className="p-8 border-border bg-card/50 shadow-lg">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                <Users size={20} className="text-primary" />
                Gemeinsamer Haushalt
            </h2>
            <div className="space-y-6">
                <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Mitglieder</p>
                    <div className="grid grid-cols-1 gap-2">
                        {fetchingMembers ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 size={24} className="animate-spin text-primary/50" />
                            </div>
                        ) : householdMembers.length > 0 ? (
                            householdMembers.map(member => (
                                <div key={member.id} className="flex items-center justify-between p-3 bg-white/30 dark:bg-black/10 rounded-xl border border-border/50 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                            {member.username.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">{member.username}</p>
                                            <p className="text-[10px] text-muted-foreground">{member.role === 'admin' ? 'Administrator' : 'Mitglied'}</p>
                                        </div>
                                    </div>
                                    {member.householdId === null && (
                                        <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">Besitzer</span>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground italic px-1">Keine weiteren Mitglieder.</p>
                        )}
                    </div>
                </div>

                {!user.householdId && (
                    <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
                        <p className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
                            <CheckCircle size={14} className="text-primary" /> Zusätzliche Person einladen
                        </p>
                        <Button
                            onClick={handleGenerateHouseholdInvite}
                            disabled={generatingInvite}
                            className="w-full h-12 gap-2 shadow-lg shadow-primary/20"
                        >
                            {generatingInvite ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
                            Einladungs-Link erstellen
                        </Button>
                    </div>
                )}
            </div>
        </Card>
    );

    const StoresSection = (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground mb-2 px-2 flex items-center gap-2">
                <StoreIcon size={20} className="text-primary" />
                Alle Geschäfte
            </h2>
            <div className="flex flex-wrap gap-2 mb-6 px-2">
                <Button
                    variant={editMode === 'edit' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEditMode(editMode === 'edit' ? 'add' : 'edit')}
                    className="gap-2 rounded-xl"
                >
                    <Settings size={14} /> Bearbeiten
                </Button>
                <Button
                    variant={editMode === 'delete' ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => setEditMode(editMode === 'delete' ? 'add' : 'delete')}
                    className="gap-2 rounded-xl"
                >
                    <Trash2 size={14} /> Löschen
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setSelectedStore(null);
                        setIsModalOpen(true);
                    }}
                    className="gap-2 rounded-xl text-primary hover:text-primary hover:bg-primary/10"
                >
                    <Plus size={14} /> Neu
                </Button>
            </div>
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

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
            (u.email && u.email.toLowerCase().includes(userSearchQuery.toLowerCase()));
        const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
        return matchesSearch && matchesRole;
    });

    const UsersSection = user?.role === 'admin' ? (
        <div className="space-y-6">
            <Card className="p-8 border-border bg-card/50 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <UserCog size={20} className="text-primary" />
                        Benutzerverwaltung
                    </h2>

                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                            <Input
                                placeholder="Suchen..."
                                value={userSearchQuery}
                                onChange={(e) => setUserSearchQuery(e.target.value)}
                                className="pl-9 h-10 text-sm bg-muted/50 border-transparent focus:bg-background"
                            />
                        </div>
                        <select
                            value={userRoleFilter}
                            onChange={(e) => setUserRoleFilter(e.target.value)}
                            className="h-10 bg-muted/50 border-transparent rounded-xl px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                        >
                            <option value="all">Alle Rollen</option>
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                </div>

                <div className="mb-6 p-4 bg-muted/30 rounded-2xl border border-border/50">
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
                            : "Registrierung ist deaktiviert."}
                    </p>
                </div>

                {loadingUsers ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted/50 rounded-xl animate-pulse" />)}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredUsers.length > 0 ? filteredUsers.map((u) => (
                            <div
                                key={u.id}
                                onClick={() => {
                                    setSelectedUserId(u.id);
                                    setIsUserDetailModalOpen(true);
                                }}
                                className="p-4 bg-white/30 dark:bg-black/10 rounded-2xl border border-border/50 group hover:border-primary/50 cursor-pointer transition-all shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-100"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-muted rounded-xl group-hover:bg-primary/10 transition-colors">
                                            {u.role === 'admin' ? <Shield size={18} className="text-amber-500" /> : <User size={18} className="text-primary" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-foreground flex items-center gap-2">
                                                {u.username}
                                                {u.id === user.id && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-medium">Du</span>}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{u.email}</p>
                                            <div className="flex gap-2 mt-2">
                                                <span className={cn(
                                                    "text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tight",
                                                    u.role === 'admin' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                )}>
                                                    {u.role}
                                                </span>
                                                <span className={cn(
                                                    "text-[10px] px-1.5 py-0.5 rounded-md border font-bold uppercase tracking-tight",
                                                    u.tier === 'Rainbowspoon' ? "bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 text-white border-transparent" : "bg-muted/50 text-muted-foreground border-border/50"
                                                )}>
                                                    {u.tier || 'Plastikgabel'}
                                                </span>
                                                {u.householdId ? (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-bold uppercase tracking-tight">
                                                        Mit {u.householdOwnerName || '...'}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold uppercase tracking-tight">
                                                        Besitzer
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className="text-right mr-4 hidden sm:block">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Credits</p>
                                            <p className="text-xs font-bold text-primary">{parseFloat(u.aiCredits || 0).toFixed(2)}</p>
                                        </div>
                                        {u.id !== user.id && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteUser(u.id, u.username);
                                                }}
                                                className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                                                title="Benutzer löschen"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-10 bg-muted/20 border border-dashed border-border rounded-3xl text-muted-foreground italic">
                                Keine Benutzer gefunden.
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    ) : null;

    const SystemSection = (
        <div className="space-y-6">
            <Card className="p-8 border-border bg-card/50 shadow-lg backdrop-blur-sm">
                <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
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

            <Card className="p-8 border-border bg-card/50 shadow-lg backdrop-blur-sm">
                <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <Building2 size={20} className="text-primary" />
                    OpenAI Integration
                </h2>
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
            </Card>
            <Card className="p-8 border-border bg-card/50 shadow-lg backdrop-blur-sm">
                <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <Sparkles size={20} className="text-primary" />
                    App-Verwaltung
                </h2>
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Sollte die App nicht korrekt laden oder weiß bleiben, kannst du hier den lokalen Speicher der PWA leeren.
                    </p>
                    <Button
                        variant="outline"
                        onClick={handleClearCache}
                        className="w-full sm:w-auto text-destructive hover:bg-destructive/10 border-destructive/20"
                    >
                        <Trash2 size={18} className="mr-2" />
                        App-Cache leeren & neu laden
                    </Button>
                </div>
            </Card>
        </div>
    );

    const ApiSection = (
        <Card className="p-8 border-border bg-card/50 shadow-lg backdrop-blur-sm">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                <Building2 size={20} className="text-primary" />
                Integrationen
            </h2>
            <div className="space-y-6">
                <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Alexa API Key</label>
                    <div className="flex gap-2">
                        <Input
                            type="text"
                            readOnly
                            disabled
                            value={alexaKey}
                            placeholder="Nicht generiert"
                            className="bg-muted border-transparent focus:bg-background transition-colors font-mono text-sm cursor-text select-text disabled:opacity-70 disabled:cursor-text"
                            onClick={(e) => e.target.select()}
                        />
                        <Button
                            onClick={handleGenerateAlexaKey}
                            disabled={savingKey}
                            className="min-w-[140px]"
                        >
                            {savingKey ? 'Verarbeite...' : 'Generiere API-Key'}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setIsLogsModalOpen(true)}
                            title="Logs ansehen"
                        >
                            <Terminal size={18} />
                        </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">Für die Nutzung mit dem Alexa Skill. Vorsicht: Bei Neugenerierung muss der Key in der Alexa App aktualisiert werden.</p>
                </div>
            </div>
        </Card>
    );

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

            {/* Tab Navigation */}
            <div className="flex overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 gap-2 mb-8 sticky top-0 bg-background/80 backdrop-blur-md py-2 z-10 border-b border-border sm:border-none sm:static sm:bg-transparent sm:backdrop-blur-none transition-all">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-2xl whitespace-nowrap transition-all active:scale-95 text-sm font-bold",
                                isActive
                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                            )}
                        >
                            <Icon size={18} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="max-w-4xl mx-auto"
            >
                {activeTab === 'profile' && ProfileSection}
                {activeTab === 'household' && HouseholdSection}
                {activeTab === 'cookbook' && CookbookSection}
                {activeTab === 'stores' && StoresSection}
                {activeTab === 'integration' && ApiSection}
                {activeTab === 'users' && UsersSection}
                {activeTab === 'system' && SystemSection}
            </motion.div>

            <StoreModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={fetchStores}
                store={selectedStore}
            />

            <UpdateModal
                isOpen={isUpdateModalOpen}
                onClose={() => setIsUpdateModalOpen(false)}
                currentVersion={appVersion}
                updateInfo={updateInfo}
            />

            <AlexaLogsModal
                isOpen={isLogsModalOpen}
                onClose={() => setIsLogsModalOpen(false)}
            />

            <UserDetailModal
                isOpen={isUserDetailModalOpen}
                onClose={() => setIsUserDetailModalOpen(false)}
                userId={selectedUserId}
                onUpdate={fetchUsers}
            />
        </div>
    );
}
