const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// MIME type mapping
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
};

// CORS middleware for Google Fonts
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://fonts.googleapis.com');
    res.header('Access-Control-Allow-Origin', 'https://fonts.gstatic.com');
    next();
});

// Middleware to set correct MIME types
app.use((req, res, next) => {
    const ext = path.extname(req.path);
    if (mimeTypes[ext]) {
        res.type(mimeTypes[ext]);
    }
    next();
});

// Clean URL middleware
app.use((req, res, next) => {
    // Skip if the request already has an extension
    if (path.extname(req.path)) {
        return next();
    }

    // Try different paths in order
    const tryPaths = [
        path.join(__dirname, '../public', req.path, 'index.html'),
        path.join(__dirname, '../public', `${req.path}.html`),
        path.join(__dirname, '../public', req.path)
    ];

    for (const tryPath of tryPaths) {
        if (fs.existsSync(tryPath)) {
            return res.sendFile(tryPath);
        }
    }

    next();
});

// Serve static files from the public directory with caching headers
app.use(express.static('public', {
    extensions: ['html'],
    index: 'index.html',
    setHeaders: (res, path) => {
        const ext = path.split('.').pop();
        
        // Set appropriate headers for different file types
        if (ext === 'css') {
            res.setHeader('Content-Type', 'text/css');
        } else if (ext === 'js') {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (['woff', 'woff2', 'ttf', 'eot'].includes(ext)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
        
        // Enable CORS for font files
        if (['woff', 'woff2', 'ttf', 'eot'].includes(ext)) {
            res.setHeader('Access-Control-Allow-Origin', '*');
        }
    }
}));

// Handle 404s
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
}); 