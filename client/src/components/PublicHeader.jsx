import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Printer, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button } from './Button';
import ThemeToggle from './ThemeToggle';

export default function PublicHeader() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    const isLoginPage = location.pathname === '/login';
    const isRecipePage = location.pathname.includes('/recipe/');
    const isCookbookPage = location.pathname.includes('/cookbook');
    const isCommunityPage = location.pathname.includes('/community-cookbooks');
    const isSharedPage = isRecipePage || isCookbookPage || isCommunityPage;

    return (
        <nav
            className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/50 transition-all"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
            <div className="max-w-7xl mx-auto pr-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2 h-full overflow-hidden">
                    {/* Logo - Top Left */}
                    <div
                        className="w-20 h-20 -mt-2 self-start flex items-center justify-center overflow-visible z-50 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity active:scale-95"
                        onClick={() => navigate('/')}
                    >
                        <img
                            src={`${import.meta.env.BASE_URL}logo_wide.png`}
                            alt="Logo"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <div className="relative h-8 flex items-center">
                        <img
                            src={`${import.meta.env.BASE_URL}logo_text.png`}
                            alt="GabelGuru"
                            className="h-6 object-contain"
                            onClick={() => navigate('/')}
                            style={{ cursor: 'pointer' }}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                    {/* Quick Actions - Top Right */}
                    <div className="flex items-center gap-1 sm:gap-2">
                        {isSharedPage && (
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                title="Zurück"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        {isRecipePage && (
                            <button
                                onClick={() => window.print()}
                                className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors print:hidden"
                                title="Drucken"
                            >
                                <Printer size={20} />
                            </button>
                        )}
                        <ThemeToggle />
                    </div>

                    <span className="print:hidden">
                        {!user && (
                            isLoginPage ? (
                                <Button size="sm" onClick={() => navigate('/signup')}>
                                    Registrieren
                                </Button>
                            ) : (
                                <Button size="sm" onClick={() => navigate('/login')}>
                                    Anmelden
                                </Button>
                            )
                        )}
                    </span>
                </div>
            </div>
        </nav>
    );
}
