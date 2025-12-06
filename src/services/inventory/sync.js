// src/services/inventory/sync.js
const logger = require('../../utils/logger');

// Hilfsfunktion: String normalisieren für Vergleich (z.B. "iPhone 12" == "iphone 12 ")
function normalize(str) {
    return str ? String(str).toLowerCase().trim().replace(/[^a-z0-9]/g, '') : '';
}

module.exports = {
    syncWithScan: (scannedItems) => {
        // Wir holen den Store direkt hier, um Zirkelbezüge zu vermeiden
        const store = require('./store');
        let db = store.getAll();
        
        let added = 0;
        let updated = 0;

        scannedItems.forEach(scanItem => {
            // Wir suchen nach ID oder exaktem Titel
            const existingIndex = db.findIndex(i => 
                (i.id && scanItem.id && i.id === scanItem.id) || 
                normalize(i.title) === normalize(scanItem.title)
            );

            if (existingIndex >= 0) {
                // --- UPDATE LOGIK ---
                const exist = db[existingIndex];
                let changed = false;

                // 1. Bilder ergänzen, wenn keine da sind
                if (!exist.images || exist.images.length === 0) {
                    if (scanItem.images && scanItem.images.length > 0) {
                        exist.images = scanItem.images;
                        changed = true;
                    }
                }
                
                // 2. Tech-Daten ergänzen
                if ((!exist.techData || exist.techData.length === 0) && scanItem.techData) {
                    exist.techData = scanItem.techData;
                    changed = true;
                }
                
                // 3. Preis update (nur wenn 0 oder leer)
                if (scanItem.price && (!exist.price || exist.price === '0')) {
                    exist.price = scanItem.price;
                    changed = true;
                }

                if (changed) {
                    updated++;
                    db[existingIndex] = exist; // Zurückschreiben
                }

            } else {
                // --- NEU ERSTELLEN ---
                
                // ID generieren falls fehlt
                if (!scanItem.id) {
                    scanItem.id = 'AUTO-' + Date.now() + Math.random().toString(36).substr(2, 5);
                }
                
                // Standardwerte
                scanItem.stock = scanItem.stock || 1;
                scanItem.location = scanItem.location || "Lager";
                scanItem.addedAt = new Date().toLocaleDateString('de-DE');
                scanItem.status = 'DRAFT'; // Erstmal als Entwurf
                
                db.push(scanItem);
                added++;
            }
        });

        // Nur speichern wenn was passiert ist
        if (added > 0 || updated > 0) {
            store.saveAll(db);
            logger.log('success', `Sync fertig: ${added} Neu, ${updated} Aktualisiert.`);
        } else {
            logger.log('info', 'Sync fertig: Keine Änderungen erforderlich.');
        }

        return db;
    }
};