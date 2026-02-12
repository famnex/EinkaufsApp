import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, Search, ArrowRight, BookOpen, User, Star, TrendingUp, Users } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import { cn, getImageUrl } from '../lib/utils';
import api from '../lib/axios';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

export default function CommunityCookbooksContent() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [cookbooks, setCookbooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchPublicCookbooks();
    }, []);

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

    const filteredCookbooks = cookbooks.filter(cb => {
        const title = cb.cookbookTitle || '';
        const name = cb.username || '';
        return title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const totalRecipes = cookbooks.reduce((acc, curr) => acc + (parseInt(curr.recipeCount) || 0), 0);

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
        <div className="space-y-8 pb-24 max-w-7xl mx-auto px-4 pt-8">
            {/* Header Section */}
            <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-background to-accent/5 border border-border/50 p-8 md:p-12">
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
                        className="text-4xl md:text-5xl font-black tracking-tight mb-6"
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
                        className="relative max-w-md"
                    >
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                        <Input
                            placeholder="Suche nach Titel, Koch oder Thema..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 h-14 rounded-2xl bg-background/80 backdrop-blur-sm border-2 border-primary/10 focus:border-primary/30 text-lg shadow-xl shadow-primary/5"
                        />
                    </motion.div>
                </div>
            </header>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 flex flex-col items-center justify-center bg-card/50 border-border/50">
                    <BookOpen className="text-primary mb-2" size={24} />
                    <span className="text-2xl font-bold">{cookbooks.length}</span>
                    <span className="text-xs text-muted-foreground">Kochbücher</span>
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center bg-card/50 border-border/50">
                    <ChefHat className="text-orange-500 mb-2" size={24} />
                    <span className="text-2xl font-bold">{totalRecipes}</span>
                    <span className="text-xs text-muted-foreground">Rezepte</span>
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center bg-card/50 border-border/50">
                    <TrendingUp className="text-green-500 mb-2" size={24} />
                    <span className="text-2xl font-bold">{cookbooks.length > 0 ? Math.round(totalRecipes / cookbooks.length) : 0}</span>
                    <span className="text-xs text-muted-foreground">Ø Rezepte / Buch</span>
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center bg-card/50 border-border/50">
                    <Star className="text-yellow-500 mb-2" size={24} />
                    <span className="text-2xl font-bold">New</span>
                    <span className="text-xs text-muted-foreground">Täglich Updates</span>
                </Card>
            </div>

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
                                className="p-0 overflow-hidden hover:shadow-2xl transition-all duration-500 border-border/50 bg-card hover:bg-card group flex flex-col h-full rounded-3xl hover:-translate-y-1"
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
                                    {/* Follower section — temporarily disabled
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex -space-x-2">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className={`w-8 h-8 rounded-full border-2 border-card flex items-center justify-center text-xs text-white font-bold ${['bg-red-400', 'bg-blue-400', 'bg-green-400'][i - 1]}`}>
                                                    {String.fromCharCode(64 + i)}
                                                </div>
                                            ))}
                                            <div className="w-8 h-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-bold">
                                                +{Math.floor(Math.random() * 20) + 5}
                                            </div>
                                        </div>
                                        <span className="text-xs text-muted-foreground font-medium">Follower</span>
                                    </div>
                                    */}

                                    <div className="mt-auto">
                                        <Button
                                            onClick={() => navigate(`/shared/${cb.sharingKey}/cookbook`)}
                                            className="w-full gap-2 rounded-xl h-12 font-bold shadow-lg shadow-primary/10 group-hover:shadow-primary/20 transition-all"
                                            variant="default"
                                        >
                                            Kochbuch öffnen <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                        </Button>
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
    );
}
