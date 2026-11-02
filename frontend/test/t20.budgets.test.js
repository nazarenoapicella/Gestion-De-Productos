const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
}

test('la interfaz tiene un apartado de presupuestos con selección de producto y cantidad validada', () => {
  const html = read('index.html');
  for (const id of [
    'budgets-panel', 'budget-product-select', 'budget-product-quantity',
    'add-budget-item', 'budget-draft-list', 'budget-draft-total', 'generate-budget',
  ]) {
    assert.match(html, new RegExp(`\\bid=["']${id}["']`, 'i'));
  }
  assert.match(html, /<select[^>]+id="budget-product-select"[^>]*required/i);
  assert.match(html, /<input[^>]+id="budget-product-quantity"[^>]*type="number"[^>]*min="1"[^>]*step="1"/i);
  assert.match(html, /Inventario[\s\S]*Presupuestos/i);
});

test('la interfaz separa presupuestos pendientes del historial de pagados y rechazados', () => {
  const html = read('index.html');
  for (const id of [
    'pending-budgets-list', 'pending-budgets-empty', 'budget-history-list',
    'budget-history-table', 'budget-success', 'budgets-error',
  ]) {
    assert.match(html, new RegExp(`\\bid=["']${id}["']`, 'i'));
  }
  assert.match(html, /Pagado/i);
  assert.match(html, /Rechazado/i);
  assert.match(html, /(stock se reserva|unidades se reservan)/i);
});

test('el frontend integra creación, resolución y descarga del presupuesto mediante la API', () => {
  const api = read(path.join('js', 'api.js'));
  const app = read(path.join('js', 'app.js'));
  assert.match(api, /function\s+getBudgets[\s\S]*?\/api\/budgets/i);
  assert.match(api, /function\s+createBudget[\s\S]*?method:\s*["']POST["']/i);
  assert.match(api, /function\s+resolveBudget[\s\S]*?method:\s*["']PATCH["']/i);
  assert.match(api, /function\s+getBudgetPdf[\s\S]*?application\/pdf/i);
  assert.match(app, /quantity\s*<=\s*0|quantity\s*<\s*1/i);
  assert.match(app, /availableStock|product\.stock/i);
  assert.match(app, /createBudget\s*\(/i);
  assert.match(app, /resolveBudget\s*\(/i);
  assert.match(app, /URL\.createObjectURL/i);
});

test('el backend declara las rutas REST de presupuestos y el PDF', () => {
  const routes = read(path.join('..', 'backend', 'src', 'routes', 'budgets.routes.js'));
  assert.match(routes, /router\.post\(["']\/["']/);
  assert.match(routes, /router\.get\(["']\/["']/);
  assert.match(routes, /:id\/pdf/);
  assert.match(routes, /:id\/status/);
});

test('el repositorio reserva y devuelve stock con transacciones, y protege las transiciones de estado', () => {
  const repository = fs.readFileSync(path.resolve(__dirname, '..', '..', 'backend', 'src', 'repositories', 'budgets.repository.js'), 'utf8');
  const service = fs.readFileSync(path.resolve(__dirname, '..', '..', 'backend', 'src', 'services', 'budgets.service.js'), 'utf8');
  const pdf = fs.readFileSync(path.resolve(__dirname, '..', '..', 'backend', 'src', 'utils', 'budget-pdf.js'), 'utf8');
  assert.match(repository, /BEGIN IMMEDIATE/);
  assert.match(repository, /stock\s*=\s*stock\s*-\s*\?/);
  assert.match(repository, /stock\s*=\s*stock\s*\+\s*\?/);
  assert.match(repository, /BUDGET_ALREADY_RESOLVED/);
  assert.match(service, /quantity\s*<=\s*0/);
  assert.match(pdf, /%PDF-1\.4/);
});


test('los presupuestos se actualizan automáticamente sin un botón manual', () => {
  const html = read('index.html');
  const app = read(path.join('js', 'app.js'));

  assert.doesNotMatch(html, /id=["']refresh-budgets["']/i);
  assert.match(app, /async refresh\(\)[\s\S]*?loadBudgets\(\)[\s\S]*?loadBudgetProducts\(\)[\s\S]*?refreshInventory\(\)[\s\S]*?refreshSummary\(\)/);
  assert.match(app, /budgetsNavigationLink\?\.addEventListener\(["']click["'],\s*refreshBudgetsAutomatically\)/);
  assert.match(app, /window\.addEventListener\(["']focus["'],\s*refreshBudgetsAutomatically\)/);
  assert.match(app, /document\.addEventListener\(["']visibilitychange["']/);
});
