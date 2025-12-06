// src/services/ocrService.js
const Tesseract = require('tesseract.js');
const fs = require('fs');
const sharp = require('sharp'); 
const logger = require('../utils/logger');

// SINGLETON: Worker wird nur einmal erstellt und wiederverwendet
let worker = null;

async function getWorker() {
    if (worker) return worker;
    logger.log('info', 'OCR: Starte Tesseract Worker (einmalig)...');
    
    // Worker erstellen und englisch laden (besser für Modellnummern)
    worker = await Tesseract.createWorker('eng');
    
    // Parameter optimieren
    await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-./: ',
        tessedit_pageseg_mode: '7' // Single Line Mode
    });
    return worker;
}

// Bildvorbereitung
async function createBuffer(inputPath) {
    try {
        return await sharp(inputPath)
            .resize({ width: 1500, fit: 'inside' })
            .grayscale()
            .normalize()
            .sharpen()
            .toBuffer();
    } catch (error) {
        return null;
    }
}

function parseTextResult(text) {
    if (!text || text.length < 2) return { score: 0, text: null };
    const lines = text.split(/\r?\n/);
    let bestLine = null;
    let maxScore = 0;

    lines.forEach(rawLine => {
        // Bereinigen: Nur erlaubte Zeichen
        let clean = rawLine.replace(/[^a-zA-Z0-9\-\/ ]/g, '').trim();
        if (clean.length < 3 || clean.length > 35) return;

        let score = 0;
        const digits = clean.replace(/[^0-9]/g, "").length;
        const uppers = clean.replace(/[^A-Z]/g, "").length;
        
        // Scoring Logik
        if (clean.length > 4) score += 5;
        if (uppers > 0) score += (uppers * 1.5);
        if (digits > 0) score += (digits * 3);
        if (digits > 0 && (clean.length - digits) > 0) score += 15;

        // Ausschluss von Standard-Wörtern
        if (/Germany|China|Made|Volt|Watt|230V|50Hz|Class|Type|Model|Nr\.|WEEE/i.test(clean)) {
            score -= 50;
        }

        if (score > maxScore) {
            maxScore = score;
            bestLine = clean;
        }
    });
    return { score: maxScore, text: bestLine };
}

async function processImage(filePath) {
    try {
        const w = await getWorker();
        const buffer = await createBuffer(filePath);
        
        if (!buffer) return "Unbekannt";

        const { data: { text } } = await w.recognize(buffer);
        const result = parseTextResult(text);

        // Aufräumen
        if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch(e){}

        if (result.score >= 12 && result.text) {
            logger.log('info', `OCR Treffer: ${result.text} (Score: ${result.score})`);
            return result.text;
        }

        return result.text || "Unbekannt";

    } catch (error) {
        logger.log('error', `OCR Fehler: ${error.message}`);
        return "Unbekannt";
    }
}

// Cleanup beim Beenden
process.on('exit', async () => {
    if(worker) await worker.terminate();
});

module.exports = { processImage };