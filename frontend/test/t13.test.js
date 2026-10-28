const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const frontendRoot = path.resolve(__dirname, '..');

function readDeliverable(relativePath) {
  const filePath = path.join(frontendRoot, relativePath);
  assert.ok(
    fs.existsSync(filePath),
    `Falta el entregable funcional de T-13: frontend/${relativePath}`
  );
  return fs.readFileSync(filePath, 'utf8');
}

function getInteractiveControls(html) {
  return [...html.matchAll(/<(button|a|input|select|textarea)\b([^>]*)>([\s\S]*?)<\/\1>|<(input|select|textarea)\b([^>]*)\/?>/gi)]
    .map(([, tag, attributes, contents, selfClosingTag, selfClosingAttributes]) => ({
      tag: (tag || selfClosingTag).toLowerCase(),
      attributes: attributes || selfClosingAttributes || '',
      contents: contents || '',
      html
    }));
}

function accessibleName(control) {
  const attributeName = control.attributes.match(/\b(?:aria-label|title|value)=["']([^"']+)["']/i);
  const visibleName = control.contents.replace(/<[^>]*>/g, '').trim();
  if (attributeName && attributeName[1]) return attributeName[1];
  if (visibleName) return visibleName;

  const id = control.attributes.match(/\bid=["']([^"']+)["']/i);
  if (!id) return '';
  const escapedId = id[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const label = new RegExp(
    `<label\\b[^>]*\\bfor=["']${escapedId}["'][^>]*>([\\s\\S]*?)<\\/label>`,
    'i'
  ).exec(control.html || '');
  return label ? label[1].replace(/<[^>]*>/g, '').trim() : '';
}

function createFakeDom(html) {
  const elements = [];
  const byId = new Map();
  const events = new Map();
  let activeElement = null;

  function makeElement(tagName) {
    const classes = new Set();
    const attributes = new Map();
    const element = {
      tagName: tagName.toUpperCase(),
      children: [],
      parentNode: null,
      style: {},
      hidden: false,
      value: '',
      classList: {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        contains: (name) => classes.has(name),
        toggle: (name, force) => (force ?? !classes.has(name))
          ? (classes.add(name), true)
          : (classes.delete(name), false)
      },
      setAttribute(name, value) {
        name = name.toLowerCase();
        attributes.set(name, String(value));
        if (name === 'hidden') this.hidden = true;
        if (name === 'value') this.value = String(value);
        if (name === 'class') {
          classes.clear();
          String(value).split(/\s+/).filter(Boolean).forEach((name) => classes.add(name));
        }
        if (name === 'id') this.id = value;
      },
      getAttribute: (name) => attributes.get(name.toLowerCase()) ?? null,
      removeAttribute(name) {
        attributes.delete(name.toLowerCase());
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
      append(...nodes) { nodes.forEach((node) => this.appendChild(typeof node === 'string' ? makeTextNode(node) : node)); },
      replaceChildren(...nodes) {
        this.children.forEach((child) => { child.parentNode = null; });
        this.children = [];
        nodes.forEach((node) => this.appendChild(node));
      },
      reset() {
        for (const control of descendants(this, 'input, textarea, select')) {
          control.value = control.getAttribute('value') || '';
        }
      },
      focus() { activeElement = this; },
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
      click() { return this.dispatch('click'); }
    };

    Object.defineProperty(element, 'id', {
      get() {
        return attributes.get('id') || '';
      },
      set(value) {
        const id = String(value);
        attributes.set('id', id);
        byId.set(id, element);
      }
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
        const controls = descendants(this, 'input, textarea, select, button, fieldset, object, output');
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
        return (element._text || '') + element.children.map((child) => child.textContent).join('');
      },
      set(value) {
        element._text = String(value ?? '');
        this.replaceChildren();
      }
    });
    Object.defineProperty(element, 'innerText', {
      get() {
        return element.textContent;
      },
      set(value) {
        element.textContent = value;
      }
    });

    elements.push(element);
    return element;
  }

  const makeTextNode = (text) => ({ textContent: text, parentNode: null });
  function descendants(root, selector) {
    const tags = selector.split(',').map((part) => part.trim().toLowerCase());
    const found = [];
    function visit(parent) {
      for (const child of parent.children || []) {
        if (child.tagName && tags.includes(child.tagName.toLowerCase())) found.push(child);
        visit(child);
      }
    }
    visit(root);
    return found;
  }

  const root = makeElement('document');
  const stack = [root];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const tagPattern = /<!--[\s\S]*?-->|<\/?([a-z][\w-]*)\b([^>]*)>/gi;
  let textStart = 0;
  for (const match of html.matchAll(tagPattern)) {
    const text = html.slice(textStart, match.index);
    if (text) stack[stack.length - 1].appendChild(makeTextNode(text));
    textStart = match.index + match[0].length;
    if (match[0].startsWith('<!--')) continue;
    const tagName = match[1].toLowerCase();
    if (match[0].startsWith('</')) {
      const index = stack.findLastIndex((element) => element.tagName.toLowerCase() === tagName);
      if (index > 0) stack.length = index;
      continue;
    }
    const rawAttributes = match[2] || '';
    const element = makeElement(tagName);
    for (const [, name, doubleQuoted, singleQuoted, unquoted] of rawAttributes.matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      element.setAttribute(name, doubleQuoted ?? singleQuoted ?? unquoted ?? '');
    }
    stack[stack.length - 1].appendChild(element);
    if (!voidTags.has(tagName) && !rawAttributes.trimEnd().endsWith('/')) stack.push(element);
  }
  const trailingText = html.slice(textStart);
  if (trailingText) stack[stack.length - 1].appendChild(makeTextNode(trailingText));

  function find(selector) {
    const id = selector.match(/#([\w-]+)/);
    if (id) return byId.get(id[1]) || null;
    const tag = selector.match(/\b(table|tbody|thead|tr|main|form|label|input|button)\b/i);
    if (tag) return elements.find((element) => element.tagName.toLowerCase() === tag[1].toLowerCase()) || null;
    const className = selector.match(/\.([\w-]+)/);
    return elements.find((element) => element.classList.contains(className && className[1])) || null;
  }

  const document = {
    readyState: 'loading',
    createElement: makeElement,
    getElementById: (id) => byId.get(id) || null,
    querySelector: find,
    querySelectorAll: (selector) => [find(selector)].filter(Boolean),
    get activeElement() { return activeElement; },
    addEventListener(name, callback) {
      if (!events.has(name)) events.set(name, []);
      events.get(name).push(callback);
    }
  };
  const window = {
    document
  };

  return {
    document,
    window,
    getById: (id) => byId.get(id) || null,
    find,
    dispatchReady() {
      for (const callback of events.get('DOMContentLoaded') || []) callback();
    }
  };
}

function isVisible(element) {
  return Boolean(element) &&
    !element.hidden &&
    element.style.display !== 'none' &&
    element.getAttribute('aria-hidden') !== 'true' &&
    !['hidden', 'is-hidden', 'd-none'].some((name) => element.classList.contains(name));
}

async function settlePromises() {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function runAppWithProducts(productsOrError, defer = false) {
  const html = readDeliverable('index.html');
  const source = readDeliverable(path.join('js', 'app.js'));
  const dom = createFakeDom(html);
  let resolveProducts;
  let rejectProducts;
  let getProductsCalls = 0;
  const pending = new Promise((resolve, reject) => {
    resolveProducts = resolve;
    rejectProducts = reject;
  });
  const getProducts = () => {
    getProductsCalls += 1;
    if (defer) return pending;
    if (productsOrError instanceof Error) return Promise.reject(productsOrError);
    return Promise.resolve(productsOrError);
  };
  const context = vm.createContext({
    document: dom.document,
    window: Object.assign(dom.window, { getProducts, api: { getProducts } }),
    getProducts,
    ProductAPI: { getProducts },
    createProduct: async () => {
      throw new Error('createProduct no configurado para una prueba de lectura');
    },
    console,
    setTimeout,
    clearTimeout,
    Promise
  });
  const apiImports = /^\s*import\s+\{[^}]+\}\s+from\s+['"][^'"]*api\.js['"]\s*;?\s*$/gm;
  const appSource = source.replace(apiImports, '');
  new vm.Script(appSource, { filename: 'frontend/js/app.js' }).runInContext(context);
  dom.dispatchReady();

  return {
    ...dom,
    getProductsCalls: () => getProductsCalls,
    resolveProducts,
    rejectProducts,
    settle: settlePromises
  };
}

function tableRows(dom) {
  const body = dom.find('tbody');
  return body ? body.children.filter((child) => child.tagName === 'TR') : [];
}

function rowCells(row) {
  return row.children
    .filter((child) => child.tagName === 'TD')
    .map((cell) => cell.textContent);
}

test('el HTML define la página española, el área principal y una tabla semántica accesible', () => {
  const html = readDeliverable('index.html');

  assert.match(html, /<html\b[^>]*\blang=["']es["']/i);
  assert.match(html, /<main\b/i);
  assert.match(html, /<h1\b/i);
  assert.match(html, /<table\b/i);
  assert.match(html, /<caption\b[^>]*>[\s\S]*?<\/caption>/i);

  const headers = [...html.matchAll(/<th\b([^>]*)>([\s\S]*?)<\/th>/gi)]
    .map(([, attributes, contents]) => ({
      attributes,
      text: contents.replace(/<[^>]*>/g, '').trim()
    }));

  for (const label of ['Nombre', 'Categoría', 'Precio', 'Stock']) {
    assert.ok(
      headers.some(({ attributes, text }) =>
        /\bscope=["']col["']/i.test(attributes) && text.toLocaleLowerCase('es') === label.toLocaleLowerCase('es')
      ),
      `Falta la columna semántica ${label}`
    );
  }
  const actionHeaders = headers.filter(({ text }) => /\bacciones\b/i.test(text));
  assert.ok(
    actionHeaders.length === 0 || actionHeaders.some(({ attributes }) => /\bscope=["']col["']/i.test(attributes)),
    'Si existe la columna de acciones de T-15, debe tener un encabezado semántico'
  );
});

test('la página ofrece regiones identificables para carga, inventario vacío y error', () => {
  const html = readDeliverable('index.html');
  const app = readDeliverable(path.join('js', 'app.js'));

  for (const state of ['loading-state', 'empty-state', 'error-state']) {
    assert.match(html, new RegExp(`\\bid=["']${state}["']`, 'i'));
    assert.match(app, new RegExp(state));
  }
  const emptyStateTag = html.match(/<[a-z][\w-]*\b(?=[^>]*\bid=["']empty-state["'])[^>]*>/i);
  assert.ok(emptyStateTag, 'Falta el elemento del estado vacío');
  assert.match(
    emptyStateTag[0],
    /\brole=["']status["']|\baria-live=["']polite["']/i,
    'El estado vacío debe anunciarse con role=status o aria-live=polite'
  );
  assert.match(html, /aria-live=["']polite["']/i);
  assert.match(html, /role=["']alert["']/i);
  assert.match(app, /loading-state|empty-state|error-state/);
});

test('el alta de T-14 está disponible con formulario accesible y el estado vacío conserva su explicación', async () => {
  const html = readDeliverable('index.html');
  const plainText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const controls = getInteractiveControls(html);

  assert.match(plainText, /\b(?:inventario|productos)\b/i);
  assert.match(plainText, /\b(?:no hay|vac[ií]o|sin productos)\b/i);
  assert.match(html, /<form\b[^>]*\bid=["']create-product-form["']/i);
  assert.match(html, /<section\b[^>]*\bid=["']create-product-panel["'][^>]*\bhidden\b/i);
  for (const name of ['name', 'category', 'price', 'stock', 'description']) {
    assert.ok(
      controls.some((control) =>
        new RegExp(`\\bname=["']${name}["']`, 'i').test(control.attributes) &&
        accessibleName(control)
      ),
      `El campo ${name} debe tener una etiqueta accesible`
    );
  }

  const dom = await runAppWithProducts([]);
  await dom.settle();
  const openButton = dom.getById('open-create-product');
  assert.ok(openButton, 'El alta debe tener un control visible y operable');
  openButton.click();
  assert.equal(isVisible(dom.getById('create-product-panel')), true);
  assert.equal(dom.document.activeElement, dom.getById('product-name'));
});

test('la capa API obtiene el listado y convierte respuestas fallidas en errores comprensibles', () => {
  const api = readDeliverable(path.join('js', 'api.js'));

  assert.match(api, /fetch\s*\(/);
  assert.match(api, /['"`]\/api\/products(?:\?[^'"`]*)?['"`]/);
  assert.match(api, /method\s*:\s*['"]GET['"]|fetch\s*\(\s*['"`]\/api\/products/i);
  assert.match(api, /response\.ok/);
  assert.match(api, /response\.json\s*\(/);
  assert.match(api, /error\.message|message/);
  assert.match(api, /throw\s+(?:new\s+)?Error|throw\s+/);
});

test('la interfaz ejecutada renderiza productos del API en celdas, en orden y como texto', async () => {
  const maliciousName = 'Mouse <img src=x onerror=alert(1)>';
  const products = [
    { name: 'Mouse', category: 'Periféricos', price: '1250.50', stock: 5 },
    { name: maliciousName, category: 'Periféricos', price: '700.25', stock: 3 },
    { name: 'Teclado', category: 'Periféricos', price: '900.00', stock: 2 }
  ];
  const dom = await runAppWithProducts(products);
  await dom.settle();

  assert.ok(dom.getProductsCalls() > 0, 'la aplicación debe solicitar los productos a getProducts');
  assert.deepEqual(
    tableRows(dom).map((row) => rowCells(row).slice(0, 4)),
    [
      ['Mouse', 'Periféricos', '1250.50', '5'],
      [maliciousName, 'Periféricos', '700.25', '3'],
      ['Teclado', 'Periféricos', '900.00', '2']
    ]
  );
  for (const row of tableRows(dom)) {
    const actionCells = row.children.filter((child) => child.tagName === 'TD').slice(4);
    for (const cell of actionCells) {
      const controls = cell.children.filter((child) => ['BUTTON', 'A'].includes(child.tagName));
      assert.ok(controls.length > 0, 'Una celda de acciones debe contener controles operables');
      assert.deepEqual(
        controls.map((control) => control.textContent.trim()).sort(),
        ['Editar', 'Eliminar'],
        'T-15 y T-16 permiten las acciones operables Editar y Eliminar, no acciones de stock'
      );
    }
  }
  assert.equal(dom.find('img'), null, 'el nombre recibido no debe crear elementos HTML');
});

test('el renderizado crea texto seguro y conserva el orden recibido del API', () => {
  const app = readDeliverable(path.join('js', 'app.js'));

  assert.match(app, /textContent/);
  assert.match(app, /createElement/);
  assert.match(app, /for\s*\(\s*(?:const|let|var)\s+\w+\s+of\s+products\b|products\s*\.\s*(?:forEach|map)\s*\(/);
  assert.doesNotMatch(app, /\.innerHTML\b|insertAdjacentHTML\s*\(/);
  assert.doesNotMatch(app, /\.sort\s*\(/);
});

test('la interfaz ejecutada mantiene loading y presenta correctamente inventario vacío y error', async () => {
  const loadingDom = await runAppWithProducts([], true);
  assert.ok(loadingDom.getProductsCalls() > 0);
  assert.ok(isVisible(loadingDom.getById('loading-state')), 'la carga debe mostrarse mientras espera la API');

  loadingDom.resolveProducts([]);
  await loadingDom.settle();
  assert.ok(isVisible(loadingDom.getById('empty-state')), 'la respuesta vacía debe mostrar su estado');
  assert.equal(tableRows(loadingDom).length, 0);

  const errorDom = await runAppWithProducts(new Error('Servicio no disponible'));
  await errorDom.settle();
  assert.ok(isVisible(errorDom.getById('error-state')), 'el fallo de API debe mostrar el estado de error');
  assert.equal(isVisible(errorDom.getById('empty-state')), false);
  assert.equal(tableRows(errorDom).length, 0);
});

test('los errores no se convierten en una lista vacía exitosa ni en datos ficticios', () => {
  const app = readDeliverable(path.join('js', 'app.js'));

  assert.match(app, /catch\s*\(/);
  assert.match(app, /error-state/);
  assert.match(app, /textContent/);
  assert.doesNotMatch(app, /(?:const|let|var)\s+\w*(?:mock|sample|demo|fake)\w*\s*=/i);
  assert.doesNotMatch(app, /(?:const|let|var)\s+\w*(?:products|inventory|items)\s*=\s*\[\s*\{/i);
  assert.doesNotMatch(app, /catch\s*\([^)]*\)\s*\{[^}]*products\s*=\s*\[\]/s);
});

test('la UI permite GET, POST, edición y eliminación, pero no adelanta el ajuste de stock', () => {
  const html = readDeliverable('index.html');
  const api = readDeliverable(path.join('js', 'api.js'));
  const app = readDeliverable(path.join('js', 'app.js'));

  for (const source of [html, api, app]) {
    assert.doesNotMatch(source, /\bPATCH\b/i);
    assert.doesNotMatch(source, /\/stock\b|adjustStock/i);
  }
  assert.doesNotMatch(
    `${html}\n${app}`,
    /<(?:button|a)\b[^>]*>[\s\S]*?\b(?:ajustar stock|aumentar stock|disminuir stock)\b[\s\S]*?<\/(?:button|a)>/i
  );
});

test('los controles existentes tienen nombre accesible y foco visible para teclado', () => {
  const html = readDeliverable('index.html');
  const css = readDeliverable(path.join('css', 'styles.css'));
  const controls = getInteractiveControls(html);

  for (const control of controls) {
    assert.ok(accessibleName(control), `El control <${control.tag}> debe tener un nombre accesible`);
    if (control.tag === 'a') {
      assert.match(control.attributes, /\bhref=["'][^"']+["']/i, 'El enlace debe poder operarse con teclado');
    }
  }

  if (controls.length > 0) {
    assert.match(css, /:focus-visible|:focus\b/i);
    assert.match(css, /outline\s*:/i);
  }
});
