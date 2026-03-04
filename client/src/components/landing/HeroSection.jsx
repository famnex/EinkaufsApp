import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Star } from 'lucide-react';
import { Button } from '../Button';
import { useNavigate } from 'react-router-dom';

export default function HeroSection() {
    const navigate = useNavigate();
    const containerRef = useRef(null);

    // Apple-style fade out and scale down on scroll down
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end start"]
    });

    const scale = useTransform(scrollYProgress, [0, 1], [1, 0.85]);
    const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
    const y = useTransform(scrollYProgress, [0, 1], [0, 100]);

    return (
        <section
            ref={containerRef}
            className="relative min-h-[90vh] flex flex-col items-center justify-center pt-24 pb-20 px-4 md:px-8 overflow-hidden"
        >
            {/* Extremely subtle ambient glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-primary/5 rounded-full blur-[150px] -z-10" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-secondary/5 rounded-full blur-[150px] -z-10" />

            <motion.div
                style={{ scale, opacity, y }}
                className="max-w-5xl mx-auto w-full flex flex-col items-center text-center space-y-10"
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-black/5 shadow-sm text-sm text-gray-500 font-medium tracking-wide"
                >
                    <Star size={16} className="text-amber-500 fill-amber-500" />
                    <span>Der smarte Begleiter für deine Küche</span>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className="text-5xl sm:text-7xl md:text-8xl font-bold tracking-tight text-neutral-900 leading-[1.05]"
                >
                    GabelGuru <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-br from-neutral-500 to-neutral-800">
                        Die erste Koch-App, die auf deine Familie aufpasst.
                    </span>
                </motion.h1>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-wrap items-center justify-center gap-3 w-full"
                >
                    <span className="px-3 py-1 bg-green-50 text-green-600 border border-green-200 rounded-full text-sm font-bold">100% Vegan machbar</span>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-sm font-bold">Vegetarisch</span>
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-full text-sm font-bold">Familienfreundlich</span>
                </motion.div>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="text-xl sm:text-2xl text-gray-500 max-w-3xl mx-auto font-medium"
                >
                    100% Sicher. 100% Lecker. Dein Haushalt voll im Griff.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8 w-full sm:w-auto"
                >
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        className="w-full sm:w-auto text-lg px-8 py-5 rounded-3xl bg-neutral-900 text-white font-medium hover:bg-neutral-800 transition-colors shadow-lg flex items-center justify-center gap-2"
                        onClick={() => navigate('/signup')}
                    >
                        Kostenlos starten <ArrowRight size={20} />
                    </motion.button>

                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        className="w-full sm:w-auto text-lg px-8 py-5 rounded-3xl bg-white border border-black/5 text-neutral-900 font-medium hover:bg-neutral-50 transition-colors shadow-sm"
                        onClick={() => navigate('/community-cookbooks')}
                    >
                        Kochbücher der Community
                    </motion.button>

                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        className="w-full sm:w-auto text-lg px-8 py-5 rounded-3xl bg-white border border-black/5 text-neutral-500 font-medium hover:bg-neutral-50 transition-colors shadow-sm"
                        onClick={() => document.getElementById('bento-grid').scrollIntoView({ behavior: 'smooth' })}
                    >
                        Mehr erfahren
                    </motion.button>
                </motion.div>
            </motion.div>
        </section>
    );
}
