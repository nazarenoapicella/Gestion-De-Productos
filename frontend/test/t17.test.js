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
    parentNode: null
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
          ...event
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
    Object.defineProperty(element, 'textContent', {
      get() {
        return (this._text || '') + this.children.map((child) => child.textContent).join('');
      },
      set(value) {
        this._text = String(value ?? '');
        this.replaceChildren();
      }
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
    elements,
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
      getProducts: typeof getProducts === "function" ? getProducts : null
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
    deleteProduct,
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

function tableRows(dom) {
  return dom.document.querySelectorAll('tbody tr');
}

function rowValues(row) {
  return row.children.filter((child) => child.tagName === 'TD')
    .map((cell) => cell.textContent.trim());
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
    updatedAt: '2026-10-28T12:00:00.000Z'
  },
  {
    id: 2,
    name: 'Teclado',
    description: 'Teclado mecánico',
    category: 'Periféricos',
    price: '2000.00',
    stock: 6,
    createdAt: '2026-10-28T12:00:00.000Z',
    updatedAt: '2026-10-28T12:00:00.000Z'
  },
  {
    id: 3,
    name: 'Mousepad',
    description: 'Mousepad grande',
    category: 'Accesorios',
    price: '500.00',
    stock: 3,
    createdAt: '2026-10-28T12:00:00.000Z',
    updatedAt: '2026-10-28T12:00:00.000Z'
  }
];

function findLabelledControl(dom, id, pattern) {
  const label = dom.document.querySelectorAll('label').find((candidate) =>
    candidate.getAttribute('for') === id && pattern.test(candidate.textContent.trim())
  );
  assert.ok(label, `Debe existir una etiqueta visible para ${pattern}`);
  const control = dom.document.querySelector(`#${id}`);
  assert.ok(control, `La etiqueta "${label.textContent.trim()}" debe asociarse a un control`);
  assert.ok(['INPUT', 'SELECT'].includes(control.tagName), 'El filtro debe ser un control nativo');
  return control;
}

function findClearButton(dom) {
  const button = dom.document.querySelectorAll('button').find((candidate) =>
    /limpiar/i.test(`${candidate.textContent} ${candidate.getAttribute('aria-label') || ''}`)
  );
  assert.ok(button, 'Debe existir una acción accesible para limpiar los filtros');
  assert.equal(button.type, 'button', 'Limpiar filtros debe ser un botón nativo operable');
  assert.ok(
    (button.getAttribute('aria-label') || button.textContent).trim(),
    'El botón de limpieza debe tener un nombre accesible'
  );
  return button;
}

function fireFilterEvents(control, eventName) {
  control.dispatch(eventName);
  control.dispatch('change');
  for (let ancestor = control.parentNode; ancestor; ancestor = ancestor.parentNode) {
    if (ancestor.tagName === 'FORM') {
      ancestor.dispatch('submit');
      break;
    }
  }
}

async function runScreen({ failFilteredRequest, deferFilteredRequests } = {}) {
  const dom = createFakeDom(readFrontend('index.html'));
  const requests = [];
  const pendingFilteredRequests = [];
  const deletedProductIds = new Set();
  let shouldFailFilteredRequest = Boolean(failFilteredRequest);
  const fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    requests.push({ url, options: { ...options, method } });
    const parsedUrl = new URL(url, 'http://localhost');
    const search = (parsedUrl.searchParams.get('search') || '').trim().toLocaleLowerCase();
    const category = (parsedUrl.searchParams.get('category') || '').trim().toLocaleLowerCase();

    if (shouldFailFilteredRequest && (search || category)) {
      return {
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'El filtro de prueba fue rechazado.'
          }
        })
      };
    }

    const filtered = productsFixture.filter((product) =>
      !deletedProductIds.has(product.id) &&
      (!search || product.name.toLocaleLowerCase().includes(search)) &&
      (!category || product.category.toLocaleLowerCase() === category)
    );
    const response = {
      ok: true,
      status: 200,
      json: async () => filtered
    };
    if (deferFilteredRequests && (search || category)) {
      return new Promise((resolve) => pendingFilteredRequests.push(() => resolve(response)));
    }
    return response;
  };
  const api = createApi(fetch);
  runApp(dom, api, async (id) => deletedProductIds.add(id));
  await settlePromises();
  return {
    dom,
    requests,
    api,
    resolveFilteredRequest(index) {
      const resolve = pendingFilteredRequests[index];
      assert.ok(resolve, `No existe la solicitud filtrada pendiente ${index}`);
      resolve();
    },
    setFailFilteredRequest(value) {
      shouldFailFilteredRequest = value;
    }
  };
}

