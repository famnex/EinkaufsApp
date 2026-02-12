import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingCart, ChefHat, Users, Calendar, ArrowRight, CheckCircle2, Star, Sparkles, BrainCircuit, BookOpen } from 'lucide-react';
import { Button } from '../components/Button';
import ThemeToggle from '../components/ThemeToggle';

import PublicLayout from '../components/PublicLayout';

export default function LandingPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        // PWA Detection
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

        if (isPWA) {
            if (user) {
                navigate('/', { replace: true });
            } else {
                navigate('/login', { replace: true });
            }
        }
    }, [user, navigate]);

    const features = [
        {
            icon: ShoppingCart,
            title: "Intelligente Einkaufslisten",
            description: "Sortiert automatisch nach Kategorien. Nie wieder Zick-Zack im Supermarkt laufen."
        },
        {
            icon: ChefHat,
            title: "Rezeptverwaltung",
            description: "Speichere deine Lieblingsrezepte. Importiere sie von Webseiten oder lasse sie von der KI erstellen."
        },
        {
            icon: Users,
            title: "Gemeinsamer Haushalt",
            description: "Teile Listen und Pläne mit deiner Familie oder WG. Synchronisierung in Echtzeit."
        },
        {
            icon: Calendar,
            title: "Wochenplaner",
            description: "Plane deine Mahlzeiten für die ganze Woche. Zutaten landen direkt auf der Einkaufsliste."
        },
        {
            icon: BrainCircuit,
            title: "KI-Assistent",
            description: "Lass dir Kochideen geben, Rezepte anpassen oder erstelle Bilder für deine Kreationen."
        },
        {
            icon: Sparkles,
            title: "Kein Schnickschnack",
            description: "Fokussiert auf das Wesentliche. Keine Werbung, kein Tracking, volle Privatsphäre."
        }
    ];

    return (
        <PublicLayout>
            {/* Hero Section */}
            <header className="relative pt-16 pb-20 lg:pt-32 lg:pb-32 px-4">
                {/* Background Glows */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -z-10 animate-pulse-slow" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[120px] -z-10" />

                <div className="max-w-4xl mx-auto text-center space-y-8">
                    <img
                        src={`${import.meta.env.BASE_URL}icon-512x512.png`}
                        alt="GabelGuru Logo"
                        className="w-32 h-32 mx-auto object-contain animate-fade-in-up"
                    />
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border border-border text-sm text-muted-foreground animate-fade-in-up delay-75">
                        <Star size={14} className="text-yellow-500 fill-yellow-500" />
                        <span>Der smarte Begleiter für deine Küche</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground leading-[1.1] animate-fade-in-up delay-100">
                        Einkaufen & Kochen <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-secondary">
                            neu gedacht.
                        </span>
                    </h1>

                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-fade-in-up delay-200">
                        Organisiere deinen Haushalt, plane Mahlzeiten und entdecke neue Rezepte mit KI-Unterstützung. Alles in einer App.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-fade-in-up delay-300">
                        <Button
                            size="xl"
                            className="w-full sm:w-auto text-lg px-8 py-6 rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-105"
                            onClick={() => navigate('/login')}
                        >
                            Jetzt loslegen <ArrowRight className="ml-2" />
                        </Button>
                        <Button
                            variant="outline"
                            size="xl"
                            className="w-full sm:w-auto text-lg px-8 py-6 rounded-2xl bg-background/50 backdrop-blur-sm border-border/50 hover:bg-muted/50"
                            onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
                        >
                            Mehr erfahren
                        </Button>
                    </div>
                </div>
            </header>

            {/* Features Grid */}
            <section id="features" className="py-24 bg-muted/30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold mb-4">Alles was du brauchst</h2>
                        <p className="text-muted-foreground">Funktionen, die deinen Alltag erleichtern.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                className="p-8 rounded-3xl bg-card border border-border hover:shadow-lg hover:border-primary/20 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <feature.icon size={24} />
                                </div>
                                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                                <p className="text-muted-foreground leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Community Preview Section */}
            <section className="py-20 bg-muted/30 border-y border-border/50">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <h2 className="text-3xl font-bold mb-6">Entdecke die GabelGuru Community</h2>
                    <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                        Lass dich inspirieren! Stöbere in den öffentlichen Kochbüchern unserer Nutzer und finde neue Lieblingsrezepte.
                    </p>
                    <Button
                        size="lg"
                        variant="accent"
                        className="text-lg px-8 py-6 rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
                        onClick={() => navigate('/community-cookbooks')}
                    >
                        <BookOpen className="mr-2" /> Öffentliche Kochbücher ansehen
                    </Button>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24">
                <div className="max-w-5xl mx-auto px-4 text-center">
                    <div className="p-12 rounded-[2.5rem] bg-gradient-to-br from-primary/10 via-background to-secondary/10 border border-border relative overflow-hidden">
                        <div className="relative z-10 space-y-6">
                            <h2 className="text-3xl md:text-4xl font-bold">Bereit, deinen Haushalt zu organisieren?</h2>
                            <p className="text-muted-foreground max-w-xl mx-auto">
                                Erstelle jetzt dein Konto und starte durch. Kostenlos und (fast) werbefrei.
                            </p>
                            <Button
                                size="lg"
                                className="mt-8 rounded-xl px-8"
                                onClick={() => navigate('/signup')}
                            >
                                Kostenlos registrieren
                            </Button>
                        </div>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
