import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/axios';

const SyncContext = createContext();

export const useSync = () => useContext(SyncContext);

export const SyncProvider = ({ children }) => {
    const [pendingChanges, setPendingChanges] = useState(() => {
        const saved = localStorage.getItem('pending_sync_changes');
        return saved ? JSON.parse(saved) : [];
    });
    const [isSyncingState, setIsSyncingState] = useState(false);
    const isSyncingRef = useRef(false);

    // Persist queue to localStorage
    useEffect(() => {
        localStorage.setItem('pending_sync_changes', JSON.stringify(pendingChanges));
    }, [pendingChanges]);

    const syncAll = useCallback(async () => {
        if (isSyncingRef.current || !navigator.onLine || pendingChanges.length === 0) return;

        isSyncingRef.current = true;
        setIsSyncingState(true);
        console.log(`[Sync] Starting sync for ${pendingChanges.length} changes...`);

        // Take a snapshot of current items to process
        const itemsToProcess = [...pendingChanges];
        const successfulIds = [];
        let aborted = false;

        for (const change of itemsToProcess) {
            try {
                await api({
                    method: change.method,
                    url: change.url,
                    data: change.data
                });
                successfulIds.push(change.id);
                console.log(`[Sync] Success: ${change.method} ${change.url}`);
            } catch (err) {
                const status = err.response?.status;
                console.error(`[Sync] Failed ${change.method} ${change.url}:`, status || err.message);

                // Permanent failure (4xx except retriable ones)
                if (status && status >= 400 && status < 500 && status !== 429 && status !== 408) {
                    console.warn(`[Sync] Discarding permanent failure for ${change.url}`);
                    successfulIds.push(change.id);
                } else {
                    // Network or Server error, stop queue and try later
                    aborted = true;
                    break;
                }
            }
        }

        if (successfulIds.length > 0) {
            setPendingChanges(prev => prev.filter(c => !successfulIds.includes(c.id)));
        }

        isSyncingRef.current = false;
        setIsSyncingState(false);
    }, [pendingChanges]);

    const addChange = useCallback((method, url, data) => {
        const newChange = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            method,
            url,
            data,
            timestamp: new Date().toISOString()
        };
        setPendingChanges(prev => [...prev, newChange]);
    }, []);

    // Automatic trigger when changes arrive or online
    useEffect(() => {
        if (navigator.onLine && pendingChanges.length > 0 && !isSyncingState) {
            const timer = setTimeout(syncAll, 500);
            return () => clearTimeout(timer);
        }
    }, [pendingChanges.length, isSyncingState, syncAll]);

    // Cleanup and interval
    useEffect(() => {
        const handleOnline = () => syncAll();
        window.addEventListener('online', handleOnline);
        const interval = setInterval(() => {
            if (navigator.onLine && pendingChanges.length > 0 && !isSyncingState) syncAll();
        }, 60000);

        return () => {
            window.removeEventListener('online', handleOnline);
            clearInterval(interval);
        };
    }, [syncAll, pendingChanges.length, isSyncingState]);

    return (
        <SyncContext.Provider value={{
            pendingChanges,
            addChange,
            syncAll,
            isSyncing: isSyncingState,
            isOffline: !navigator.onLine
        }}>
            {children}
        </SyncContext.Provider>
    );
};
