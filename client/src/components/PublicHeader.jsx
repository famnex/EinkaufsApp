import { useNavigate, useLocation } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { Button } from './Button';
import ThemeToggle from './ThemeToggle';

export default function PublicHeader() {
    const navigate = useNavigate();
    const location = useLocation();

    const isLoginPage = location.pathname === '/login';
    const isRecipePage = location.pathname.includes('/recipe/');

    return (
        <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => navigate('/')}
                >
                    <img
                        src={`${import.meta.env.BASE_URL}logo_wide.png`}
                        alt="Logo"
                        className="w-10 h-10 object-contain"
                    />
                    <img
                        src={`${import.meta.env.BASE_URL}logo_text.svg`}
                        alt="GabelGuru"
                        className="h-6 object-contain hidden sm:block filter dark:invert"
                    />
                </div>
                <div className="flex items-center gap-4">
                    {/* Print button - only on recipe pages */}
                    {isRecipePage && (
                        <button
                            onClick={() => window.print()}
                            className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors print:hidden"
                            title="Drucken"
                        >
                            <Printer size={20} />
                        </button>
                    )}
                    <span className="print:hidden">
                        <ThemeToggle />
                    </span>
                    <span className="print:hidden">
                        {isLoginPage ? (
                            <Button size="sm" onClick={() => navigate('/signup')}>
                                Registrieren
                            </Button>
                        ) : (
                            <Button size="sm" onClick={() => navigate('/login')}>
                                Anmelden
                            </Button>
                        )}
                    </span>
                </div>
            </div>
        </nav>
    );
}
