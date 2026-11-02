const http = require('node:http');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const { openDatabase } = require('./src/db');
const repo = require('./src/repositories/products.repository');
const { createApp } = require('./src/app');

const dbPath = path.join(__dirname, '.debug-' + process.pid + '-' + randomUUID() + '.sqlite');
const database = openDatabase(dbPath);
const server = http.createServer(createApp({ database }));

(async () => {
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  repo.create(database, { name: 'Mouse', description: 'Mouse inalámbrico', category: 'Periféricos', price_cents: 100000, stock: 5 });
  repo.create(database, { name: 'Teclado', description: 'Teclado mecánico', category: 'Periféricos', price_cents: 90000, stock: 12 });

  const res = await fetch(`${base}/api/products/999999`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Mouse Pro',
      description: 'Mouse inalámbrico actualizado',
      category: 'Accesorios',
      price: '1500.00',
      stock: 99,
    }),
  });

  const text = await res.text();
  console.log('status=', res.status);
  console.log(text);

  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  database.close();
  for (const suffix of ['', '-journal', '-shm', '-wal']) {
    try { fs.unlinkSync(dbPath + suffix); } catch {}
  }
})();
