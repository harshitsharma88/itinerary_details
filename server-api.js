const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '100mb' }));
app.use(express.text({ type: 'text/html', limit: '100mb' }));

app.post('/generate-pdf', async (req, res) => {
    try {
        const html = typeof req.body === 'string' ? req.body : req.body.html;
        
        if (!html) {
            return res.status(400).json({ error: 'HTML content is required' });
        }

        // Using PDFShift API (free tier: 50 PDFs/month)
        const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('api:' + process.env.PDFSHIFT_API_KEY).toString('base64'),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                source: html,
                landscape: false,
                use_print: true
            })
        });

        if (!response.ok) {
            throw new Error('PDF generation failed');
        }

        const pdf = await response.arrayBuffer();
        const filename = req.body.filename || 'document.pdf';

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
            'Content-Length': pdf.byteLength
        });

        res.end(Buffer.from(pdf));
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`PDF service running on port ${PORT}`);
});
