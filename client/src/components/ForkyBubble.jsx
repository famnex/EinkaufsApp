import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight } from 'lucide-react';
import { useForkyTutorial } from '../contexts/ForkyTutorialContext';
import { useStartup } from '../contexts/StartupContext';
import { cn } from '../lib/utils';

/**
 * ForkyBubble – the Forky mascot speech bubble overlay.
 */

const BASE_URL = import.meta.env.BASE_URL?.endsWith('/')
    ? import.meta.env.BASE_URL.slice(0, -1)
    : (import.meta.env.BASE_URL || '');

export default function ForkyBubble() {
    const { activeTutorial, nextStep, closeTutorial, finishTutorial } = useForkyTutorial();
    const { canShowForky, setIsForkyActive } = useStartup();
    const [targetRect, setTargetRect] = React.useState(null);

    const steps = activeTutorial?.steps ?? [];
    const stepIndex = activeTutorial?.stepIndex ?? 0;
    const currentStep = activeTutorial ? steps[stepIndex] : null;
    const isLast = stepIndex === steps.length - 1;
    const progress = steps.length > 0 ? ((stepIndex + 1) / steps.length) * 100 : 0;
    const shouldShow = activeTutorial && currentStep && canShowForky;

    useEffect(() => {
        if (shouldShow) {
            setIsForkyActive(true);
        } else {
            setIsForkyActive(false);
        }
        return () => setIsForkyActive(false);
    }, [shouldShow, setIsForkyActive]);

    // Track the target element's exact screen position to draw the spotlight
    useEffect(() => {
        if (!shouldShow || !currentStep?.selector) {
            setTargetRect(null);
            return;
        }

        const updateRect = () => {
            const el = document.querySelector(currentStep.selector);
            if (el) {
                const rect = el.getBoundingClientRect();
                const computedStyle = window.getComputedStyle(el);
                setTargetRect({
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                    borderRadius: computedStyle.borderRadius || '8px'
                });
            }
        };

        // Scroll into view first, then measure a moment later
        const scrollTimer = setTimeout(() => {
            const el = document.querySelector(currentStep.selector);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(updateRect, 300);
            }
        }, 100);

        // Update continuously on scroll/resize
        window.addEventListener('scroll', updateRect, true);
        window.addEventListener('resize', updateRect);

        return () => {
            clearTimeout(scrollTimer);
            window.removeEventListener('scroll', updateRect, true);
            window.removeEventListener('resize', updateRect);
        };
    }, [shouldShow, currentStep]);

    return (
        <AnimatePresence>
            {shouldShow && (
                <div className="fixed inset-0 z-[4000] pointer-events-none">
                    <style dangerouslySetInnerHTML={{__html: `
                        @keyframes forky-brighten {
                            0% { background-color: rgba(255,255,255,0.05); }
                            50% { background-color: rgba(255,255,255,0.25); }
                            100% { background-color: rgba(255,255,255,0.05); }
                        }
                        @keyframes forky-pulse {
                            0% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.4), 0 0 0 4px hsl(var(--primary) / 0.5), 0 0 20px hsl(var(--primary) / 0.4); }
                            50% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.4), 0 0 0 6px hsl(var(--primary) / 0.7), 0 0 40px hsl(var(--primary) / 0.6); }
                            100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.4), 0 0 0 4px hsl(var(--primary) / 0.5), 0 0 20px hsl(var(--primary) / 0.4); }
                        }
                    `}} />
                    
                    {/* The Spotlight / Dark Overlay */}
                    {targetRect ? (
                        <>
                            {/* Invisible barrier to catch all stray clicks while tutorial is open */}
                            <div className="absolute inset-0 bg-transparent pointer-events-auto" />
                            
                            {/* Massive shadow doing the darkening, while leaving the element hole clear */}
                            <div 
                                className="fixed pointer-events-none transition-all duration-[50ms]"
                                style={{
                                    top: targetRect.top - 2,
                                    left: targetRect.left - 2,
                                    width: targetRect.width + 4,
                                    height: targetRect.height + 4,
                                    borderRadius: targetRect.borderRadius,
                                    animation: 'forky-pulse 2s infinite',
                                    zIndex: 4001
                                }}
                            />
                            {/* Inner semi-transparent bright overlay making the target glow */}
                            <div 
                                className="fixed pointer-events-none transition-all duration-[50ms]"
                                style={{
                                    top: targetRect.top - 2,
                                    left: targetRect.left - 2,
                                    width: targetRect.width + 4,
                                    height: targetRect.height + 4,
                                    borderRadius: targetRect.borderRadius,
                                    animation: 'forky-brighten 2s infinite ease-in-out',
                                    zIndex: 4002
                                }}
                            />
                        </>
                    ) : (
                        <div className="absolute inset-0 bg-black/40 pointer-events-auto" />
                    )}

                    {/* Forky Panel - NO key={stepIndex} here to prevent re-animating whole panel */}
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 22, stiffness: 260 }}
                        className="absolute bottom-24 left-4 right-4 md:left-auto md:right-6 md:w-[380px] pointer-events-auto z-[4010]"
                    >
                        <div className="relative rounded-3xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
                            {/* Progress bar */}
                            <div className="h-1 w-full bg-muted">
                                <motion.div
                                    className="h-full bg-primary"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.4 }}
                                />
                            </div>

                            {/* Header */}
                            <div className="flex items-center justify-between px-4 pt-3 pb-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    {stepIndex + 1} / {steps.length}
                                </span>
                                <button
                                    onClick={closeTutorial}
                                    className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                    aria-label="Tutorial schließen"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Body: Forky image + speech bubble */}
                            <div className="flex items-end gap-3 px-4 pb-5 pt-2">
                                {/* Forky mascot - animate once on mount, then subtle idle */}
                                <div className="shrink-0 w-20 h-20 relative">
                                    <motion.img
                                        src={`${BASE_URL}/images/forky.png`}
                                        alt="Forky"
                                        className="w-full h-full object-contain drop-shadow-xl"
                                        initial={{ rotate: -15, scale: 0.8 }}
                                        animate={{ 
                                            rotate: [0, -3, 3, -2, 0],
                                            scale: 1,
                                            y: [0, -4, 0]
                                        }}
                                        transition={{ 
                                            rotate: { duration: 1.2, ease: 'easeInOut' },
                                            y: { duration: 3, repeat: Infinity, ease: 'easeInOut' }
                                        }}
                                    />
                                </div>

                                {/* Speech bubble */}
                                <div className="relative flex-1">
                                    {/* Speech Bubble Tail (Triangle) - Behind the bubble, matching background */}
                                    <div className="absolute left-[-7px] bottom-6 w-4 h-4 bg-card border-l border-b border-primary/20 -rotate-45 z-0" />
                                    
                                    <div className="relative z-10 bg-card border border-primary/20 rounded-2xl rounded-bl-sm px-4 py-3 min-h-[60px] flex items-center">
                                        {/* Animate text change ONLY */}
                                        <AnimatePresence mode="wait">
                                            <motion.p
                                                key={stepIndex}
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -10 }}
                                                transition={{ duration: 0.2 }}
                                                className="text-sm leading-relaxed text-foreground font-semibold"
                                            >
                                                {currentStep.text}
                                            </motion.p>
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div>

                            {/* Footer actions */}
                            <div className="px-4 pb-4 flex justify-end gap-3 items-center">
                                <div className="flex-1" />
                                {isLast ? (
                                    <button
                                        onClick={finishTutorial}
                                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-95"
                                    >
                                        Alles klar!
                                    </button>
                                ) : (
                                    <button
                                        onClick={nextStep}
                                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-95"
                                    >
                                        Weiter
                                        <ChevronRight size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
