import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, RefreshCw, Smartphone, ListChecks } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function BentoGrid() {
    // Animation Variants
    const containerVariants = {
        hidden: {},
        show: {
            transition: {
                staggerChildren: 0.15
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 40, scale: 0.95 },
        show: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
        }
    };

    const badgeContainerVariants = {
        hidden: {},
        show: {
            transition: {
                staggerChildren: 0.2,
                delayChildren: 0.5
            }
        }
    };

    const badgeVariants = {
        hidden: { opacity: 0, scale: 0, filter: "blur(10px)" },
        show: {
            opacity: 1,
            scale: 1,
            filter: "blur(0px)",
            transition: { type: "spring", stiffness: 200, damping: 20 }
        }
    };

    return (
        <section id="bento-grid" className="py-24 px-4 md:px-8 max-w-7xl mx-auto w-full">
            <motion.div
                className="text-center mb-16 space-y-4"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.8 }}
            >
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-neutral-900">Kochen ohne Angst.</h2>
                <p className="text-xl text-gray-500 max-w-2xl mx-auto font-medium">Nicht nur warnen, sondern lösen. Unser KI-Ersatz-Assistent verwandelt Gefahren in sichere Rezepte.</p>
            </motion.div>

            <motion.div
                className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8"
                variants={containerVariants}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
            >
                {/* Main Card - Spans 2 cols on Desktop */}
                <motion.div
                    variants={itemVariants}
                    className="md:col-span-2 relative bg-white rounded-[2.5rem] border border-black/5 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[400px]"
                >
                    <div className="p-10 flex-1 flex flex-col justify-center relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-6">
                            <ShieldAlert size={28} />
                        </div>
                        <h3 className="text-3xl font-bold tracking-tight text-neutral-900 mb-4">Der Allergie-Radar.</h3>
                        <p className="text-gray-500 text-lg leading-relaxed">
                            KI-Ersatz-Assistent: Aus Sahne wird Hafer-Cuisine. Automatisch und passend für alle in deinem Haushalt. Perfekt auch um Lieblingsrezepte einfach vegan oder vegetarisch umzuwandeln.
                        </p>
                    </div>

                    {/* Radar Graphic Area */}
                    <div className="w-full md:w-[60%] relative flex items-center justify-center p-8 bg-neutral-50/50">
                        <div className="relative w-64 h-64 flex items-center justify-center">
                            {/* Pulsing rings */}
                            {[1, 2, 3].map((i) => (
                                <motion.div
                                    key={i}
                                    className="absolute w-full h-full rounded-full border border-primary/20 bg-primary/5"
                                    animate={{
                                        scale: [1, 1.5, 2],
                                        opacity: [0.5, 0.2, 0],
                                    }}
                                    transition={{
                                        duration: 3,
                                        repeat: Infinity,
                                        delay: i * 1,
                                        ease: "circOut"
                                    }}
                                />
                            ))}

                            {/* Center Dot */}
                            <div className="absolute w-4 h-4 rounded-full bg-primary z-20 shadow-[0_0_20px_rgba(var(--primary),0.5)]" />

                            {/* Pop-up Badges */}
                            <motion.div
                                variants={badgeContainerVariants}
                                className="absolute inset-0 z-30"
                            >
                                <motion.div variants={badgeVariants} className="absolute top-4 left-4 bg-white px-4 py-2 rounded-2xl shadow-lg border border-black/5 font-bold text-sm text-neutral-800 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Glutenfrei
                                </motion.div>
                                <motion.div variants={badgeVariants} className="absolute bottom-12 left-0 bg-white px-4 py-2 rounded-2xl shadow-lg border border-black/5 font-bold text-sm text-neutral-800 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500" /> Auto-Vegan
                                </motion.div>
                                <motion.div variants={badgeVariants} className="absolute top-1/2 right-0 -translate-y-1/2 bg-white px-4 py-2 rounded-2xl shadow-lg border border-black/5 font-bold text-sm text-neutral-800 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500" /> Nuss-Alarm
                                </motion.div>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>

                {/* Side Card 1 */}
                <motion.div variants={itemVariants} className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-10 flex flex-col justify-between">
                    <div>
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mb-6">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                className="flex items-center justify-center"
                            >
                                <RefreshCw size={28} />
                            </motion.div>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight text-neutral-900 mb-3">Nahtlos Synchron</h3>
                    </div>
                    <p className="text-gray-500 mt-4 font-medium">
                        Dein Hausplan ist immer auf allen Geräten der Familie aktuell. Ändert jemand das Menü, wissen alle Bescheid.
                    </p>
                </motion.div>

                {/* Side Card 2 */}
                <motion.div variants={itemVariants} className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-10 flex flex-col justify-between">
                    <div>
                        <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-500 flex items-center justify-center mb-6">
                            <Smartphone size={28} />
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight text-neutral-900 mb-3">Immer griffbereit</h3>
                    </div>
                    <p className="text-gray-500 mt-4 font-medium">
                        Ob im Supermarkt ohne Empfang oder am iPad in der Küche. GabelGuru funktioniert auch offline perfekt.
                    </p>
                </motion.div>

                {/* Bottom Card - Full Width */}
                <motion.div variants={itemVariants} className="md:col-span-2 bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="w-16 h-16 rounded-3xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                        <ListChecks size={32} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold tracking-tight text-neutral-900 mb-2">Automatisierte Einkaufslisten</h3>
                        <p className="text-gray-500 font-medium">Zutaten aus deinem Menüplan landen magisch gruppiert auf deiner Liste. Nichts wird vergessen, kein doppelter Weg durch den Markt.</p>
                    </div>
                </motion.div>
            </motion.div>
        </section>
    );
}
