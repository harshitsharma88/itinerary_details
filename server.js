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

async function initBrowser() {
    if (!browser) {
        console.log('Initializing browser...');
        browser = await puppeteer.launch({
            args: chromium.args,
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

        await page.setContent(html, { waitUntil: 'networkidle0' });

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

async function generatePDF_Render(html, filename = "document.pdf", maxRetries = 2, triedUrls = []) {
    const pdfServiceUrls = [
        "https://itinerary-details.onrender.com/generate-pdf",
        "https://itinerary-details-2.onrender.com/generate-pdf"
    ];

    const availableUrls = pdfServiceUrls.filter(url => !triedUrls.includes(url));

    if (availableUrls.length === 0) {
        throw new Error("All PDF service URLs failed.");
    }

    const selectedUrl = availableUrls[Math.floor(Math.random() * availableUrls.length)];
    const postData = JSON.stringify({ html, filename });
    const urlObj = new URL(selectedUrl);
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
                console.warn(`Service failed (${selectedUrl}) with status ${res.statusCode}`);

                if (maxRetries > 0) {
                    return resolve(
                        generatePDF_Render(html, filename, maxRetries - 1, [...triedUrls, selectedUrl])
                    );
                }

                return reject(new Error(`PDF generation failed at all URLs.`));
            }

            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
                console.log(`PDF generated from ${selectedUrl}`);
                resolve(Buffer.concat(chunks));
            });
        });

        req.on("error", async (error) => {
            console.warn(`Error on ${selectedUrl}: ${error.message}`);

            if (maxRetries > 0) {
                return resolve(
                    generatePDF_Render(html, filename, maxRetries - 1, [...triedUrls, selectedUrl])
                );
            }

            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

app.post('/generate-pdf', async (req, res) => {
    try {
        const html = typeof req.body === 'string' ? req.body : req.body.html;
        
        if (!html) {
            return res.status(400).json({ error: 'HTML content is required' });
        }

        const filename = req.body.filename || 'document.pdf';
        
        // Random choice: 50% local, 50% external load balancer
        const useLocal = Math.random() < 0.5;
        const pdf = useLocal 
            ? await createPDF(html)
            : await generatePDF_Render(html, filename);

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
