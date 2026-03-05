import { useRegisterSW } from 'virtual:pwa-register/react'
import { useEffect } from 'react'
import { X, Smartphone, CheckCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ReloadPrompt() {
    // Hinweis: registerType in vite.config.js muss auf 'autoUpdate' stehen
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
    } = useRegisterSW({
        onRegistered(r) {
            if (r) {
                // Prüft jede Minute im Hintergrund auf neue Versionen
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

    // Auto-Close Effekt: Blendet die Meldung nach 5 Sekunden automatisch aus
    useEffect(() => {
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

        if (offlineReady && !isPWA) {
            setOfflineReady(false);
            return;
        }

        if (offlineReady || needRefresh) {
            const timer = setTimeout(() => {
                setOfflineReady(false);
                setNeedRefresh(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [offlineReady, needRefresh, setOfflineReady, setNeedRefresh]);

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
                    className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 z-[9999] bg-foreground text-background dark:bg-card dark:text-foreground p-4 rounded-xl shadow-2xl border border-border flex items-center gap-4 max-w-md"
                >
                    <div className="bg-primary/20 p-2 rounded-lg text-primary">
                        {needRefresh ? <CheckCircle size={24} /> : <Smartphone size={24} />}
                    </div>

                    <div className="flex-1">
                        <h3 className="font-bold text-sm">
                            {offlineReady ? 'App ist bereit' : 'Update installiert'}
                        </h3>
                        <p className="text-xs opacity-80">
                            {offlineReady
                                ? 'Die App kann nun offline verwendet werden.'
                                : 'Die neueste Version von GabelGuru wurde erfolgreich geladen.'
                            }
                        </p>
                    </div>

                    {/* Nur noch der X-Button zum manuellen Schließen */}
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