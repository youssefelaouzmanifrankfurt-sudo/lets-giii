// src/routes/api.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const QRCode = require('qrcode');
const upload = multer({ dest: 'uploads/' });

// Imports
const ocrService = require('../services/ocrService');
// WICHTIG: getBrowser muss hier importiert werden!
const { toggleDebugMode, getStatus, getBrowser } = require('../scrapers/chat/connection');
const logger = require('../utils/logger');
const systemState = require('../utils/state');

// --- API ROUTES ---

// 1. Boot Status (für Ladebalken)
router.get('/boot-status', (req, res) => res.json(systemState));

// 2. QR Code (mit Error Handling)
router.get('/qr/:text', async (req, res) => {
    try { 
        if(!req.params.text) throw new Error("Kein Text für QR Code");
        const url = await QRCode.toDataURL(req.params.text);
        res.json({ url }); 
    } catch (e) { 
        res.status(500).json({ error: 'QR Error: ' + e.message }); 
    }
});

// 3. Browser Status & Toggle (Robust gemacht)
router.get('/browser/status', (req, res) => {
    // Prüfen ob Browser-Instanz existiert, ohne abzustürzen
    const browser = getBrowser();
    const status = getStatus();
    // Wir senden 'connected' nur als true, wenn der Browser wirklich da ist
    res.json({ ...status, connected: !!browser });
});

router.post('/browser/toggle', async (req, res) => {
    try {
        const { visible } = req.body; 
        const result = await toggleDebugMode(visible);
        logger.log('info', `Browser Modus geändert: ${visible ? 'Sichtbar' : 'Headless'}`);
        res.json(result);
    } catch (e) {
        logger.log('warning', `Browser Toggle Fehler: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// 4. Bild-Scan (OCR)
router.post('/scan-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Kein Bild hochgeladen' });
        
        logger.log('info', 'Starte OCR Analyse...');
        const modelName = await ocrService.processImage(req.file.path);

        if(modelName === "Unbekannt" || modelName.length < 2) {
             return res.json({ success: false, error: "Kein Text erkannt. Bitte Bild drehen oder näher ran." });
        }

        res.json({ success: true, model: modelName });
    } catch (e) { 
        logger.log('error', `API Scan Fehler: ${e.message}`);
        res.status(500).json({ error: e.message }); 
    }
});

module.exports = router;