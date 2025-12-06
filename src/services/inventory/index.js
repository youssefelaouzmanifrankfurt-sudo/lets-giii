// src/services/inventory/index.js
const store = require('./store');
const sync = require('./sync');
const actions = require('./actions');
const storage = require('../../utils/storage'); 

module.exports = {
    // --- Core Data Access ---
    getAll: store.getAll,
    saveAll: store.saveAll,
    delete: store.deleteItem,
    replaceAll: store.replaceAll,

    // --- Methoden für Boot & Socket ---
    
    // Lädt DB von Festplatte in den RAM-Cache (beim Start)
    init: () => {
        const data = storage.loadDB() || [];
        store.replaceAll(data);
        return data;
    },

    // Erzwingt Neuladen von Festplatte (beim File-Watcher Event)
    reload: () => {
        const newData = storage.loadDB();
        if (newData) {
            store.replaceAll(newData);
            return newData;
        }
        return store.getAll();
    },

    // Fügt Item hinzu und speichert sofort (für Re-Upload)
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