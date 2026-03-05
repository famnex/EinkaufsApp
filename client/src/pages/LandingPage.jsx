import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import { Button } from '../components/Button';

// Modular Apple-style Sections
import HeroSection from '../components/landing/HeroSection';
import BentoGrid from '../components/landing/BentoGrid';
import FeaturePath from '../components/landing/FeaturePath';
import InteractiveMockup from '../components/landing/InteractiveMockup';

export default function LandingPage() {
    const navigate = useNavigate();

    useEffect(() => {
        const root = window.document.documentElement;
        const originalIsDark = root.classList.contains('dark');

        if (originalIsDark) {
            root.classList.remove('dark');
        }

        return () => {
            if (originalIsDark) {
                root.classList.add('dark');
            }
        };
    }, []);

    return (
        <PublicLayout mainClassName="flex-1 bg-[#F5F5F7] dark:bg-black overflow-hidden selection:bg-primary/20">
            {/* The individual components have their own paddings and animations */}
            <HeroSection />
            <BentoGrid />
            <FeaturePath />
            <InteractiveMockup />

            {/* Final Call to Action Section */}
            <section className="py-12 px-4 md:px-8 max-w-7xl mx-auto w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Primary CTA */}
                    <div className="p-10 md:p-16 rounded-[3rem] bg-neutral-900 text-white relative overflow-hidden shadow-2xl flex flex-col justify-center">
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/20 rounded-full blur-[100px] -z-0 opacity-50" />
                        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary/20 rounded-full blur-[100px] -z-0 opacity-50" />

                        <div className="relative z-10 space-y-6">
                            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                                Bereit für eine stressfreie Küche?
                            </h2>
                            <p className="text-lg text-neutral-400 font-medium leading-relaxed">
                                Erstelle jetzt dein Konto und starte durch. Kostenlos und (fast) werbefrei.
                            </p>

                            <div className="pt-4">
                                <button
                                    className="px-8 py-4 rounded-full bg-white text-neutral-900 font-bold hover:bg-neutral-100 transition-all hover:scale-105 shadow-xl flex items-center gap-2"
                                    onClick={() => navigate('/signup')}
                                >
                                    Kostenlos registrieren
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Community CTA */}
                    <div className="p-10 md:p-16 rounded-[3rem] bg-white border border-black/5 relative overflow-hidden shadow-sm flex flex-col justify-center">
                        <div className="relative z-10 space-y-6">
                            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-neutral-900">
                                Werde Teil der Community.
                            </h2>
                            <p className="text-lg text-gray-500 font-medium leading-relaxed">
                                Lass dich inspirieren! Stöbere in den öffentlichen Kochbüchern unserer Nutzer und finde neue Lieblingsrezepte.
                            </p>

                            <div className="pt-4">
                                <button
                                    className="px-8 py-4 rounded-full bg-neutral-100 text-neutral-900 font-bold hover:bg-neutral-200 transition-all shadow-sm flex items-center gap-2"
                                    onClick={() => navigate('/community-cookbooks')}
                                >
                                    Zu den Kochbüchern
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
