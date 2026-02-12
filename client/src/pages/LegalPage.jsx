import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, FileText } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import api from '../lib/axios';

import PublicLayout from '../components/PublicLayout';

export default function LegalPage({ type }) {
    const navigate = useNavigate();
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);

    const config = {
        privacy: {
            title: 'Datenschutzerklärung',
            icon: Shield
        },
        imprint: {
            title: 'Impressum',
            icon: FileText
        }
    };

    const { title, icon: Icon } = config[type];

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const { data } = await api.get(`/settings/legal/${type}`);
                setContent(data.value || 'Kein Inhalt hinterlegt.');
            } catch (error) {
                console.error(`Failed to fetch ${type}`, error);
                setContent('Fehler beim Laden des Inhalts.');
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, [type]);

    return (
        <PublicLayout>
            <div className="p-6 md:p-12">
                <div className="max-w-4xl mx-auto space-y-8">
                    <header className="flex items-center gap-4 border-b border-border pb-6">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                            <Icon size={32} />
                        </div>
                        <h1 className="text-3xl font-bold">{title}</h1>
                    </header>

                    <Card className="p-8 md:p-12 bg-card/50 shadow-sm min-h-[50vh]">
                        {loading ? (
                            <div className="space-y-4 animate-pulse">
                                {/* Loading Skeletons */}
                                <div className="h-6 w-3/4 bg-muted rounded" />
                                <div className="h-4 w-full bg-muted rounded" />
                                <div className="h-4 w-full bg-muted rounded" />
                                <div className="h-4 w-2/3 bg-muted rounded" />
                            </div>
                        ) : (
                            <div
                                className="prose dark:prose-invert max-w-none font-sans text-foreground/80 leading-relaxed prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-a:text-primary hover:prose-a:text-primary/80"
                                dangerouslySetInnerHTML={{ __html: content }}
                            />
                        )}
                    </Card>
                </div>
            </div>
        </PublicLayout>
    );
}
