// src/services/inventory/index.js
const store = require('./store');
const sync = require('./sync');
const actions = require('./actions');
const storage = require('../../utils/storage'); // Zugriff auf Storage Utils

module.exports = {
    // --- Core Data Access ---
    getAll: store.getAll,
    saveAll: store.saveAll,
    delete: store.deleteItem,
    replaceAll: store.replaceAll,

    // --- Neue Methoden für Socket & Boot (Global Replacement) ---
    
    /**
     * Lädt die Datenbank initial (für BootService)
     */
    init: () => {
        const data = storage.loadDB() || [];
        store.replaceAll(data); // Store mit Daten füllen
        return data;
    },

    /**
     * Erzwingt ein Neuladen von der Festplatte (für FileWatcher)
     */
    reload: () => {
        const newData = storage.loadDB();
        if (newData) {
            store.replaceAll(newData);
            return newData;
        }
        return store.getAll();
    },

    /**
     * Fügt ein einzelnes Item hinzu (für Re-Upload Feature)
     */
    add: (item) => {
        const currentList = store.getAll();
        currentList.push(item);
        store.saveAll(currentList);
        return currentList;
    },

    // --- Sync Logic ---
    syncWithScan: sync.syncWithScan,

    // --- Actions ---
    markAsInStock: actions.markAsInStock,
    removeFromStock: actions.removeFromStock,
    addFeature: actions.addFeature,
    addFromStock: actions.addFromStock
};