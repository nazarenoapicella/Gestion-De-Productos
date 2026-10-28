const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function readDeliverable(relativePath) {
  const filePath = path.resolve(__dirname, '..', relativePath);
  assert.ok(fs.existsSync(filePath), `Falta frontend/${relativePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

test('la API del frontend consulta el resumen del inventario desde /api/summary', () => {
  const api = readDeliverable(path.join('js', 'api.js'));

  assert.match(api, /export\s+async\s+function\s+getSummary|function\s+getSummary/i);
  assert.match(api, /['"`]\/api\/summary['"`]/i);
  assert.match(api, /method\s*:\s*['"]GET['"]/i);
});

test('la página expone el resumen del inventario con indicadores accesibles y el app los actualiza', () => {
  const html = readDeliverable('index.html');
  const app = readDeliverable(path.join('js', 'app.js'));

  for (const id of ['summary-panel', 'summary-products', 'summary-units', 'summary-low-stock']) {
    assert.match(html, new RegExp(`\\bid=["']${id}["']`, 'i'));
  }

  assert.match(html, /Productos registrados|Unidades en stock|Productos con stock bajo/i);
  assert.match(app, /getSummary\s*\(|renderSummary|loadSummary|summary-products|summary-units|summary-low-stock/i);
  assert.match(app, /productsCount|unitsInStock|lowStockCount/i);
});
