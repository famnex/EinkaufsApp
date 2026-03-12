const { User, List, Product, ListItem, Store, Recipe } = require('./server/src/models');

async function ensureExampleData() {
    try {
        const user = await User.findOne();
        if (!user) {
            console.log('Kein Benutzer gefunden.');
            return;
        }

        // 1. Geschäft & Liste sicherstellen
        let store = await Store.findOne({ where: { UserId: user.id } });
        if (!store) {
            store = await Store.create({ name: 'Testgeschäft', UserId: user.id });
        }

        let list = await List.findOne({ where: { UserId: user.id, status: 'active' } });
        if (!list) {
            list = await List.create({ 
                name: 'Meine Einkaufsliste', 
                date: new Date().toISOString().split('T')[0],
                UserId: user.id,
                CurrentStoreId: store.id
            });
        } else if (!list.CurrentStoreId) {
            await list.update({ CurrentStoreId: store.id });
        }

        const itemsCount = await ListItem.count({ where: { ListId: list.id } });
        if (itemsCount === 0) {
            let product = await Product.findOne({ where: { UserId: user.id } });
            if (!product) {
                product = await Product.create({ 
                    name: 'Äpfel', 
                    category: 'Obst', 
                    UserId: user.id 
                });
            }
            await ListItem.create({
                ListId: list.id,
                ProductId: product.id,
                UserId: user.id,
                quantity: 1,
                unit: 'kg'
            });
            console.log('Beispielprodukt zur Liste hinzugefügt.');
        } else {
            console.log('Liste enthält bereits Produkte.');
        }

        // 2. Rezept ID 0 für das Tutorial sicherstellen
        const recipe0 = await Recipe.findByPk(0);
        if (recipe0) {
            // Wir stellen sicher, dass das Rezept öffentlich ist
            await recipe0.update({ isPublic: true });
            
            // Wir fügen es zu den Favoriten des Users hinzu, damit es in der Übersicht erscheint
            // Da wir direkt mit den Modellen arbeiten, nutzen wir die assoziierte Methode oder 
            // legen einen Eintrag in der FavoriteRecipes Tabelle an if needed.
            // Die Methode addFavorite sollte durch die belongsToMany Assoziation 'Favorites' verfügbar sein.
            try {
                await user.addFavorite(recipe0);
                console.log('Rezept ID 0 zu Favoriten hinzugefügt.');
            } catch (favErr) {
                // Fallback: Falls die Methode nicht da ist, manuell in die Tabelle (wobei wir den Tabellennamen raten müssten)
                console.log('Konnte Favorit nicht via Methode hinzufügen, versuche isPublic = true reicht evtl.');
            }
        } else {
            // Falls es doch nicht existiert, legen wir ein Beispielrezept an
            const existingRecipe = await Recipe.findOne({ where: { UserId: user.id } });
            if (!existingRecipe) {
                await Recipe.create({
                    title: 'Beispielrezept: Pasta',
                    category: 'Pasta',
                    instructions: JSON.stringify(['Nudeln kochen', 'Soße drüber']),
                    servings: 2,
                    UserId: user.id,
                    isPublic: true
                });
                console.log('Neues Beispielrezept erstellt.');
            }
        }

    } catch (error) {
        console.error('Fehler beim Erstellen der Beispieldaten:', error);
    }
}

ensureExampleData();
