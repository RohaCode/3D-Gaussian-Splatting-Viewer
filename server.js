const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8000;

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".splat": "application/octet-stream",
    ".spz": "application/octet-stream"
};

const server = http.createServer((req, res) => {
    // Decodes URL (e.g. for files with spaces or Russian characters)
    let safeUrl = req.url;
    try {
        safeUrl = decodeURIComponent(req.url);
    } catch (e) {
        console.error("URL decoding failed:", e);
    }

    // Strip query parameters
    const parsedUrl = new URL(safeUrl, `http://${req.headers.host || "localhost"}`);
    let filePath = parsedUrl.pathname;

    // Default to index.html if pointing to root
    if (filePath === "/") {
        filePath = "/index.html";
    }

    const viewerPath = path.join(__dirname, filePath);
    const rootPath = path.join(__dirname, "..", filePath);
    const rootDir = path.join(__dirname, "..");

    // Security check to prevent Directory Traversal attacks (lock to parent folder)
    if (!viewerPath.startsWith(rootDir) || !rootPath.startsWith(rootDir)) {
        res.statusCode = 403;
        res.end("403 Forbidden");
        console.log(`[Forbidden] ❌ ${req.method} ${req.url}`);
        return;
    }

    // Helper to resolve the correct path (prefer viewer folder first)
    const resolvePath = (cb) => {
        fs.stat(viewerPath, (viewerErr, viewerStats) => {
            if (!viewerErr && viewerStats.isFile()) {
                cb(viewerPath);
            } else {
                fs.stat(rootPath, (rootErr, rootStats) => {
                    if (!rootErr && rootStats.isFile()) {
                        cb(rootPath);
                    } else {
                        cb(null);
                    }
                });
            }
        });
    };

    resolvePath((resolvedPath) => {
        if (!resolvedPath) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end("404 Файл не найден");
            console.log(`[Not Found] 🔍 ${req.method} ${req.url}`);
            return;
        }

        const ext = path.extname(resolvedPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        // Enable CORS and Caching for performance
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Content-Type", contentType);
        
        // Cache static assets for 1 hour, except HTML which is fresh
        if (ext === ".html") {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        } else {
            res.setHeader("Cache-Control", "public, max-age=3600");
        }

        const stream = fs.createReadStream(resolvedPath);
        stream.on("error", (streamErr) => {
            console.error("Stream error:", streamErr);
            if (!res.headersSent) {
                res.statusCode = 500;
                res.end("500 Internal Server Error");
            }
        });
        
        stream.pipe(res);
        console.log(`[200 OK] ⚡ ${contentType} - ${req.url}`);
    });
});

server.listen(PORT, () => {
    console.log("\n==============================================");
    console.log(`🚀 Node.js static server is running successfully!`);
    console.log(`🔗 Local Address:  http://localhost:${PORT}`);
});
