// src/utils/logger.js
const fs = require('fs');
const path = require('path');

let ioInstance = null;

// Log Verzeichnis erstellen
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
    try { fs.mkdirSync(logDir); } catch(e) {}
}

const logFile = path.join(logDir, 'server.log');

module.exports = {
    init: (io) => {
        ioInstance = io;
    },

    log: (type, message) => {
        // 1. Console Output mit Zeitstempel
        const timestamp = new Date().toLocaleTimeString('de-DE');
        const date = new Date().toLocaleDateString('de-DE');
        
        let color = '';
        let prefix = '';

        switch (type) {
            case 'info':    color = '\x1b[36m'; prefix = 'ℹ️'; break; // Cyan
            case 'success': color = '\x1b[32m'; prefix = '✅'; break; // Green
            case 'warning': color = '\x1b[33m'; prefix = '⚠️'; break; // Yellow
            case 'error':   color = '\x1b[31m'; prefix = '❌'; break; // Red
            default:        color = '\x1b[37m'; prefix = '📝'; break; // White
        }

        const consoleMsg = `${color}[${timestamp}] ${prefix} ${message}\x1b[0m`;
        console.log(consoleMsg);

        // 2. File Logging
        try {
            const fileMsg = `[${date} ${timestamp}] [${type.toUpperCase()}] ${message}\n`;
            fs.appendFileSync(logFile, fileMsg);
        } catch (e) {
            console.error("Kann nicht in Logfile schreiben:", e);
        }

        // 3. Socket Emit
        if (ioInstance) {
            ioInstance.emit('server-log', { type, message, time: timestamp });
            if (type === 'error') ioInstance.emit('error-msg', message);
        }
    }
};