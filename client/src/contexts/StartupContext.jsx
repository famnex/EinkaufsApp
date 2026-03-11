import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const StartupContext = createContext();

export function StartupProvider({ children }) {
    const { user, loading } = useAuth();
    
    // States for sequence elements:
    // 1. Onboarding is active if user is logged in but hasn't completed it
    const isOnboardingActive = user && user.isOnboardingCompleted === false;
    
    // 2. News popup is active
    const [isNewsPopupActive, setIsNewsPopupActive] = useState(false);
    
    // 3. Forky tutorial is active
    const [isForkyActive, setIsForkyActive] = useState(false);

    // Helpers to check if something can run:
    const canShowNews = !loading && user && !isOnboardingActive;
    const canShowForky = canShowNews && !isNewsPopupActive;
    const canShowPwaOverlay = canShowForky && !isForkyActive;

    return (
        <StartupContext.Provider value={{
            isOnboardingActive,
            isNewsPopupActive, setIsNewsPopupActive,
            isForkyActive, setIsForkyActive,
            canShowNews, canShowForky, canShowPwaOverlay
        }}>
            {children}
        </StartupContext.Provider>
    );
}

export const useStartup = () => useContext(StartupContext);
