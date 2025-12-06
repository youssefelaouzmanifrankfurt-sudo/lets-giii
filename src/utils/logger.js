// src/utils/logger.js
const fs = require('fs');
const path = require('path');

let ioRef = null;

// Pfad zur Logdatei
const logDir = path.join(process.cwd(), 'logs');
const logFile = path.join(logDir, 'server.log');

// Initialisierung (wird von server.js aufgerufen)
function init(io) {
    ioRef = io;
    // Sicherstellen, dass Ordner existiert
    if (!fs.existsSync(logDir)) {
        try { fs.mkdirSync(logDir); } catch(e) {}
    }
}

function log(type, message) {
    const timestamp = new Date().toLocaleTimeString('de-DE');
    const date = new Date().toLocaleDateString('de-DE');
    
    // Farben für die Konsole
    let color = '\x1b[37m'; // Weiß
    if (type === 'info') color = '\x1b[36m';    // Cyan
    if (type === 'success') color = '\x1b[32m'; // Grün
    if (type === 'warning') color = '\x1b[33m'; // Gelb
    if (type === 'error') color = '\x1b[31m';   // Rot

    // 1. Ausgabe Konsole
    console.log(`${color}[${timestamp}] [${type.toUpperCase()}] ${message}\x1b[0m`);

    // 2. Schreiben in Datei (Append)
    try {
        const fileMsg = `[${date} ${timestamp}] [${type.toUpperCase()}] ${message}\n`;
        fs.appendFileSync(logFile, fileMsg);
    } catch (e) {
        console.error("Kann nicht in Logfile schreiben:", e);
    }

    // 3. Senden an Frontend (Dashboard)
    if (ioRef) {
        ioRef.emit('server-log', {
            time: timestamp,
            type: type,
            msg: message
        });
        
        // Fehler auch als Popup-Event senden
        if (type === 'error') {
            ioRef.emit('error-msg', message);
        }
    }
}

module.exports = { init, log };