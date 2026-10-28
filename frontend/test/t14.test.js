const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const frontendRoot = path.resolve(__dirname, '..');
let focusedElement = null;

function readFrontend(relativePath) {
  const filePath = path.join(frontendRoot, relativePath);
  assert.ok(fs.existsSync(filePath), `Falta frontend/${relativePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function createElement(tagName, attributes, byId, allElements) {
  const element = {
    tagName: tagName.toUpperCase(),
    attributes: new Map(),
    children: [],
    parentNode: null,
    hidden: false,
    value: '',
    listeners: new Map(),
    setAttribute(name, value) {
      this.attributes.set(name.toLowerCase(), String(value));
      if (name.toLowerCase() === 'id') {
        byId.set(String(value), this);
      }
      if (name.toLowerCase() === 'hidden') this.hidden = true;
      if (name.toLowerCase() === 'value') this.value = String(value);
    },
    getAttribute(name) {
      return this.attributes.get(name.toLowerCase()) ?? null;
    },
    hasAttribute(name) {
      return this.attributes.has(name.toLowerCase());
    },
    removeAttribute(name) {
      this.attributes.delete(name.toLowerCase());
      if (name.toLowerCase() === 'hidden') this.hidden = false;
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
    reset() {
      for (const control of queryAll(this, 'input, textarea, select')) {
        control.value = control.getAttribute('value') || '';
      }
    },
    focus() {
      focusedElement = this;
    },
    addEventListener(name, callback) {
      if (!this.listeners.has(name)) this.listeners.set(name, []);
      this.listeners.get(name).push(callback);
    },
    dispatch(name, event = {}) {
      const actualEvent = {
        target: this,
        currentTarget: this,
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        ...event
      };
      for (const callback of this.listeners.get(name) || []) {
        callback(actualEvent);
      }
      return actualEvent;
    },
    click() {
      return this.dispatch('click');
    },
    querySelector(selector) {
      return queryAll(this, selector)[0] || null;
    },
    querySelectorAll(selector) {
      return queryAll(this, selector);
    }
  };

  Object.defineProperty(element, 'id', {
    get() { return this.getAttribute('id') || ''; },
    set(value) { this.setAttribute('id', value); }
  });
  Object.defineProperty(element, 'type', {
    get() { return this.getAttribute('type') || ''; },
    set(value) { this.setAttribute('type', value); }
  });
  Object.defineProperty(element, 'name', {
    get() { return this.getAttribute('name') || ''; },
    set(value) { this.setAttribute('name', value); }
  });
  Object.defineProperty(element, 'elements', {
    get() {
      if (this.tagName !== 'FORM') return undefined;
      const controls = queryAll(this, 'input, textarea, select, button, fieldset, object, output');
      return new Proxy(controls, {
        get(target, property, receiver) {
          if (property === 'namedItem') {
            return (name) => target.find((control) =>
              control.name === name || control.id === name
            ) || null;
          }
          if (typeof property === 'string' && !/^\d+$/.test(property) && !(property in target)) {
            return target.find((control) =>
              control.name === property || control.id === property
            );
          }
          return Reflect.get(target, property, receiver);
        }
      });
    }
  });
  Object.defineProperty(element, 'textContent', {
    get() {
      return (this._text || '') + this.children.map((child) => child.textContent).join('');
    },
    set(value) {
      this._text = String(value ?? '');
      this.replaceChildren();
    }
  });

  for (const [name, value] of attributes) element.setAttribute(name, value);
  allElements.push(element);
  return element;
}

function createTextNode(text) {
  return { textContent: String(text), parentNode: null };
}

function matches(element, selector) {
  const trimmed = selector.trim();
  const id = trimmed.match(/^#([\w-]+)$/);
  if (id) return element.id === id[1];
  const named = trimmed.match(/^\[name=["']?([^"'\]]+)["']?\]$/i);
  if (named) return element.getAttribute('name') === named[1];
  const namedTag = trimmed.match(/^([\w-]+)\[name=["']?([^"'\]]+)["']?\]$/i);
  if (namedTag) {
    return element.tagName.toLowerCase() === namedTag[1].toLowerCase() &&
      element.getAttribute('name') === namedTag[2];
  }
  return /^[\w-]+$/.test(trimmed) &&
    element.tagName.toLowerCase() === trimmed.toLowerCase();
}

function queryAll(root, selector) {
  const selectors = selector.split(',');
  const found = [];
  function matchesSelectorChain(element, selectorChain) {
    const parts = selectorChain.trim().split(/\s+/);
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
      if (child.tagName && selectors.some((part) => matchesSelectorChain(child, part))) {
        found.push(child);
      }
      visit(child);
    }
  }
  visit(root);
  return found;
}

function createFakeDom(html) {
  const byId = new Map();
  const elements = [];
  const root = createElement('document', [], byId, elements);
  const stack = [root];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const events = new Map();
  const tagPattern = /<!--[\s\S]*?-->|<\/?([a-z][\w-]*)\b([^>]*)>/gi;

  let textStart = 0;
  for (const match of html.matchAll(tagPattern)) {
    const text = html.slice(textStart, match.index);
    if (text) stack[stack.length - 1].appendChild(createTextNode(text));
    textStart = match.index + match[0].length;
    if (match[0].startsWith('<!--')) continue;
    const tagName = match[1].toLowerCase();
    const isClosing = match[0].startsWith('</');
    if (isClosing) {
      const index = stack.findLastIndex((element) => element.tagName.toLowerCase() === tagName);
      if (index > 0) stack.length = index;
      continue;
    }

    const rawAttributes = match[2] || '';
    const attributes = [...rawAttributes.matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
      .map(([, name, doubleQuoted, singleQuoted, unquoted]) => [
        name,
        doubleQuoted ?? singleQuoted ?? unquoted ?? ''
      ]);
    const element = createElement(tagName, attributes, byId, elements);
    stack[stack.length - 1].appendChild(element);
    if (!voidTags.has(tagName) && !rawAttributes.trimEnd().endsWith('/')) stack.push(element);
  }
  const trailingText = html.slice(textStart);
  if (trailingText) stack[stack.length - 1].appendChild(createTextNode(trailingText));

  const document = {
    get activeElement() {
      return focusedElement;
    },
    createElement(tagName) {
      return createElement(tagName, [], byId, elements);
    },
    getElementById(id) {
      return byId.get(id) || null;
    },
    querySelector(selector) {
      return queryAll(root, selector)[0] || null;
    },
    querySelectorAll(selector) {
      return queryAll(root, selector);
    },
    addEventListener(name, callback) {
      if (!events.has(name)) events.set(name, []);
      events.get(name).push(callback);
    },
    dispatchReady() {
      for (const callback of events.get('DOMContentLoaded') || []) callback();
    }
  };

  return { document, elements, dispatchReady: () => document.dispatchReady() };
}

function createApi(fetch) {
  const apiSource = readFrontend(path.join('js', 'api.js'))
    .replace(/\bexport\s+(?=(?:async\s+)?function)/g, '');
  const context = vm.createContext({ fetch, Promise, Error });
  const exposeApi = `
    globalThis.apiFunctions = {
      getProducts: typeof getProducts === "function" ? getProducts : null,
      createProduct: typeof createProduct === "function" ? createProduct : null
    };
  `;
  new vm.Script(`${apiSource}\n${exposeApi}`, { filename: 'frontend/js/api.js' })
    .runInContext(context);
  return context.apiFunctions;
}

async function settlePromises() {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function runScreen({ errorOnCreate = false } = {}) {
  const html = readFrontend('index.html');
  const appSource = readFrontend(path.join('js', 'app.js'));
  const dom = createFakeDom(html);
  const requests = [];
  const products = [];
  let nextId = 1;
  const fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if ((options.method || 'GET') === 'GET') {
      return { ok: true, status: 200, json: async () => products.slice() };
    }
    if (errorOnCreate) {
      return {
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'El precio debe ser no negativo.'
          }
        })
      };
    }
    const input = JSON.parse(options.body);
    const product = {
      id: nextId++,
      ...input,
      description: input.description || null,
      createdAt: '2026-10-28T12:00:00.000Z',
      updatedAt: '2026-10-28T12:00:00.000Z'
    };
    products.push(product);
    return { ok: true, status: 201, json: async () => product };
  };

  const api = createApi(fetch);
  const imports = /^\s*import\s+\{[^}]+\}\s+from\s+['"][^'"]*api\.js['"]\s*;?\s*$/gm;
  const executableApp = appSource.replace(imports, '');
  const context = vm.createContext({
    document: dom.document,
    getProducts: api.getProducts,
    createProduct: api.createProduct,
    console,
    Promise,
    Error,
    setTimeout,
    clearTimeout
  });
  new vm.Script(executableApp, { filename: 'frontend/js/app.js' }).runInContext(context);
  dom.dispatchReady();
  await settlePromises();

  return { ...dom, requests, products, settle: settlePromises };
}

function isVisible(element) {
  if (!element) return false;
  for (let current = element; current; current = current.parentNode) {
    if (current.hidden || current.getAttribute?.('aria-hidden') === 'true') return false;
  }
  return true;
}

function visibleText(dom) {
  return dom.elements
    .filter(isVisible)
    .flatMap((element) => [
      element._text || '',
      ...element.children
        .filter((child) => !child.tagName)
        .map((child) => child.textContent)
    ])
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function accessibleName(control, dom) {
  const ariaLabel = control.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  const labelledBy = control.getAttribute('aria-labelledby');
  if (labelledBy) {
    return labelledBy.split(/\s+/)
      .map((id) => dom.document.getElementById(id)?.textContent || '')
      .join(' ')
      .trim();
  }
  const id = control.id;
  const explicitLabel = dom.document.querySelectorAll('label')
    .find((label) => label.getAttribute('for') === id);
  if (explicitLabel) return explicitLabel.textContent.trim();
  let parent = control.parentNode;
  while (parent && parent.tagName !== 'LABEL') parent = parent.parentNode;
  return parent?.textContent.trim() || '';
}

function findCreateControl(dom) {
  return dom.elements.find((element) =>
    ['button', 'a', 'input'].includes(element.tagName.toLowerCase()) &&
    /\b(?:agregar|añadir|crear|registrar|nuevo producto)\b/i.test(
      `${element.textContent} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('value') || ''}`
    )
  );
}

function openCreateForm(dom) {
  const control = findCreateControl(dom);
  assert.ok(control, 'Debe existir un control real para iniciar el alta');
  control.click();
  const form = dom.document.querySelector('form');
  assert.ok(form && isVisible(form), 'El control de alta debe abrir el formulario');
  assert.equal(dom.document.activeElement, dom.document.getElementById('product-name'),
    'Al abrir el formulario, el foco debe pasar al campo nombre');
  return form;
}

function field(form, name) {
  const control = form.querySelector(`[name="${name}"]`);
  assert.ok(control, `El formulario debe incluir el campo ${name}`);
  return control;
}

function fillValidProduct(form, { description = '' } = {}) {
  field(form, 'name').value = 'Mouse';
  field(form, 'category').value = 'Periféricos';
  field(form, 'price').value = '1250.50';
  field(form, 'stock').value = '5';
  const descriptionControl = form.querySelector('[name="description"]');
  if (descriptionControl) descriptionControl.value = description;
}

function submitForm(form) {
  const event = form.dispatch('submit');
  assert.ok(event.defaultPrevented, 'El envío debe controlarse sin recargar la página');
}

test('el alta se alcanza desde un control real y sus campos tienen etiquetas accesibles', async () => {
  const dom = await runScreen();
  const form = openCreateForm(dom);

  for (const name of ['name', 'category', 'price', 'stock', 'description']) {
    const control = field(form, name);
    assert.ok(accessibleName(control, dom), `El campo ${name} necesita etiqueta accesible`);
  }
  assert.ok(field(form, 'name').hasAttribute('required'));
  assert.ok(field(form, 'category').hasAttribute('required'));
  assert.ok(field(form, 'price').hasAttribute('required'));
  assert.ok(field(form, 'stock').hasAttribute('required'));
  assert.equal(field(form, 'description').hasAttribute('required'), false);
  assert.equal(field(form, 'description').getAttribute('maxlength'), '500');
  assert.equal(form.elements.name, field(form, 'name'));
  assert.equal(form.elements.namedItem('name'), field(form, 'name'));
  field(form, 'name').value = 'Temporal';
  form.reset();
  assert.equal(field(form, 'name').value, '');
});

test('el precio se valida como texto decimal no negativo con hasta dos decimales', async () => {
  const dom = await runScreen();
  const form = openCreateForm(dom);
  const price = field(form, 'price');
  if (price.type === 'number') {
    assert.equal(price.getAttribute('min'), '0');
    assert.ok(['0.01', '0,01'].includes(price.getAttribute('step')),
      'El precio debe aceptar centavos y rechazar más de dos decimales');
  } else {
    const pattern = price.getAttribute('pattern');
    assert.ok(pattern, 'El campo precio debe restringir el formato decimal admitido');
    const accepted = new RegExp(`^(?:${pattern})$`);

    for (const value of ['0', '1250', '1250.50', '1.2']) {
      assert.equal(accepted.test(value), true, `Debe aceptar ${value}`);
    }
    for (const value of ['-1', 'abc', '1.001', '1e3', '1,000']) {
      assert.equal(accepted.test(value), false, `Debe rechazar ${value}`);
    }
  }
});

test('el stock inicial se limita a enteros no negativos y admite cero', async () => {
  const dom = await runScreen();
  const form = openCreateForm(dom);
  const stock = field(form, 'stock');

  assert.ok(stock.hasAttribute('required'));
  if (stock.type === 'number') {
    assert.equal(stock.getAttribute('min'), '0');
    assert.equal(stock.getAttribute('step'), '1');
  } else {
    const pattern = stock.getAttribute('pattern');
    assert.ok(pattern, 'Un campo de stock textual debe expresar su restricción de entero');
    const accepted = new RegExp(`^(?:${pattern})$`);
    for (const value of ['0', '5']) assert.equal(accepted.test(value), true);
    for (const value of ['-1', '1.5', 'abc']) assert.equal(accepted.test(value), false);
  }
});

test('la descripción es opcional, permite vacío y limita la longitud a 500 caracteres', async () => {
  const dom = await runScreen();
  const form = openCreateForm(dom);
  const description = field(form, 'description');

  assert.equal(description.hasAttribute('required'), false);
  assert.equal(description.getAttribute('maxlength'), '500');
});

test('el módulo API envía POST JSON y preserva price como texto decimal exacto', async () => {
  const calls = [];
  const api = createApi(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 1,
        name: 'Mouse',
        category: 'Periféricos',
        price: '1250.50',
        stock: 5
      })
    };
  });

  assert.equal(typeof api.createProduct, 'function', 'api.js debe exponer createProduct');
  await api.createProduct({
    name: 'Mouse',
    category: 'Periféricos',
    price: '1250.50',
    stock: 5,
    description: ''
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/products');
  assert.equal(calls[0].options.method, 'POST');
  assert.match(calls[0].options.headers['Content-Type'] || calls[0].options.headers['content-type'] || '', /application\/json/i);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    name: 'Mouse',
    category: 'Periféricos',
    price: '1250.50',
    stock: 5,
    description: ''
  });
});

test('el envío válido muestra éxito y añade el producto al listado después de actualizar por GET', async () => {
  const dom = await runScreen();
  const form = openCreateForm(dom);
  fillValidProduct(form);
  submitForm(form);
  await dom.settle();

  const post = dom.requests.find(({ options }) => options.method === 'POST');
  assert.ok(post, 'El formulario debe enviar POST /api/products');
  assert.equal(post.url, '/api/products');
  assert.equal(JSON.parse(post.options.body).price, '1250.50');
  assert.match(visibleText(dom), /cread|registrad|guardad|éxit/i);
  assert.ok(dom.requests.filter(({ options }) => !options.method || options.method === 'GET').length >= 2,
    'Después del POST debe volver a consultar el listado');
  const rows = dom.document.querySelectorAll('tbody tr');
  assert.ok(rows.some((row) => row.textContent.includes('Mouse') && row.textContent.includes('1250.50')));
  assert.ok(!isVisible(form) || ['name', 'category', 'price', 'stock']
    .every((name) => field(form, name).value === ''),
  'Tras el alta exitosa, el formulario debe cerrarse o limpiarse');
});

test('un error 400 comprensible no anuncia éxito y conserva los datos ingresados', async () => {
  const dom = await runScreen({ errorOnCreate: true });
  const form = openCreateForm(dom);
  fillValidProduct(form);
  submitForm(form);
  await dom.settle();

  const visible = visibleText(dom);
  assert.match(visible, /precio debe ser no negativo/i);
  const successState = dom.document.getElementById('success-state');
  assert.ok(!isVisible(successState) || !/cread|registrad|guardad|éxit/i.test(successState.textContent));
  assert.equal(field(form, 'name').value, 'Mouse');
  assert.equal(field(form, 'category').value, 'Periféricos');
  assert.equal(field(form, 'price').value, '1250.50');
  assert.equal(field(form, 'stock').value, '5');
});
