import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, Search, ArrowRight, BookOpen, User, Star, TrendingUp, Users, ShieldCheck, ArrowLeft, Heart, ChevronDown, ChevronUp, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import { cn, getImageUrl } from '../lib/utils';
import api from '../lib/axios';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import LoadingOverlay from './LoadingOverlay';
import { useTutorial } from '../contexts/TutorialContext';
import { useForkyTutorial } from '../contexts/ForkyTutorialContext';
import { forkyTutorials } from '../lib/forkyTutorials';

export default function CommunityCookbooksContent() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { notifyAction } = useTutorial();
    const { startTutorial } = useForkyTutorial();
    const [cookbooks, setCookbooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('favorites'); // 'recipes', 'favorites', 'clicks'

    useEffect(() => {
        fetchPublicCookbooks();
    }, []);

    // Start Forky short tutorial on first visit
    useEffect(() => {
        const timer = setTimeout(() => startTutorial('community', forkyTutorials.community), 1000);
        return () => clearTimeout(timer);
    }, [startTutorial]);

    const fetchPublicCookbooks = async () => {
        try {
            const { data } = await api.get('/auth/public-cookbooks');
            setCookbooks(data);
        } catch (error) {
            console.error('Failed to fetch public cookbooks', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleFollow = async (e, cb) => {
        e.stopPropagation();
        if (!user) {
            navigate('/login');
            return;
        }
        try {
            const { data } = await api.post(`/auth/cookbooks/${cb.sharingKey}/follow`);
            setCookbooks(prev => prev.map(c =>
                c.sharingKey === cb.sharingKey
                    ? { ...c, isFollowed: data.isFollowed, followerCount: data.followerCount }
                    : c
            ));
        } catch (error) {
            console.error('Failed to toggle follow', error);
        }
        notifyAction('community-follow');
    };

    const filteredCookbooks = cookbooks
        .filter(cb => {
            const title = cb.cookbookTitle || '';
            const name = cb.username || '';
            return title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                name.toLowerCase().includes(searchTerm.toLowerCase());
        })
        .sort((a, b) => {
            // Pin THECOOKINGGUYS to the top
            const pinnedTitle = "THECOOKINGGUYS";
            const aIsPinned = (a.cookbookTitle || '').toUpperCase() === pinnedTitle;
            const bIsPinned = (b.cookbookTitle || '').toUpperCase() === pinnedTitle;

            if (aIsPinned && !bIsPinned) return -1;
            if (!aIsPinned && bIsPinned) return 1;

            if (sortBy === 'recipes') return (b.recipeCount || 0) - (a.recipeCount || 0);
            if (sortBy === 'favorites') return (b.totalFavorites || 0) - (a.totalFavorites || 0);
            if (sortBy === 'clicks') return (b.cookbookClicks || 0) - (a.cookbookClicks || 0);
            return 0;
        });

    const [updates, setUpdates] = useState([]);
    const [lastCheck, setLastCheck] = useState(user?.lastFollowedUpdatesCheck);
    const [isUpdatesExpanded, setIsUpdatesExpanded] = useState(false);

    useEffect(() => {
        if (user) {
            fetchFollowedUpdates();
        }
    }, [user]);

    const fetchFollowedUpdates = async () => {
        try {
            const { data } = await api.get('/auth/followed-updates');
            setUpdates(data.updates);
            setLastCheck(data.lastFollowedUpdatesCheck);
        } catch (error) {
            console.error('Failed to fetch followed updates', error);
        }
    };

    const markUpdatesAsSeen = async () => {
        try {
            const { data } = await api.post('/auth/mark-updates-seen');
            setLastCheck(data.lastFollowedUpdatesCheck);
            // Optionally update user in context if needed, but lastCheck local is enough for UI
        } catch (error) {
            console.error('Failed to mark updates as seen', error);
        }
    };

    const unseenUpdates = updates.filter(u => !lastCheck || new Date(u.createdAt) > new Date(lastCheck));
    const unseenCount = unseenUpdates.length;

    const totalRecipes = cookbooks.reduce((acc, curr) => acc + (parseInt(curr.recipeCount) || 0), 0);
    const totalFollowers = cookbooks.reduce((acc, curr) => acc + (curr.followerCount || 0), 0);
    const hasFollows = cookbooks.some(cb => cb.isFollowed);

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <LoadingOverlay isLoading={loading}>

            <div className="space-y-8 pb-24 max-w-7xl mx-auto px-4 pt-8">

                {/* Header Section - Desktop Only */}
                <header className="hidden md:block relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-background to-accent/5 border border-border/50 p-8 md:p-12">
                    <div className="absolute top-0 right-0 p-12 opacity-5">
                        <BookOpen size={200} />
                    </div>

                    <div className="relative z-10 max-w-2xl">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-3 mb-4"
                        >
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                <Users size={24} />
                            </div>
                            <span className="text-sm font-bold uppercase tracking-widest text-primary">GabelGuru Community</span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-2xl min-[400px]:text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-6"
                        >
                            Entdecke neue <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Geschmackswelten</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-lg text-muted-foreground mb-8"
                        >
                            Stöbere durch {cookbooks.length} veröffentlichte Kochbücher mit insgesamt {totalRecipes} Rezepten von unserer Community.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="flex flex-col md:flex-row gap-4 items-start md:items-center w-full max-w-2xl"
                        >
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                                <Input
                                    id="community-search"
                                    placeholder="Suche..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        if (e.target.value.length > 2) notifyAction('community-search');
                                    }}
                                    className="pl-12 h-14 rounded-2xl bg-background/80 backdrop-blur-sm border-2 border-primary/10 focus:border-primary/30 text-lg shadow-xl shadow-primary/5"
                                />
                            </div>

                            <div className="flex bg-muted/50 p-1 rounded-2xl border border-border/50 backdrop-blur-sm w-full md:w-auto h-14 items-center">
                                {[
                                    { id: 'favorites', label: 'Favoriten', icon: Star },
                                    { id: 'recipes', label: 'Rezepte', icon: ChefHat },
                                    { id: 'clicks', label: 'Klicks', icon: TrendingUp }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setSortBy(tab.id)}
                                        className={cn(
                                            "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap h-full",
                                            sortBy === tab.id
                                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                        )}
                                    >
                                        <tab.icon size={16} />
                                        <span className="hidden sm:inline">{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </header>

                {/* Mobile Header - Compact */}
                <div className="block md:hidden space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                            <Input
                                id="community-search-mobile"
                                placeholder="Suchen..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    if (e.target.value.length > 2) notifyAction('community-search');
                                }}
                                className="pl-9 h-11 rounded-xl bg-background border-border text-sm shadow-sm"
                            />
                        </div>
                        <div className="flex bg-muted/50 p-1 rounded-xl border border-border/50 h-11 items-center gap-1">
                            {[
                                { id: 'favorites', icon: Star, title: 'Favoriten' },
                                { id: 'recipes', icon: ChefHat, title: 'Rezepte' },
                                { id: 'clicks', icon: TrendingUp, title: 'Klicks' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setSortBy(tab.id)}
                                    title={tab.title}
                                    className={cn(
                                        "w-9 h-9 flex items-center justify-center rounded-lg transition-all",
                                        sortBy === tab.id
                                            ? "bg-primary text-primary-foreground shadow-md"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <tab.icon size={16} />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        <Card className="p-2 flex flex-col items-center justify-center bg-card/50 border-border/50 aspect-square">
                            <BookOpen className="text-primary mb-1" size={18} />
                            <span className="text-sm font-bold leading-none">{cookbooks.length}</span>
                            <span className="text-[8px] text-muted-foreground text-center mt-1 uppercase font-black">Bücher</span>
                        </Card>
                        <Card className="p-2 flex flex-col items-center justify-center bg-card/50 border-border/50 aspect-square">
                            <ChefHat className="text-orange-500 mb-1" size={18} />
                            <span className="text-sm font-bold leading-none">{totalRecipes}</span>
                            <span className="text-[8px] text-muted-foreground text-center mt-1 uppercase font-black">Rezepte</span>
                        </Card>
                        {user ? (
                            <Card className="p-2 flex flex-col items-center justify-center bg-card/50 border-border/50 aspect-square">
                                <Heart className="text-red-500 mb-1" size={18} />
                                <span className="text-sm font-bold leading-none">{user?.followerCount || 0}</span>
                                <span className="text-[8px] text-muted-foreground text-center mt-1 uppercase font-black">Follower</span>
                            </Card>
                        ) : (
                            <Card className="p-2 flex flex-col items-center justify-center bg-muted/20 border-border/50 aspect-square opacity-50">
                                <User className="text-muted-foreground mb-1" size={18} />
                                <span className="text-xs font-bold leading-none">-</span>
                                <span className="text-[8px] text-muted-foreground text-center mt-1 uppercase font-black">User</span>
                            </Card>
                        )}
                        <Card
                            onClick={() => {
                                if (updates.length > 0) {
                                    const nextState = !isUpdatesExpanded;
                                    setIsUpdatesExpanded(nextState);
                                    if (nextState && unseenCount > 0) {
                                        setTimeout(markUpdatesAsSeen, 2000);
                                    }
                                }
                            }}
                            className={cn(
                                "p-2 flex flex-col items-center justify-center border-border/50 aspect-square relative cursor-pointer active:scale-95 transition-transform",
                                isUpdatesExpanded ? "bg-primary/20 border-primary" : "bg-card/50",
                                updates.length === 0 && "opacity-50 cursor-default"
                            )}
                        >
                            {unseenCount > 0 ? (
                                <Sparkles className="mb-1 text-primary animate-pulse" size={18} />
                            ) : (
                                <CheckCircle2 className={cn("mb-1", updates.length === 0 ? "text-muted-foreground" : "text-green-500")} size={18} />
                            )}
                            <span className="text-sm font-bold leading-none">{updates.length}</span>
                            <span className="text-[8px] text-muted-foreground text-center mt-1 uppercase font-black">Updates</span>
                            {unseenCount > 0 && (
                                <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full">
                                    {unseenCount}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>

                {/* Desktop Stats Row */}
                <div className="hidden md:grid grid-cols-8 gap-4 items-start">
                    <Card className="p-4 flex flex-col items-center justify-center bg-card/50 border-border/50 md:col-span-1">
                        <BookOpen className="text-primary mb-2" size={24} />
                        <span className="text-2xl font-bold">{cookbooks.length}</span>
                        <span className="text-xs text-muted-foreground text-center">Kochbücher</span>
                    </Card>
                    <Card className="p-4 flex flex-col items-center justify-center bg-card/50 border-border/50 md:col-span-1">
                        <ChefHat className="text-orange-500 mb-2" size={24} />
                        <span className="text-2xl font-bold">{totalRecipes}</span>
                        <span className="text-xs text-muted-foreground text-center">Rezepte</span>
                    </Card>
                    {user && (
                        <Card className="p-4 flex flex-col items-center justify-center bg-card/50 border-border/50 md:col-span-1">
                            <Heart className="text-red-500 mb-2" size={24} />
                            <span className="text-2xl font-bold">{user?.followerCount || 0}</span>
                            <span className="text-xs text-muted-foreground text-center">Follower</span>
                        </Card>
                    )}


                    {/* Updates Card Wrapper (Maintains Grid Space) */}
                    <div className={cn(
                        "relative h-[115px]",
                        user ? "col-span-5" : "col-span-6"
                    )}>
                        <Card className={cn(
                            "p-3 bg-card border-border transition-all duration-500 overflow-hidden shadow-xl",
                            isUpdatesExpanded
                                ? "absolute top-0 left-0 w-full z-50 h-auto ring-1 ring-primary/20"
                                : "relative w-full h-full bg-card/50 border-border/50"
                        )}>
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                    {unseenCount > 0 ? (
                                        <Sparkles size={16} className="text-primary animate-pulse" />
                                    ) : (
                                        <CheckCircle2 size={16} className={cn(updates.length === 0 ? "text-muted-foreground" : "text-green-500")} />
                                    )}
                                    <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">Updates</h3>
                                </div>

                                <div className="flex items-center gap-2">
                                    {unseenCount > 0 && (
                                        <div className="bg-primary text-primary-foreground text-[9px] font-black px-1.5 py-0.5 rounded-full animate-bounce">
                                            {unseenCount}
                                        </div>
                                    )}
                                    {updates.length > 0 && (
                                        <button
                                            onClick={() => {
                                                const nextState = !isUpdatesExpanded;
                                                setIsUpdatesExpanded(nextState);
                                                if (nextState && unseenCount > 0) {
                                                    setTimeout(markUpdatesAsSeen, 2000);
                                                }
                                            }}
                                            className="p-1 hover:bg-white/5 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                                        >
                                            {isUpdatesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {!user ? (
                                <div className="flex flex-col items-center justify-center h-16 text-muted-foreground text-xs min-[400px]:text-sm font-bold italic text-center px-4 leading-relaxed">
                                    Melde dich an um Updates zu erhalten.
                                </div>
                            ) : !hasFollows ? (
                                <div className="flex flex-col items-center justify-center h-16 text-muted-foreground text-xs min-[400px]:text-sm font-bold italic text-center px-4 leading-relaxed">
                                    Folge einem Kochbuch um Updates zu erhalten.
                                </div>
                            ) : updates.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-16 text-muted-foreground text-xs min-[400px]:text-sm font-bold italic text-center px-4 leading-relaxed">
                                    Keine neuen Updates.
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {(isUpdatesExpanded ? updates : [updates[0]]).map((update, idx) => {
                                        const isNew = !lastCheck || new Date(update.createdAt) > new Date(lastCheck);
                                        return (
                                            <motion.div
                                                key={`${update.id}-${idx}`}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className={cn(
                                                    "group flex items-center gap-3 rounded-xl border transition-all",
                                                    isUpdatesExpanded ? "p-3" : "p-2",
                                                    isNew
                                                        ? "bg-primary/5 border-primary/20"
                                                        : "bg-black/5 dark:bg-white/5 border-transparent"
                                                )}
                                            >
                                                {/* Recipe Image Circle */}
                                                <div className="relative">
                                                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-background shadow-inner flex-shrink-0 bg-muted">
                                                        {update.image_url ? (
                                                            <img
                                                                src={getImageUrl(update.image_url)}
                                                                alt={update.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                                <ChefHat size={24} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isNew && (
                                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-background" />
                                                    )}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                        <p className="text-sm text-foreground leading-tight">
                                                            <span className="font-black text-primary hover:underline cursor-pointer">@{update.username}</span>
                                                            {" hat bei "}
                                                            <span className="font-bold italic">{update.cookbookTitle}</span>
                                                            {" ein neues Rezept hinzugefügt: "}
                                                            <span className="font-black text-foreground">{update.name}</span>
                                                        </p>
                                                        <div className="flex items-center gap-3 shrink-0">
                                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                <Heart size={14} className={cn(update.likeCount > 0 ? "text-red-500 fill-red-500" : "")} />
                                                                <span className="font-bold">{update.likeCount}</span>
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground font-medium bg-black/5 dark:bg-white/5 px-2 py-1 rounded-lg">
                                                                {new Date(update.createdAt).toLocaleString('de-DE', {
                                                                    day: '2-digit',
                                                                    month: '2-digit',
                                                                    year: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => navigate(`/shared/${update.sharingKey || ''}/recipe/${update.id}`)}
                                                    className="p-2 opacity-0 group-hover:opacity-100 bg-primary/10 text-primary rounded-xl transition-all hover:bg-primary hover:text-primary-foreground"
                                                >
                                                    <ArrowRight size={18} />
                                                </button>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>

                {/* Mobile Expansion List (Shown when isUpdatesExpanded is true on Mobile) */}
                {isUpdatesExpanded && (
                    <div className="block md:hidden">
                        <Card className="p-3 bg-card border-primary/20 shadow-xl rounded-2xl">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-sm text-foreground uppercase tracking-wider flex items-center gap-2">
                                    {unseenCount > 0 ? (
                                        <Sparkles size={16} className="text-primary animate-pulse" />
                                    ) : (
                                        <CheckCircle2 size={16} className="text-green-500" />
                                    )}
                                    Neueste Updates
                                </h3>
                                <button
                                    onClick={() => setIsUpdatesExpanded(false)}
                                    className="p-1.5 hover:bg-muted rounded-full"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="space-y-2">
                                {updates.length === 0 ? (
                                    <p className="text-center text-xs text-muted-foreground py-4">Keine Updates vorhanden.</p>
                                ) : (
                                    updates.map((update, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-2 rounded-xl bg-muted/30 border border-transparent">
                                            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-muted">
                                                {update.image_url ? (
                                                    <img src={getImageUrl(update.image_url)} alt="" className="w-full h-full object-cover" />
                                                ) : <ChefHat size={20} className="m-auto text-muted-foreground" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs line-clamp-2">
                                                    <span className="font-bold">@{update.username}</span> hat <span className="italic">{update.name}</span> geteilt.
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => navigate(`/shared/${update.sharingKey}/recipe/${update.id}`)}
                                                className="p-1.5 bg-primary/10 text-primary rounded-lg"
                                            >
                                                <ArrowRight size={14} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>
                )}

                {/* Grid */}
                <motion.div
                    key={loading ? 'loading' : 'loaded'}
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {loading ? (
                        [1, 2, 3, 4, 5, 6].map(i => (
                            <Card key={i} className="p-0 overflow-hidden h-80 animate-pulse bg-muted/50 rounded-3xl border-none" />
                        ))
                    ) : filteredCookbooks.length > 0 ? (
                        filteredCookbooks.map((cb, idx) => (
                            <motion.div variants={item} key={cb.sharingKey || idx}>
                                <Card
                                    id={idx === 0 ? "first-cookbook-card" : ((cb.cookbookTitle || '').toUpperCase() === "THECOOKINGGUYS" ? "open-global-cookbook" : undefined)}
                                    onClick={() => {
                                        navigate(`/shared/${cb.sharingKey}/cookbook`);
                                        if ((cb.cookbookTitle || '').toUpperCase() === "THECOOKINGGUYS") notifyAction('global-cookbook-open');
                                        notifyAction('community-open');
                                    }}
                                    className="p-0 overflow-hidden hover:shadow-2xl transition-all duration-500 border-border/50 bg-card hover:bg-card group flex flex-col h-full rounded-3xl hover:-translate-y-1 cursor-pointer community-cookbook-card"
                                >
                                    <div className="h-48 bg-muted relative overflow-hidden">
                                        {cb.tileImage ? (
                                            <img
                                                src={getImageUrl(cb.tileImage)}
                                                alt={cb.cookbookTitle || 'Kochbuch'}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div className={cn(
                                            "w-full h-full items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 text-primary/20",
                                            cb.tileImage ? "hidden" : "flex"
                                        )}>
                                            <ChefHat size={64} />
                                        </div>
                                        {/* Recipe count badge */}
                                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                            <ChefHat size={12} />
                                            {cb.recipeCount || 0}
                                        </div>

                                        {/* Follow Button */}
                                        {user && cb.sharingKey && cb.id !== user.id && (!user.householdId || cb.householdId !== user.householdId) && (
                                            <button
                                                id={idx === 0 ? "first-cookbook-heart" : "follow-cookbook-btn"}
                                                onClick={(e) => toggleFollow(e, cb)}
                                                className="absolute top-4 left-4 p-2 rounded-full backdrop-blur-sm bg-black/20 hover:bg-black/40 text-white transition-all duration-200 focus:outline-none z-10 follow-cookbook-btn"
                                                title="Kochbuch folgen/entfolgen"
                                            >
                                                <Heart
                                                    size={20}
                                                    className={cn("transition-colors duration-300", cb.isFollowed ? "fill-rose-500 text-rose-500" : "text-white")}
                                                />
                                            </button>
                                        )}
                                        {/* Cookbook avatar — shown below recipe count */}
                                        {cb.cookbookImage ? (
                                            <div className="absolute top-12 right-2">
                                                <img
                                                    src={getImageUrl(cb.cookbookImage)}
                                                    alt="Kochbuch"
                                                    className="w-20 h-20 rounded-full object-cover border-2 border-white/80 shadow-lg"
                                                />
                                            </div>
                                        ) : null}
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-12">
                                            <h3 className="font-bold text-xl text-white leading-tight mb-1 line-clamp-2">
                                                {cb.cookbookTitle || 'Unbenanntes Kochbuch'}
                                            </h3>
                                            <div className="flex items-center gap-2 text-white/80 text-sm">
                                                <User size={16} />
                                                <span>{cb.username || 'Unbekannt'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-5 flex flex-col flex-1 bg-card">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col items-center">
                                                    <div className="flex items-center gap-1.5 text-rose-500 mb-0.5">
                                                        <Heart size={16} className={cn(cb.isFollowed ? "fill-rose-500" : "fill-rose-500/20")} />
                                                        <span className="text-lg font-black">{cb.followerCount || 0}</span>
                                                    </div>
                                                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Follower</span>
                                                </div>
                                                <div className="w-px h-8 bg-border/50" />
                                                <div className="flex flex-col items-center">
                                                    <div className="flex items-center gap-1.5 text-blue-500 mb-0.5">
                                                        <TrendingUp size={16} />
                                                        <span className="text-lg font-black">{cb.cookbookClicks || 0}</span>
                                                    </div>
                                                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Aufrufe</span>
                                                </div>
                                            </div>

                                            <div className="bg-primary/5 text-primary px-3 py-1.5 rounded-xl border border-primary/10 flex items-center gap-2">
                                                <ChefHat size={14} className="opacity-70" />
                                                <span className="text-sm font-black">{cb.recipeCount || 0}</span>
                                            </div>
                                        </div>

                                    </div>
                                </Card>
                            </motion.div>
                        ))
                    ) : (
                        <div className="col-span-full py-20 text-center">
                            <div className="w-24 h-24 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                <BookOpen size={48} className="text-muted-foreground/50" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Noch ist es hier leer</h3>
                            <p className="text-muted-foreground max-w-sm mx-auto mb-8">
                                Derzeit gibt es keine öffentlichen Kochbücher.
                            </p>
                            {user && (
                                <>
                                    <p className="text-sm mb-4">Sei der Erste und teile dein Kochbuch in den Einstellungen!</p>
                                    <Button onClick={() => navigate('/settings')} variant="outline">
                                        Zu den Einstellungen
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </motion.div>
            </div>
        </LoadingOverlay>
    );
}
