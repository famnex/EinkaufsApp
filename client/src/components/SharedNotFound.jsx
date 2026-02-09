import { ChefHat, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';

export default function SharedNotFound() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6 text-center">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-8 animate-bounce">
                <ChefHat size={48} />
            </div>

            <h1 className="text-4xl font-black tracking-tighter mb-4 text-foreground">
                Halt da! 🛑
            </h1>

            <p className="text-xl text-muted-foreground max-w-md mb-8 leading-relaxed">
                Dieser Link scheint abgelaufen oder ungültig zu sein.
                Vielleicht wurde ein neuer Link generiert?
            </p>

            <div className="bg-muted/50 border border-border rounded-2xl p-6 mb-8 max-w-sm">
                <p className="text-sm font-medium">
                    🔍 <strong className="text-foreground">Tipp:</strong> Frag am besten die Person, die den Link geteilt hat, nach einem neuen Zugriff.
                </p>
            </div>

            <Button
                onClick={() => navigate('/')}
                className="gap-2 rounded-full px-8 h-12 shadow-lg hover:shadow-primary/20 transition-all"
            >
                <ArrowLeft size={18} />
                Zur Startseite
            </Button>

            <footer className="mt-20 text-muted-foreground/50 text-xs">
                GabelGuru &copy; 2026
            </footer>
        </div>
    );
}
