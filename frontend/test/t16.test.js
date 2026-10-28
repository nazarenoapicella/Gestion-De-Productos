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
    const named = trimmed.match(/^\[name=["']?([^"'\]]+)["']?\]$/i);
    if (named) return element.getAttribute('name') === named[1];
    const role = trimmed.match(/^\[role=["']?([^"'\]]+)["']?\]$/i);
    if (role) return element.getAttribute('role') === role[1];
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
      getProducts: typeof getProducts === "function" ? getProducts : null,
      createProduct: typeof createProduct === "function" ? createProduct : null,
      updateProduct: typeof updateProduct === "function" ? updateProduct : null,
      deleteProduct: typeof deleteProduct === "function" ? deleteProduct : null
    };
  `, { filename: 'frontend/js/api.js' }).runInContext(context);
  return context.apiFunctions;
}

function runApp(dom, api, confirm) {
  const source = readFrontend(path.join('js', 'app.js'))
    .replace(/^\s*import\s+\{[^}]+\}\s+from\s+['"][^'"]*api\.js['"]\s*;?\s*$/gm, '');
  const window = { confirm };
  const context = vm.createContext({
    document: dom.document,
    window,
    confirm,
    getProducts: api.getProducts,
    createProduct: api.createProduct,
    updateProduct: api.updateProduct,
    deleteProduct: api.deleteProduct,
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

function productFixture(id, name) {
  return {
    id,
    name,
    description: `${name} óptico`,
    category: 'Periféricos',
    price: '1000.00',
    stock: 5,
    createdAt: '2026-10-28T12:00:00.000Z',
    updatedAt: '2026-10-28T12:00:00.000Z'
  };
}

function findDeleteButton(dom, name = 'Mouse') {
  const row = tableRows(dom).find((candidate) => rowValues(candidate)[0] === name);
  assert.ok(row, `El producto ${name} debe estar en el listado`);
  const button = row.querySelectorAll('button').find((candidate) =>
    /\b(eliminar|borrar)\b/i.test(
      `${candidate.textContent} ${candidate.getAttribute('aria-label') || ''}`
    )
  );
  assert.ok(button, `La fila de ${name} debe ofrecer una acción de eliminación operable`);
  assert.equal(button.type, 'button', 'La acción debe ser un botón nativo operable con teclado');
  assert.match(
    button.getAttribute('aria-label') || button.textContent,
    /eliminar|borrar/i,
    'La acción debe tener un nombre accesible'
  );
  const styles = readFrontend(path.join('css', 'styles.css'));
  assert.match(styles, /:focus-visible|:focus\b/i, 'La acción debe tener foco visible para teclado');
  assert.match(styles, /outline\s*:/i, 'El indicador de foco debe tener contorno visible');
  return button;
}

function assertDeleteError(dom, messagePattern) {
  const errorRegions = dom.elements.filter((element) =>
    element.getAttribute('role') === 'alert'
  )
    .filter(isVisible);
  assert.ok(errorRegions.length > 0, 'El error de eliminación debe anunciarse en una región de alerta');
  assert.ok(
    errorRegions.some((region) => messagePattern.test(region.textContent)),
    `La región de error debe comunicar el problema; recibido: ${errorRegions.map((region) => region.textContent).join(' | ')}`
  );
}

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

async function runScreen({ deleteError, deleteResponse } = {}) {
  const dom = createFakeDom(readFrontend('index.html'));
  const products = [productFixture(42, 'Mouse'), productFixture(43, 'Teclado')];
  const requests = [];
  const confirmations = [];
  let confirmationResult = true;
  let deleteSucceeded = false;
  const fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    requests.push({ url, options });
    if (method === 'GET') {
      return {
        ok: true,
        status: 200,
        json: async () => deleteSucceeded
          ? products.filter((product) => product.id !== 42)
          : products
      };
    }
    if (method === 'DELETE') {
      if (deleteResponse) {
        return deleteResponse.promise.then((response) => {
          if (response.ok && response.status === 204) deleteSucceeded = true;
          return response;
        });
      }
      if (deleteError) {
        return {
          ok: false,
          status: deleteError.status,
          json: async () => ({
            error: { code: deleteError.code, message: deleteError.message }
          })
        };
      }
      deleteSucceeded = true;
      return {
        ok: true,
        status: 204,
        json: async () => { throw new SyntaxError('No content'); },
        text: async () => ''
      };
    }
    throw new Error(`Solicitud inesperada: ${method} ${url}`);
  };
  const api = createApi(fetch);
  const confirm = (message) => {
    confirmations.push(String(message));
    return confirmationResult;
  };
  runApp(dom, api, confirm);
  await settlePromises();
  return {
    dom,
    products,
    requests,
    confirmations,
    api,
    setConfirmationResult(value) { confirmationResult = value; }
  };
}

test('cancelar la confirmación de Mouse no envía DELETE y lo mantiene en la lista', async () => {
  const screen = await runScreen();
  screen.setConfirmationResult(false);
  findDeleteButton(screen.dom).click();
  await settlePromises();

  assert.ok(screen.confirmations.some((message) => /Mouse/i.test(message)),
    'La confirmación debe identificar el producto');
  assert.equal(screen.requests.filter(({ options }) => options.method === 'DELETE').length, 0);
  assert.ok(tableRows(screen.dom).some((row) => rowValues(row)[0] === 'Mouse'));
});

test('confirmar envía DELETE al ID correcto y solo quita Mouse tras éxito', async () => {
  const deleteResponse = deferred();
  const screen = await runScreen({ deleteResponse });
  findDeleteButton(screen.dom).click();
  await settlePromises();

  const deletion = screen.requests.find(({ options }) => options.method === 'DELETE');
  assert.ok(deletion, 'La confirmación debe enviar una solicitud DELETE');
  assert.equal(deletion.url, '/api/products/42');
  assert.equal(screen.confirmations.some((message) => /Mouse/i.test(message)), true);
  assert.equal(tableRows(screen.dom).length, 2, 'El listado no debe cambiar antes de la respuesta exitosa');

  deleteResponse.resolve({
    ok: true,
    status: 204,
    json: async () => { throw new SyntaxError('No content'); },
    text: async () => ''
  });
  await settlePromises();

  assert.deepEqual(tableRows(screen.dom).map((row) => rowValues(row)[0]), ['Teclado']);
});

test('un error de API al eliminar conserva Mouse y comunica el error', async () => {
  const screen = await runScreen({
    deleteError: {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'No se pudo eliminar el producto.'
    }
  });
  findDeleteButton(screen.dom).click();
  await settlePromises();

  assert.deepEqual(tableRows(screen.dom).map((row) => rowValues(row)[0]), ['Mouse', 'Teclado']);
  assertDeleteError(screen.dom, /error|problema|no se pudo|inténtalo/i);
});

test('un 404 al eliminar conserva Mouse y comunica que no fue encontrado', async () => {
  const screen = await runScreen({
    deleteError: {
      status: 404,
      code: 'NOT_FOUND',
      message: 'El producto no fue encontrado.'
    }
  });
  findDeleteButton(screen.dom).click();
  await settlePromises();

  assert.deepEqual(tableRows(screen.dom).map((row) => rowValues(row)[0]), ['Mouse', 'Teclado']);
  assertDeleteError(screen.dom, /no encontrado|no existe/i);
});

test('una respuesta DELETE 200 fuera de contrato conserva productos y comunica un error', async () => {
  const deleteResponse = deferred();
  const screen = await runScreen({ deleteResponse });
  findDeleteButton(screen.dom).click();
  await settlePromises();

  deleteResponse.resolve({
    ok: true,
    status: 200,
    json: async () => productFixture(42, 'Mouse')
  });
  await settlePromises();

  assert.deepEqual(tableRows(screen.dom).map((row) => rowValues(row)[0]), ['Mouse', 'Teclado']);
  assertDeleteError(screen.dom, /error|problema|no se pudo|inténtalo|respuesta/i);
});
