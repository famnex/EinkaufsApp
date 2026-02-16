import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings as SettingsIcon, Store as StoreIcon, Shield, Trash2, Plus, ArrowLeft, Check, X, Building2, Users, UserCog, User, Sparkles, Terminal, Loader2, CheckCircle, ChefHat, Share2, Lock, Mail, Eye, EyeOff, Palette, Copy, FileText, Type, ShieldCheck, Layers, CloudDownload, ChevronDown, CreditCard, History, Inbox, Send, RefreshCw, Reply, MailOpen, Pen, AlertTriangle } from 'lucide-react';
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
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

export default function SettingsPage() {
    const navigate = useNavigate();
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user, setUser, notificationCounts, fetchNotificationCounts } = useAuth();
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
    const [initialDetailTab, setInitialDetailTab] = useState('general');

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
        smtpSenderName: '',
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

    const [activeTab, setActiveTab] = useState('');
    const [activeAdminTab, setActiveAdminTab] = useState('');
    const [activeProfileTab, setActiveProfileTab] = useState('');


    useEffect(() => {
        // Auto-open defaults only on desktop if nothing matches
        if (window.innerWidth >= 640) {
            if (!activeTab) setActiveTab('profile');
            if (!activeAdminTab) setActiveAdminTab('users');
            if (!activeProfileTab) setActiveProfileTab('general');
        }
    }, [activeTab]);

    // Email/Password Change State
    const [emailChangeData, setEmailChangeData] = useState({ currentPassword: '', newEmail: '' });
    const [passwordChangeData, setPasswordChangeData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [changingEmail, setChangingEmail] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);


    // Compliance State
    const [complianceReports, setComplianceReports] = useState([]);
    const [loadingCompliance, setLoadingCompliance] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);

    useEffect(() => {
        fetchStores();
        fetchSettings();
        if (user) {
            fetchHouseholdMembers();
            fetchUserStrikes(); // New: Fetch strikes for personal profile
        }
        if (user?.role === 'admin') {
            fetchUsers();
            fetchEmails('inbox');
            if (activeAdminTab === 'compliance') {
                fetchComplianceReports();
            }
        }
    }, [user?.role, activeAdminTab, user?.id]); // Added user.id dependency

    // User Strikes State
    const [userStrikes, setUserStrikes] = useState([]);
    const [loadingStrikes, setLoadingStrikes] = useState(false);

    const fetchUserStrikes = async () => {
        if (!user) return;
        setLoadingStrikes(true);
        try {
            const res = await api.get(`/users/${user.id}/strikes`);
            setUserStrikes(res.data);
        } catch (err) {
            console.error('Failed to fetch user strikes:', err);
        } finally {
            setLoadingStrikes(false);
        }
    };

    const fetchComplianceReports = async () => {
        setLoadingCompliance(true);
        try {
            const res = await api.get('/compliance');
            setComplianceReports(res.data);
        } catch (err) {
            console.error('Failed to fetch compliance reports:', err);
        } finally {
            setLoadingCompliance(false);
        }
    };

    const updateReportStatus = async (id, newStatus, note, internalNote) => {
        try {
            const res = await api.put(`/compliance/${id}`, { status: newStatus, resolutionNote: note, internalNote });

            // The API returns the updated report, but might miss associations like 'accusedUser' unless we fetch again.
            // We can merge the existing accusedUser from our local state to prevent it from disappearing.
            const updatedReport = res.data;
            const currentReport = complianceReports.find(r => r.id === id);

            // Preserve associations
            if (currentReport?.accusedUser) updatedReport.accusedUser = currentReport.accusedUser;
            if (selectedReport?.accusedUser) updatedReport.accusedUser = selectedReport.accusedUser;

            // Update list
            setComplianceReports(prev => prev.map(r => r.id === id ? { ...r, ...updatedReport } : r));

            if (selectedReport && selectedReport.id === id) {
                // Force UI lock if entering final state by updating 'originalStatus' to match new status immediately
                // AND ensuring we have the full object structure
                setSelectedReport({
                    ...selectedReport,
                    ...updatedReport,
                    originalStatus: updatedReport.status // Update this to lock fields immediately
                });
            }
            if (fetchNotificationCounts) fetchNotificationCounts();
        } catch (err) {
            console.error('Failed to update report:', err);
            alert('Fehler beim Speichern: ' + (err.response?.data?.error || err.message));
        }
    };

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
                    smtpSenderName: emailRes.data.smtpSenderName || '',
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


    // Credit History State
    const [creditHistory, setCreditHistory] = useState([]);
    const [loadingCredits, setLoadingCredits] = useState(false);
    const [loadingSubscription, setLoadingSubscription] = useState(false);

    useEffect(() => {
        if (activeTab === 'subscription') {
            fetchCreditHistory();
            refreshUserStatus();
        }
        if (activeTab === 'admin' && user?.role === 'admin') {
            if (activeAdminTab === 'logs') fetchLogs();
            if (activeAdminTab === 'texts') fetchLegalTexts();
        }

        // Desktop default for profile/admin sub-tabs
        if (window.innerWidth >= 640) {
            if (activeTab === 'admin' && !activeAdminTab) setActiveAdminTab('users');
            if (activeTab === 'profile' && !activeProfileTab) setActiveProfileTab('general');
        }
    }, [activeTab, activeAdminTab, activeProfileTab]);

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

    const refreshUserStatus = async () => {
        setLoadingSubscription(true);
        try {
            const { data } = await api.get('/auth/profile');
            setUser(data);
            localStorage.setItem('user', JSON.stringify(data));
        } catch (err) {
            console.error('Failed to refresh user status', err);
        } finally {
            setLoadingSubscription(false);
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

    // --- Messaging State ---
    const [messagingFolder, setMessagingFolder] = useState('inbox');
    const [emails, setEmails] = useState([]);
    const [emailsTotal, setEmailsTotal] = useState(0);
    const [unreadInbox, setUnreadInbox] = useState(0);
    const [loadingEmails, setLoadingEmails] = useState(false);
    const [fetchingEmails, setFetchingEmails] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [loadingEmail, setLoadingEmail] = useState(false);
    const [composeOpen, setComposeOpen] = useState(false);
    const [composeData, setComposeData] = useState({ to: '', cc: '', bcc: '', subject: '', body: '' });
    const [showCcBcc, setShowCcBcc] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [replyTo, setReplyTo] = useState(null);

    const fetchEmails = async (folder) => {
        setLoadingEmails(true);
        try {
            const res = await api.get(`/messaging?folder=${folder || messagingFolder}`);
            setEmails(res.data.emails || []);
            setEmailsTotal(res.data.total || 0);
            setUnreadInbox(res.data.unreadInbox || 0);
        } catch (err) {
            console.error('Failed to fetch emails:', err);
        } finally {
            setLoadingEmails(false);
        }
    };

    const openEmail = async (id) => {
        setLoadingEmail(true);
        try {
            const res = await api.get(`/messaging/${id}`);
            setSelectedEmail(res.data);
            // Update read status in list
            const wasUnread = emails.find(e => e.id === id)?.isRead === false;
            setEmails(prev => prev.map(e => e.id === id ? { ...e, isRead: true } : e));

            if (wasUnread && res.data.folder === 'inbox') {
                setUnreadInbox(prev => Math.max(0, prev - 1));
                if (fetchNotificationCounts) fetchNotificationCounts();
            }
        } catch (err) {
            console.error('Failed to open email:', err);
        } finally {
            setLoadingEmail(false);
        }
    };

    const handleImapFetch = async () => {
        setFetchingEmails(true);
        try {
            const res = await api.post('/messaging/fetch');
            alert(res.data.message || 'E-Mails abgerufen');
            fetchEmails('inbox');
        } catch (err) {
            alert(err.response?.data?.error || 'Fehler beim Abrufen');
        } finally {
            setFetchingEmails(false);
        }
    };

    const handleSendEmail = async () => {
        if (!composeData.to) return alert('Empfänger fehlt');
        setSendingEmail(true);
        try {
            await api.post('/messaging/send', {
                to: composeData.to,
                cc: composeData.cc,
                bcc: composeData.bcc,
                subject: composeData.subject,
                body: composeData.body,
                inReplyTo: replyTo?.messageId || null
            });
            setComposeOpen(false);
            setComposeData({ to: '', cc: '', bcc: '', subject: '', body: '' });
            setShowCcBcc(false);
            setReplyTo(null);
            fetchEmails(messagingFolder);
            alert('E-Mail gesendet!');
        } catch (err) {
            alert(err.response?.data?.error || 'Fehler beim Senden');
        } finally {
            setSendingEmail(false);
        }
    };

    const handleTrashEmail = async (id) => {
        try {
            await api.put(`/messaging/${id}/trash`);
            setSelectedEmail(null);
            fetchEmails(messagingFolder);
        } catch (err) {
            alert('Fehler: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleRestoreEmail = async (id) => {
        try {
            await api.put(`/messaging/${id}/restore`);
            setSelectedEmail(null);
            fetchEmails(messagingFolder);
        } catch (err) {
            alert('Fehler: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleDeleteEmail = async (id) => {
        if (!confirm('E-Mail endgültig löschen?')) return;
        try {
            await api.delete(`/messaging/${id}`);
            setSelectedEmail(null);
            fetchEmails(messagingFolder);
        } catch (err) {
            alert('Fehler: ' + (err.response?.data?.error || err.message));
        }
    };

    const openReply = (email) => {
        setReplyTo(email);
        setComposeData({
            to: email.fromAddress,
            cc: '',
            bcc: '',
            subject: email.subject?.startsWith('RE:') ? email.subject : `RE: ${email.subject || ''}`,
            body: `<br/><br/>--- Ursprüngliche Nachricht ---<br/>Von: ${email.fromAddress}<br/>Datum: ${new Date(email.date).toLocaleString('de-DE')}<br/>Betreff: ${email.subject}<br/><br/>${email.body || email.bodyText || ''}`
        });
        setComposeOpen(true);
    };

    const switchFolder = (folder) => {
        setMessagingFolder(folder);
        setSelectedEmail(null);
        fetchEmails(folder);
    };

    // Tab Definitions
    const profileTabs = [
        { id: 'general', label: 'Benutzerprofil', icon: User },
        { id: 'email', label: 'E-Mail-Adresse ändern', icon: Mail },
        { id: 'password', label: 'Passwort ändern', icon: Lock },
        { id: 'strikes', label: 'Sicherheitsstatus & Verstöße', icon: ShieldCheck }
    ];

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

    const getProfileContent = (id) => {
        switch (id) {
            case 'general':
                return (
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
                );
            case 'email':
                return (
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
                );
            case 'password':
                return (
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
                );
            case 'strikes':
                return (
                    <Card className="p-8 border-border bg-card/50 shadow-lg backdrop-blur-sm relative overflow-hidden">
                        <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                            <ShieldCheck size={20} className={userStrikes.length > 0 ? "text-destructive" : "text-emerald-500"} />
                            Sicherheitsstatus & Verstöße
                        </h2>

                        {loadingStrikes ? (
                            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary/50" /></div>
                        ) : userStrikes.length > 0 ? (
                            <div className="space-y-6">
                                <div className="p-4 bg-destructive/10 text-destructive rounded-2xl border border-destructive/20 flex gap-3">
                                    <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold">
                                            Achtung: Es liegen Verstöße gegen unsere Richtlinien vor.
                                        </p>
                                        <p className="text-xs mt-1 opacity-90 leading-relaxed">
                                            Bitte beachten Sie, dass wiederholte Verstöße zur dauerhaften Sperrung Ihres Accounts führen können.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-background/50 rounded-2xl border border-border overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-muted/50 border-b border-border">
                                            <tr>
                                                <th className="px-4 py-3 font-bold">Datum</th>
                                                <th className="px-4 py-3 font-bold">Grund</th>
                                                <th className="px-4 py-3 font-bold">Inhalt</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {userStrikes.map(strike => (
                                                <tr key={strike.id} className="hover:bg-muted/30 transition-colors">
                                                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap align-top">
                                                        {new Date(strike.updatedAt).toLocaleDateString('de-DE')}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium align-top">
                                                        <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded-full text-xs font-bold border border-destructive/20 inline-block">
                                                            {strike.reasonCategory}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-muted-foreground align-top">
                                                        <div className="font-mono bg-muted/50 px-1.5 py-0.5 rounded inline-block mb-1 max-w-[200px] truncate" title={strike.contentUrl}>
                                                            {strike.contentType}: {strike.contentUrl}
                                                        </div>
                                                        {strike.resolutionNote && (
                                                            <div className="italic text-destructive/80 font-medium">
                                                                "{strike.resolutionNote}"
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle size={32} />
                                </div>
                                <p className="font-bold text-foreground text-lg">Alles in Ordnung!</p>
                                <p className="text-sm">Keine Verstöße oder Verwarnungen verzeichnet.</p>
                            </div>
                        )}
                    </Card>
                );
            default: return null;
        }
    };

    const ProfileSection = (
        <div className="space-y-6">
            {/* Mobile Accordion for Profile Submenu */}
            <div className="sm:hidden space-y-2">
                {profileTabs.map((sub) => {
                    const isActive = activeProfileTab === sub.id;
                    return (
                        <div key={sub.id} className="border border-border/50 rounded-lg overflow-hidden bg-card/30">
                            <button
                                onClick={() => setActiveProfileTab(isActive ? '' : sub.id)}
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
                                            {getProfileContent(sub.id)}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>

            {/* Desktop Sections for Profile */}
            <div className="hidden sm:block space-y-6">
                {profileTabs.map(tab => (
                    <div key={tab.id}>
                        {getProfileContent(tab.id)}
                    </div>
                ))}
            </div>
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

                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Absender Name (Optional)</label>
                        <Input
                            type="text"
                            value={emailConfig.smtpSenderName}
                            onChange={(e) => setEmailConfig({ ...emailConfig, smtpSenderName: e.target.value })}
                            placeholder="GabelGuru Admin"
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


    const SubscriptionSection = (() => {
        // Map tier names to badge filenames
        const getTierBadge = (tier) => {
            const tierMap = {
                'Plastikgabel': 'badge_plastic.png',
                'Silbergabel': 'badge_silver.png',
                'Goldgabel': 'badge_gold.png',
                'Rainbowspoon': 'badge_rainbow.png', // Match server enum
                'Regenbogengabel': 'badge_rainbow.png' // Fallback
            };
            return tierMap[tier] || 'badge_plastic.png';
        };

        const currentTier = user?.tier || 'Plastikgabel';
        const badgeImage = getTierBadge(currentTier);

        return (
            <div className="space-y-8 relative">
                {/* Tier Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl border border-primary/20 relative min-h-[160px] flex flex-col justify-center">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block">Aktuelles Abo</label>
                        {loadingSubscription ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-4 mb-3">
                                    <img src={`/${badgeImage}`} alt={currentTier} className="w-16 h-16 object-contain" />
                                    <div className="text-2xl font-bold">
                                        {currentTier === 'Rainbowspoon' ? 'Regenbogengabel' : currentTier}
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Ihr aktueller Status. Upgrades sind derzeit nur über den Administrator möglich.
                                </p>
                            </>
                        )}
                    </div>

                    <div className="p-6 bg-muted/30 rounded-3xl border border-border flex flex-col justify-between relative min-h-[160px]">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3 block">Verfügbare Credits</label>
                        {loadingSubscription ? (
                            <div className="flex-1 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
                            </div>
                        ) : (
                            <>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <img src="/coin.png" alt="Credits" className="w-8 h-8 object-contain" />
                                        <span className="text-3xl font-black">{parseFloat(user?.aiCredits || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2 italic">Guthaben für AI-Analysen und Bildgenerierung.</p>
                            </>
                        )}
                    </div>
                </div>

                {/* History Table */}
                <div>
                    <h3 className="font-bold mb-4 flex items-center gap-2 px-1">
                        <History size={18} className="text-muted-foreground" />
                        Kontoauszug (AI Credits)
                    </h3>
                    <div className="bg-muted/20 rounded-2xl border border-border overflow-hidden min-h-[200px]">
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
                                        <td colSpan="3" className="px-4 py-20 text-center">
                                            <Loader2 className="animate-spin mx-auto text-primary/50 w-8 h-8" />
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
                                        <td colSpan="3" className="px-4 py-20 text-center text-muted-foreground italic">Noch keine Transaktionen vorhanden.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    })();

    const messagingFolders = [
        { id: 'inbox', label: 'Posteingang', icon: Inbox },
        { id: 'sent', label: 'Gesendet', icon: Send },
        { id: 'trash', label: 'Papierkorb', icon: Trash2 }
    ];

    const MessagingSection = (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    {messagingFolders.map(f => {
                        const FIcon = f.icon;
                        return (
                            <button
                                key={f.id}
                                onClick={() => switchFolder(f.id)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                    messagingFolder === f.id
                                        ? "bg-primary text-primary-foreground shadow-md"
                                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                )}
                            >
                                <FIcon size={16} />
                                {f.label}
                                {f.id === 'inbox' && unreadInbox > 0 && (
                                    <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{unreadInbox}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleImapFetch}
                        disabled={fetchingEmails}
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                    >
                        {fetchingEmails ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        Abrufen
                    </Button>
                    <Button
                        onClick={() => {
                            setReplyTo(null);
                            setComposeData({ to: '', cc: '', bcc: '', subject: '', body: '' });
                            setShowCcBcc(false);
                            setComposeOpen(true);
                        }}
                        size="sm"
                        className="gap-1.5"
                    >
                        <Pen size={16} />
                        Neue E-Mail
                    </Button>
                </div>
            </div>

            {/* Email Detail View */}
            {selectedEmail ? (
                <Card className="p-6 border-border bg-card/50 shadow-lg backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => setSelectedEmail(null)}
                            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft size={16} />
                            Zurück
                        </button>
                        <div className="flex items-center gap-2">
                            {selectedEmail.folder === 'inbox' && (
                                <Button variant="outline" size="sm" onClick={() => openReply(selectedEmail)} className="gap-1">
                                    <Reply size={14} />
                                    Antworten
                                </Button>
                            )}
                            {selectedEmail.folder !== 'trash' ? (
                                <Button variant="outline" size="sm" onClick={() => handleTrashEmail(selectedEmail.id)} className="gap-1 text-red-500 hover:text-red-600">
                                    <Trash2 size={14} />
                                    Löschen
                                </Button>
                            ) : (
                                <>
                                    <Button variant="outline" size="sm" onClick={() => handleRestoreEmail(selectedEmail.id)} className="gap-1">
                                        <ArrowLeft size={14} />
                                        Wiederherstellen
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleDeleteEmail(selectedEmail.id)} className="gap-1 text-red-500 hover:text-red-600">
                                        <Trash2 size={14} />
                                        Endgültig löschen
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-3">{selectedEmail.subject || '(Kein Betreff)'}</h2>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground mb-4">
                        <span><strong>Von:</strong> {selectedEmail.fromAddress}</span>
                        <span><strong>An:</strong> {selectedEmail.toAddress}</span>
                        {selectedEmail.cc && <span><strong>CC:</strong> {selectedEmail.cc}</span>}
                        {selectedEmail.bcc && <span><strong>BCC:</strong> {selectedEmail.bcc}</span>}
                        <span><strong>Datum:</strong> {new Date(selectedEmail.date).toLocaleString('de-DE')}</span>
                    </div>
                    <div className="border-t border-border pt-4">
                        {selectedEmail.body ? (
                            <div
                                className="prose prose-sm max-w-none text-foreground [&_a]:text-primary"
                                dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
                            />
                        ) : (
                            <pre className="whitespace-pre-wrap text-sm text-foreground font-sans">{selectedEmail.bodyText || 'Kein Inhalt'}</pre>
                        )}
                    </div>
                </Card>
            ) : (
                /* Email List */
                <Card className="border-border bg-card/50 shadow-lg backdrop-blur-sm overflow-hidden">
                    {loadingEmails ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 size={24} className="animate-spin text-primary" />
                        </div>
                    ) : emails.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                            <MailOpen size={40} className="mb-3 opacity-50" />
                            <p className="font-medium">Keine E-Mails in {messagingFolders.find(f => f.id === messagingFolder)?.label}</p>
                            {messagingFolder === 'inbox' && (
                                <p className="text-sm mt-1">Klicke "Abrufen" um neue E-Mails zu laden</p>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {emails.map(email => (
                                <button
                                    key={email.id}
                                    onClick={() => openEmail(email.id)}
                                    className={cn(
                                        "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-start gap-3",
                                        !email.isRead && "bg-primary/5"
                                    )}
                                >
                                    <div className="mt-1 shrink-0">
                                        {email.isRead ? (
                                            <MailOpen size={16} className="text-muted-foreground" />
                                        ) : (
                                            <Mail size={16} className="text-primary" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className={cn(
                                                "text-sm truncate",
                                                email.isRead ? "text-muted-foreground" : "text-foreground font-bold"
                                            )}>
                                                {messagingFolder === 'sent' ? email.toAddress : email.fromAddress}
                                            </p>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                {new Date(email.date).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className={cn(
                                            "text-sm truncate",
                                            email.isRead ? "text-muted-foreground" : "text-foreground font-medium"
                                        )}>
                                            {email.subject || '(Kein Betreff)'}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {/* Compose Modal */}
            <AnimatePresence>
                {composeOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                        onClick={() => setComposeOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-foreground">
                                        {replyTo ? 'Antworten' : 'Neue E-Mail'}
                                    </h3>
                                    <button onClick={() => setComposeOpen(false)} className="text-muted-foreground hover:text-foreground">
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    <div className="relative">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 block flex justify-between items-center">
                                            An
                                            <button
                                                onClick={() => setShowCcBcc(!showCcBcc)}
                                                className="text-[10px] text-primary hover:underline font-bold"
                                            >
                                                {showCcBcc ? '- CC/BCC ausblenden' : '+ CC/BCC hinzufügen'}
                                            </button>
                                        </label>
                                        <Input
                                            value={composeData.to}
                                            onChange={e => setComposeData({ ...composeData, to: e.target.value })}
                                            placeholder="empfaenger@example.com"
                                            className="bg-muted border-transparent"
                                        />
                                    </div>

                                    <AnimatePresence>
                                        {showCcBcc && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="space-y-3 overflow-hidden"
                                            >
                                                <div>
                                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 block">CC</label>
                                                    <Input
                                                        value={composeData.cc}
                                                        onChange={e => setComposeData({ ...composeData, cc: e.target.value })}
                                                        placeholder="cc@example.com"
                                                        className="bg-muted border-transparent"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 block">BCC</label>
                                                    <Input
                                                        value={composeData.bcc}
                                                        onChange={e => setComposeData({ ...composeData, bcc: e.target.value })}
                                                        placeholder="bcc@example.com"
                                                        className="bg-muted border-transparent"
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Betreff</label>
                                        <Input
                                            value={composeData.subject}
                                            onChange={e => setComposeData({ ...composeData, subject: e.target.value })}
                                            placeholder="Betreff"
                                            className="bg-muted border-transparent"
                                        />
                                    </div>
                                    <div className="min-h-[300px] flex flex-col">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Nachricht</label>
                                        <div className="flex-1 bg-muted rounded-lg overflow-hidden border-transparent focus-within:ring-2 focus-within:ring-primary/20">
                                            <ReactQuill
                                                theme="snow"
                                                value={composeData.body}
                                                onChange={val => setComposeData({ ...composeData, body: val })}
                                                placeholder="Nachricht eingeben..."
                                                className="h-full border-none [&_.ql-toolbar]:bg-muted/50 [&_.ql-toolbar]:border-none [&_.ql-container]:border-none [&_.ql-editor]:min-h-[250px] [&_.ql-editor]:text-foreground [&_.ql-editor]:text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <Button variant="outline" onClick={() => setComposeOpen(false)}>Abbrechen</Button>
                                        <Button onClick={handleSendEmail} disabled={sendingEmail} className="gap-1.5">
                                            {sendingEmail ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                            Senden
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    // Compliance UI State
    const [showUserLinkSearch, setShowUserLinkSearch] = useState(false);
    const [userLinkSearchQuery, setUserLinkSearchQuery] = useState('');

    const userLinkFilteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(userLinkSearchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(userLinkSearchQuery.toLowerCase())
    );

    const handleLinkUser = async (userToLink) => {
        if (!selectedReport) return;

        // Optimistic UI update
        const updatedUser = { ...userToLink, strikeCount: '...' }; // Placeholder until refresh

        setSelectedReport(prev => ({
            ...prev,
            accusedUserId: userToLink.id,
            accusedUser: updatedUser
        }));
        setShowUserLinkSearch(false);

        try {
            await api.put(`/compliance/${selectedReport.id}`, {
                accusedUserId: userToLink.id
            });

            // Update list state to reflect change
            setComplianceReports(prev => prev.map(r =>
                r.id === selectedReport.id ? {
                    ...r,
                    accusedUserId: userToLink.id,
                    accusedUser: userToLink
                } : r
            ));

        } catch (err) {
            console.error('Failed to link user:', err);
            alert('Fehler beim Verknüpfen des Benutzers.');
        }
    };

    const ComplianceSection = (
        <div className="space-y-6">
            <Card className="p-6 border-border bg-card/50 shadow-lg backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <ShieldCheck size={20} className="text-primary" />
                        Compliance & Meldungen
                    </h2>
                    <Button variant="outline" size="sm" onClick={fetchComplianceReports} disabled={loadingCompliance}>
                        {loadingCompliance ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    </Button>
                </div>

                {selectedReport ? (
                    <div className="space-y-6 animate-in slide-in-from-right duration-300">
                        <button
                            onClick={() => setSelectedReport(null)}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                        >
                            <ArrowLeft size={16} /> Zurück zur Liste
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                            {/* Left Column: Report Details & Evidence */}
                            <div className="md:col-span-2 space-y-6">
                                <Card className="p-0 overflow-hidden border-border bg-muted/20">
                                    <div className="p-4 border-b border-border bg-muted/40 font-bold text-sm uppercase tracking-widest text-muted-foreground">
                                        Meldungs-Details
                                    </div>
                                    <div className="p-6 space-y-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div>
                                                <h4 className="font-semibold text-foreground mb-2">Gemeldeter Inhalt</h4>
                                                <div className="space-y-1 text-sm text-muted-foreground">
                                                    <p><span className="font-medium text-foreground">URL:</span> <a href={selectedReport.contentUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{selectedReport.contentUrl}</a></p>
                                                    <p><span className="font-medium text-foreground">Art:</span> {selectedReport.contentType}</p>
                                                    <p><span className="font-medium text-foreground">Zeitpunkt:</span> {new Date(selectedReport.createdAt).toLocaleString('de-DE')}</p>
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-foreground mb-2">Begründung</h4>
                                                <div className="space-y-1 text-sm text-muted-foreground">
                                                    <p><span className="font-medium text-foreground">Kategorie:</span> <span className="text-red-500 font-bold">{selectedReport.reasonCategory}</span></p>
                                                    {selectedReport.originalSourceUrl && (
                                                        <p><span className="font-medium text-foreground">Original:</span> <a href={selectedReport.originalSourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{selectedReport.originalSourceUrl}</a></p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-foreground mb-2">Beschreibung</h4>
                                            <div className="p-3 bg-background rounded-lg border border-border/50 text-sm italic">
                                                "{selectedReport.reasonDescription}"
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                {selectedReport.screenshotPath && (
                                    <Card className="p-0 overflow-hidden border-border bg-muted/20">
                                        <div className="p-4 border-b border-border bg-muted/40 font-bold text-sm uppercase tracking-widest text-muted-foreground flex justify-between items-center">
                                            <span>Beweissicherung</span>
                                            <span className="text-[10px] font-normal normal-case opacity-70">Automatisch erstellt</span>
                                        </div>
                                        <div className="p-6">
                                            <a
                                                href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${selectedReport.screenshotPath}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block group relative overflow-hidden rounded-lg border border-border"
                                            >
                                                <img
                                                    src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${selectedReport.screenshotPath}`}
                                                    alt="Vorschau"
                                                    className="w-full h-auto transition-transform duration-500 group-hover:scale-105"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                    <div className="bg-black/75 text-white px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm">
                                                        Vergrößern
                                                    </div>
                                                </div>
                                            </a>
                                        </div>
                                    </Card>
                                )}
                            </div>

                            {/* Right Column: Administration */}
                            <div className="space-y-6">
                                {/* Accused User Card */}
                                <Card className="p-0 overflow-hidden border-border bg-muted/20">
                                    <div className="p-4 border-b border-border bg-muted/40 font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <User size={16} />
                                        Verursacher
                                    </div>
                                    <div className="p-4 space-y-4">
                                        {selectedReport.accusedUser ? (
                                            <div className="bg-background/50 p-3 rounded-xl border border-border/50">
                                                <div
                                                    className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors group"
                                                    onClick={() => {
                                                        setSelectedUserId(selectedReport.accusedUserId);
                                                        setInitialDetailTab('strikes'); // Open directly to strikes
                                                        setIsUserDetailModalOpen(true);
                                                    }}
                                                    title="Benutzerdetails öffnen"
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                        {selectedReport.accusedUser.username.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                                            {selectedReport.accusedUser.username}
                                                        </p>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            {selectedReport.accusedUser.strikeCount > 0 ? (
                                                                <span className="flex items-center gap-1 text-destructive font-bold">
                                                                    <AlertTriangle size={12} />
                                                                    {selectedReport.accusedUser.strikeCount} Verstöße
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1 text-emerald-500 font-bold">
                                                                    <CheckCircle size={12} />
                                                                    Keine Verstöße
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                        <ChevronDown size={14} className="-rotate-90" />
                                                    </Button>
                                                </div>

                                                <div className="mt-2 pt-2 border-t border-border/50 flex justify-end">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowUserLinkSearch(!showUserLinkSearch);
                                                        }}
                                                        disabled={selectedReport.originalStatus === 'resolved' || selectedReport.originalStatus === 'dismissed'}
                                                        className="text-[10px] text-muted-foreground hover:text-primary transition-colors font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <UserCog size={12} />
                                                        Benutzer ändern
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-4 text-muted-foreground text-sm">
                                                <p className="mb-2 italic">Kein Benutzer zugeordnet.</p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setShowUserLinkSearch(!showUserLinkSearch)}
                                                    disabled={selectedReport.originalStatus === 'resolved' || selectedReport.originalStatus === 'dismissed'}
                                                    className="w-full text-xs"
                                                >
                                                    <Plus size={14} className="mr-1" />
                                                    Benutzer verknüpfen
                                                </Button>
                                            </div>
                                        )}

                                        {/* User Search/Selection */}
                                        <AnimatePresence>
                                            {showUserLinkSearch && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden space-y-2 pt-2 border-t border-border"
                                                >
                                                    <Input
                                                        placeholder="Benutzer suchen..."
                                                        value={userLinkSearchQuery}
                                                        onChange={(e) => setUserLinkSearchQuery(e.target.value)}
                                                        className="h-8 text-xs"
                                                        autoFocus
                                                    />
                                                    <div className="max-h-[150px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                                        {userLinkFilteredUsers.map(u => (
                                                            <button
                                                                key={u.id}
                                                                onClick={() => handleLinkUser(u)}
                                                                className={cn(
                                                                    "w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between hover:bg-muted transition-colors",
                                                                    selectedReport.accusedUserId === u.id && "bg-primary/10 text-primary font-bold"
                                                                )}
                                                            >
                                                                <span className="truncate">{u.username}</span>
                                                                {selectedReport.accusedUserId === u.id && <Check size={12} />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </Card>

                                <Card className="p-0 overflow-hidden border-border bg-muted/20 h-full">
                                    <div className="p-4 border-b border-border bg-muted/40 font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <ShieldCheck size={16} />
                                        Verwaltung
                                    </div>
                                    <div className="p-6 space-y-8">
                                        {/* Status */}
                                        {/* Status */}
                                        {/* Status */}
                                        <div>
                                            <h4 className="font-semibold text-foreground mb-3 text-sm">Status bearbeiten</h4>
                                            <select
                                                value={selectedReport.status}
                                                onChange={(e) => setSelectedReport({ ...selectedReport, status: e.target.value })}
                                                disabled={selectedReport.originalStatus === 'resolved' || selectedReport.originalStatus === 'dismissed'}
                                                className={cn(
                                                    "flex h-10 w-full rounded-xl border border-input px-3 py-2 text-sm font-bold shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed",
                                                    selectedReport.status === 'open' && "text-red-600 bg-red-50 border-red-200",
                                                    selectedReport.status === 'investigating' && "text-yellow-600 bg-yellow-50 border-yellow-200",
                                                    selectedReport.status === 'resolved' && "text-green-600 bg-green-50 border-green-200",
                                                    selectedReport.status === 'dismissed' && "text-muted-foreground bg-muted"
                                                )}
                                            >
                                                <option value="open">Offen</option>
                                                <option value="investigating">In Bearbeitung</option>
                                                <option value="resolved">Entfernen</option>
                                                <option value="dismissed">Ablehnen</option>
                                            </select>
                                            {(selectedReport.originalStatus === 'resolved' || selectedReport.originalStatus === 'dismissed') && (
                                                <p className="text-[10px] text-muted-foreground mt-1 italic">
                                                    Dieser Fall ist abgeschlossen und kann nicht mehr bearbeitet werden.
                                                </p>
                                            )}
                                        </div>

                                        {/* Public Reasoning */}
                                        <div className="space-y-2">
                                            <h4 className="font-semibold text-foreground mb-1 text-sm flex items-center gap-2">
                                                Begründung (Öffentlich / E-Mail)
                                                {(selectedReport.status === 'resolved' || selectedReport.status === 'dismissed') && (
                                                    <span className="text-red-500 ml-1">*</span>
                                                )}
                                                <Mail size={12} className="text-muted-foreground" />
                                            </h4>
                                            <textarea
                                                value={selectedReport.resolutionNote || ''}
                                                onChange={(e) => setSelectedReport({ ...selectedReport, resolutionNote: e.target.value })}
                                                disabled={selectedReport.originalStatus === 'resolved' || selectedReport.originalStatus === 'dismissed'}
                                                placeholder={
                                                    selectedReport.status === 'resolved' ? "Begründung für Entfernung (geht per Mail an Nutzer)..." :
                                                        selectedReport.status === 'dismissed' ? "Begründung für Ablehnung (geht per Mail an Nutzer)..." :
                                                            "Begründung für die Entscheidung..."
                                                }
                                                className="flex min-h-[100px] w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                                            />
                                            <p className="text-[10px] text-muted-foreground">
                                                Dieser Text wird dem Melder per E-Mail zugesendet.
                                            </p>
                                        </div>

                                        {/* Internal Notes */}
                                        <div className="space-y-2">
                                            <h4 className="font-semibold text-foreground mb-1 text-sm flex items-center gap-2">
                                                Interne Notizen
                                                <Lock size={12} className="text-muted-foreground" />
                                            </h4>
                                            <textarea
                                                value={selectedReport.internalNote || ''}
                                                onChange={(e) => setSelectedReport({ ...selectedReport, internalNote: e.target.value })}
                                                disabled={selectedReport.originalStatus === 'resolved' || selectedReport.originalStatus === 'dismissed'}
                                                placeholder="Nur für Administratoren sichtbar..."
                                                className="flex min-h-[80px] w-full rounded-xl border border-input bg-yellow-50/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                                            />
                                        </div>

                                        <Button
                                            onClick={() => {
                                                if ((selectedReport.status === 'resolved' || selectedReport.status === 'dismissed') && !selectedReport.resolutionNote?.trim()) {
                                                    alert('Für "Entfernen" oder "Ablehnen" ist eine Begründung erforderlich!');
                                                    return;
                                                }

                                                // Confirm destructive/final action
                                                if (selectedReport.status === 'resolved' || selectedReport.status === 'dismissed') {
                                                    const action = selectedReport.status === 'resolved' ? 'ENTFERNEN' : 'ABLEHNEN';
                                                    const msg = `ACHTUNG: Sie sind dabei, diesen Fall mit dem Status "${action}" abzuschließen.\n\n` +
                                                        `1. Die Begründung wird per E-Mail an den Melder gesendet.\n` +
                                                        `2. Der Status kann danach NICHT mehr geändert werden.\n` +
                                                        `3. ${selectedReport.status === 'resolved' ? 'Der Inhalt wird, falls vorhanden, unwiderruflich gelöscht/gebannt.' : 'Eventuelle Banns werden aufgehoben.'}\n\n` +
                                                        `Fortfahren?`;

                                                    if (!confirm(msg)) return;
                                                }

                                                updateReportStatus(selectedReport.id, selectedReport.status, selectedReport.resolutionNote, selectedReport.internalNote);
                                                alert('Status gespeichert.');
                                            }}
                                            disabled={selectedReport.originalStatus === 'resolved' || selectedReport.originalStatus === 'dismissed'}
                                            className="w-full"
                                            size="sm"
                                        >
                                            <CheckCircle size={16} className="mr-2" />
                                            Speichern
                                        </Button>

                                        <div className="border-t border-border/50 pt-6">
                                            <h4 className="font-semibold text-foreground mb-3 text-sm flex items-center gap-2">
                                                <User size={14} /> Melder-Informationen
                                            </h4>
                                            <div className="text-sm space-y-2 bg-background/50 p-3 rounded-lg border border-border/50">
                                                <div className="grid grid-cols-[60px_1fr] gap-2">
                                                    <span className="text-muted-foreground">Name:</span>
                                                    <span className="font-medium truncate">{selectedReport.reporterName}</span>

                                                    <span className="text-muted-foreground">Rolle:</span>
                                                    <span className="font-medium truncate">{selectedReport.reporterRole}</span>

                                                    <span className="text-muted-foreground">Kontakt:</span>
                                                    <a href={`mailto:${selectedReport.reporterEmail}`} className="text-primary hover:underline truncate block">
                                                        {selectedReport.reporterEmail}
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground font-bold">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">Status</th>
                                    <th className="px-4 py-3">Grund & Inhalt</th>
                                    <th className="px-4 py-3">Melder</th>
                                    <th className="px-4 py-3">Datum</th>
                                    <th className="px-4 py-3 rounded-tr-lg text-right">Aktion</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {loadingCompliance ? (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-12 text-center">
                                            <Loader2 size={24} className="animate-spin text-primary mx-auto" />
                                        </td>
                                    </tr>
                                ) : complianceReports.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-12 text-center text-muted-foreground italic">
                                            Keine Meldungen vorhanden.
                                        </td>
                                    </tr>
                                ) : (
                                    complianceReports.map(report => (
                                        <tr key={report.id} className="hover:bg-muted/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border",
                                                    report.status === 'open' && "bg-red-100 text-red-700 border-red-200",
                                                    report.status === 'investigating' && "bg-yellow-100 text-yellow-700 border-yellow-200",
                                                    report.status === 'resolved' && "bg-green-100 text-green-700 border-green-200",
                                                    report.status === 'dismissed' && "bg-muted text-muted-foreground border-border"
                                                )}>
                                                    {report.status === 'open' && 'Offen'}
                                                    {report.status === 'investigating' && 'In Arbeit'}
                                                    {report.status === 'resolved' && 'Gelöst'}
                                                    {report.status === 'dismissed' && 'Abgelehnt'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 max-w-[250px]">
                                                <div className="font-bold truncate" title={report.reasonCategory}>{report.reasonCategory}</div>
                                                <div className="text-xs text-muted-foreground truncate" title={report.contentUrl}>{report.contentUrl}</div>
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                <div className="font-medium">{report.reporterName}</div>
                                                <div className="text-muted-foreground">{report.reporterRole}</div>
                                            </td>
                                            <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                                                {new Date(report.createdAt).toLocaleDateString('de-DE')}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Button size="sm" variant="ghost" onClick={() => setSelectedReport({ ...report, originalStatus: report.status })}>
                                                    Details
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );

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
                                    {sub.id === 'messaging' && notificationCounts?.messaging > 0 && (
                                        <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{notificationCounts.messaging}</span>
                                    )}
                                    {sub.id === 'compliance' && notificationCounts?.compliance > 0 && (
                                        <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{notificationCounts.compliance}</span>
                                    )}
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
                            {sub.id === 'messaging' && notificationCounts?.messaging > 0 && (
                                <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{notificationCounts.messaging}</span>
                            )}
                            {sub.id === 'compliance' && notificationCounts?.compliance > 0 && (
                                <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{notificationCounts.compliance}</span>
                            )}
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
                                    {tab.id === 'admin' && notificationCounts?.total > 0 && (
                                        <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{notificationCounts.total}</span>
                                    )}
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
                                {tab.id === 'admin' && notificationCounts?.total > 0 && (
                                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{notificationCounts.total}</span>
                                )}
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