function assertOnlyReadRequests(screen) {
  assert.ok(screen.requests.length > 0, 'Los filtros deben consultar la API');
  assert.ok(
    screen.requests.every(({ options }) => options.method === 'GET'),
    'Buscar y filtrar no debe crear ni modificar productos ni adelantar otras operaciones'
  );
}

function assertNames(dom, expectedNames) {
  assert.deepEqual(
    tableRows(dom).map((row) => rowValues(row)[0]),
    expectedNames
  );
}

test('getProducts transmite los parámetros de búsqueda y categoría al GET real', async () => {
  const calls = [];
  const api = createApi(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => [] };
  });

  await api.getProducts({ search: 'mOuSe', category: 'Accesorios' });

  assert.equal(calls.length, 1);
  const requestUrl = new URL(calls[0].url, 'http://localhost');
  assert.equal(requestUrl.pathname, '/api/products');
  assert.equal(requestUrl.searchParams.get('search'), 'mOuSe');
  assert.equal(requestUrl.searchParams.get('category'), 'Accesorios');
  assert.equal(calls[0].options.method, 'GET');
});

test('buscar mOuSe muestra Mouse inalámbrico y Mousepad y consulta por query string', async () => {
  const screen = await runScreen();
  const search = findLabelledControl(screen.dom, 'search-products', /buscar|nombre/i);
  search.value = 'mOuSe';
  fireFilterEvents(search, 'input');
  await settlePromises();

  assertNames(screen.dom, ['Mouse inalámbrico', 'Mousepad']);
  const filteredRequest = screen.requests.find(({ url }) =>
    new URL(url, 'http://localhost').searchParams.get('search') === 'mOuSe'
  );
  assert.ok(filteredRequest, 'La búsqueda debe llegar a GET /api/products?search=mOuSe');
  assert.equal(filteredRequest.options.method, 'GET');
  assertOnlyReadRequests(screen);
});

test('seleccionar Periféricos muestra Mouse inalámbrico y Teclado', async () => {
  const screen = await runScreen();
  const category = findLabelledControl(screen.dom, 'category-filter', /categor/i);
  category.value = 'Periféricos';
  fireFilterEvents(category, 'change');
  await settlePromises();

  assertNames(screen.dom, ['Mouse inalámbrico', 'Teclado']);
  const filteredRequest = screen.requests.find(({ url }) =>
    new URL(url, 'http://localhost').searchParams.get('category') === 'Periféricos'
  );
  assert.ok(filteredRequest, 'La categoría debe enviarse como parámetro category');
  assert.equal(filteredRequest.options.method, 'GET');
  assertOnlyReadRequests(screen);
});

test('combinar mouse y Accesorios deja únicamente Mousepad', async () => {
  const screen = await runScreen();
  const search = findLabelledControl(screen.dom, 'search-products', /buscar|nombre/i);
  const category = findLabelledControl(screen.dom, 'category-filter', /categor/i);
  search.value = 'mouse';
  fireFilterEvents(search, 'input');
  category.value = 'Accesorios';
  fireFilterEvents(category, 'change');
  await settlePromises();

  assertNames(screen.dom, ['Mousepad']);
  const combinedRequest = screen.requests.find(({ url }) => {
    const parameters = new URL(url, 'http://localhost').searchParams;
    return parameters.get('search') === 'mouse' && parameters.get('category') === 'Accesorios';
  });
  assert.ok(combinedRequest, 'La misma solicitud debe incluir búsqueda y categoría');
  assert.equal(combinedRequest.options.method, 'GET');
  assertOnlyReadRequests(screen);
});

