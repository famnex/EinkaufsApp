import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from './Button';
import api from '../lib/axios';
import { cn } from '../lib/utils';

export default function UpdateModal({ isOpen, onClose }) {
    const [logs, setLogs] = useState([]);
    const [status, setStatus] = useState('idle'); // idle, updating, restarting, success, error
    const [finalMessage, setFinalMessage] = useState('');
    const terminalRef = useRef(null);
    const eventSourceRef = useRef(null);

    // Auto-scroll to bottom of logs
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs, status]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    useEffect(() => {
        if (isOpen && status === 'idle') {
            startUpdate();
        }
    }, [isOpen]);

    const startUpdate = () => {
        setStatus('updating');
        setLogs(['Initializing update process...', 'Connecting to server stream...']);

        // Determine correct URL for EventSource (needs full path)
        const baseUrl = api.defaults.baseURL || '/api';
        // Remove trailing slash if present to avoid double slash
        const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        // Note: EventSource doesn't support custom headers easily for auth. 
        // We might need to pass token in query param or rely on cookie if used. 
        // Since we use Bearer token in headers, we'll pass it in query param and update backend to check it.
        // WAIT: Backend auth middleware usually checks header. 
        // Let's assume for this "system" route we might need to allow query param auth or use a library like 'event-source-polyfill' if strict header is needed.
        // For simplicity, let's try passing ?token=xxx.
        const token = localStorage.getItem('token');
        const url = `${cleanBase}/system/stream-update?token=${token}`;

        const evtSource = new EventSource(url);
        eventSourceRef.current = evtSource;

        evtSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'stdout' || data.type === 'stderr') {
                    // Strip ANSI escape codes (colors, etc.)
                    const cleanMessage = data.message.replace(/\x1b\[[0-9;]*[mGJK]/g, '');
                    setLogs(prev => [...prev, cleanMessage]);
                } else if (data.type === 'done') {
                    setLogs(prev => [...prev, `Process finished with code ${data.code}`]);
                    if (data.code === 0) {
                        // Usually "done" won't be reached if supervisor restarts the server first.
                        // But if it does:
                        startRestartCheck();
                    } else {
                        setStatus('error');
                        setFinalMessage('Update process failed.');
                        evtSource.close();
                    }
                } else if (data.type === 'error') {
                    setLogs(prev => [...prev, `ERROR: ${data.message}`]);
                    setStatus('error');
                    evtSource.close();
                }
            } catch (e) {
                console.error('Parse error', e);
            }
        };

        evtSource.onerror = (err) => {
            // Error usually means connection lost -> Server likely restarting
            console.log('Stream disconnected (likely server restart)', err);
            evtSource.close();
            setLogs(prev => [...prev, '>>> Connection lost. Server is likely restarting...']);
            startRestartCheck();
        };
    };

    const startRestartCheck = () => {
        setStatus('restarting');
        const checkInterval = setInterval(async () => {
            try {
                await api.get('/'); // Simple health check
                // If successful:
                clearInterval(checkInterval);
                setStatus('success');
                setFinalMessage('System successfully updated and restarted!');
                setLogs(prev => [...prev, '>>> Server is back online!']);
            } catch (e) {
                // Still down, keep waiting
                console.log('Waiting for server...', e.message);
            }
        }, 2000);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/95 backdrop-blur-md"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full max-w-2xl bg-black border border-green-500 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] relative"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-green-500 bg-[#051a05] flex items-center justify-between shrink-0 relative z-20">
                            <div className="flex items-center gap-2 text-green-500">
                                <Terminal size={20} />
                                <h3 className="font-mono font-bold tracking-wider">SYSTEM UPDATE</h3>
                            </div>
                            <button onClick={onClose} className="p-1 hover:bg-green-500/20 rounded text-green-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Terminal Window */}
                        <div
                            ref={terminalRef}
                            className="flex-1 p-4 overflow-y-auto font-mono text-xs md:text-sm space-y-1 bg-black text-[#00ff41] min-h-[300px] border-2 border-[#00ff41] m-2 rounded-lg shadow-[0_0_15px_rgba(0,255,65,0.2)] relative z-10"
                        >
                            {logs.map((log, i) => (
                                <div key={i} className="break-words font-medium" style={{ color: '#00ff41' }}>
                                    <span className="opacity-50 mr-2 select-none">$
                                        {log}
                                    </span>
                                </div>
                            ))}
                            {status === 'restarting' && (
                                <div className="animate-pulse text-yellow-500 mt-4 font-bold">
                                    &gt; Waiting for services to come back online...
                                </div>
                            )}
                        </div>

                        {/* Footer Status */}
                        <div className="p-4 border-t border-green-500 bg-[#051a05] shrink-0 relative z-20">
                            {status === 'success' && (
                                <div className="flex items-center gap-2 text-green-500 font-bold">
                                    <CheckCircle size={20} />
                                    <span>{finalMessage}</span>
                                    <Button onClick={() => window.location.reload()} size="sm" className="ml-auto bg-green-600 hover:bg-green-700 text-white border-none">
                                        Reload App
                                    </Button>
                                </div>
                            )}
                            {status === 'error' && (
                                <div className="flex items-center gap-2 text-red-500 font-bold w-full">
                                    <AlertTriangle size={20} />
                                    <span className="flex-1">Update process failed.</span>
                                    <Button onClick={startUpdate} size="sm" className="bg-red-600 hover:bg-red-700 text-white border-none">
                                        Retry Update
                                    </Button>
                                    <Button onClick={() => window.location.reload()} size="sm" variant="outline" className="text-red-500 border-red-500 hover:bg-red-500/10">
                                        Reload
                                    </Button>
                                </div>
                            )}
                            {(status === 'updating' || status === 'restarting') && (
                                <div className="text-green-500/50 text-xs text-center uppercase tracking-widest animate-pulse">
                                    System updating...
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
