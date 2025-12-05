// src/scrapers/amazonScraper.js
const { getBrowser } = require('./chat/connection');
const logger = require('../utils/logger');

const randomSleep = (min, max) => new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1) + min)));

async function searchAmazon(query, pageNum = 1) {
    const browser = await getBrowser();
    if (!browser) return [];
    
    const page = await browser.newPage();
    
    try {
        await page.setViewport({ width: 1366, height: 768 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(`https://www.amazon.de/s?k=${encodeURIComponent(query)}&page=${pageNum}`, { waitUntil: 'domcontentloaded' });
        
        try { 
            const cookieBtn = await page.waitForSelector('#sp-cc-accept', {timeout: 2000}); 
            if(cookieBtn) await cookieBtn.click();
        } catch(e){}

        await randomSleep(500, 1500); 

        const results = await page.evaluate(() => {
            const items = document.querySelectorAll('div[data-component-type="s-search-result"]');
            const data = [];
            
            items.forEach(item => {
                const titleEl = item.querySelector('h2 span');
                const linkEl = item.querySelector('div[data-cy="title-recipe"] a') || item.querySelector('h2 a');
                const imgEl = item.querySelector('img.s-image');
                
                let price = "0";
                const whole = item.querySelector('.a-price-whole');
                const fraction = item.querySelector('.a-price-fraction');
                
                if (whole && fraction) {
                    price = whole.innerText.replace('.', '') + "," + fraction.innerText; 
                } else {
                    const offscreen = item.querySelector('.a-price .a-offscreen');
                    if (offscreen) {
                        price = offscreen.innerText.replace('€', '').replace('.', '').trim(); 
                    }
                }

                if (titleEl && linkEl) {
                    let link = linkEl.href;
                    if(!link.startsWith('http')) link = 'https://www.amazon.de' + link;
                    
                    data.push({
                        title: titleEl.innerText.trim(),
                        price: price, 
                        img: imgEl ? imgEl.src : '',
                        url: link,
                        source: 'Amazon'
                    });
                }
            });
            return data;
        });
        
        await page.close();
        return results;
    } catch(e) { 
        if(!page.isClosed()) await page.close();
        return []; 
    }
}

async function scrapeAmazonDetails(url) {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    try {
        await page.setViewport({ width: 1400, height: 900 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await randomSleep(1500, 3000); 

        // --- ENERGIELABEL SUCHE ---
        let energyLabelUrl = "Unbekannt";
        try {
            // Verschiedene Selektoren probieren
            const badgeSelectors = [
                '.s-energy-efficiency-badge-standard', 
                'svg[class*="energy-efficiency"]',
                '#energyEfficiencyLabel_feature_div img', // Manchmal direkt da
                'a[href*="energy_efficiency"]'
            ];
            
            let badge = null;
            for (const sel of badgeSelectors) {
                badge = await page.$(sel);
                if (badge) break;
            }

            if (badge) {
                // Prüfen ob es direkt ein Bild ist
                const isImg = await page.evaluate(el => el.tagName === 'IMG', badge);
                if(isImg) {
                    energyLabelUrl = await page.evaluate(el => el.src, badge);
                } else {
                    // Sonst klicken für Popover
                    await badge.click();
                    await randomSleep(1000, 2000); 
                    energyLabelUrl = await page.evaluate(() => {
                        const img = document.querySelector('.a-popover-content img') || document.querySelector('#energy-label-popover img');
                        return img ? img.src : "Unbekannt";
                    });
                }
            }
        } catch(e) {
            logger.log('warning', "Amazon E-Label Fehler: " + e.message);
        }

        const details = await page.evaluate((eLabel) => {
            const title = document.querySelector('#productTitle')?.innerText.trim();
            if (!title) return null;
            
            let price = '';
            const whole = document.querySelector('.a-price-whole');
            const fraction = document.querySelector('.a-price-fraction');
            
            if (whole && fraction) {
                 price = whole.innerText.replace('.', '') + "," + fraction.innerText; 
            } else {
                 const pEl = document.querySelector('.a-price .a-offscreen');
                 if(pEl) price = pEl.innerText.replace('€','').replace('.', '').trim();
            }

            const bullets = Array.from(document.querySelectorAll('#feature-bullets li span')).map(el => el.innerText.trim()).join('\n');
            
            const images = [];
            const imgContainer = document.querySelector('#imgTagWrapperId img');
            if(imgContainer) {
                const dyn = imgContainer.getAttribute('data-a-dynamic-image');
                if(dyn) {
                    const urls = JSON.parse(dyn);
                    Object.keys(urls).forEach(u => images.push(u));
                } else {
                    images.push(imgContainer.src);
                }
            }

            const techData = [];
            document.querySelectorAll('#productDetails_techSpec_section_1 tr').forEach(r => {
                const k = r.querySelector('th')?.innerText.trim();
                const v = r.querySelector('td')?.innerText.trim();
                if(k && v) techData.push(`${k}: ${v}`);
            });

            return { 
                title, price, description: bullets, techData, 
                images: images.slice(0, 10), 
                energyLabel: eLabel, 
                url: document.location.href 
            };
        }, energyLabelUrl);

        // --- ENERGIELABEL EINFÜGEN (Position 2) ---
        if (details && energyLabelUrl !== "Unbekannt") {
            if (!details.images.includes(energyLabelUrl)) {
                if (details.images.length > 0) {
                    // Als 2. Bild einfügen
                    details.images.splice(1, 0, energyLabelUrl);
                } else {
                    details.images.push(energyLabelUrl);
                }
            }
        }

        await page.close();
        return details;
    } catch(e) { 
        if(!page.isClosed()) await page.close();
        return null; 
    }
}

module.exports = { searchAmazon, scrapeAmazonDetails };