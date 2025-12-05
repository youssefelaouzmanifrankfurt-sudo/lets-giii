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
                const updatedList = inventoryService.syncWithScan(scannedItems);
                logger.log('success', 'DB Sync abgeschlossen. Sende Update.');
                io.emit('update-db-list', updatedList);
            } else {
                socket.emit('scrape-progress', { error: true });
                logger.log('error', 'DB Scan fehlgeschlagen.');
            }
        });

        // 4. RE-UPLOAD IMPLEMENTIERUNG
        socket.on('re-up-item', async ({ id }) => {
            logger.log('info', `🚀 Re-Up Request für ID: ${id}`);
            
            try {
                const db = inventoryService.getAll();
                const originalItem = db.find(i => i.id === id);

                if (originalItem) {
                    // Wir erstellen eine KOPIE als Draft
                    const newId = 'DRAFT-' + Date.now();
                    const newItem = {
                        ...originalItem,
                        id: newId,
                        status: 'DRAFT',        // Wird gelb markiert
                        active: false,
                        views: 0,
                        favorites: 0,
                        uploadDate: new Date().toLocaleDateString('de-DE'),
                    };

                    // Zur DB hinzufügen
                    inventoryService.add(newItem); // Nutze Service statt direktes Push
                    
                    // Bestätigung an alle Clients
                    io.emit('update-db-list', inventoryService.getAll());
                    logger.log('success', `✅ Anzeige dupliziert (${newId}). Öffne Browser...`);
                    
                    // Browser Formular öffnen
                    // Wir warten nicht zwingend auf das Ergebnis, damit der Server nicht blockiert
                    poster.fillAdForm(newItem).catch(err => {
                        logger.log('error', `Fehler im Poster-Prozess: ${err.message}`);
                    });

                } else {
                    logger.log('warning', `Re-Up fehlgeschlagen: Item ${id} nicht gefunden.`);
                }
            } catch (error) {
                logger.log('error', `Critical Error bei Re-Up: ${error.message}`);
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