// src/services/inventoryService.js
const storage = require('../utils/storage');
const dbScraper = require('../scrapers/dbScraper'); // Service kontrolliert jetzt den Scraper

const FILE_NAME = 'inventory.json';

class InventoryService {
    
    /**
     * WICHTIG: Wird vom bootService beim Start aufgerufen.
     * Muss existieren, damit der Server nicht crasht.
     */
    async init() {
        try {
            // Test-Laden um sicherzugehen, dass Zugriff da ist
            const items = this.getAll();
            console.log(`[InventoryService] Initialisiert. ${items.length} Artikel geladen.`);
            return true;
        } catch (e) {
            console.error('[InventoryService] Init Fehler:', e.message);
            return false; 
        }
    }

    // --- STANDARD CRUD (Datenbank-Operationen) ---

    getAll() {
        return storage.readJSON(FILE_NAME, []);
    }

    saveAll(items) {
        return storage.writeJSON(FILE_NAME, items);
    }

    add(item) {
        const items = this.getAll();
        items.push(item);
        this.saveAll(items);
        return items;
    }

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

    // --- KOMPLEXE LOGIK (Geschäftsfälle) ---

    /**
     * Führt den kompletten Scan-Prozess durch.
     * Kapselt die Scraper-Logik komplett vom Socket ab.
     * @param {Function} onProgress - Callback (current, total)
     */
    async performFullScan(onProgress) {
        const currentDB = this.getAll();

        // 1. Scraper ausführen
        const scannedItems = await dbScraper.scrapeMyAds(currentDB, (current, total) => {
            // Daten normalisieren für UI
            const safeTotal = (typeof total === 'number') ? total : 100;
            if (onProgress) onProgress(current, safeTotal);
        });

        // 2. Ergebnis verarbeiten
        if (scannedItems && Array.isArray(scannedItems)) {
            this.saveAll(scannedItems); // Wir speichern das Ergebnis direkt
            return scannedItems;
        } else {
            throw new Error("Scan lieferte keine gültigen Daten.");
        }
    }

    /**
     * Erstellt eine Kopie eines Artikels (Re-Upload Vorbereitung).
     */
    createReUpDraft(originalId) {
        const items = this.getAll();
        const originalItem = items.find(i => i.id === originalId);

        if (!originalItem) {
            throw new Error(`Item mit ID ${originalId} nicht gefunden.`);
        }

        // Kopie erstellen mit neuen Metadaten
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

        this.add(newItem);

        return {
            updatedList: this.getAll(),
            newItem: newItem
        };
    }
}

// Singleton Export
module.exports = new InventoryService();