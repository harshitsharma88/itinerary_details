const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '100mb' }));
app.use(express.text({ type: 'text/html', limit: '100mb' }));

let browser = null;
let currentServerIndex = 0;
const servers = [
    { name: 'LOCAL', url: null },
    { name: 'RENDER-1', url: 'https://itinerary-playwright.onrender.com/generate-pdf' },
    { name: 'RENDER-2', url: 'https://itinerary-details-2.onrender.com/generate-pdf' },
    { name: 'RENDER-3', url: 'https://itinerary-details-4.onrender.com/generate-pdf' }
];

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

async function generatePDF_Render(html, filename, serverUrl, serverName) {
    const postData = JSON.stringify({ html, filename });
    const urlObj = new URL(serverUrl);
    const isHttps = urlObj.protocol === "https:";
    const client = isHttps ? https : http;

    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve, reject) => {
        const req = client.request(urlObj, options, async (res) => {
            if (res.statusCode !== 200) {
                console.warn(`❌ ${serverName} failed with status ${res.statusCode}`);
                return reject(new Error(`${serverName} failed`));
            }

            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
                console.log(`✅ PDF generated successfully on ${serverName}`);
                resolve(Buffer.concat(chunks));
            });
        });

        req.on("error", (error) => {
            console.warn(`❌ ${serverName} error: ${error.message}`);
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

async function generatePDFWithRoundRobin(html, filename, triedServers = []) {
    if (triedServers.length >= servers.length) {
        throw new Error("All servers failed to generate PDF");
    }

    const server = servers[currentServerIndex];
    currentServerIndex = (currentServerIndex + 1) % servers.length;

    if (triedServers.includes(server.name)) {
        return generatePDFWithRoundRobin(html, filename, triedServers);
    }

    console.log(`🔄 Attempting PDF generation on ${server.name}`);

    try {
        if (server.url === null) {
            const pdf = await createPDF(html);
            console.log(`✅ PDF generated successfully on ${server.name}`);
            return pdf;
        } else {
            return await generatePDF_Render(html, filename, server.url, server.name);
        }
    } catch (error) {
        console.warn(`❌ ${server.name} failed, trying next server...`);
        return generatePDFWithRoundRobin(html, filename, [...triedServers, server.name]);
    }
}

app.post('/generate-pdf', async (req, res) => {
    const html = typeof req.body === 'string' ? req.body : req.body.html;
    if (!html) {
        return res.status(400).json({ error: 'HTML content is required' });
    }
    const filename = req.body.filename || 'document.pdf';
    
    try {
        const pdf = await generatePDFWithRoundRobin(html, filename);

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
        console.error('❌ All servers failed:', error.message);
        res.status(500).json({ error: 'Failed to generate PDF on all servers' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`PDF service running on port ${PORT}`);
    initBrowser();
});


const serviceUrl = "https://itinerary-details.onrender.com";
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
