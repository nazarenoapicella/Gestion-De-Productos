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
  return { textContent: String(text), parentNode: null };
}

function createFakeDom(html) {
  const byId = new Map();
  const events = new Map();
  const elements = [];

  function makeElement(tagName) {
    const attributes = new Map();
    const element = {
      tagName: tagName.toUpperCase(),
      children: [],
      parentNode: null,
      hidden: false,
      disabled: false,
      value: '',
      style: {},
      classList: {
        contains(name) {
          return (attributes.get('class') || '').split(/\s+/).includes(name);
        },
        add(name) {
          const names = new Set((attributes.get('class') || '').split(/\s+/).filter(Boolean));
          names.add(name);
          attributes.set('class', [...names].join(' '));
        },
        remove(name) {
          attributes.set('class', (attributes.get('class') || '')
            .split(/\s+/).filter((entry) => entry && entry !== name).join(' '));
        }
      },
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
        if (!events.has(this)) events.set(this, new Map());
        const listeners = events.get(this);
        if (!listeners.has(name)) listeners.set(name, []);
        listeners.get(name).push(callback);
      },
      dispatch(name, event = {}) {
        const actualEvent = {
          target: this,
          currentTarget: this,
          defaultPrevented: false,
          preventDefault() { this.defaultPrevented = true; },
          ...event
        };
        for (const callback of events.get(this)?.get(name) || []) callback(actualEvent);
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
      }
    };

    Object.defineProperty(element, 'id', {
      get() { return attributes.get('id') || ''; },
      set(value) { this.setAttribute('id', value); }
    });
    Object.defineProperty(element, 'name', {
      get() { return attributes.get('name') || ''; },
      set(value) { this.setAttribute('name', value); }
    });
    Object.defineProperty(element, 'type', {
      get() { return attributes.get('type') || ''; },
      set(value) { this.setAttribute('type', value); }
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
    Object.defineProperty(element, 'innerText', {
      get() { return this.textContent; },
      set(value) { this.textContent = value; }
    });
    Object.defineProperty(element, 'elements', {
      get() {
        if (this.tagName !== 'FORM') return undefined;
        const controls = queryAll(this, 'input, textarea, select, button');
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
    elements.push(element);
    return element;
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
    const className = trimmed.match(/^\.([\w-]+)$/);
    if (className) return element.classList.contains(className[1]);
    return /^[\w-]+$/.test(trimmed) &&
      element.tagName.toLowerCase() === trimmed.toLowerCase();
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

  const documentEvents = new Map();
  const document = {
    activeElement: null,
    createElement: makeElement,
    getElementById(id) { return byId.get(id) || null; },
    querySelector(selector) { return queryAll(root, selector)[0] || null; },
    querySelectorAll(selector) { return queryAll(root, selector); },
    addEventListener(name, callback) {
      if (!documentEvents.has(name)) documentEvents.set(name, []);
      documentEvents.get(name).push(callback);
    }
  };
  const root = makeElement('document');
  const stack = [root];
  const voidTags = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
    'meta', 'param', 'source', 'track', 'wbr'
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
      .map(([, name, doubleQuoted, singleQuoted, unquoted]) => [
        name, doubleQuoted ?? singleQuoted ?? unquoted ?? ''
      ]);
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
    dispatchReady() {
      for (const callback of documentEvents.get('DOMContentLoaded') || []) callback();
    }
  };
}

function createApi(fetch) {
  const source = readFrontend(path.join('js', 'api.js'))
    .replace(/\bexport\s+(?=(?:async\s+)?function)/g, '');
  const context = vm.createContext({ fetch, Promise, Error });
  new vm.Script(`${source}
    globalThis.apiFunctions = {
      getProducts: typeof getProducts === "function" ? getProducts : null,
      createProduct: typeof createProduct === "function" ? createProduct : null,
      updateProduct: typeof updateProduct === "function" ? updateProduct : null
    };
  `, { filename: 'frontend/js/api.js' }).runInContext(context);
  return context.apiFunctions;
}

function runApp(dom, api) {
  const source = readFrontend(path.join('js', 'app.js'))
    .replace(/^\s*import\s+\{[^}]+\}\s+from\s+['"][^'"]*api\.js['"]\s*;?\s*$/gm, '');
  const context = vm.createContext({
    document: dom.document,
    getProducts: api.getProducts,
    createProduct: api.createProduct,
    updateProduct: api.updateProduct,
    Promise,
    Error,
    console,
    setTimeout,
    clearTimeout
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

function assertEditError(dom, messagePattern) {
  const errorState = dom.document.getElementById('edit-form-error');
  assert.ok(errorState, 'El formulario debe ofrecer la región edit-form-error');
  assert.equal(isVisible(errorState), true, 'El error de edición debe ser visible');
  assert.match(errorState.textContent, messagePattern);

  const successState = dom.document.getElementById('success-state');
  assert.ok(successState, 'La pantalla debe ofrecer la región success-state');
  assert.equal(
    isVisible(successState) && /guardad|actualizad|éxit/i.test(successState.textContent),
    false,
    'Un error de edición no debe mostrar un éxito falso'
  );
}

function tableRows(dom) {
  return dom.document.querySelectorAll('tbody tr');
}

function rowValues(row) {
  return row.children.filter((child) => child.tagName === 'TD')
    .map((cell) => cell.textContent.trim());
}

function findEditControl(dom) {
  return dom.document.querySelectorAll('button, a').find((control) =>
    /\beditar\b/i.test(`${control.textContent} ${control.getAttribute('aria-label') || ''}`)
  );
}

function editForm(dom) {
  return dom.document.querySelectorAll('form').find((form) =>
    isVisible(form) &&
    ['name', 'description', 'category', 'price'].every((name) => form.elements[name]) &&
    !form.elements.stock
  );
}

function field(form, name) {
  const control = form.elements[name];
  assert.ok(control, `El formulario de edición debe tener el campo ${name}`);
  return control;
}

function openEditForm(dom) {
  const control = findEditControl(dom);
  assert.ok(control, 'Cada producto debe ofrecer una acción operable para editarlo');
  control.click();
  const form = editForm(dom);
  assert.ok(form, 'Al seleccionar un producto debe abrirse el formulario de edición sin stock');
  return form;
}

function changeProduct(form) {
  field(form, 'name').value = 'Mouse Pro';
  field(form, 'description').value = 'Mouse inalámbrico';
  field(form, 'category').value = 'Periféricos';
  field(form, 'price').value = '1500.00';
}

function submitForm(form) {
  const event = form.dispatch('submit');
  assert.equal(event.defaultPrevented, true, 'La edición debe enviarse sin recargar la página');
}

function productFixture() {
  return {
    id: 42,
    name: 'Mouse',
    description: 'Mouse óptico',
    category: 'Periféricos',
    price: '1000.00',
    stock: 5,
    createdAt: '2026-10-28T12:00:00.000Z',
    updatedAt: '2026-10-28T12:00:00.000Z'
  };
}

async function runScreen({ updateError } = {}) {
  const dom = createFakeDom(readFrontend('index.html'));
  const product = productFixture();
  const requests = [];
  const fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if ((options.method || 'GET') === 'GET') {
      return { ok: true, status: 200, json: async () => [{ ...product }] };
    }
    if (options.method === 'PUT') {
      if (updateError) {
        return { ok: false, status: updateError.status, json: async () => ({
          error: { code: updateError.code, message: updateError.message }
        }) };
      }
      const changes = JSON.parse(options.body);
      Object.assign(product, changes);
      product.updatedAt = '2026-10-28T12:01:00.000Z';
      return { ok: true, status: 200, json: async () => ({ ...product }) };
    }
    throw new Error(`Solicitud inesperada: ${options.method} ${url}`);
  };
  const api = createApi(fetch);
  runApp(dom, api);
  await settlePromises();
  return { dom, product, requests, api };
}

test('el harness ejecuta la pantalla y representa el producto recibido por GET', async () => {
  const { dom, requests } = await runScreen();
  assert.ok(requests.some(({ url, options }) =>
    url === '/api/products' && (options.method || 'GET') === 'GET'
  ));
  assert.deepEqual(tableRows(dom).map((row) => rowValues(row).slice(0, 4)), [
    ['Mouse', 'Periféricos', '1000.00', '5']
  ]);
});

test('la API actualiza por PUT el ID elegido y envía solo los cuatro campos editables', async () => {
  const calls = [];
  const api = createApi(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => productFixture() };
  });

  assert.equal(typeof api.updateProduct, 'function', 'api.js debe exponer updateProduct');
  await api.updateProduct(42, {
    name: 'Mouse Pro',
    description: 'Mouse inalámbrico',
    category: 'Periféricos',
    price: '1500.00'
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/products/42');
  assert.equal(calls[0].options.method, 'PUT');
  assert.match(calls[0].options.headers['Content-Type'] || '', /application\/json/i);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    name: 'Mouse Pro',
    description: 'Mouse inalámbrico',
    category: 'Periféricos',
    price: '1500.00'
  });
  assert.equal(Object.hasOwn(JSON.parse(calls[0].options.body), 'stock'), false);
});

test('la API comunica un 404 como producto no encontrado', async () => {
  const api = createApi(async () => ({
    ok: false,
    status: 404,
    json: async () => ({ error: { code: 'NOT_FOUND', message: 'El producto no existe.' } })
  }));
  assert.equal(typeof api.updateProduct, 'function', 'api.js debe exponer updateProduct');
  await assert.rejects(
    api.updateProduct(42, { name: 'Mouse Pro', description: '', category: 'Periféricos', price: '1500.00' }),
    /no encontrado|no existe/i
  );
});

test('la API conserva el mensaje VALIDATION_ERROR de un 400', async () => {
  const api = createApi(async () => ({
    ok: false,
    status: 400,
    json: async () => ({
      error: { code: 'VALIDATION_ERROR', message: 'El precio no es válido.' }
    })
  }));
  assert.equal(typeof api.updateProduct, 'function', 'api.js debe exponer updateProduct');
  await assert.rejects(
    api.updateProduct(42, { name: '', description: '', category: 'Periféricos', price: '-1' }),
    /El precio no es válido/
  );
});

test('seleccionar Mouse carga los valores actuales en un formulario sin campo stock', async () => {
  const { dom } = await runScreen();
  const form = openEditForm(dom);
  assert.equal(field(form, 'name').value, 'Mouse');
  assert.equal(field(form, 'description').value, 'Mouse óptico');
  assert.equal(field(form, 'category').value, 'Periféricos');
  assert.equal(field(form, 'price').value, '1000.00');
  assert.equal(form.elements.stock, undefined);
});

test('guardar Mouse Pro por PUT actualiza el listado y conserva stock 5', async () => {
  const { dom, requests } = await runScreen();
  const form = openEditForm(dom);
  changeProduct(form);
  submitForm(form);
  await settlePromises();

  const put = requests.find(({ options }) => options.method === 'PUT');
  assert.ok(put, 'La edición debe enviar PUT');
  assert.equal(put.url, '/api/products/42');
  assert.deepEqual(JSON.parse(put.options.body), {
    name: 'Mouse Pro',
    description: 'Mouse inalámbrico',
    category: 'Periféricos',
    price: '1500.00'
  });
  assert.equal(Object.hasOwn(JSON.parse(put.options.body), 'stock'), false);
  assert.deepEqual(tableRows(dom).map((row) => rowValues(row).slice(0, 4)), [
    ['Mouse Pro', 'Periféricos', '1500.00', '5']
  ]);
});

test('un 404 informa que el producto no fue encontrado y no anuncia guardado', async () => {
  const { dom } = await runScreen({
    updateError: {
      status: 404,
      code: 'NOT_FOUND',
      message: 'El producto no fue encontrado.'
    }
  });
  const form = openEditForm(dom);
  changeProduct(form);
  submitForm(form);
  await settlePromises();

  assertEditError(dom, /no fue encontrado|no existe/i);
  assert.deepEqual(tableRows(dom).map((row) => rowValues(row).slice(0, 4)), [
    ['Mouse', 'Periféricos', '1000.00', '5']
  ]);
});

test('VALIDATION_ERROR no finge el guardado ni reemplaza los datos del listado', async () => {
  const { dom } = await runScreen({
    updateError: {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'El precio no es válido.'
    }
  });
  const form = openEditForm(dom);
  changeProduct(form);
  submitForm(form);
  await settlePromises();

  assertEditError(dom, /El precio no es válido/);
  assert.deepEqual(tableRows(dom).map((row) => rowValues(row).slice(0, 4)), [
    ['Mouse', 'Periféricos', '1000.00', '5']
  ]);
});
