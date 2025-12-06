// src/services/inventory/store.js
const fs = require('fs');
const path = require('path');
const storage = require('../../utils/storage');
const logger = require('../../utils/logger');

// Cache im Speicher (vermeidet ständiges Lesen der Festplatte)
let inventoryCache = [];

// Helper: Atomares Schreiben (Sichert gegen Datenverlust bei Absturz)
function safeWrite(filePath, data) {
    const tempPath = filePath + '.tmp';
    try {
        // 1. Schreibe in temporäre Datei
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
        
        // 2. Benenne atomar um (Das OS garantiert, dass dies vollständig geschieht)
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
    // Gibt Cache zurück (lazy load falls leer)
    getAll: () => {
        if (inventoryCache.length === 0) {
            inventoryCache = storage.loadDB() || [];
        }
        return inventoryCache;
    },

    // Ersetzt Cache (ohne Speichern - für init/reload)
    replaceAll: (newData) => {
        if (!Array.isArray(newData)) return;
        inventoryCache = newData;
    },

    // Speichert Cache auf Festplatte (sicher)
    saveAll: (data) => {
        inventoryCache = data; 
        const dbPath = storage.getDbPath(); 
        
        if (dbPath) {
            safeWrite(dbPath, inventoryCache);
        } else {
            logger.log('error', 'Kein DB Pfad gefunden! Kann nicht speichern.');
        }
    },

    // Löscht ein Item und speichert
    deleteItem: (id) => {
        const initialLength = inventoryCache.length;
        inventoryCache = inventoryCache.filter(i => i.id !== id);
        
        if (inventoryCache.length !== initialLength) {
            module.exports.saveAll(inventoryCache);
            return true;
        }
        return false;
    }
};