// src/socket/index.js
const chatHandler = require('./chatHandler');
const taskHandler = require('./taskHandler');
const trackingHandler = require('./trackingHandler');
const settingsHandler = require('./settingsHandler');

// Poster bleibt hier, da es eine UI-Automation ist (Browser öffnen am Client/Server)
const poster = require('../scrapers/poster');

// Modulare Handler
const externalHandler = require('./external'); 
const stockHandler = require('./stock'); 

const logger = require('../utils/logger');
// Nur noch der Service wird importiert, keine Scraper-Tools mehr!
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

        // 3. Scan Starten (Delegiert an Service)
        socket.on('start-db-scrape', async () => {
            logger.log('info', 'Starte manuellen DB-Scan via Service...');
            
            try {
                // Service übernimmt die Arbeit und meldet Progress via Callback
                const updatedList = await inventoryService.performFullScan((current, total) => {
                    socket.emit('scrape-progress', { current, total });
                });

                logger.log('success', 'DB Scan erfolgreich. Sende Update.');
                io.emit('update-db-list', updatedList);

            } catch (err) {
                logger.log('error', `DB Scan fehlgeschlagen: ${err.message}`);
                socket.emit('scrape-progress', { error: true });
            }
        });

        // 4. Re-Up Item (Delegiert an Service)
        socket.on('re-up-item', async ({ id }) => {
            logger.log('info', `🚀 Re-Up Request für ID: ${id}`);
            
            try {
                // Daten-Logik im Service
                const result = inventoryService.createReUpDraft(id);
                
                // Update an alle
                io.emit('update-db-list', result.updatedList);
                logger.log('success', `✅ Anzeige dupliziert (${result.newItem.id}).`);
                
                // UI-Aktion (Browser öffnen)
                poster.fillAdForm(result.newItem).catch(err => {
                    logger.log('error', `Fehler beim Öffnen des Formulars: ${err.message}`);
                });

            } catch (error) {
                logger.log('error', `Re-Up Fehler: ${error.message}`);
                socket.emit('server-error', { msg: error.message });
            }
        });

        // Globale Events
        socket.on('refresh-stock-request', () => {
            io.emit('force-reload-stock');
        });

        socket.on('start-scraper', (d) => logger.log('info', `Bot Start: ${d.term}`));
        socket.on('stop-scraper', () => logger.log('warning', 'Bot Stop'));
        
        socket.on('disconnect', () => {
            // Cleanup
        });
    });
};