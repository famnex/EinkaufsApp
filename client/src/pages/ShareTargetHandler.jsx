import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AiListUrlModal from '../components/AiListUrlModal';
import { useAuth } from '../contexts/AuthContext';

export default function ShareTargetHandler() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const [modalOpen, setModalOpen] = useState(false);
    const [sharedText, setSharedText] = useState('');

    useEffect(() => {
        if (loading) return;
        if (!user) {
            // Store params and redirect to login if not authenticated
            // For simplicity now, just redirect to login
            navigate('/login');
            return;
        }

        const title = searchParams.get('title') || '';
        const text = searchParams.get('text') || '';
        const url = searchParams.get('url') || '';

        // Combine into one string for the AI to parse
        let fullText = '';
        if (title) fullText += `${title}\n`;
        if (text) fullText += `${text}\n`;
        if (url) fullText += `${url}`;

        if (fullText.trim()) {
            setSharedText(fullText.trim());
            setModalOpen(true);
        } else {
            // No content, just go home
            navigate('/');
        }
    }, [searchParams, user, loading, navigate]);

    const handleClose = () => {
        setModalOpen(false);
        navigate('/');
    };

    if (loading) return <div className="p-4 text-center">Lade...</div>;

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <h1 className="text-2xl font-bold mb-4">Inhalte werden verarbeitet...</h1>

            {/* 
                We use the AiListUrlModal, but passed with specific props to indicate "No List Selected Yet".
                The modal itself (or a wrapper) needs to handle the logic of "Analyzed -> Select List -> Add".
            */}
            <AiListUrlModal
                isOpen={modalOpen}
                onClose={handleClose}
                listId={null} // NULL indicates we need to select a list!
                initialText={sharedText}
                onItemsAdded={() => {
                    // Modal handles navigation after success
                }}
            />
        </div>
    );
}
