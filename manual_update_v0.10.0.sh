#!/bin/bash
# Manuelles Update-Script für v0.10.0
# Dieses Script ist NUR für das erste Update auf v0.10.0 nötig!
# Ab v0.10.1 funktioniert das Web-Interface Update automatisch.

echo "╔════════════════════════════════════════╗"
echo "║  GabelGuru Manual Update v0.10.0     ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Farbdefinitionen
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Fehlerbehandlung
set -e
trap 'echo -e "${RED}❌ Fehler aufgetreten! Update abgebrochen.${NC}"; exit 1' ERR

echo -e "${YELLOW}>>> Step 1: Git Pull${NC}"
git pull origin main
echo -e "${GREEN}✓ Code aktualisiert${NC}\n"

echo -e "${YELLOW}>>> Step 2: Root Dependencies${NC}"
npm install
echo -e "${GREEN}✓ Root Dependencies installiert${NC}\n"

echo -e "${YELLOW}>>> Step 3: Database Migration (mit Backup!)${NC}"
node update.js
echo -e "${GREEN}✓ Migration erfolgreich${NC}\n"

echo -e "${YELLOW}>>> Step 4: Server Dependencies${NC}"
cd server && npm install && cd ..
echo -e "${GREEN}✓ Server Dependencies installiert${NC}\n"

echo -e "${YELLOW}>>> Step 5: Client Dependencies${NC}"
cd client && npm install
echo -e "${GREEN}✓ Client Dependencies installiert${NC}\n"

echo -e "${YELLOW}>>> Step 6: Client Build${NC}"
npm run build
cd ..
echo -e "${GREEN}✓ Frontend gebaut${NC}\n"

echo -e "${YELLOW}>>> Step 7: Service Restart${NC}"
supervisorctl restart einkaufsliste
echo -e "${GREEN}✓ Service neugestartet${NC}\n"

echo ""
echo "╔════════════════════════════════════════╗"
echo "║         Update Complete! ✓             ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Die App läuft jetzt auf v0.10.0!${NC}"
echo ""
echo "Nächste Schritte:"
echo "1. Check Status: supervisorctl status einkaufsliste"
echo "2. Check Logs: supervisorctl tail einkaufsliste"
echo "3. Test App: https://deine-domain.de"
echo ""
echo -e "${YELLOW}💡 Ab jetzt kannst du über /settings updaten!${NC}"
