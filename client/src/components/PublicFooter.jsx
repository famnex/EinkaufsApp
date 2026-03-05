import { useNavigate } from 'react-router-dom';

export default function PublicFooter() {
    const navigate = useNavigate();

    return (
        <footer className="py-6 sm:py-12 border-t border-border/50 bg-muted/10">
            <div className="max-w-7xl mx-auto px-4 text-center text-xs sm:text-sm text-muted-foreground">
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 sm:gap-6 mb-4 sm:mb-8 print:hidden">
                    <button onClick={() => navigate('/privacy')} className="hover:text-foreground transition-colors">Datenschutz</button>
                    <button onClick={() => navigate('/terms')} className="hover:text-foreground transition-colors">Nutzungsbedingungen</button>
                    <button onClick={() => navigate('/imprint')} className="hover:text-foreground transition-colors">Impressum</button>
                    <button onClick={() => navigate('/community-cookbooks')} className="hover:text-foreground transition-colors">Community</button>
                    <button onClick={() => navigate(`/compliance?url=${encodeURIComponent(window.location.href)}`)} className="hover:text-red-500 transition-colors">Inhalt melden</button>
                </div>
                <p>&copy; {new Date().getFullYear()} GabelGuru. Steffen Fleischer. Made with ❤️.</p>
            </div>
        </footer>
    );
}
