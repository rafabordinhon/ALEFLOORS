// Local test server for the site, with HTTP Range support (like Netlify).
// The home hero video (js/hero-video.js) is scrubbed by the scroll, which needs Range requests:
// python -m http.server doesn't support them, so the video would stay stuck on its first frame there.
// Usage, from the site root: node tools/serve.mjs   ->  http://127.0.0.1:8765/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 8765);
const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream',
    '.xml': 'application/xml', '.txt': 'text/plain',
};

http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    fs.stat(file, (error, stat) => {
        if (error || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
        const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
        const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
        if (range) {
            const start = range[1] ? Number(range[1]) : 0;
            const end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
            res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
            fs.createReadStream(file, { start, end }).pipe(res);
        } else {
            res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
            fs.createReadStream(file).pipe(res);
        }
    });
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} at http://127.0.0.1:${port}/`));
