import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, CheckCircle, AlertTriangle, Loader2, ChevronDown, ChevronUp, Cpu, Database, CloudDownload, Package, Layers } from 'lucide-react';
import { Button } from './Button';
import api from '../lib/axios';
import { cn } from '../lib/utils';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

const UPDATE_STEPS = [
    { key: 'pull', label: 'Code laden', icon: CloudDownload, marker: '>>> Starting Update Process...' },
    { key: 'server_deps', label: 'Server-Pakete', icon: Package, marker: '>>> Installing Server Dependencies...' },
    { key: 'client_deps', label: 'Client-Pakete', icon: Package, marker: '>>> Installing Client Dependencies...' },
    { key: 'build', label: 'Frontend Build', icon: Layers, marker: '>>> Building Frontend...' },
    { key: 'migrate', label: 'Datenbank', icon: Database, marker: '>>> Running Database Migrations...' },
    { key: 'restart', label: 'Neustart', icon: Cpu, marker: '>>> Restarting Service' }
];

export default function UpdateModal({ isOpen, onClose, currentVersion, updateInfo }) {
    useLockBodyScroll(isOpen);
    const [logs, setLogs] = useState([]);
    const [status, setStatus] = useState('idle'); // idle, updating, restarting, success, error
    const [showLogs, setShowLogs] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(-1);
    const [finalMessage, setFinalMessage] = useState('');
    const terminalRef = useRef(null);
    const eventSourceRef = useRef(null);

    // Auto-scroll to bottom of logs
    useEffect(() => {
        if (terminalRef.current && showLogs) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs, status, showLogs]);

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
        setCurrentStepIndex(-1);

        const baseUrl = api.defaults.baseURL || '/api';
        const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const token = localStorage.getItem('token');
        const url = `${cleanBase}/system/stream-update?token=${token}`;

        const evtSource = new EventSource(url);
        eventSourceRef.current = evtSource;

        evtSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'stdout' || data.type === 'stderr') {
                    const cleanMessage = data.message.replace(/\x1b\[[0-9;]*[mGJK]/g, '');
                    setLogs(prev => [...prev, cleanMessage]);

                    // Update Progress based on markers
                    const stepIdx = UPDATE_STEPS.findIndex(s => cleanMessage.includes(s.marker));
                    if (stepIdx !== -1) {
                        setCurrentStepIndex(stepIdx);
                    }
                } else if (data.type === 'done') {
                    setLogs(prev => [...prev, `Process finished with code ${data.code}`]);
                    if (data.code === 0) {
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
            console.log('Stream disconnected (likely server restart)', err);
            evtSource.close();
            setCurrentStepIndex(UPDATE_STEPS.length - 1); // Last step
            setLogs(prev => [...prev, '>>> Connection lost. Server is likely restarting...']);
            startRestartCheck();
        };
    };

    const startRestartCheck = () => {
        setStatus('restarting');
        const checkInterval = setInterval(async () => {
            try {
                await api.get('/');
                clearInterval(checkInterval);
                setStatus('success');
                setCurrentStepIndex(UPDATE_STEPS.length); // All done
                setFinalMessage('System successfully updated and restarted!');
                setLogs(prev => [...prev, '>>> Server is back online!']);
            } catch (e) {
                console.log('Waiting for server...', e.message);
            }
        }, 2000);
    };

    const progress = status === 'success' ? 100 : status === 'error' ? 0 : Math.max(5, (currentStepIndex + 1) * (100 / UPDATE_STEPS.length));

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/90 backdrop-blur-xl"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col relative z-10"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <Terminal size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold tracking-tight">System-Update</h3>
                                    <div className="flex gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                                        <span>Aktuell: {currentVersion || '...'}</span>
                                        {updateInfo?.commits_behind > 0 && (
                                            <span className="text-primary">
                                                (+{updateInfo.commits_behind} Commits)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Main Content */}
                        <div className="p-6 flex-1 overflow-y-auto min-h-[300px] flex flex-col gap-8">
                            {/* Visual Progress */}
                            <div className="space-y-6">
                                <div className="relative pt-1">
                                    <div className="flex mb-2 items-center justify-between">
                                        <div>
                                            <span className="text-xs font-bold inline-block py-1 px-2 uppercase rounded-full text-primary bg-primary/10">
                                                {status === 'updating' ? 'Installation läuft...' : status === 'restarting' ? 'Neustart...' : status === 'success' ? 'Fertig' : 'Bereit'}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-bold inline-block text-primary">
                                                {Math.round(progress)}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-muted">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary transition-all duration-500"
                                        />
                                    </div>
                                </div>

                                {/* Steps Grid */}
                                <div className="grid grid-cols-3 gap-3">
                                    {UPDATE_STEPS.map((step, idx) => {
                                        const Icon = step.icon;
                                        const isActive = idx === currentStepIndex;
                                        const isDone = idx < currentStepIndex || status === 'success';
                                        return (
                                            <div
                                                key={step.key}
                                                className={cn(
                                                    "p-3 rounded-xl border flex flex-col items-center gap-2 transition-all duration-300",
                                                    isActive ? "border-primary bg-primary/5 shadow-sm scale-105" :
                                                        isDone ? "border-primary/20 bg-muted/50 grayscale-0" :
                                                            "border-border bg-muted/20 grayscale"
                                                )}
                                            >
                                                <div className={cn(
                                                    "p-2 rounded-lg",
                                                    isActive ? "bg-primary text-primary-foreground animate-pulse" :
                                                        isDone ? "bg-primary/20 text-primary" :
                                                            "bg-muted text-muted-foreground"
                                                )}>
                                                    <Icon size={18} />
                                                </div>
                                                <span className={cn(
                                                    "text-[10px] font-bold uppercase tracking-tight text-center leading-tight",
                                                    isActive ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"
                                                )}>
                                                    {step.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Status Message */}
                            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-4 min-h-[120px]">
                                {status === 'updating' && (
                                    <>
                                        <div className="relative">
                                            <Loader2 size={32} className="text-primary animate-spin" />
                                            <div className="absolute inset-0 bg-primary/20 blur-xl animate-pulse" />
                                        </div>
                                        <p className="text-sm text-muted-foreground max-w-xs">
                                            Das System wird aktualisiert. Bitte schließen Sie dieses Fenster nicht.
                                        </p>
                                    </>
                                )}
                                {status === 'restarting' && (
                                    <>
                                        <Loader2 size={32} className="text-yellow-500 animate-spin" />
                                        <p className="text-sm text-muted-foreground max-w-xs italic">
                                            Der Server startet gerade neu. Verbindung wird wiederhergestellt...
                                        </p>
                                    </>
                                )}
                                {status === 'success' && (
                                    <>
                                        <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 shadow-lg shadow-green-500/20">
                                            <CheckCircle size={32} />
                                        </div>
                                        <p className="text-sm font-medium text-foreground">
                                            Update erfolgreich abgeschlossen!
                                        </p>
                                    </>
                                )}
                                {status === 'error' && (
                                    <>
                                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                                            <AlertTriangle size={32} />
                                        </div>
                                        <p className="text-sm font-medium text-red-500">
                                            Da ist etwas schiefgelaufen.
                                        </p>
                                    </>
                                )}
                            </div>

                            {/* Collapsible Logs Toggle */}
                            <div className="pt-2">
                                <button
                                    onClick={() => setShowLogs(!showLogs)}
                                    className="w-full py-2 px-3 rounded-lg hover:bg-muted flex items-center justify-between text-xs font-bold text-muted-foreground transition-colors border border-transparent hover:border-border"
                                >
                                    <div className="flex items-center gap-2">
                                        <Terminal size={14} />
                                        <span>Systemdetails (Logs)</span>
                                    </div>
                                    {showLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>

                                <AnimatePresence>
                                    {showLogs && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 200, opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden mt-2"
                                        >
                                            <div
                                                ref={terminalRef}
                                                className="h-full p-4 overflow-y-auto font-mono text-[10px] bg-black text-green-500 rounded-xl border border-border shadow-inner"
                                            >
                                                {logs.map((log, i) => (
                                                    <div key={i} className="break-words opacity-80 mb-1">
                                                        <span className="text-green-500/40 mr-2">$</span>
                                                        {log}
                                                    </div>
                                                ))}
                                                {(status === 'updating' || status === 'restarting') && (
                                                    <div className="animate-pulse inline-block w-2 h-4 bg-green-500 align-middle ml-1" />
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-border bg-muted/30 flex gap-3">
                            {status === 'success' ? (
                                <Button
                                    onClick={() => window.location.reload()}
                                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                                >
                                    App neu laden
                                </Button>
                            ) : status === 'error' ? (
                                <>
                                    <Button onClick={startUpdate} className="flex-1">Erneut versuchen</Button>
                                    <Button onClick={() => window.location.reload()} variant="outline" className="flex-1">Abbrechen</Button>
                                </>
                            ) : (
                                <Button
                                    variant="outline"
                                    onClick={onClose}
                                    disabled={status === 'updating' || status === 'restarting'}
                                    className="w-full"
                                >
                                    Schließen
                                </Button>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
