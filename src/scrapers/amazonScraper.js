// src/scrapers/amazonScraper.js
const { getBrowser } = require('./chat/connection');
const logger = require('../utils/logger');

const randomSleep = (min, max) => new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1) + min)));

// Menschliches Scrollen simulieren
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight - window.innerHeight || totalHeight > 4000) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

async function searchAmazon(query, pageNum = 1) {
    const browser = await getBrowser();
    if (!browser) {
        logger.log('error', 'Amazon Scraper: Kein Browser verfügbar.');
        return [];
    }
    
    const page = await browser.newPage();
    
    try {
        await page.setViewport({ width: 1366, height: 768 });
        
        // Stealth Header
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
        });

        const searchUrl = `https://www.amazon.de/s?k=${encodeURIComponent(query)}&page=${pageNum}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        try { 
            const cookieBtn = await page.waitForSelector('#sp-cc-accept', {timeout: 2000}); 
            if(cookieBtn) {
                await randomSleep(500, 1000);
                await cookieBtn.click();
            }
        } catch(e){}

        await randomSleep(1000, 2000); 

        const results = await page.evaluate(() => {
            const items = document.querySelectorAll('div[data-component-type="s-search-result"]');
            const data = [];
            
            items.forEach(item => {
                try {
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
                        if (offscreen) price = offscreen.innerText.replace('€', '').replace('.', '').trim(); 
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
                } catch (err) {}
            });
            return data;
        });
        
        await page.close();
        return results;

    } catch(e) { 
        logger.log('error', `Amazon Search Fehler (${query}): ${e.message}`);
        if(!page.isClosed()) await page.close();
        return []; 
    }
}

async function scrapeAmazonDetails(url) {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    try {
        await page.setViewport({ width: 1400, height: 900 });
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        
        try { 
            const cookieBtn = await page.waitForSelector('#sp-cc-accept', {timeout: 2000}); 
            if(cookieBtn) await cookieBtn.click();
        } catch(e){}

        // WICHTIG: Runterscrollen für Bilder
        await autoScroll(page);
        await randomSleep(1000, 2000);

        // --- ENERGIELABEL SUCHE ---
        let energyLabelUrl = "Unbekannt";
        try {
            const badgeSelectors = ['.s-energy-efficiency-badge-standard', 'svg[class*="energy-efficiency"]', '#energyEfficiencyLabel_feature_div img'];
            let badge = null;
            for (const sel of badgeSelectors) {
                badge = await page.$(sel);
                if (badge) break;
            }

            if (badge) {
                const isImg = await page.evaluate(el => el.tagName === 'IMG', badge);
                if(isImg) {
                    energyLabelUrl = await page.evaluate(el => el.src, badge);
                } else {
                    await badge.click();
                    await randomSleep(1000, 2000); 
                    energyLabelUrl = await page.evaluate(() => {
                        const img = document.querySelector('.a-popover-content img') || document.querySelector('#energy-label-popover img');
                        return img ? img.src : "Unbekannt";
                    });
                }
            }
        } catch(e) {}

        const details = await page.evaluate((eLabel) => {
            const titleEl = document.querySelector('#productTitle');
            if (!titleEl) return null;
            const title = titleEl.innerText.trim();
            
            let price = '';
            const whole = document.querySelector('.a-price-whole');
            const fraction = document.querySelector('.a-price-fraction');
            
            if (whole && fraction) {
                 price = whole.innerText.replace('.', '') + "," + fraction.innerText; 
            } else {
                 const pEl = document.querySelector('.a-price .a-offscreen');
                 if(pEl) price = pEl.innerText.replace('€','').replace('.', '').trim();
            }

            const bullets = Array.from(document.querySelectorAll('#feature-bullets li span'))
                .map(el => el.innerText.trim())
                .filter(text => text.length > 0)
                .join('\n');
            
            const images = [];
            const imgContainer = document.querySelector('#imgTagWrapperId img');
            if(imgContainer) {
                const dyn = imgContainer.getAttribute('data-a-dynamic-image');
                if(dyn) {
                    try {
                        const urls = JSON.parse(dyn);
                        Object.keys(urls).forEach(u => images.push(u));
                    } catch(e) { images.push(imgContainer.src); }
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

        if (details && energyLabelUrl !== "Unbekannt") {
            if (!details.images.includes(energyLabelUrl)) {
                if (details.images.length > 0) {
                    details.images.splice(1, 0, energyLabelUrl);
                } else {
                    details.images.push(energyLabelUrl);
                }
            }
        }

        await page.close();
        return details;
    } catch(e) { 
        logger.log('error', `Amazon Details Scrape Fehler: ${e.message}`);
        if(!page.isClosed()) await page.close();
        return null; 
    }
}

module.exports = { searchAmazon, scrapeAmazonDetails };