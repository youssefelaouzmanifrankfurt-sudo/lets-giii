// src/socket/index.js
const chatHandler = require('./chatHandler');
const taskHandler = require('./taskHandler');
const trackingHandler = require('./trackingHandler');
const settingsHandler = require('./settingsHandler');

// Scraper & Poster Import
const dbScraper = require('../scrapers/dbScraper');
const poster = require('../scrapers/poster');

// Modulare Handler
const externalHandler = require('./external'); 
const stockHandler = require('./stock'); 

const logger = require('../utils/logger');
const inventoryService = require('../services/inventoryService'); 

module.exports = (io) => {
    io.on('connection', (socket) => {
        logger.log('info', `Client verbunden: ${socket.id}`);

        // Alle Sub-Handler starten
        chatHandler(io, socket);
        taskHandler(io, socket);
        trackingHandler(io, socket);
        settingsHandler(io, socket);
        externalHandler(io, socket);
        stockHandler(io, socket);

        // --- DATENBANK EVENTS ---

        // 1. Liste laden
        socket.on('get-db-products', () => {
            try {
                const data = inventoryService.getAll();
                socket.emit('update-db-list', data);
            } catch (e) {
                logger.log('error', 'Fehler beim Laden der DB-Liste: ' + e.message);
            }
        });

        // 2. Item löschen
        socket.on('delete-db-item', (id) => {
             inventoryService.delete(id);
             io.emit('update-db-list', inventoryService.getAll());
        });

        // 3. Scan Starten
        socket.on('start-db-scrape', async () => {
            logger.log('info', 'Starte manuellen DB-Scan...');
            const currentDB = inventoryService.getAll();

            const scannedItems = await dbScraper.scrapeMyAds(currentDB, (current, total) => {
                let t = (typeof total === 'number') ? total : 100;
                socket.emit('scrape-progress', { current, total: t });
            });

            if (scannedItems) {
                // Daten speichern über Service
                const updatedList = inventoryService.syncWithScan(scannedItems);
                
                logger.log('success', 'DB Sync abgeschlossen. Sende Update.');
                io.emit('update-db-list', updatedList);
            } else {
                socket.emit('scrape-progress', { error: true });
                logger.log('error', 'DB Scan fehlgeschlagen.');
            }
        });

        // 4. RE-UPLOAD IMPLEMENTIERUNG (Sauber & Sicher)
        socket.on('re-up-item', async ({ id }) => {
            logger.log('info', `🚀 Re-Up Request für ID: ${id}`);
            
            try {
                // 1. Logik: Draft erstellen (Service Call)
                const result = inventoryService.createReUpDraft(id);
                
                // 2. State Update: Alle Clients informieren
                io.emit('update-db-list', result.updatedList);
                logger.log('success', `✅ Anzeige dupliziert (${result.newItem.id}). Öffne Browser...`);
                
                // 3. Side-Effect: Browser/Poster starten
                poster.fillAdForm(result.newItem).catch(err => {
                    logger.log('error', `Fehler im Poster-Prozess: ${err.message}`);
                });

            } catch (error) {
                logger.log('error', `Critical Error bei Re-Up: ${error.message}`);
                socket.emit('server-error', { msg: 'Re-Up fehlgeschlagen: ' + error.message });
            }
        });

        // Globale Events
        socket.on('refresh-stock-request', () => {
            io.emit('force-reload-stock');
        });

        socket.on('start-scraper', (d) => logger.log('info', `Bot Start: ${d.term}`));
        socket.on('stop-scraper', () => logger.log('warning', 'Bot Stop'));
        
        socket.on('disconnect', () => {
            // Optional: Cleanup logic
        });
    });
};