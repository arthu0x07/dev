const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3333;

const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, req.url === '/' ? '/portfolio.html' : req.url);
  const ext = path.extname(filePath);
  const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