test('buscar router anuncia accesiblemente que no se encontraron productos', async () => {
  const screen = await runScreen();
  const search = findLabelledControl(screen.dom, 'search-products', /buscar|nombre/i);
  search.value = 'router';
  fireFilterEvents(search, 'input');
  await settlePromises();

  const noResults = screen.dom.elements.find((element) =>
    element.getAttribute('role') === 'status' &&
    isVisible(element) &&
    /no se encontraron productos/i.test(element.textContent)
  );
  assert.ok(noResults, 'El estado sin coincidencias debe anunciar que no hay resultados');
  assert.equal(noResults.getAttribute('aria-live'), 'polite');
  assertNames(screen.dom, []);
  assertOnlyReadRequests(screen);
});

test('limpiar filtros retorna los tres productos y el control es accesible', async () => {
  const screen = await runScreen();
  const search = findLabelledControl(screen.dom, 'search-products', /buscar|nombre/i);
  const category = findLabelledControl(screen.dom, 'category-filter', /categor/i);
  const clearButton = findClearButton(screen.dom);

  search.value = 'mouse';
  fireFilterEvents(search, 'input');
  category.value = 'Accesorios';
  fireFilterEvents(category, 'change');
  await settlePromises();
  clearButton.click();
  await settlePromises();

  assert.equal(search.value, '');
  assert.equal(category.value, '');
  assertNames(screen.dom, ['Mouse inalámbrico', 'Teclado', 'Mousepad']);
  const clearedRequest = screen.requests.find(({ url }) => {
    const parameters = new URL(url, 'http://localhost').searchParams;
    return !parameters.has('search') && !parameters.has('category');
  });
  assert.ok(clearedRequest, 'Limpiar debe volver a consultar sin parámetros de filtro');
  assert.equal(clearedRequest.options.method, 'GET');
  assertOnlyReadRequests(screen);
});

test('un error de validación devuelto por la API se conserva en una alerta accesible', async () => {
  const screen = await runScreen({ failFilteredRequest: true });
  const search = findLabelledControl(screen.dom, 'search-products', /buscar|nombre/i);
  search.value = 'router';
  fireFilterEvents(search, 'input');
  await settlePromises();

  const alert = screen.dom.elements.find((element) =>
    element.getAttribute('role') === 'alert' &&
    isVisible(element) &&
    element.textContent.includes('El filtro de prueba fue rechazado.')
  );
  assert.ok(alert, 'La interfaz debe conservar y anunciar el mensaje de error de la API');
  assertOnlyReadRequests(screen);
});

test('eliminar un producto conserva la búsqueda y categoría seleccionadas', async () => {
  const screen = await runScreen();
  const search = findLabelledControl(screen.dom, 'search-products', /buscar|nombre/i);
  const category = findLabelledControl(screen.dom, 'category-filter', /categor/i);
  search.value = 'mouse';
  fireFilterEvents(search, 'input');
  category.value = 'Periféricos';
  fireFilterEvents(category, 'change');
  await settlePromises();

  const deleteButton = screen.dom.document.querySelectorAll('button').find((button) =>
    button.getAttribute('aria-label') === 'Eliminar Mouse inalámbrico'
  );
  assert.ok(deleteButton, 'El producto filtrado debe conservar su acción de eliminación');
  deleteButton.click();
  await settlePromises();

  const lastRequest = screen.requests.at(-1);
  const parameters = new URL(lastRequest.url, 'http://localhost').searchParams;
  assert.equal(parameters.get('search'), 'mouse');
  assert.equal(parameters.get('category'), 'Periféricos');
  assert.equal(lastRequest.options.method, 'GET');
});

