import React, { createContext, useContext, useState, useEffect } from 'react';

const EditModeContext = createContext();

export function EditModeProvider({ children }) {
    const [editMode, setEditMode] = useState('view');

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
