import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeUserToPush } from '../lib/pushNotifications';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function NotificationPrompt({ className, iconSize = 18, showLabel = false }) {
    const { user } = useAuth();
    const [permissionStatus, setPermissionStatus] = useState('default');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if ('Notification' in window) {
            setPermissionStatus(Notification.permission);
        }
    }, [user]);

    // Only show if user HAS enabled notifications in their profile,
    // but the browser permission is NOT yet granted.
    if (!user?.followNotificationsEnabled || permissionStatus === 'granted') {
        return null;
    }

    const handleRequestPermission = async (e) => {
        e.stopPropagation();
        setIsLoading(true);
        try {
            const result = await subscribeUserToPush();
            if (result) {
                setPermissionStatus('granted');
            } else {
                // If it failed or return false, re-check permission
                setPermissionStatus(Notification.permission);
            }
        } catch (err) {
            console.error('Failed to subscribe from prompt:', err);
            setPermissionStatus(Notification.permission);
        } finally {
            setIsLoading(false);
        }
    };

    const isDenied = permissionStatus === 'denied';

    return (
        <AnimatePresence>
            <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={handleRequestPermission}
                disabled={isLoading}
                className={cn(
                    "relative flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all active:scale-95",
                    isDenied
                        ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                        : "bg-primary/10 text-primary hover:bg-primary/20",
                    className
                )}
                title={isDenied ? "Benachrichtigungen im Browser blockiert" : "Benachrichtigungen aktivieren"}
            >
                {isLoading ? (
                    <Loader2 size={iconSize} className="animate-spin" />
                ) : (
                    isDenied ? <BellOff size={iconSize} /> : <Bell size={iconSize} className="animate-bounce" />
                )}

                {showLabel && (
                    <span className="text-xs font-bold whitespace-nowrap">
                        {isDenied ? 'Blockiert' : 'Aktivieren'}
                    </span>
                )}

                {!isDenied && !isLoading && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-ping" />
                )}
            </motion.button>
        </AnimatePresence>
    );
}
