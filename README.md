# PDF Generation Service

Standalone service to generate PDFs from HTML using Puppeteer.

## Setup

```bash
npm install
npm start
```

## Usage

**POST /generate-pdf**

Send HTML as request body:

```javascript
// Option 1: Send as text/html
fetch('http://localhost:3000/generate-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'text/html' },
    body: '<html><body><h1>Hello</h1></body></html>'
});

// Option 2: Send as JSON
fetch('http://localhost:3000/generate-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        html: '<html><body><h1>Hello</h1></body></html>',
        filename: 'my-document.pdf'
    })
});
```

## Deploy to Render

1. Push to GitHub
2. Create new Web Service on Render
3. Set environment variable: `RENDER_SERVICE_URL=https://your-service.onrender.com`
4. Deploy

Auto-ping keeps service alive every 10 minutes.
