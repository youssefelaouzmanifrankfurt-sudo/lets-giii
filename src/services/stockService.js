// src/services/stockService.js
const storage = require('../utils/storage');
const logger = require('../utils/logger');
const { findBestMatch } = require('../utils/similarity');

class StockService {
    constructor() { console.log("[SERVICE] StockService gestartet."); }
    
    _load() { return storage.loadStock() || []; }
    getAll() { return this._load(); }

    findInStock(name) {
        let stock = this._load();
        if(!name) return null;
        
        const skuMatch = stock.find(i => i.sku && i.sku.toLowerCase() === name.toLowerCase());
        if (skuMatch) return skuMatch;

        const matchResult = findBestMatch(name, stock);
        if (matchResult.item && matchResult.score > 0.80) {
            return matchResult.item;
        }
        return null;
    }

    checkScanMatch(name) { return this.findInStock(name); }

    incrementQuantity(id) {
        let stock = this._load();
        const item = stock.find(i => i.id === id);
        if (item) {
            item.quantity = (parseInt(item.quantity) || 0) + 1;
            item.lastScanned = new Date().toLocaleString();
            this._save(stock);
            logger.log('success', `Bestand erhöht: ${item.title} (+1)`);
        }
        return stock;
    }

    createNewItem(name, details = {}) {
        let stock = this._load();
        
        const newItem = {
            id: "STOCK-" + Date.now(),
            title: name,
            quantity: parseInt(details.quantity) || 1,
            location: details.location || "Lager",
            
            purchasePrice: parseFloat(details.purchasePrice) || 0,
            marketPrice: parseFloat(details.marketPrice) || 0,
            
            sku: details.sku || ("SKU-" + Date.now()),
            minQuantity: parseInt(details.minQuantity) || 0,
            
            sourceUrl: details.sourceUrl || "",
            sourceName: details.sourceName || "",
            
            linkedAdId: details.linkedAdId || null,
            image: details.image || null,
            
            scannedAt: new Date().toLocaleString(),
            lastPriceCheck: details.lastPriceCheck || null
        };
        
        stock.push(newItem);
        this._save(stock);
        logger.log('info', `Neu im Lager: ${name}`);
        return stock;
    }

    linkToAd(stockId, adId, adImage) {
        let stock = this._load();
        const item = stock.find(i => i.id === stockId);
        if (item) {
            item.linkedAdId = adId;
            if(adImage) item.image = adImage; 
            this._save(stock);
            return true;
        }
        return false;
    }

    updateDetails(id, data) {
        const stock = this._load();
        const item = stock.find(i => i.id === id);
        if (item) {
            if (data.title) item.title = data.title;
            if (data.location) item.location = data.location;
            if (data.purchasePrice) item.purchasePrice = parseFloat(data.purchasePrice);
            if (data.quantity) item.quantity = parseInt(data.quantity);
            
            if (data.sku) item.sku = data.sku;
            if (data.marketPrice) item.marketPrice = data.marketPrice;
            if (data.sourceUrl) item.sourceUrl = data.sourceUrl;
            if (data.sourceName) item.sourceName = data.sourceName;
            
            // WICHTIG: Hier fehlte vorher das Speichern der Verknüpfung!
            if (data.linkedAdId !== undefined) item.linkedAdId = data.linkedAdId;
            if (data.image !== undefined) item.image = data.image;
            
            this._save(stock);
        }
        return stock;
    }

    updateQuantity(id, delta) {
        const stock = this._load();
        const item = stock.find(i => i.id === id);
        if (item) {
            item.quantity = (parseInt(item.quantity) || 0) + delta;
            if (item.quantity < 0) item.quantity = 0;
            this._save(stock);
        }
        return stock;
    }

    delete(id) {
        let stock = this._load();
        const initialLength = stock.length;
        stock = stock.filter(i => i.id !== id);
        
        // Nur speichern, wenn wirklich was gelöscht wurde
        if (stock.length !== initialLength) {
            this._save(stock);
            return true;
        }
        return false;
    }

    _save(data) { storage.saveStock(data); }
}

module.exports = new StockService();