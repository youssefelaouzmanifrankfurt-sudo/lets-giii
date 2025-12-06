// src/services/inventoryService.js
const storage = require('../utils/storage');
const logger = require('../utils/logger'); // Optional, falls Logger verfügbar

const FILE_NAME = 'inventory.json';

class InventoryService {
    
    /**
     * WICHTIG: Wird vom bootService beim Start aufgerufen.
     * Muss existieren, damit der Server nicht crasht.
     */
    async init() {
        try {
            // Wir laden die Daten einmal testweise, um sicherzugehen, dass alles passt.
            const items = this.getAll();
            console.log(`[InventoryService] Initialisiert. ${items.length} Artikel im Speicher.`);
            return true;
        } catch (e) {
            console.error('[InventoryService] Init fehlgeschlagen:', e.message);
            // Wir werfen den Fehler nicht weiter, damit der Server oben bleibt (Soft-Fail)
            return false; 
        }
    }

    /**
     * Lädt alle Inventar-Items.
     */
    getAll() {
        return storage.readJSON(FILE_NAME, []);
    }

    /**
     * Speichert die gesamte Liste.
     */
    saveAll(items) {
        return storage.writeJSON(FILE_NAME, items);
    }

    /**
     * Fügt ein einzelnes Item hinzu und speichert.
     */
    add(item) {
        const items = this.getAll();
        items.push(item);
        this.saveAll(items);
        return items;
    }

    /**
     * Löscht ein Item anhand der ID.
     */
    delete(id) {
        let items = this.getAll();
        const initialLength = items.length;
        items = items.filter(i => i.id !== id);
        
        if (items.length !== initialLength) {
            this.saveAll(items);
            return true;
        }
        return false;
    }

    /**
     * Synchronisiert Scanner-Ergebnisse mit der Datenbank.
     */
    syncWithScan(scannedItems) {
        if (!Array.isArray(scannedItems)) return this.getAll();
        // Einfacher Overwrite/Update
        this.saveAll(scannedItems);
        return scannedItems;
    }

    /**
     * Kern-Logik für "Re-Up" (Duplizieren einer Anzeige).
     * Erstellt einen Draft basierend auf einem existierenden Item.
     */
    createReUpDraft(originalId) {
        const items = this.getAll();
        const originalItem = items.find(i => i.id === originalId);

        if (!originalItem) {
            throw new Error(`Item mit ID ${originalId} nicht gefunden.`);
        }

        // Kopie erstellen
        const newId = 'DRAFT-' + Date.now();
        const newItem = {
            ...originalItem,
            id: newId,
            status: 'DRAFT',
            active: false,
            views: 0,
            favorites: 0,
            uploadDate: new Date().toLocaleDateString('de-DE'),
        };

        // Speichern
        this.add(newItem);

        return {
            updatedList: this.getAll(),
            newItem: newItem
        };
    }
}

// Exportiere eine Instanz der Klasse (Singleton Pattern)
module.exports = new InventoryService();