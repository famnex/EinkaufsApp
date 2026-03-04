import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Timer, CheckCircle2, ChefHat } from 'lucide-react';

export default function InteractiveMockup() {
    return (
        <section className="py-24 px-4 md:px-8 max-w-7xl mx-auto w-full relative">
            <div className="flex flex-col-reverse md:flex-row items-center gap-16">

                {/* Phone Mockup Area */}
                <div className="flex-1 relative w-full flex justify-center perspective-[1000px]">
                    <motion.div
                        initial={{ opacity: 0, rotateY: -15, scale: 0.9 }}
                        whileInView={{ opacity: 1, rotateY: 0, scale: 1 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="relative w-[300px] h-[600px] bg-neutral-900 rounded-[3rem] border-8 border-neutral-800 shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden"
                    >
                        {/* Fake Dynamic Island */}
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-7 bg-black rounded-full z-50" />

                        {/* Mock App Content */}
                        <div className="flex-1 bg-white pt-16 px-6 relative">
                            <h4 className="font-bold text-2xl text-neutral-900 mb-6 tracking-tight">Cremige Tomatensuppe</h4>

                            {/* Floating Step Card 1 */}
                            <motion.div
                                animate={{ y: [0, -5, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-4 shadow-sm"
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">1</div>
                                    <span className="font-bold text-neutral-900">Zwiebeln andünsten</span>
                                </div>
                                <p className="text-sm text-gray-500">Mit etwas Olivenöl glasig braten.</p>
                            </motion.div>

                            {/* Floating Step Card 2 - Active */}
                            <motion.div
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                className="bg-white border-2 border-primary rounded-2xl p-4 mb-4 shadow-md relative"
                            >
                                <div className="absolute -top-3 -right-3 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg">
                                    <Mic size={14} />
                                </div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center font-bold text-sm">2</div>
                                    <span className="font-bold text-neutral-900">Tomaten hinzugeben</span>
                                </div>
                                <p className="text-sm text-gray-500 mb-3">Die Dosentomaten und Gemüsebrühe aufgießen.</p>

                                {/* Inner Floating Timer */}
                                <motion.div
                                    animate={{ scale: [1, 1.05, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="bg-neutral-100 rounded-xl p-3 flex items-center gap-3"
                                >
                                    <Timer size={18} className="text-primary" />
                                    <span className="font-medium text-sm text-neutral-800">15:00 Min. kochen</span>
                                </motion.div>
                            </motion.div>

                            {/* Fade out mask at bottom */}
                            <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                        </div>
                    </motion.div>

                    {/* Floating decoration badges outside phone */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 }}
                        animate={{ y: [0, 10, 0] }}
                        className="absolute top-1/4 -right-8 md:-right-12 bg-white p-3 rounded-2xl shadow-xl border border-black/5 flex items-center gap-2"
                    >
                        <CheckCircle2 size={20} className="text-green-500" />
                        <span className="font-bold text-sm text-neutral-800">"Weiter"</span>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.7 }}
                        animate={{ y: [0, -10, 0] }}
                        className="absolute bottom-1/3 -left-8 md:-left-12 bg-white p-3 rounded-2xl shadow-xl border border-black/5 flex items-center gap-2"
                    >
                        <Timer size={20} className="text-orange-500" />
                        <span className="font-bold text-sm text-neutral-800">"Timer auf 15"</span>
                    </motion.div>
                </div>

                {/* Text Content */}
                <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.8 }}
                    className="flex-1 space-y-6"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 text-purple-600 font-bold text-sm">
                        <ChefHat size={16} /> Interaktiver Kochmodus
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-neutral-900">
                        Dein Sous-Chef hört aufs Wort.
                    </h2>
                    <p className="text-xl text-gray-500 font-medium leading-relaxed">
                        Hände voller Teig? Steuere den Kochmodus per Sprachbefehl.
                        Starte Timer, frage nach Zutaten oder springe zum nächsten Schritt, ohne das Display zu berühren.
                    </p>
                </motion.div>

            </div>
        </section>
    );
}
