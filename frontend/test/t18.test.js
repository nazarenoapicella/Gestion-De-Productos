const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const frontendRoot = path.resolve(__dirname, '..');

function readFrontend(relativePath) {
  const filePath = path.join(frontendRoot, relativePath);
  assert.ok(fs.existsSync(filePath), `Falta frontend/${relativePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function createTextNode(text) {
  return {
    textContent: String(text),
    parentNode: null,
  };
}

function createFakeDom(html) {
  const byId = new Map();
  const documentEvents = new Map();
  const elements = [];

  function makeElement(tagName) {
    const attributes = new Map();
    const listeners = new Map();
    const element = {
      tagName: tagName.toUpperCase(),
      children: [],
      parentNode: null,
      hidden: false,
      disabled: false,
      value: '',
      attributes,
      setAttribute(name, value) {
        const key = name.toLowerCase();
        attributes.set(key, String(value));
        if (key === 'id') byId.set(String(value), this);
        if (key === 'hidden') this.hidden = true;
        if (key === 'value') this.value = String(value);
      },
      getAttribute(name) {
        return attributes.get(name.toLowerCase()) ?? null;
      },
      hasAttribute(name) {
        return attributes.has(name.toLowerCase());
      },
      removeAttribute(name) {
        const key = name.toLowerCase();
        attributes.delete(key);
        if (key === 'hidden') this.hidden = false;
      },
      appendChild(child) {
        if (child.parentNode) {
          const index = child.parentNode.children.indexOf(child);
          if (index >= 0) child.parentNode.children.splice(index, 1);
        }
        this.children.push(child);
        child.parentNode = this;
        return child;
      },
      append(...children) {
        children.forEach((child) =>
          this.appendChild(typeof child === 'string' ? createTextNode(child) : child)
        );
      },
      replaceChildren(...children) {
        this.children.forEach((child) => { child.parentNode = null; });
        this.children = [];
        this.append(...children);
      },
      addEventListener(name, callback) {
        if (!listeners.has(name)) listeners.set(name, []);
        listeners.get(name).push(callback);
      },
      dispatch(name, event = {}) {
        const actualEvent = {
          target: this,
          currentTarget: this,
          defaultPrevented: false,
          preventDefault() { this.defaultPrevented = true; },
          ...event,
        };
        for (const callback of listeners.get(name) || []) callback(actualEvent);
        return actualEvent;
      },
      click() {
        return this.dispatch('click');
      },
      focus() {
        document.activeElement = this;
      },
      reset() {
        for (const control of queryAll(this, 'input, textarea, select')) {
          control.value = control.getAttribute('value') || '';
        }
      },
      querySelector(selector) {
        return queryAll(this, selector)[0] || null;
      },
      querySelectorAll(selector) {
        return queryAll(this, selector);
      },
    };

    Object.defineProperty(element, 'id', {
      get() { return attributes.get('id') || ''; },
      set(value) { this.setAttribute('id', value); },
    });
    Object.defineProperty(element, 'name', {
      get() { return attributes.get('name') || ''; },
      set(value) { this.setAttribute('name', value); },
    });
    Object.defineProperty(element, 'type', {
      get() { return attributes.get('type') || ''; },
      set(value) { this.setAttribute('type', value); },
    });
    Object.defineProperty(element, 'elements', {
      get() {
        if (this.tagName !== 'FORM') return undefined;
        const controls = queryAll(this, 'input, textarea, select, button');
        return new Proxy(controls, {
          get(target, property, receiver) {
            if (property === 'namedItem') {
              return (name) => target.find((control) => control.name === name || control.id === name) || null;
            }
            if (typeof property === 'string' && !/^\d+$/.test(property) && !(property in target)) {
              return target.find((control) => control.name === property || control.id === property);
            }
            return Reflect.get(target, property, receiver);
          },
        });
      },
    });
    Object.defineProperty(element, 'textContent', {
      get() {
        return (this._text || '') + this.children.map((child) => child.textContent).join('');
      },
      set(value) {
        this._text = String(value ?? '');
        this.replaceChildren();
      },
    });
    elements.push(element);
    return element;
  }

  function matches(element, selector) {
    const trimmed = selector.trim();
    const id = trimmed.match(/^#([\w-]+)$/);
    if (id) return element.id === id[1];
    const role = trimmed.match(/^\[role=["']?([^"'\]]+)["']?\]$/i);
    if (role) return element.getAttribute('role') === role[1];
    return /^[\w-]+$/.test(trimmed) && element.tagName.toLowerCase() === trimmed.toLowerCase();
  }

  function queryAll(root, selector) {
    const selectors = selector.split(',');
    const found = [];
    function matchesChain(element, chain) {
      const parts = chain.trim().split(/\s+/);
      if (!matches(element, parts[parts.length - 1])) return false;
      let ancestor = element.parentNode;
      for (let index = parts.length - 2; index >= 0; index -= 1) {
        while (ancestor && !matches(ancestor, parts[index])) ancestor = ancestor.parentNode;
        if (!ancestor) return false;
        ancestor = ancestor.parentNode;
      }
      return true;
    }
    function visit(parent) {
      for (const child of parent.children || []) {
        if (child.tagName && selectors.some((part) => matchesChain(child, part))) {
          found.push(child);
        }
        visit(child);
      }
    }
    visit(root);
    return found;
  }

  const document = {
    activeElement: null,
    createElement: makeElement,
    getElementById(id) { return byId.get(id) || null; },
    querySelector(selector) { return queryAll(root, selector)[0] || null; },
    querySelectorAll(selector) { return queryAll(root, selector); },
    addEventListener(name, callback) {
      if (!documentEvents.has(name)) documentEvents.set(name, []);
      documentEvents.get(name).push(callback);
    },
  };
  const root = makeElement('document');
  const stack = [root];
  const voidTags = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
    'meta', 'param', 'source', 'track', 'wbr',
  ]);
  const tagPattern = /<!--[\s\S]*?-->|<\/?([a-z][\w-]*)\b([^>]*)>/gi;
  let textStart = 0;
  for (const match of html.matchAll(tagPattern)) {
    const text = html.slice(textStart, match.index);
    if (text) stack[stack.length - 1].appendChild(createTextNode(text));
    textStart = match.index + match[0].length;
    if (match[0].startsWith('<!--')) continue;
    const tagName = match[1].toLowerCase();
    if (match[0].startsWith('</')) {
      const index = stack.findLastIndex((element) => element.tagName.toLowerCase() === tagName);
      if (index > 0) stack.length = index;
      continue;
    }
    const attrs = [...(match[2] || '').matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
      .map(([, name, doubleQuoted, singleQuoted, unquoted]) => [name, doubleQuoted ?? singleQuoted ?? unquoted ?? '']);
    const element = makeElement(tagName);
    attrs.forEach(([name, value]) => element.setAttribute(name, value));
    stack[stack.length - 1].appendChild(element);
    if (!voidTags.has(tagName) && !(match[2] || '').trimEnd().endsWith('/')) {
      stack.push(element);
    }
  }
  const trailingText = html.slice(textStart);
  if (trailingText) stack[stack.length - 1].appendChild(createTextNode(trailingText));

  return {
    document,
    elements,
    dispatchReady() {
      for (const callback of documentEvents.get('DOMContentLoaded') || []) callback();
    },
  };
}

function createApi(fetch) {
  const source = readFrontend(path.join('js', 'api.js')).replace(/\bexport\s+(?=(?:async\s+)?function)/g, '');
  const context = vm.createContext({ fetch, Promise, Error });
  new vm.Script(`${source}
    globalThis.apiFunctions = {
      getProducts: typeof getProducts === 'function' ? getProducts : null,
      adjustProductStock: typeof adjustProductStock === 'function' ? adjustProductStock : null,
    };
  `, { filename: 'frontend/js/api.js' }).runInContext(context);
  return context.apiFunctions;
}

function runApp(dom, api, deleteProduct = async () => {}) {
  const source = readFrontend(path.join('js', 'app.js'))
    .replace(/^\s*import\s+\{[^}]+\}\s+from\s+['"][^'"]*api\.js['"]\s*;?\s*$/gm, '');
  const context = vm.createContext({
    document: dom.document,
    window: { confirm: () => true },
    confirm: () => true,
    getProducts: api.getProducts,
    createProduct: async () => {},
    updateProduct: async () => {},
    adjustProductStock: api.adjustProductStock,
    deleteProduct,
    Promise,
    Error,
    console,
    setTimeout,
    clearTimeout,
  });
  new vm.Script(source, { filename: 'frontend/js/app.js' }).runInContext(context);
  dom.dispatchReady();
}

async function settlePromises() {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function isVisible(element) {
  for (let current = element; current; current = current.parentNode) {
    if (current.hidden || current.getAttribute?.('aria-hidden') === 'true') return false;
  }
  return Boolean(element);
}

function rowValues(row) {
  return row.children.filter((child) => child.tagName === 'TD').map((cell) => cell.textContent.trim());
}

const productsFixture = [
  {
    id: 1,
    name: 'Mouse inalámbrico',
    description: 'Mouse óptico',
    category: 'Periféricos',
    price: '1000.00',
    stock: 5,
    createdAt: '2026-10-28T12:00:00.000Z',
    updatedAt: '2026-10-28T12:00:00.000Z',
  },
  {
    id: 2,
    name: 'Teclado',
    description: 'Teclado mecánico',
    category: 'Periféricos',
    price: '2000.00',
    stock: 6,
    createdAt: '2026-10-28T12:00:00.000Z',
    updatedAt: '2026-10-28T12:00:00.000Z',
  },
];

function findInventoryRow(dom, productName) {
  return [...dom.document.querySelectorAll('tbody tr')].find((row) => rowValues(row)[0] === productName);
}

function createAdjustmentScreen({ failUpdate = false } = {}) {
  const inventory = productsFixture.map((product) => ({ ...product }));
  const dom = createFakeDom(readFrontend('index.html'));
  const requests = [];
  const fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    requests.push({ url, options: { ...options, method } });
    const parsedUrl = new URL(url, 'http://localhost');
    if (method === 'GET' && parsedUrl.pathname === '/api/products') {
      return {
        ok: true,
        status: 200,
        json: async () => inventory,
      };
    }
    if (method === 'PATCH' && parsedUrl.pathname === '/api/products/1/stock') {
      const body = JSON.parse(options.body || '{}');
      if (failUpdate) {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'La cantidad de ajuste no es válida.',
            },
          }),
        };
      }
      const product = inventory.find((entry) => entry.id === 1);
      const quantity = Number(body.quantity);
      if (body.operation === 'increase') product.stock += quantity;
      if (body.operation === 'decrease') product.stock -= quantity;
      return {
        ok: true,
        status: 200,
        json: async () => ({ ...product, stock: product.stock }),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const api = createApi(fetch);
  runApp(dom, api);
  return { dom, api, requests };
}

function findAdjustButton(dom, productName) {
  const buttons = [...dom.document.querySelectorAll('button')];
  return buttons.find((button) =>
    /ajustar stock/i.test(`${button.textContent} ${button.getAttribute('aria-label') || ''}`) &&
    (button.getAttribute('aria-label') || '').includes(productName)
  );
}

function findStockForm(dom) {
  const form = dom.document.getElementById('stock-adjustment-form');
  assert.ok(form, 'Debe existir un formulario accesible para ajustar el stock');
  return form;
}

test('T-18: el producto ofrece ajuste de stock y actualiza el stock visible tras una respuesta exitosa', async () => {
  const screen = createAdjustmentScreen();
  await settlePromises();

  const adjustButton = findAdjustButton(screen.dom, 'Mouse inalámbrico');
  assert.ok(adjustButton, 'Cada producto debe mostrar una acción accesible para ajustar el stock');
  adjustButton.click();
  await settlePromises();

  const form = findStockForm(screen.dom);
  const operation = form.elements.operation;
  const quantity = form.elements.quantity;
  assert.ok(operation, 'El formulario debe permitir elegir aumentar o disminuir');
  assert.ok(quantity, 'El formulario debe permitir ingresar una cantidad positiva');

  operation.value = 'increase';
  quantity.value = '2';
  form.dispatch('submit');
  await settlePromises();

  const row = findInventoryRow(screen.dom, 'Mouse inalámbrico');
  assert.ok(row, 'El producto debe seguir visible tras el ajuste de stock');
  assert.equal(rowValues(row)[3], '7');
  const patchRequest = screen.requests.find(({ url, options }) => {
    const parsed = new URL(url, 'http://localhost');
    return parsed.pathname === '/api/products/1/stock' && options.method === 'PATCH';
  });
  assert.ok(patchRequest, 'La interfaz debe llamar a PATCH /api/products/:id/stock');
  assert.equal(JSON.parse(patchRequest.options.body).quantity, 2);
  assert.equal(JSON.parse(patchRequest.options.body).operation, 'increase');
});

test('T-18: una cantidad inválida no modifica el stock y muestra el error del backend', async () => {
  const screen = createAdjustmentScreen({ failUpdate: true });
  await settlePromises();

  const adjustButton = findAdjustButton(screen.dom, 'Mouse inalámbrico');
  adjustButton.click();
  await settlePromises();

  const form = findStockForm(screen.dom);
  form.elements.operation.value = 'decrease';
  form.elements.quantity.value = '8';
  form.dispatch('submit');
  await settlePromises();

  const row = findInventoryRow(screen.dom, 'Mouse inalámbrico');
  assert.equal(rowValues(row)[3], '5');
  const error = screen.dom.document.getElementById('stock-adjustment-error');
  assert.ok(error, 'Debe mostrar un mensaje de error accesible para la operación inválida');
  assert.match(error.textContent, /La cantidad de ajuste no es válida/i);
});
