// src/server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const os = require('os');

// Core Module
const configureExpress = require('./config/express');
const bootService = require('./services/bootService');

// Socket Manager & Utils
const socketManager = require('./socket/index');
const logger = require('./utils/logger');

// --- INIT ---
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Erlaubt Zugriff von allen Geräten im LAN
        methods: ["GET", "POST"]
    }
});

// --- SETUP ---
// 1. Logger mit IO verbinden
logger.init(io);

// 2. Express Konfiguration laden (Middleware & Routes)
configureExpress(app);

// 3. Socket Manager starten
socketManager(io);

// --- SERVER START ---
const PORT = process.env.PORT || 3000;

// Helper: Lokale IP finden
const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
};

server.listen(PORT, '0.0.0.0', async () => {
    console.clear();
    const localIP = getLocalIP();
    console.log('--------------------------------------------------');
    console.log(`🚀 LAN SERVER GESTARTET`);
    console.log(`📡 Local:   http://localhost:${PORT}`);
    console.log(`📡 Network: http://${localIP}:${PORT}`);
    console.log('--------------------------------------------------');
    
    try {
        // Boot-Prozess anstoßen (DB laden, Browser, etc.)
        await bootService.startSystem(io, PORT);
        logger.log('success', 'System Boot abgeschlossen.');
    } catch (err) {
        logger.log('error', `System Boot Fehler: ${err.message}`);
    }
});