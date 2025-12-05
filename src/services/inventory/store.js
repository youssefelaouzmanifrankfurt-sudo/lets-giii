// src/services/inventory/store.js
const fs = require('fs');
const path = require('path');
const storage = require('../../utils/storage');
const logger = require('../../utils/logger');

// Cache im Speicher
let inventory = [];

// Atomic Write Helper (Sicheres Speichern)
function safeWrite(filePath, data) {
    const tempPath = filePath + '.tmp';
    try {
        // 1. Schreibe in temporäre Datei
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
        
        // 2. Benenne um (Atomare Operation im Betriebssystem)
        fs.renameSync(tempPath, filePath);
        return true;
    } catch (e) {
        logger.log('error', `CRITICAL: Fehler beim Speichern der DB: ${e.message}`);
        // Versuch temp datei zu löschen falls sie existiert
        try { fs.unlinkSync(tempPath); } catch(err) {}
        return false;
    }
}

module.exports = {
    getAll: () => inventory,

    replaceAll: (newData) => {
        if (!Array.isArray(newData)) {
            logger.log('error', 'Versuch ungültige Daten in DB zu laden (kein Array)');
            return;
        }
        inventory = newData;
    },

    saveAll: (data) => {
        inventory = data; // Update Memory
        const dbPath = storage.getDbPath(); 
        
        if (dbPath) {
            const success = safeWrite(dbPath, inventory);
            // Wir loggen Success nicht, um Konsole sauber zu halten
        } else {
            logger.log('error', 'Kein DB Pfad gefunden! Kann nicht speichern.');
        }
    },

    // Einzelnes Item löschen (Hilfsfunktion)
    deleteItem: (id) => {
        const initialLength = inventory.length;
        inventory = inventory.filter(i => i.id !== id);
        
        if (inventory.length !== initialLength) {
            module.exports.saveAll(inventory); // Speichern triggern
            return true;
        }
        return false;
    }
};