import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Users, ChefHat, Building2, CreditCard, Sparkles, Loader2, Save, History, Plus, Minus, AlertTriangle, Key } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import api from '../lib/axios';
import { cn, getImageUrl } from '../lib/utils';

export default function UserDetailModal({ isOpen, onClose, userId, onUpdate }) {
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [saving, setSaving] = useState(false);

    // Edit States
    const [editData, setEditData] = useState({});
    const [bookingAmount, setBookingAmount] = useState('');
    const [bookingDesc, setBookingDesc] = useState('');
    const [bookingLoading, setBookingLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (isOpen && userId) {
            fetchDetail();
        }
    }, [isOpen, userId]);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/users/${userId}/detail`);
            setData(data);
            setEditData({
                username: data.user.username,
                email: data.user.email,
                role: data.user.role,
                tier: data.user.tier,
                cookbookTitle: data.user.cookbookTitle,
                cookbookImage: data.user.cookbookImage,
                password: ''
            });
        } catch (err) {
            console.error('Failed to fetch user detail', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGeneral = async () => {
        if (!confirm('Möchtest du diese Änderungen wirklich speichern?')) return;
        setSaving(true);
        try {
            const updatePayload = { ...editData };
            if (!updatePayload.password) delete updatePayload.password;

            await api.put(`/users/${userId}/detail`, updatePayload);
            await fetchDetail();
            if (onUpdate) onUpdate();
        } catch (err) {
            alert('Speichern fehlgeschlagen: ' + (err.response?.data?.error || err.message));
        } finally {
            setSaving(false);
        }
    };

    const handleBookCredits = async (isPositive = true) => {
        const amount = parseFloat(bookingAmount);
        if (isNaN(amount) || amount <= 0) {
            alert('Bitte einen gültigen Betrag eingeben');
            return;
        }

        const currentBalance = parseFloat(data.user.aiCredits || 0);
        if (!isPositive && currentBalance - amount < 0) {
            alert('Guthaben darf nicht unter 0 fallen');
            return;
        }

        if (!confirm(`Möchtest du wirklich ${amount.toFixed(2)} Credits ${isPositive ? 'gutschreiben' : 'abziehen'}?`)) return;

        setBookingLoading(true);
        try {
            const finalAmount = isPositive ? amount : -amount;
            await api.post(`/users/${userId}/book-credits`, {
                amount: finalAmount,
                description: bookingDesc
            });
            setBookingAmount('');
            setBookingDesc('');
            await fetchDetail();
            if (onUpdate) onUpdate();
        } catch (err) {
            alert('Buchung fehlgeschlagen');
        } finally {
            setBookingLoading(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        setUploading(true);
        try {
            const { data: uploadRes } = await api.post('/upload', formData);
            setEditData({ ...editData, cookbookImage: uploadRes.path });
        } catch (err) {
            console.error('Upload failed', err);
            alert('Upload fehlgeschlagen');
        } finally {
            setUploading(false);
        }
    };

    const tabs = [
        { id: 'general', label: 'Allgemein', icon: User },
        { id: 'household', label: 'Haushalt', icon: Users },
        { id: 'cookbook', label: 'Kochbuch', icon: ChefHat },
        { id: 'integration', label: 'Integration', icon: Building2 },
        { id: 'subscription', label: 'Abo & Credits', icon: CreditCard }
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-4xl bg-background rounded-3xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                    <User size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold">{data?.user?.username || 'Benutzer-Details'}</h2>
                                    <p className="text-sm text-muted-foreground">{data?.user?.email}</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                            {/* Sidebar Tabs */}
                            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-muted/10 p-4 space-y-1 overflow-x-auto md:overflow-y-auto flex md:flex-col gap-1">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm whitespace-nowrap",
                                            activeTab === tab.id
                                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        )}
                                    >
                                        <tab.icon size={18} />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Tab Panels */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {loading ? (
                                    <div className="h-full flex flex-col items-center justify-center space-y-4">
                                        <Loader2 size={40} className="animate-spin text-primary/50" />
                                        <p className="text-muted-foreground">Lade Details...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        {/* General Tab */}
                                        {activeTab === 'general' && (
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Benutzername</label>
                                                        <Input
                                                            value={editData.username}
                                                            onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Email-Adresse</label>
                                                        <Input
                                                            type="email"
                                                            value={editData.email}
                                                            onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Neues Passwort (optional)</label>
                                                        <Input
                                                            type="password"
                                                            placeholder="Unverändert lassen..."
                                                            value={editData.password}
                                                            onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Rolle</label>
                                                        <select
                                                            value={editData.role}
                                                            onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                                                            className="w-full h-12 bg-muted border-transparent rounded-2xl px-4 text-foreground focus:ring-2 focus:ring-primary outline-none"
                                                        >
                                                            <option value="user">Benutzer</option>
                                                            <option value="admin">Administrator</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <Button onClick={handleSaveGeneral} disabled={saving} className="w-full md:w-auto gap-2">
                                                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                                    Änderungen speichern
                                                </Button>
                                            </div>
                                        )}

                                        {/* Household Tab */}
                                        {activeTab === 'household' && (
                                            <div className="space-y-6">
                                                <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                                                    <h3 className="font-bold mb-4 flex items-center gap-2">
                                                        <Users size={18} className="text-primary" />
                                                        Verknüpfte Konten
                                                    </h3>
                                                    {data.householdMembers?.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {data.householdMembers.map(member => (
                                                                <div key={member.id} className="flex items-center justify-between p-3 bg-background rounded-xl border border-border/50">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold">
                                                                            {member.username.substring(0, 2).toUpperCase()}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-sm font-bold">{member.username}</p>
                                                                            <p className="text-[10px] text-muted-foreground">{member.email}</p>
                                                                        </div>
                                                                    </div>
                                                                    <span className={cn(
                                                                        "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter",
                                                                        member.role === 'admin' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                                                    )}>
                                                                        {member.role === 'admin' ? 'Admin' : 'Member'}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground italic">Kein Haushalt verknüpft.</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Cookbook Tab */}
                                        {activeTab === 'cookbook' && (
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Kochbuch Titel</label>
                                                        <Input
                                                            value={editData.cookbookTitle}
                                                            onChange={(e) => setEditData({ ...editData, cookbookTitle: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-4">
                                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Kochbuch Bild</label>
                                                        <div className="flex flex-col sm:flex-row items-start gap-4">
                                                            <div className="w-32 h-32 rounded-2xl bg-muted border border-border overflow-hidden flex-shrink-0 relative group">
                                                                {editData.cookbookImage ? (
                                                                    <img
                                                                        src={getImageUrl(editData.cookbookImage)}
                                                                        alt="Preview"
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                                        <ChefHat size={32} />
                                                                    </div>
                                                                )}
                                                                {uploading && (
                                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                                        <Loader2 size={24} className="animate-spin text-white" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 space-y-3 w-full">
                                                                <div className="flex gap-2">
                                                                    <Input
                                                                        value={editData.cookbookImage || ''}
                                                                        onChange={(e) => setEditData({ ...editData, cookbookImage: e.target.value })}
                                                                        placeholder="/uploads/..."
                                                                        className="text-xs"
                                                                    />
                                                                    <label className="shrink-0 h-12 px-4 bg-muted hover:bg-muted/80 rounded-2xl flex items-center justify-center cursor-pointer transition-colors border border-border/50">
                                                                        <Plus size={18} className="text-muted-foreground" />
                                                                        <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                                                                    </label>
                                                                </div>
                                                                <p className="text-[10px] text-muted-foreground leading-relaxed">
                                                                    Klicke auf das Plus-Icon um ein Bild hochzuladen oder gib direkt einen Pfad ein.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                                    <p className="text-xs text-primary font-medium flex items-center gap-2">
                                                        <Sparkles size={14} />
                                                        Hier können Admin-spezifische Korrekturen am Kochbuch-Profil vorgenommen werden.
                                                    </p>
                                                </div>

                                                <Button onClick={handleSaveGeneral} disabled={saving} className="w-full md:w-auto gap-2">
                                                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                                    Profil aktualisieren
                                                </Button>
                                            </div>
                                        )}


                                        {/* Integration Tab */}
                                        {activeTab === 'integration' && (
                                            <div className="space-y-6">
                                                <div className="p-6 bg-muted/30 rounded-3xl border border-border">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
                                                            <Key size={24} />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold">Alexa Integration</h3>
                                                            <p className="text-xs text-muted-foreground">Persönlicher API Key für den Alexa Skill</p>
                                                        </div>
                                                    </div>

                                                    <div className="bg-background p-4 rounded-2xl border border-border font-mono text-sm break-all">
                                                        {data.alexaKey || <span className="text-muted-foreground italic">Kein Key generiert</span>}
                                                    </div>

                                                    <div className="mt-4 flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                if (data.alexaKey) {
                                                                    navigator.clipboard.writeText(data.alexaKey);
                                                                    alert('Kopiert!');
                                                                }
                                                            }}
                                                            disabled={!data.alexaKey}
                                                        >
                                                            Kopieren
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Subscription Tab */}
                                        {activeTab === 'subscription' && (
                                            <div className="space-y-8">
                                                {/* Tier Info */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl border border-primary/20">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block">Aktuelles Abo</label>
                                                        <select
                                                            value={editData.tier}
                                                            onChange={(e) => setEditData({ ...editData, tier: e.target.value })}
                                                            className="w-full bg-background border-border rounded-xl px-4 py-2 text-foreground font-bold outline-none"
                                                        >
                                                            <option value="Plastikgabel">🍴 Plastikgabel</option>
                                                            <option value="Silbergabel">🥈 Silbergabel</option>
                                                            <option value="Goldgabel">🥇 Goldgabel</option>
                                                            <option value="Rainbowspoon">🌈 Rainbowspoon</option>
                                                        </select>
                                                        <Button onClick={handleSaveGeneral} size="sm" className="mt-4 w-full h-10">Status ändern</Button>
                                                    </div>

                                                    <div className="p-6 bg-muted/30 rounded-3xl border border-border flex flex-col justify-between">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3 block">Verfügbare Credits</label>
                                                            <div className="flex items-center gap-2">
                                                                <Sparkles className="text-amber-500" size={24} />
                                                                <span className="text-3xl font-black">{parseFloat(data.user.aiCredits || 0).toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground mt-2 italic">Guthaben für AI-Analysen und Bildgenerierung.</p>
                                                    </div>
                                                </div>

                                                {/* Booking Module */}
                                                <Card className="p-6 border-border">
                                                    <h3 className="font-bold mb-4 flex items-center gap-2">
                                                        <Plus size={18} className="text-primary" />
                                                        Credits buchen
                                                    </h3>
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            <div className="md:col-span-1">
                                                                <Input
                                                                    type="number"
                                                                    placeholder="Menge (z.B. 10)"
                                                                    value={bookingAmount}
                                                                    onChange={(e) => setBookingAmount(e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="md:col-span-2">
                                                                <Input
                                                                    placeholder="Grund der Buchung..."
                                                                    value={bookingDesc}
                                                                    onChange={(e) => setBookingDesc(e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                onClick={() => handleBookCredits(true)}
                                                                variant="default"
                                                                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                                                                disabled={bookingLoading}
                                                            >
                                                                <Plus size={18} /> Gutschreiben
                                                            </Button>
                                                            <Button
                                                                onClick={() => handleBookCredits(false)}
                                                                variant="destructive"
                                                                className="flex-1 gap-2"
                                                                disabled={bookingLoading}
                                                            >
                                                                <Minus size={18} /> Abziehen
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </Card>

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
                                                                {data.creditHistory?.length > 0 ? (
                                                                    data.creditHistory.map(tx => (
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
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
