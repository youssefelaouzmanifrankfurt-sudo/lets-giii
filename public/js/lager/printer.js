// public/js/lager/printer.js

/**
 * Öffnet das Modal zum Drucken des Labels.
 * Erwartet eine ID.
 */
window.openPrintModal = async (id) => {
    let item = null;

    // 1. Versuch: Aus globalem Cache laden (Frontend State)
    if (window.lastStockItems && Array.isArray(window.lastStockItems)) {
        item = window.lastStockItems.find(i => i.id === id);
    }

    // 2. Fallback: API Call falls Frontend State leer (z.B. nach Reload)
    if (!item) {
        try {
            // Annahme: Es gibt eine Route um ein einzelnes Item zu holen
            // Falls nicht, muss diese Route in inventoryService/routes ergänzt werden.
            // Hier simulieren wir den Fallback oder brechen ab.
            console.warn("Item nicht im Cache gefunden. Versuche Reload...");
            // return; // Aktuell return, da wir die API Route nicht kennen
        } catch (e) {
            console.error("Fehler beim Laden des Items", e);
        }
    }

    if (!item) {
        alert("Fehler: Artikeldaten konnten nicht gefunden werden.");
        return;
    }

    // Wir nutzen die SKU oder ID für den QR Code
    const codeContent = item.sku || item.id; 
    
    try {
        // QR Code generieren lassen (Backend call)
        const res = await fetch(`/api/qr/${encodeURIComponent(codeContent)}`);
        const data = await res.json();

        if (data.url) {
            const qrImg = document.getElementById('print-qr');
            const titleEl = document.getElementById('print-title');
            const skuEl = document.getElementById('print-sku');
            
            if(qrImg) qrImg.src = data.url;
            if(titleEl) titleEl.innerText = item.title ? item.title.substring(0, 30) : 'Unbekannt';
            if(skuEl) skuEl.innerText = item.sku || "Keine SKU";
            
            const modal = document.getElementById('print-modal');
            if(modal) modal.classList.add('open');
        } else {
            throw new Error("Keine URL erhalten");
        }
    } catch (e) {
        console.error(e);
        alert("Fehler beim QR-Code Generieren: " + e.message);
    }
};

/**
 * Führt den eigentlichen Druckbefehl aus.
 * Öffnet ein Popup, schreibt HTML hinein und druckt.
 */
window.printLabel = () => {
    const printArea = document.getElementById('print-area');
    if(!printArea) return;

    const content = printArea.innerHTML;
    const win = window.open('', 'LabelPrint', 'height=600,width=600');
    
    win.document.write('<html><head><title>Drucken</title>');
    // CSS für den Druck optimiert
    win.document.write(`
        <style>
            body { 
                font-family: 'Arial', sans-serif; 
                text-align: center; 
                margin: 0; 
                padding: 20px; 
            }
            .label-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            img { 
                width: 100%; 
                max-width: 250px; 
                height: auto;
            }
            h3 { margin: 10px 0 5px 0; font-size: 18px; }
            p { margin: 0; font-size: 14px; color: #555; }
        </style>
    `);
    win.document.write('</head><body>');
    win.document.write('<div class="label-container">' + content + '</div>');
    win.document.write('</body></html>');
    
    win.document.close(); // Wichtig für Rendering
    win.focus();

    // Kurze Verzögerung für Bilder-Laden
    setTimeout(() => {
        win.print();
        // Optional: Fenster danach schließen
        // win.close(); 
    }, 500);
};