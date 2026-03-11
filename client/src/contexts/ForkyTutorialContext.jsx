import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../lib/axios';
import { useAuth } from './AuthContext';

const ForkyTutorialContext = createContext();

export const useForkyTutorial = () => useContext(ForkyTutorialContext);

/**
 * Tracks which short Forky tutorials the user has already seen.
 * State is persisted on the backend (user preferences) and cached in localStorage.
 *
 * Tutorial keys:
 *  - 'lists'           → /lists overview page
 *  - 'menu'            → /menu (Menüplan) page
 *  - 'recipes'         → /recipes page
 *  - 'community'       → /community-cookbooks page
 *  - 'listdetail'      → /lists/:id (first list detail visit)
 */

const LS_KEY = 'forky_seen_tutorials';

function getSeenFromLocalStorage() {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    } catch {
        return {};
    }
}

export const ForkyTutorialProvider = ({ children }) => {
    const { user } = useAuth();
    const [seenTutorials, setSeenTutorials] = useState(() => getSeenFromLocalStorage());
    const [activeTutorial, setActiveTutorial] = useState(null); // { key, steps, stepIndex }

    // Sync with user preferences from backend when user loads
    useEffect(() => {
        if (user && user.forkyTutorialsSeen) {
            // Use server state as source of truth if available
            const serverSeen = user.forkyTutorialsSeen;
            setSeenTutorials(serverSeen);
            localStorage.setItem(LS_KEY, JSON.stringify(serverSeen));
        }
    }, [user?.id, user?.forkyTutorialsSeen]);

    const markSeen = useCallback(async (key) => {
        const updated = { ...seenTutorials, [key]: true };
        setSeenTutorials(updated);
        localStorage.setItem(LS_KEY, JSON.stringify(updated));
        // Persist to backend
        try {
            await api.patch('/auth/profile/forky-tutorials', { key });
        } catch (err) {
            console.warn('Could not persist Forky tutorial seen state', err);
        }
    }, [seenTutorials]);

    const hasSeen = useCallback((key) => !!seenTutorials[key], [seenTutorials]);

    const startTutorial = useCallback((key, steps) => {
        if (seenTutorials[key]) return; // Already seen
        setActiveTutorial({ key, steps, stepIndex: 0 });
    }, [seenTutorials]);

    const nextStep = useCallback(() => {
        setActiveTutorial(prev => {
            if (!prev) return null;
            if (prev.stepIndex < prev.steps.length - 1) {
                return { ...prev, stepIndex: prev.stepIndex + 1 };
            }
            return null; // Tutorial finished
        });
    }, []);

    const closeTutorial = useCallback(() => {
        if (activeTutorial) {
            markSeen(activeTutorial.key);
        }
        setActiveTutorial(null);
    }, [activeTutorial, markSeen]);

    const finishTutorial = useCallback(() => {
        if (activeTutorial) {
            markSeen(activeTutorial.key);
        }
        setActiveTutorial(null);
    }, [activeTutorial, markSeen]);

    return (
        <ForkyTutorialContext.Provider value={{
            hasSeen,
            startTutorial,
            activeTutorial,
            nextStep,
            closeTutorial,
            finishTutorial
        }}>
            {children}
        </ForkyTutorialContext.Provider>
    );
};
