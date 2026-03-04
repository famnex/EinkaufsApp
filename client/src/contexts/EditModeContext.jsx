import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const EditModeContext = createContext();

export function EditModeProvider({ children }) {
    const [editMode, setEditMode] = useState('view');
    const location = useLocation();
    const prevLocation = React.useRef(location.pathname);

    if (location.pathname !== prevLocation.current) {
        prevLocation.current = location.pathname;
        if (editMode !== 'view') {
            setEditMode('view');
        }
    }

    return (
        <EditModeContext.Provider value={{ editMode, setEditMode }}>
            {children}
        </EditModeContext.Provider>
    );
}

export function useEditMode() {
    const context = useContext(EditModeContext);
    if (!context) {
        throw new Error('useEditMode must be used within an EditModeProvider');
    }
    return context;
}
