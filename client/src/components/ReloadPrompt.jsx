import { useRegisterSW } from 'virtual:pwa-register/react'
import { useState, useEffect } from 'react'
import { X, RefreshCw, Smartphone } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ReloadPrompt() {
    // registerType provided in vite.config.js is 'prompt'
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ' + r)
            // Poll for updates every minute
            if (r) {
                setInterval(() => {
                    r.update();
                    console.log('[PWA] Checking for updates...');
                }, 60 * 1000);
            }
        },
        onRegisterError(error) {
            console.log('SW registration error', error)
        },
    })

    const close = () => {
        setOfflineReady(false)
        setNeedRefresh(false)
    }

    return (
        <AnimatePresence>
            {(offlineReady || needRefresh) && (
                <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 50, opacity: 0 }}
                    className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 z-[100] bg-foreground text-background dark:bg-card dark:text-foreground p-4 rounded-xl shadow-2xl border border-border flex items-center gap-4 max-w-md"
                >
                    <div className="bg-primary/20 p-2 rounded-lg text-primary">
                        <Smartphone size={24} />
                    </div>

                    <div className="flex-1">
                        <h3 className="font-bold text-sm">
                            {offlineReady ? 'App ist bereit' : 'Update verfügbar'}
                        </h3>
                        <p className="text-xs opacity-80">
                            {offlineReady
                                ? 'Die App kann nun offline verwendet werden.'
                                : 'Neue Inhalte sind verfügbar. Klicken Sie auf Aktualisieren.'
                            }
                        </p>
                    </div>

                    {needRefresh && (
                        <button
                            onClick={() => updateServiceWorker(true)}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
                        >
                            <RefreshCw size={14} />
                            Update
                        </button>
                    )}

                    <button
                        onClick={close}
                        className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={16} />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
