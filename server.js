const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const cron = require('node-cron');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '100mb' }));
app.use(express.text({ type: 'text/html', limit: '100mb' }));

let browser = null;

async function initBrowser() {
    if (!browser) {
        console.log('Initializing browser...');
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-breakpad',
                '--font-render-hinting=medium'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless
        });
    }
    return browser;
}

async function createPDF(html) {
    let page = null;
    try {
        await initBrowser();
        
        console.log('Creating new page...');
        page = await browser.newPage();
        page.setDefaultNavigationTimeout(120000);

        await page.setRequestInterception(true);
        page.on('request', async (request) => {
            request.continue();
        });

        await page.setContent(html, { waitUntil: 'load' });

        await page.evaluate(() => {
            const images = document.querySelectorAll('img');
            images.forEach(img => {
                img.setAttribute('loading', 'lazy');
                if (!img.style.maxWidth) {
                    img.style.maxWidth = '800px';
                }
            });
        });

        console.log('Generating PDF...');
        const pdf = await page.pdf({
            printBackground: true,
            format: 'A4',
            preferCSSPageSize: true,
            timeout: 0,
            quality: 85
        });

        console.log('PDF generated successfully');
        return pdf;
    } catch (error) {
        console.error('PDF creation error:', error);
        throw error;
    } finally {
        if (page) {
            try {
                await page.close();
            } catch (error) {
                console.error('Error closing page:', error);
            }
        }
    }
}

app.post('/generate-pdf', async (req, res) => {
    try {
        const html = typeof req.body === 'string' ? req.body : req.body.html;
        
        if (!html) {
            return res.status(400).json({ error: 'HTML content is required' });
        }

        const pdf = await createPDF(html);
        const filename = req.body.filename || 'document.pdf';

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
            'Content-Length': pdf.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        res.end(pdf);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`PDF service running on port ${PORT}`);
    initBrowser();
});

// Keep Render alive - ping every 10 minutes
const serviceUrl = "https://itinerary-playwright.onrender.com";
setInterval(() => {
    const url = serviceUrl + '/health';
    console.log('Pinging service:', url);
    https.get(url, (res) => {
        console.log('Ping response:', res.statusCode);
    }).on('error', (err) => {
        console.error('Ping error:', err.message);
    });
}, 10 * 60 * 1000); // 10 minutes

process.on('SIGTERM', async () => {
    if (browser) await browser.close();
    process.exit(0);
});