import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings as SettingsIcon, Store as StoreIcon, Shield, Trash2, Plus, ArrowLeft, Check, X, Building2, Users, UserCog, User, Sparkles, Terminal, Loader2, CheckCircle, ChefHat, Share2, Lock, Mail, Eye, EyeOff, Palette, Copy, FileText, Type, ShieldCheck, Layers, CloudDownload, ChevronDown, CreditCard, History } from 'lucide-react';
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
    const [isPublicCookbook, setIsPublicCookbook] = useState(user?.isPublicCookbook || false);
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

    // System Design State
    const [accentColor, setAccentColor] = useState('#14b8a6');
    const [secondaryColor, setSecondaryColor] = useState('#ef4444');
    const [savingDesign, setSavingDesign] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState('all');

    // Email Configuration State
    const [emailConfig, setEmailConfig] = useState({
        smtpHost: '',
        smtpPort: '587',
        smtpUser: '',
        smtpPassword: '',
        smtpFrom: '',
        smtpSecure: true,
        imapHost: '',
        imapPort: '993',
        imapUser: '',
        imapPassword: '',
        imapSecure: true
    });
    const [savingEmail, setSavingEmail] = useState(false);
    const [testingEmail, setTestingEmail] = useState(false);
    const [showSmtpPassword, setShowSmtpPassword] = useState(false);
    const [showImapPassword, setShowImapPassword] = useState(false);

    // Design State
    const primaryColors = [
        { name: 'Teal', value: '#14b8a6' },
        { name: 'Blue', value: '#3b82f6' },
        { name: 'Violet', value: '#8b5cf6' },
        { name: 'Pink', value: '#ec4899' },
        { name: 'Red', value: '#ef4444' },
        { name: 'Orange', value: '#f97316' },
        { name: 'Amber', value: '#f59e0b' },
        { name: 'Green', value: '#10b981' },
    ];

    // Tab State
    const [activeTab, setActiveTab] = useState(''); // Modified to start empty (collapsed) for mobile

    useEffect(() => {
        // Auto-open defaults only on desktop if nothing matches
        if (window.innerWidth >= 640) {
            if (!activeTab) setActiveTab('profile');
        }
    }, []);

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
    }, [user?.role]); // Only re-fetch if user role changes or component mounts

    // Separate effect for syncing local state when user or members change
    useEffect(() => {
        if (user) {
            if (user.householdId && user.householdOwnerName) {
                const owner = householdMembers.find(m => m.id === user.householdId);
                // Only update if we actually found the owner to avoid clearing state unnecessarily
                if (owner) {
                    setCookbookTitle(owner.cookbookTitle || 'MEIN KOCHBUCH');
                    setCookbookImage(owner.cookbookImage || null);
                    setSharingKey(owner.sharingKey || '');
                }
            } else {
                setCookbookTitle(user.cookbookTitle || 'MEIN KOCHBUCH');
                setCookbookImage(user.cookbookImage || null);
                setSharingKey(user.sharingKey || '');
            }
        }
    }, [user, householdMembers]);

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
                api.get('/settings/alexa_key'),
                api.get('/system/settings'),
                api.get('/settings/email')
            ];

            // Allow version fetch to fail gracefully if endpoint doesn't exist yet (though it should)
            const results = await Promise.allSettled(promises);

            const openaiRes = results[0].status === 'fulfilled' ? results[0].value : { data: {} };
            const regRes = results[1].status === 'fulfilled' ? results[1].value : { data: {} };
            const verRes = results[2].status === 'fulfilled' ? results[2].value : { data: { version: 'Unknown' } };
            const alexaRes = results[3]?.status === 'fulfilled' ? results[3].value : { data: {} };
            const systemSettingsRes = results[4]?.status === 'fulfilled' ? results[4].value : { data: {} };
            const emailRes = results[5]?.status === 'fulfilled' ? results[5].value : { data: {} };

            setOpenaiKey(openaiRes.data.value || '');
            setRegistrationEnabled(regRes.data.value !== 'false');
            setAppVersion(verRes.data.version);
            setAlexaKey(alexaRes.data.value || '');

            if (systemSettingsRes.data.system_accent_color) {
                setAccentColor(systemSettingsRes.data.system_accent_color);
            }
            if (systemSettingsRes.data.system_secondary_color) {
                setSecondaryColor(systemSettingsRes.data.system_secondary_color);
            }

            // Load email settings
            if (emailRes?.data && Object.keys(emailRes.data).length > 0) {
                console.log('Loading email settings:', emailRes.data);
                setEmailConfig({
                    smtpHost: emailRes.data.smtpHost || '',
                    smtpPort: emailRes.data.smtpPort || '587',
                    smtpUser: emailRes.data.smtpUser || '',
                    smtpPassword: '', // Never populate password from server
                    smtpFrom: emailRes.data.smtpFrom || '',
                    smtpSecure: emailRes.data.smtpSecure === true,
                    imapHost: emailRes.data.imapHost || '',
                    imapPort: emailRes.data.imapPort || '993',
                    imapUser: emailRes.data.imapUser || '',
                    imapPassword: '', // Never populate password from server
                    imapSecure: emailRes.data.imapSecure === true
                });
            } else {
                console.log('No email settings found or empty response');
            }
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



    const handleSaveCookbook = async () => {
        setSavingCookbook(true);
        try {
            const { data } = await api.put('/auth/profile', { cookbookTitle, isPublicCookbook });
            setUser(data);
            localStorage.setItem('user', JSON.stringify(data));
            alert('Kochbuch-Einstellungen gespeichert');
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

            const fullInviteMessage = `Werde Teil meines Haushalts bei GabelGuru: ${inviteUrl}`;

            if (navigator.share) {
                await navigator.share({
                    title: 'Haushalt beitreten - GabelGuru',
                    text: `Werde Teil meines Haushalts bei GabelGuru: `,
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

    const handleClearCache = () => {
        if (confirm('Bist du sicher? Alle lokalen Daten der App werden gelöscht und die Seite neu geladen.')) {
            // Unregister all service workers
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    for (let registration of registrations) {
                        registration.unregister();
                    }
                });
            }
            // Clear all caches
            if ('caches' in window) {
                caches.keys().then(names => {
                    for (let name of names) {
                        caches.delete(name);
                    }
                });
            }
            // Clear local storage
            localStorage.clear();
            // Reload
            window.location.reload(true);
        }
    };

    const handleSaveEmail = async () => {
        setSavingEmail(true);
        try {
            await api.post('/settings/email', emailConfig);
            alert('E-Mail Einstellungen gespeichert');
        } catch (err) {
            console.error('Failed to save email settings', err);
            alert('Fehler beim Speichern der E-Mail Einstellungen');
        } finally {
            setSavingEmail(false);
        }
    };

    const handleTestEmail = async () => {
        setTestingEmail(true);
        try {
            const { data } = await api.post('/settings/email/test', emailConfig);
            alert(data.message || 'Testmail erfolgreich versendet!');
        } catch (err) {
            console.error('Failed to send test email', err);
            alert(err.response?.data?.error || 'Fehler beim Versenden der Testmail');
        } finally {
            setTestingEmail(false);
        }
    };



    // Helper for local preview (duplicated from App.jsx for simplicity or move to utils)
    const hexToHsl = (hex) => {
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) {
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length === 7) {
            r = parseInt(hex.substring(1, 3), 16);
            g = parseInt(hex.substring(3, 5), 16);
            b = parseInt(hex.substring(5, 7), 16);
        }
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) { h = s = 0; }
        else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    };

    // Logs State
    const [logs, setLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [logsPage, setLogsPage] = useState(0);
    const [logsTotal, setLogsTotal] = useState(0);

    // Legal Texts State
    const [legalTexts, setLegalTexts] = useState({
        legal_privacy: '',
        legal_imprint: '',
        legal_terms: ''
    });
    const [loadingLegal, setLoadingLegal] = useState(false);
    const [savingLegal, setSavingLegal] = useState(false);

    // Sub-Tabs for Admin
    const [activeAdminTab, setActiveAdminTab] = useState(''); // Modified to start empty

    // Credit History State
    const [creditHistory, setCreditHistory] = useState([]);
    const [loadingCredits, setLoadingCredits] = useState(false);

    useEffect(() => {
        if (activeTab === 'subscription') {
            fetchCreditHistory();
        }
        if (activeTab === 'admin' && user?.role === 'admin') {
            if (activeAdminTab === 'logs') fetchLogs();
            if (activeAdminTab === 'texts') fetchLegalTexts();
        }

        // Desktop default for admin sub-tabs
        if (activeTab === 'admin' && window.innerWidth >= 640 && !activeAdminTab) {
            setActiveAdminTab('users');
        }
    }, [activeTab, activeAdminTab]);

    const fetchCreditHistory = async () => {
        setLoadingCredits(true);
        try {
            const { data } = await api.get('/auth/credits');
            setCreditHistory(data);
        } catch (err) {
            console.error('Failed to fetch credit history', err);
        } finally {
            setLoadingCredits(false);
        }
    };

    const fetchLogs = async () => {
        setLoadingLogs(true);
        try {
            const { data } = await api.get(`/settings/logs?limit=50&offset=${logsPage * 50}`);
            setLogs(data.logs);
            setLogsTotal(data.total);
        } catch (err) {
            console.error('Failed to fetch logs', err);
        } finally {
            setLoadingLogs(false);
        }
    };

    const fetchLegalTexts = async () => {
        setLoadingLegal(true);
        try {
            const [privacy, imprint, terms] = await Promise.all([
                api.get('/settings/legal/privacy'),
                api.get('/settings/legal/imprint'),
                api.get('/settings/legal/terms')
            ]);
            setLegalTexts({
                legal_privacy: privacy.data.value || '',
                legal_imprint: imprint.data.value || '',
                legal_terms: terms.data.value || ''
            });
        } catch (err) {
            console.error('Failed to fetch legal texts', err);
        } finally {
            setLoadingLegal(false);
        }
    };

    const handleSaveLegal = async (type, value) => {
        setSavingLegal(true);
        try {
            // key is 'legal_privacy' etc.
            await api.post('/settings/legal', { key: type, value });
            setLegalTexts(prev => ({ ...prev, [type]: value }));
            alert('Gespeichert');
        } catch (err) {
            alert('Fehler beim Speichern');
        } finally {
            setSavingLegal(false);
        }
    };

    // Tab Definitions
    const tabs = [
        { id: 'profile', label: 'Profil & Sicherheit', icon: User },
        { id: 'subscription', label: 'Abo & Credits', icon: CreditCard },
        { id: 'household', label: 'Haushalt', icon: Users },
        { id: 'cookbook', label: 'Öffentliches Kochbuch', icon: ChefHat },
        { id: 'stores', label: 'Geschäfte', icon: StoreIcon },
        { id: 'integration', label: 'Integration', icon: Building2 },
        ...(user?.role === 'admin' ? [
            { id: 'admin', label: 'Verwaltung', icon: Shield }
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
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <ChefHat size={20} className="text-primary" />
                    Dein öffentliches Kochbuch
                </h2>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={user?.isPublicCookbook || false}
                        onChange={(e) => {
                            const newVal = e.target.checked;
                            // Optimistic update
                            setUser({ ...user, isPublicCookbook: newVal });
                            // API call
                            api.put('/auth/profile', { isPublicCookbook: newVal }).catch(() => {
                                setUser({ ...user, isPublicCookbook: !newVal }); // Revert on error
                                alert('Fehler beim Speichern');
                            });
                        }}
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
            </div>

            {user?.isPublicCookbook && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-6"
                >
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Kochbuch-Titel</label>
                        <div className="flex gap-2">
                            <Input
                                value={cookbookTitle}
                                onChange={(e) => setCookbookTitle(e.target.value)}
                                placeholder="Z.B. MEIN REZEPTSCHREIN"
                                className="bg-muted border-transparent focus:bg-background"
                            />
                            <Button onClick={handleSaveCookbook} disabled={savingCookbook}>
                                {savingCookbook ? <Loader2 size={16} className="animate-spin" /> : 'OK'}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Hero-Bild (Startseite)</label>
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 rounded-2xl bg-muted overflow-hidden border border-border flex items-center justify-center shrink-0">
                                {cookbookImage ? (
                                    <img src={getImageUrl(cookbookImage)} className="w-full h-full object-cover" alt="Cookbook Preview" />
                                ) : (
                                    <ChefHat size={32} className="text-muted-foreground/30" />
                                )}
                            </div>
                            <div className="space-y-2 flex-1">
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

                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Sichtbarkeit</label>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-background/50 border border-border">
                            <div>
                                <h3 className="font-bold">Öffentliches Kochbuch</h3>
                                <p className="text-xs text-muted-foreground">Dein Kochbuch erscheint in der Community-Liste.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={isPublicCookbook}
                                    onChange={(e) => setIsPublicCookbook(e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>
                    </div>

                    <div className="p-4 bg-muted/50 rounded-xl border border-border/50 space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">Dein öffentlicher Link</label>
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                readOnly
                                value={`${window.location.origin}${import.meta.env.BASE_URL}shared/${sharingKey}/cookbook`.replace(/([^:]\/)\/+/g, "$1")}
                                className="bg-background border-border text-sm font-mono truncate h-9"
                                onClick={(e) => e.target.select()}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 shrink-0"
                                onClick={() => {
                                    const url = `${window.location.origin}${import.meta.env.BASE_URL}shared/${sharingKey}/cookbook`.replace(/([^:]\/)\/+/g, "$1");
                                    navigator.clipboard.writeText(url);
                                    alert('Link kopiert!');
                                }}
                            >
                                <Copy size={14} />
                            </Button>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-[10px] text-muted-foreground hover:text-destructive gap-1 h-auto py-1"
                            onClick={handleRegenerateKey}
                        >
                            <X size={12} /> Neuen Key generieren (alte Links werden ungültig)
                        </Button>
                    </div>
                </motion.div>
            )}
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

    const LogsSection = (
        <Card className="p-0 border-border bg-card/50 shadow-lg backdrop-blur-sm overflow-hidden">
            <div className="p-8 border-b border-border">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <FileText size={20} className="text-primary" />
                    System Logs
                </h2>
                <p className="text-muted-foreground text-sm mt-1">Überblick über Anmeldeaktivitäten. IP-Adressen sind anonymisiert.</p>
            </div>
            <div className="p-0 overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                        <tr>
                            <th className="p-4">Zeitpunkt</th>
                            <th className="p-4">Event</th>
                            <th className="p-4">Benutzer</th>
                            <th className="p-4">IP-Hash</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loadingLogs ? (
                            <tr><td colSpan="4" className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan="4" className="p-8 text-center text-muted-foreground">Keine Logs vorhanden.</td></tr>
                        ) : (
                            logs.map(log => (
                                <tr key={log.id} className="hover:bg-muted/30">
                                    <td className="p-4 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                                    <td className="p-4">
                                        <span className={cn(
                                            "px-2 py-1 rounded-full text-xs font-bold",
                                            log.event === 'login_success' ? "bg-green-100 text-green-700" :
                                                log.event === 'login_failed' ? "bg-red-100 text-red-700" :
                                                    "bg-gray-100 text-gray-700"
                                        )}>
                                            {log.event}
                                        </span>
                                    </td>
                                    <td className="p-4">{log.username || '-'} <span className="text-xs text-muted-foreground ml-1">({log.UserId ? 'ID: ' + log.UserId : 'Unbekannt'})</span></td>
                                    <td className="p-4 font-mono text-xs text-muted-foreground" title={log.ipHash}>{log.ipHash?.substring(0, 16)}...</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <div className="p-4 border-t border-border bg-muted/30 flex justify-between items-center text-xs text-muted-foreground">
                <span>Gesamt: {logsTotal} (Zeige letzte 50)</span>
                <span>Aufbewahrung: 14 Tage</span>
            </div>
        </Card>
    );

    const TextsSection = (
        <div className="space-y-8">
            <Card className="p-8 border-border bg-card/50 shadow-lg backdrop-blur-sm">
                <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <Type size={20} className="text-primary" />
                    Rechtliche Texte verwalten
                </h2>
                <p className="text-muted-foreground mb-6">Hier können Sie die Inhalte für Datenschutz, Impressum und Nutzungsbedingungen im HTML-Format hinterlegen.</p>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex justify-between">
                            Datenschutzerklärung (HTML)
                            <Button
                                variant="ghost" size="sm" className="h-6 text-xs"
                                onClick={() => handleSaveLegal('legal_privacy', legalTexts.legal_privacy)}
                                disabled={savingLegal}
                            >
                                Speichern
                            </Button>
                        </label>
                        <textarea
                            className="w-full h-64 p-4 rounded-xl bg-muted/50 border border-border focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono text-xs"
                            value={legalTexts.legal_privacy}
                            onChange={(e) => setLegalTexts(prev => ({ ...prev, legal_privacy: e.target.value }))}
                            placeholder="<h1>Datenschutzerklärung</h1>..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex justify-between">
                            Impressum (HTML)
                            <Button
                                variant="ghost" size="sm" className="h-6 text-xs"
                                onClick={() => handleSaveLegal('legal_imprint', legalTexts.legal_imprint)}
                                disabled={savingLegal}
                            >
                                Speichern
                            </Button>
                        </label>
                        <textarea
                            className="w-full h-64 p-4 rounded-xl bg-muted/50 border border-border focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono text-xs"
                            value={legalTexts.legal_imprint}
                            onChange={(e) => setLegalTexts(prev => ({ ...prev, legal_imprint: e.target.value }))}
                            placeholder="<h1>Impressum</h1>..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex justify-between">
                            Nutzungsbedingungen (HTML)
                            <Button
                                variant="ghost" size="sm" className="h-6 text-xs"
                                onClick={() => handleSaveLegal('legal_terms', legalTexts.legal_terms)}
                                disabled={savingLegal}
                            >
                                Speichern
                            </Button>
                        </label>
                        <textarea
                            className="w-full h-64 p-4 rounded-xl bg-muted/50 border border-border focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono text-xs"
                            value={legalTexts.legal_terms}
                            onChange={(e) => setLegalTexts(prev => ({ ...prev, legal_terms: e.target.value }))}
                            placeholder="<h1>AGB</h1>..."
                        />
                    </div>
                </div>
            </Card>
        </div>
    );

    const ComplianceSection = (
        <Card className="p-12 border-border bg-card/50 shadow-lg backdrop-blur-sm text-center">
            <ShieldCheck size={64} className="mx-auto text-muted-foreground/30 mb-6" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Compliance Center</h2>
            <p className="text-muted-foreground mb-6">Dieser Bereich befindet sich noch in Entwicklung.</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full font-bold text-sm">
                <Loader2 size={16} className="animate-spin" /> In Arbeit
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
                    <SettingsIcon size={14} /> Bearbeiten
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
                                        <SettingsIcon size={18} />
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
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="p-3 bg-muted rounded-xl group-hover:bg-primary/10 transition-colors shrink-0">
                                            {u.role === 'admin' ? <Shield size={18} className="text-amber-500" /> : <User size={18} className="text-primary" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-foreground flex items-center gap-2 truncate">
                                                {u.username}
                                                {u.id === user.id && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-medium shrink-0">Du</span>}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <span className={cn(
                                                    "text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tight whitespace-nowrap",
                                                    u.role === 'admin' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                )}>
                                                    {u.role}
                                                </span>
                                                <span className={cn(
                                                    "text-[10px] px-1.5 py-0.5 rounded-md border font-bold uppercase tracking-tight whitespace-nowrap",
                                                    u.tier === 'Rainbowspoon' ? "bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 text-white border-transparent" : "bg-muted/50 text-muted-foreground border-border/50"
                                                )}>
                                                    {u.tier || 'Plastikgabel'}
                                                </span>
                                                {u.householdId ? (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-bold uppercase tracking-tight whitespace-nowrap">
                                                        Mit {u.householdOwnerName || '...'}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold uppercase tracking-tight whitespace-nowrap">
                                                        Besitzer
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                                        <div className="text-left sm:text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <img src="/coin.png" alt="Credits" className="w-4 h-4" />
                                                <p className="text-xs font-bold text-primary">{parseFloat(u.aiCredits || 0).toFixed(2)}</p>
                                            </div>
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

    const handleCheckUpdate = async () => {
        setCheckingUpdate(true);
        try {
            const { data } = await api.get('/system/check');
            setUpdateInfo(data);
            if (data.current_version) {
                setAppVersion(data.current_version);
            }
        } catch (error) {
            console.error('Update check failed', error);
            alert('Fehler beim Prüfen auf Updates');
        } finally {
            setCheckingUpdate(false);
        }
    };

    const handleSavePrimaryColor = async (color) => {
        setAccentColor(color);
        try {
            await api.post('/system/settings', { key: 'system_accent_color', value: color });

            const root = document.documentElement;
            // Needed for Shadcn/Tailwind opacities
            const hsl = hexToHsl(color);
            const hslString = `${hsl.h} ${hsl.s}% ${hsl.l}%`;

            root.style.setProperty('--primary', hslString);
            root.style.setProperty('--accent', hslString);
            root.style.setProperty('--ring', hslString);
            root.style.setProperty('--ref-teal', color);

        } catch (err) {
            console.error('Failed to save color', err);
        }
    };

    const handleSaveSecondaryColor = async (color) => {
        setSecondaryColor(color);
        try {
            await api.post('/system/settings', { key: 'system_secondary_color', value: color });

            const root = document.documentElement;
            const hsl = hexToHsl(color);
            const hslString = `${hsl.h} ${hsl.s}% ${hsl.l}%`;

            root.style.setProperty('--secondary', hslString);
            root.style.setProperty('--ref-red', color);
            // Destructive often shares the red/secondary
            root.style.setProperty('--destructive', hslString);

        } catch (err) {
            console.error('Failed to save color', err);
        }
    };

    const SystemSection = (
        <div className="space-y-6">
            <Card className="p-8 border-border bg-card/50 shadow-lg backdrop-blur-sm">
                <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <Terminal size={20} className="text-primary" />
                    System & Design
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {/* Primary Color */}
                    <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block">
                            Primärfarbe (Akzent)
                        </label>
                        <div className="flex gap-4 items-center">
                            <div className="relative">
                                <input
                                    type="color"
                                    value={accentColor}
                                    onChange={(e) => handleSavePrimaryColor(e.target.value)}
                                    className="w-16 h-16 rounded-2xl cursor-pointer border-0 p-0 overflow-hidden shadow-lg transition-transform hover:scale-105"
                                />
                                <div className="absolute inset-0 pointer-events-none rounded-2xl border-2 border-border/20"></div>
                            </div>
                            <div className="flex-1">
                                <span className="text-xs text-muted-foreground mb-1 block">Hex-Code</span>
                                <div className="flex gap-2">
                                    <Input
                                        value={accentColor}
                                        onChange={(e) => setAccentColor(e.target.value)}
                                        onBlur={(e) => handleSavePrimaryColor(e.target.value)}
                                        className="font-mono text-sm h-10 uppercase"
                                        maxLength={7}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {primaryColors.map((color) => (
                                <button
                                    key={color.value}
                                    onClick={() => handleSavePrimaryColor(color.value)}
                                    className={cn(
                                        "w-6 h-6 rounded-full transition-all border-2",
                                        accentColor === color.value ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                                    )}
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Secondary Color */}
                    <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block">
                            Sekundärfarbe (Akzent 2)
                        </label>
                        <div className="flex gap-4 items-center">
                            <div className="relative">
                                <input
                                    type="color"
                                    value={secondaryColor}
                                    onChange={(e) => handleSaveSecondaryColor(e.target.value)}
                                    className="w-16 h-16 rounded-2xl cursor-pointer border-0 p-0 overflow-hidden shadow-lg transition-transform hover:scale-105"
                                />
                                <div className="absolute inset-0 pointer-events-none rounded-2xl border-2 border-border/20"></div>
                            </div>
                            <div className="flex-1">
                                <span className="text-xs text-muted-foreground mb-1 block">Hex-Code</span>
                                <div className="flex gap-2">
                                    <Input
                                        value={secondaryColor}
                                        onChange={(e) => setSecondaryColor(e.target.value)}
                                        onBlur={(e) => handleSaveSecondaryColor(e.target.value)}
                                        className="font-mono text-sm h-10 uppercase"
                                        maxLength={7}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-border">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-foreground flex items-center gap-2">
                                System Status
                                {updateInfo?.updates_available && (
                                    <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase">
                                        Update verfügbar
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs text-muted-foreground"> Installierte Version: <span className="font-mono">{appVersion || '...'}</span></p>
                            {updateInfo && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Remote: <span className="font-mono">{updateInfo.current_version || '...'}</span> ({updateInfo.commits_behind || 0} Commits behind)
                                </p>
                            )}
                        </div>

                        <div className="flex gap-2">
                            {!updateInfo ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCheckUpdate}
                                    disabled={checkingUpdate}
                                >
                                    {checkingUpdate ? <Loader2 size={14} className="animate-spin mr-2" /> : <Layers size={14} className="mr-2" />}
                                    {checkingUpdate ? 'Prüfe...' : 'Nach Updates suchen'}
                                </Button>
                            ) : updateInfo.updates_available ? (
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => setIsUpdateModalOpen(true)}
                                    className="bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                >
                                    <CloudDownload size={14} className="mr-2" />
                                    Update jetzt starten
                                </Button>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCheckUpdate}
                                    className="text-muted-foreground"
                                >
                                    <CheckCircle size={14} className="mr-2 text-green-500" />
                                    System aktuell
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </Card>
            <Card className="p-8 border-border bg-card/50 shadow-lg backdrop-blur-sm border-destructive/20">
                <h2 className="text-xl font-bold text-destructive mb-4 flex items-center gap-2">
                    <Trash2 size={20} />
                    Cache & Daten
                </h2>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-bold text-foreground">Lokalen Cache leeren</p>
                        <p className="text-xs text-muted-foreground">Behebt oft Anzeigefehler nach Updates.</p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={handleClearCache}>
                        Cache leeren
                    </Button>
                </div>
            </Card>
            <Card className="p-8 border-border bg-card/50 shadow-lg backdrop-blur-sm">
                <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <Mail size={20} className="text-primary" />
                    E-Mail Konfiguration
                </h2>
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">SMTP Host</label>
                            <Input
                                type="text"
                                value={emailConfig.smtpHost}
                                onChange={(e) => setEmailConfig({ ...emailConfig, smtpHost: e.target.value })}
                                placeholder="smtp.example.com"
                                className="bg-muted border-transparent focus:bg-background transition-colors"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">SMTP Port</label>
                            <Input
                                type="number"
                                value={emailConfig.smtpPort}
                                onChange={(e) => setEmailConfig({ ...emailConfig, smtpPort: e.target.value })}
                                placeholder="587"
                                className="bg-muted border-transparent focus:bg-background transition-colors"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">SMTP Benutzername</label>
                        <Input
                            type="text"
                            value={emailConfig.smtpUser}
                            onChange={(e) => setEmailConfig({ ...emailConfig, smtpUser: e.target.value })}
                            placeholder="user@example.com"
                            className="bg-muted border-transparent focus:bg-background transition-colors"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">SMTP Passwort</label>
                        <div className="relative">
                            <Input
                                type={showSmtpPassword ? "text" : "password"}
                                value={emailConfig.smtpPassword}
                                onChange={(e) => setEmailConfig({ ...emailConfig, smtpPassword: e.target.value })}
                                placeholder="••••••••"
                                className="bg-muted border-transparent focus:bg-background transition-colors pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showSmtpPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Absender-Adresse</label>
                        <Input
                            type="email"
                            value={emailConfig.smtpFrom}
                            onChange={(e) => setEmailConfig({ ...emailConfig, smtpFrom: e.target.value })}
                            placeholder="noreply@example.com"
                            className="bg-muted border-transparent focus:bg-background transition-colors"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="smtpSecure"
                            checked={emailConfig.smtpSecure}
                            onChange={(e) => setEmailConfig({ ...emailConfig, smtpSecure: e.target.checked })}
                            className="w-4 h-4 rounded border-border bg-muted checked:bg-primary"
                        />
                        <label htmlFor="smtpSecure" className="text-sm font-medium text-foreground cursor-pointer">
                            Sichere Verbindung (TLS/SSL)
                        </label>
                    </div>

                    {/* IMAP Section */}
                    <div className="pt-6 border-t border-border">
                        <h3 className="text-lg font-bold text-foreground mb-4">IMAP (E-Mails empfangen)</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">IMAP Host</label>
                                    <Input
                                        type="text"
                                        value={emailConfig.imapHost}
                                        onChange={(e) => setEmailConfig({ ...emailConfig, imapHost: e.target.value })}
                                        placeholder="imap.example.com"
                                        className="bg-muted border-transparent focus:bg-background transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">IMAP Port</label>
                                    <Input
                                        type="number"
                                        value={emailConfig.imapPort}
                                        onChange={(e) => setEmailConfig({ ...emailConfig, imapPort: e.target.value })}
                                        placeholder="993"
                                        className="bg-muted border-transparent focus:bg-background transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">IMAP Benutzername</label>
                                <Input
                                    type="text"
                                    value={emailConfig.imapUser}
                                    onChange={(e) => setEmailConfig({ ...emailConfig, imapUser: e.target.value })}
                                    placeholder="user@example.com"
                                    className="bg-muted border-transparent focus:bg-background transition-colors"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">IMAP Passwort</label>
                                <div className="relative">
                                    <Input
                                        type={showImapPassword ? "text" : "password"}
                                        value={emailConfig.imapPassword}
                                        onChange={(e) => setEmailConfig({ ...emailConfig, imapPassword: e.target.value })}
                                        placeholder="••••••••"
                                        className="bg-muted border-transparent focus:bg-background transition-colors pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowImapPassword(!showImapPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showImapPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="imapSecure"
                                    checked={emailConfig.imapSecure}
                                    onChange={(e) => setEmailConfig({ ...emailConfig, imapSecure: e.target.checked })}
                                    className="w-4 h-4 rounded border-border bg-muted checked:bg-primary"
                                />
                                <label htmlFor="imapSecure" className="text-sm font-medium text-foreground cursor-pointer">
                                    Sichere Verbindung (TLS/SSL)
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-border">
                        <Button
                            onClick={handleSaveEmail}
                            disabled={savingEmail}
                            className="flex-1"
                        >
                            {savingEmail ? <Loader2 size={16} className="animate-spin mr-2" /> : <Check size={16} className="mr-2" />}
                            {savingEmail ? 'Speichere...' : 'Speichern'}
                        </Button>
                        <Button
                            onClick={handleTestEmail}
                            disabled={testingEmail || !emailConfig.smtpHost}
                            variant="outline"
                            className="flex-1"
                        >
                            {testingEmail ? <Loader2 size={16} className="animate-spin mr-2" /> : <Mail size={16} className="mr-2" />}
                            {testingEmail ? 'Sende...' : 'Testmail senden'}
                        </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">
                        Die Testmail wird an die E-Mail-Adresse des aktuell angemeldeten Administrators gesendet.
                    </p>
                </div>
            </Card>
        </div>
    );

    const MessagingSection = (
        <div className="space-y-6">
            <Card className="p-8 border-border bg-card/50 shadow-lg backdrop-blur-sm">
                <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <Mail size={20} className="text-primary" />
                    Messaging
                </h2>
                <div className="text-center py-12">
                    <p className="text-muted-foreground italic">Diese Funktion wird in Kürze verfügbar sein.</p>
                </div>
            </Card>
        </div>
    );

    const SubscriptionSection = (() => {
        // Map tier names to badge filenames
        const getTierBadge = (tier) => {
            const tierMap = {
                'Plastikgabel': 'badge_plastic.png',
                'Silbergabel': 'badge_silver.png',
                'Goldgabel': 'badge_gold.png',
                'Regenbogengabel': 'badge_rainbow.png'
            };
            return tierMap[tier] || 'badge_plastic.png';
        };

        const currentTier = user?.tier || 'Plastikgabel';
        const badgeImage = getTierBadge(currentTier);

        return (
            <div className="space-y-8">
                {/* Tier Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl border border-primary/20">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block">Aktuelles Abo</label>
                        <div className="flex items-center gap-4 mb-3">
                            <img src={`/${badgeImage}`} alt={currentTier} className="w-16 h-16 object-contain" />
                            <div className="text-2xl font-bold">
                                {currentTier}
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Ihr aktueller Status. Upgrades sind derzeit nur über den Administrator möglich.
                        </p>
                    </div>

                    <div className="p-6 bg-muted/30 rounded-3xl border border-border flex flex-col justify-between">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3 block">Verfügbare Credits</label>
                            <div className="flex items-center gap-2">
                                <img src="/coin.png" alt="Credits" className="w-8 h-8 object-contain" />
                                <span className="text-3xl font-black">{parseFloat(user?.aiCredits || 0).toFixed(2)}</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 italic">Guthaben für AI-Analysen und Bildgenerierung.</p>
                    </div>
                </div>

                {/* History Table */}
                <div>
                    <h3 className="font-bold mb-4 flex items-center gap-2 px-1">
                        <History size={18} className="text-muted-foreground" />
                        Kontoauszug (AI Credits)
                    </h3>
                    <div className="bg-muted/20 rounded-2xl border border-border overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50 border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 font-bold">Datum</th>
                                    <th className="px-4 py-3 font-bold">Beschreibung</th>
                                    <th className="px-4 py-3 font-bold text-right">Betrag</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {loadingCredits ? (
                                    <tr>
                                        <td colSpan="3" className="px-4 py-8 text-center">
                                            <Loader2 className="animate-spin mx-auto text-primary/50" />
                                        </td>
                                    </tr>
                                ) : creditHistory?.length > 0 ? (
                                    creditHistory.map(tx => (
                                        <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString('de-DE')}</td>
                                            <td className="px-4 py-3">{tx.description}</td>
                                            <td className={cn(
                                                "px-4 py-3 font-bold text-right",
                                                parseFloat(tx.delta) > 0 ? "text-emerald-500" : "text-destructive"
                                            )}>
                                                {parseFloat(tx.delta) > 0 ? '+' : ''}{parseFloat(tx.delta).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="3" className="px-4 py-8 text-center text-muted-foreground italic">Noch keine Transaktionen vorhanden.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    })();

    const adminTabs = [
        { id: 'users', label: 'Benutzer', icon: Users },
        { id: 'messaging', label: 'Messaging', icon: Mail },
        { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
        { id: 'logs', label: 'Logs', icon: FileText },
        { id: 'texts', label: 'Rechtstexte', icon: Type },
        { id: 'system', label: 'System', icon: SettingsIcon }
    ];

    const getAdminContent = (id) => {
        switch (id) {
            case 'users': return UsersSection;
            case 'messaging': return MessagingSection;
            case 'compliance': return ComplianceSection;
            case 'logs': return LogsSection;
            case 'texts': return TextsSection;
            case 'system': return SystemSection;
            default: return null;
        }
    };

    const AdminSection = (
        <div className="space-y-6">
            {/* Mobile Accordion for Admin Submenu */}
            <div className="sm:hidden space-y-2">
                {adminTabs.map((sub) => {
                    const isActive = activeAdminTab === sub.id;
                    return (
                        <div key={sub.id} className="border border-border/50 rounded-lg overflow-hidden bg-card/30">
                            <button
                                onClick={() => setActiveAdminTab(isActive ? '' : sub.id)}
                                className={cn(
                                    "w-full flex items-center justify-between p-3 text-sm font-bold text-left transition-colors",
                                    isActive ? "bg-primary/5 text-primary" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <sub.icon size={16} />
                                    <span>{sub.label}</span>
                                </div>
                                <ChevronDown
                                    size={16}
                                    className={cn("text-muted-foreground transition-transform duration-300", isActive && "rotate-180 text-primary")}
                                />
                            </button>
                            <AnimatePresence initial={false}>
                                {isActive && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <div className="p-3 border-t border-border/50">
                                            {getAdminContent(sub.id)}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>

            {/* Desktop Tabs for Admin Submenu */}
            <div className="hidden sm:block">
                <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2">
                    {adminTabs.map(sub => (
                        <button
                            key={sub.id}
                            onClick={() => setActiveAdminTab(sub.id)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all text-xs font-bold",
                                activeAdminTab === sub.id
                                    ? "bg-primary/10 text-primary border border-primary/20"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                            )}
                        >
                            <sub.icon size={14} />
                            {sub.label}
                        </button>
                    ))}
                </div>

                <motion.div
                    key={activeAdminTab}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {getAdminContent(activeAdminTab)}
                </motion.div>
            </div>
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
            {/* Mobile View: Accordion (Vertical Stack) */}
            <div className="sm:hidden space-y-3">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <div key={tab.id} className="border border-border rounded-xl bg-card/50 overflow-hidden shadow-sm transition-all duration-200">
                            <button
                                onClick={() => setActiveTab(isActive ? '' : tab.id)}
                                className={cn(
                                    "w-full flex items-center justify-between p-4 font-bold text-left transition-colors",
                                    isActive ? "bg-primary/5 text-primary" : "hover:bg-muted/50 text-foreground"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon size={20} className={isActive ? "text-primary" : "text-muted-foreground"} />
                                    <span>{tab.label}</span>
                                </div>
                                <ChevronDown
                                    size={18}
                                    className={cn("text-muted-foreground transition-transform duration-300", isActive && "rotate-180 text-primary")}
                                />
                            </button>
                            <AnimatePresence initial={false}>
                                {isActive && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                    >
                                        <div className="p-4 border-t border-border/50">
                                            {tab.id === 'profile' && ProfileSection}
                                            {tab.id === 'household' && HouseholdSection}
                                            {tab.id === 'cookbook' && CookbookSection}
                                            {tab.id === 'stores' && StoresSection}
                                            {tab.id === 'subscription' && SubscriptionSection}
                                            {tab.id === 'integration' && ApiSection}
                                            {tab.id === 'admin' && AdminSection}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>

            {/* Desktop View: Tabs + Content */}
            <div className="hidden sm:block">
                <div className="flex flex-wrap gap-2 mb-8 border-b border-border pb-2">
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
                    {activeTab === 'subscription' && SubscriptionSection}
                    {activeTab === 'integration' && ApiSection}
                    {activeTab === 'admin' && AdminSection}
                </motion.div>
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
