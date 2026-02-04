import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, AlertTriangle, CheckCircle, Info, Loader2 } from 'lucide-react';
import api from '../lib/axios';
import { cn } from '../lib/utils';
import { Button } from './Button';

export default function AlexaLogsModal({ isOpen, onClose }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/system/alexa-logs');
            setLogs(data);
        } catch (err) {
            console.error('Failed to fetch logs', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchLogs();
        }
    }, [isOpen]);

    const getLevelColor = (level) => {
        switch (level) {
            case 'ERROR': return 'text-red-500';
            case 'WARN': return 'text-orange-500';
            case 'INFO': return 'text-green-500';
            default: return 'text-gray-500';
        }
    };

    const getIcon = (level) => {
        switch (level) {
            case 'ERROR': return <AlertTriangle size={16} />;
            case 'WARN': return <AlertTriangle size={16} />;
            case 'INFO': return <CheckCircle size={16} />;
            default: return <Info size={16} />;
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-card border border-border rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
                    >
                        <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <span className="font-mono bg-primary/20 text-primary px-2 py-1 rounded">ALEXA.LOG</span>
                                System Protokoll
                            </h2>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="ghost" onClick={fetchLogs} disabled={loading}>
                                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                                </Button>
                                <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-4 bg-zinc-950 font-mono text-sm">
                            {loading && logs.length === 0 ? (
                                <div className="flex justify-center p-8 text-muted-foreground">
                                    <Loader2 className="animate-spin" />
                                </div>
                            ) : logs.length === 0 ? (
                                <div className="text-center text-muted-foreground p-8">Keine Einträge gefunden.</div>
                            ) : (
                                <div className="space-y-1">
                                    {logs.map((log, i) => (
                                        <div key={i} className="flex gap-3 hover:bg-white/5 p-1 rounded transition-colors group">
                                            <span className="text-zinc-500 shrink-0 select-none w-36">
                                                {new Date(log.timestamp).toLocaleString('de-DE')}
                                            </span>
                                            <span className={cn("font-bold shrink-0 w-16 flex items-center gap-1", getLevelColor(log.level))}>
                                                {getIcon(log.level)}
                                                {log.level}
                                            </span>
                                            <span className="text-zinc-400 shrink-0 w-24">[{log.type}]</span>
                                            <span className="text-zinc-300 break-all">
                                                {log.message}
                                                {log.meta && Object.keys(log.meta).length > 0 && (
                                                    <span className="text-zinc-600 block sm:inline sm:ml-2">
                                                        {JSON.stringify(log.meta)}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
