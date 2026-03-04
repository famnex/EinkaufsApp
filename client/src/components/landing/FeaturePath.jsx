import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { MapPin, ShoppingCart } from 'lucide-react';

export default function FeaturePath() {
    const containerRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start center", "end center"]
    });

    // Map scroll progress to SVG path length
    const pathLength = useTransform(scrollYProgress, [0, 0.8], [0, 1]);
    const opacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);

    return (
        <section ref={containerRef} className="py-24 px-4 md:px-8 max-w-7xl mx-auto w-full relative">
            <div className="flex flex-col md:flex-row items-center gap-16">

                {/* Text Content */}
                <motion.div
                    initial={{ opacity: 0, x: -40 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.8 }}
                    className="flex-1 space-y-6"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 text-green-600 font-bold text-sm">
                        <MapPin size={16} /> Lernende Laufwege
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-neutral-900">
                        Wir lernen deine Wege.
                    </h2>
                    <p className="text-xl text-gray-500 font-medium leading-relaxed">
                        GabelGuru sortiert deine Einkaufsliste exakt nach dem Layout deines Lieblings-Supermarkts.
                        Gemüse zuerst, Kühlregal zum Schluss.
                    </p>
                </motion.div>

                {/* SVG Animation Area */}
                <div className="flex-1 relative w-full h-[400px] bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-8 overflow-hidden">
                    {/* Abstract Supermarket Shelf Blocks */}
                    <div className="absolute top-12 left-12 w-24 h-8 bg-neutral-100 rounded-lg" />
                    <div className="absolute top-12 right-20 w-32 h-8 bg-neutral-100 rounded-lg" />
                    <div className="absolute top-32 left-12 w-16 h-8 bg-neutral-100 rounded-lg" />
                    <div className="absolute top-32 right-12 w-40 h-8 bg-neutral-100 rounded-lg" />
                    <div className="absolute bottom-24 left-24 w-32 h-8 bg-neutral-100 rounded-lg" />
                    <div className="absolute bottom-12 right-24 w-24 h-8 bg-neutral-100 rounded-lg" />

                    {/* Check-out Area */}
                    <div className="absolute bottom-8 left-8 w-16 h-16 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-center text-green-500">
                        <ShoppingCart size={24} />
                    </div>

                    {/* SVG Path */}
                    <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        viewBox="0 0 400 400"
                        preserveAspectRatio="none"
                    >
                        <motion.path
                            d="M 50 50 Q 150 50, 200 100 T 350 150 T 200 250 Q 80 300, 100 350"
                            fill="transparent"
                            strokeWidth="4"
                            stroke="url(#gradient)"
                            strokeLinecap="round"
                            style={{
                                pathLength,
                                opacity
                            }}
                        />
                        <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="rgb(34, 197, 94)" /> {/* green-500 */}
                                <stop offset="100%" stopColor="rgb(59, 130, 246)" /> {/* blue-500 */}
                            </linearGradient>
                        </defs>
                    </svg>

                    {/* Moving Dot */}
                    <motion.div
                        className="absolute w-6 h-6 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary),0.6)] z-10 hidden md:block"
                        style={{
                            offsetDistance: useTransform(scrollYProgress, [0, 0.8], ["0%", "100%"]),
                            offsetPath: "path('M 50 50 Q 150 50, 200 100 T 350 150 T 200 250 Q 80 300, 100 350')",
                            opacity
                        }}
                    />
                </div>

            </div>
        </section>
    );
}
