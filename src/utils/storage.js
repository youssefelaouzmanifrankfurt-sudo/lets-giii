// src/utils/storage.js
const fs = require('fs');
const path = require('path');

// --- KONFIGURATION ---
// Port 3000 = IMMER Master (C: Laufwerk)
// Andere Ports = IMMER Client (Z: Laufwerk)
const PORT = process.env.PORT || 3000;
const IS_MASTER = (String(PORT) === '3000');

// Pfad-Konfiguration
const SERVER_DATA_DIR = 'C:\\weeeeeee_data';
const CLIENT_DATA_DIR = 'Z:\\'; 

// Wähle den korrekten Pfad basierend auf der Rolle
const ACTIVE_PATH = IS_MASTER ? SERVER_DATA_DIR : CLIENT_DATA_DIR;
const MODE = IS_MASTER ? "SERVER (Master)" : "CLIENT (Worker)";

console.log("------------------------------------------------");
console.log(`[STORAGE] Modus:       ${MODE}`);
console.log(`[STORAGE] Speicherort: ${ACTIVE_PATH}`);
console.log("------------------------------------------------");

// --- INTERNE HELFER ---

/**
 * Stellt sicher, dass Datei und Ordner existieren.
 * Master: Erstellt Ordner/Datei wenn nicht vorhanden.
 * Client: Wartet/Liest nur.
 */
function ensureFile(filename, defaultData = []) {
    const filePath = path.join(ACTIVE_PATH, filename);

    // 1. Ordner erstellen (nur Master)
    if (IS_MASTER && !fs.existsSync(ACTIVE_PATH)) {
        try { fs.mkdirSync(ACTIVE_PATH, { recursive: true }); } catch(e) {}
    }

    // 2. Datei prüfen
    if (!fs.existsSync(filePath)) {
        if (IS_MASTER) {
            try {
                fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
            } catch (e) {
                console.error(`[STORAGE] Fehler beim Erstellen von ${filename}: ${e.message}`);
            }
        } else {
            console.warn(`[STORAGE] Warte auf Master-DB: ${filename} nicht gefunden.`);
            return defaultData; 
        }
    }
    
    // 3. Lesen
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return data ? JSON.parse(data) : defaultData;
    } catch (e) {
        console.error(`[STORAGE] Lesefehler bei ${filename}: ${e.message}`);
        return defaultData;
    }
}

/**
 * Speichert Daten in Datei.
 */
function saveFile(filename, data) {
    const filePath = path.join(ACTIVE_PATH, filename);
    try {
        // Backup Logic (nur Master, ca. 5% Chance)
        if (IS_MASTER && Math.random() > 0.95) {
            try { fs.copyFileSync(filePath, filePath + '.bak'); } catch(e) {}
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error(`[STORAGE] Schreibfehler bei ${filename}: ${e.message}`);
        return false;
    }
}

// --- PUBLIC API ---

const api = {
    // Basis-Infos
    getDbPath: () => path.join(ACTIVE_PATH, 'inventory.json'),
    getDataDir: () => ACTIVE_PATH,

    // --- NEUE GENERISCHE API (Besser für Erweiterungen) ---
    readJSON: (filename, defaultVal = []) => ensureFile(filename, defaultVal),
    writeJSON: (filename, data) => saveFile(filename, data),

    // --- LEGACY API (Kompatibilität) ---
    loadDB: () => api.readJSON('inventory.json'),
    saveDB: (data) => api.writeJSON('inventory.json', data),

    loadHistory: () => api.readJSON('history.json'),
    saveHistory: (data) => api.writeJSON('history.json', data),

    loadStock: () => api.readJSON('stock.json'),
    saveStock: (data) => api.writeJSON('stock.json', data),

    loadTasks: () => api.readJSON('tasks.json'),
    saveTasks: (data) => api.writeJSON('tasks.json', data),

    loadSettings: () => api.readJSON('settings.json', {}),
    saveSettings: (data) => api.writeJSON('settings.json', data),
    
    loadExternal: () => api.readJSON('imported.json'),
    saveExternal: (data) => api.writeJSON('imported.json', data)
};

module.exports = api;