test('una consulta fallida permite reintentar con los mismos filtros', async () => {
  const screen = await runScreen({ failFilteredRequest: true });
  const search = findLabelledControl(screen.dom, 'search-products', /buscar|nombre/i);
  search.value = 'router';
  fireFilterEvents(search, 'input');
  await settlePromises();
  const requestsAfterFailure = screen.requests.length;

  screen.setFailFilteredRequest(false);
  screen.dom.document.getElementById('filter-form').dispatch('submit');
  await settlePromises();

  assert.ok(
    screen.requests.length > requestsAfterFailure,
    'Enviar nuevamente los mismos filtros debe volver a consultar la API'
  );
  assertNames(screen.dom, []);
  const noResults = screen.dom.elements.find((element) =>
    element.getAttribute('role') === 'status' &&
    isVisible(element) &&
    /no se encontraron productos/i.test(element.textContent)
  );
  assert.ok(noResults, 'Tras el reintento exitoso debe mostrarse el estado sin resultados');
  assertOnlyReadRequests(screen);
});

test('una respuesta tardía no reemplaza los resultados de los filtros más recientes', async () => {
  const screen = await runScreen({ deferFilteredRequests: true });
  const search = findLabelledControl(screen.dom, 'search-products', /buscar|nombre/i);

  search.value = 'mouse';
  screen.dom.document.getElementById('filter-form').dispatch('submit');
  search.value = 'router';
  screen.dom.document.getElementById('filter-form').dispatch('submit');

  screen.resolveFilteredRequest(1);
  await settlePromises();
  screen.resolveFilteredRequest(0);
  await settlePromises();

  assertNames(screen.dom, []);
  const noResults = screen.dom.elements.find((element) =>
    element.getAttribute('role') === 'status' &&
    isVisible(element) &&
    /no se encontraron productos/i.test(element.textContent)
  );
  assert.ok(noResults, 'Debe conservarse el resultado de la búsqueda más reciente');
  assert.equal(search.value, 'router');
  assertOnlyReadRequests(screen);
});

test('eliminar la última categoría actualiza las opciones y vuelve al inventario disponible', async () => {
  const screen = await runScreen();
  const category = findLabelledControl(screen.dom, 'category-filter', /categor/i);
  category.value = 'Accesorios';
  fireFilterEvents(category, 'change');
  await settlePromises();

  const deleteButton = screen.dom.document.querySelectorAll('button').find((button) =>
    button.getAttribute('aria-label') === 'Eliminar Mousepad'
  );
  assert.ok(deleteButton, 'Mousepad debe ofrecer la acción de eliminación');
  deleteButton.click();
  await settlePromises();

  const availableCategories = category.querySelectorAll('option').map((option) => option.value);
  assert.ok(!availableCategories.includes('Accesorios'));
  assert.equal(category.value, '');
  assertNames(screen.dom, ['Mouse inalámbrico', 'Teclado']);
});

test('una recarga filtrada conserva las demás categorías existentes', async () => {
  const screen = await runScreen();
  const search = findLabelledControl(screen.dom, 'search-products', /buscar|nombre/i);
  const category = findLabelledControl(screen.dom, 'category-filter', /categor/i);
  search.value = 'mouse';
  fireFilterEvents(search, 'input');
  await settlePromises();

  const deleteButton = screen.dom.document.querySelectorAll('button').find((button) =>
    button.getAttribute('aria-label') === 'Eliminar Mouse inalámbrico'
  );
  assert.ok(deleteButton, 'Mouse inalámbrico debe ofrecer la acción de eliminación');
  deleteButton.click();
  await settlePromises();

  const availableCategories = category.querySelectorAll('option').map((option) => option.value);
  assert.ok(availableCategories.includes('Periféricos'));
  assert.ok(availableCategories.includes('Accesorios'));
  assertNames(screen.dom, ['Mousepad']);
});
