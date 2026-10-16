const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const handler = require('../api/resume');
const root = path.resolve(__dirname, '../dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.wasm': 'application/wasm' };
const server = http.createServer(async (req, res) => {
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
  res.send = body => res.end(body);
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/api/resume') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 2000000) return res.status(413).json({ error: 'Arquivo muito grande.' });
      }
      req.body = body;
      return await handler(req, res);
    }
    const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!filename.startsWith(root + path.sep)) return res.status(403).send('Forbidden');
    const data = await fs.readFile(filename);
    res.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream');
    res.end(data);
  } catch { res.status(404).send('Not found'); }
});
if (require.main === module) {
  const requestedPort = Number(process.env.PORT) || 3000;
  server.once('listening', () => console.log(`Currículo SIDY: http://localhost:${server.address().port}`));
  const listen = port => {
    server.once('error', error => {
      if (!process.env.PORT && error.code === 'EADDRINUSE' && port < 3010) {
        console.log(`Porta ${port} ocupada; tentando ${port + 1}...`);
        return listen(port + 1);
      }
      console.error(`Não foi possível iniciar o servidor na porta ${port}: ${error.message}`);
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1');
  };
  listen(requestedPort);
}
module.exports = server;
