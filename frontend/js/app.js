import {
  getProducts,
  getSummary,
  createProduct,
  updateProduct,
  deleteProduct,
  getBudgets,
  createBudget,
  resolveBudget,
  getBudgetPdf,
} from "./api.js";

const genericErrorMessage = "No se pudieron cargar los productos. Intentá nuevamente.";
const genericCreateErrorMessage = "No se pudo registrar el producto. Intentá nuevamente.";
const genericUpdateErrorMessage = "No se pudo actualizar el producto. Intentá nuevamente.";
const genericDeleteErrorMessage = "No se pudo eliminar el producto. Intentá nuevamente.";
const maximumSafeInteger = BigInt(Number.MAX_SAFE_INTEGER);

function setVisible(element, visible) {
  if (element) element.hidden = !visible;
}

function normalizeComparableText(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-ES");
}

function formatPrice(price) {
  const [integerPart = "0", decimalPart = ""] = String(price ?? "0.00").split(".");
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "");
  const groupedInteger = normalizedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimals = decimalPart.padEnd(2, "0").slice(0, 2);
  return `$ ${groupedInteger},${decimals}`;
}

function renderProducts(products, tableBody, onEdit, onDelete) {
  tableBody.replaceChildren();

  for (const product of products) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const categoryCell = document.createElement("td");
    const priceCell = document.createElement("td");
    const stockCell = document.createElement("td");
    const actionsCell = document.createElement("td");
    const actions = document.createElement("div");
    const editButton = document.createElement("button");
    const deleteButton = document.createElement("button");

    nameCell.textContent = product.name;
    categoryCell.textContent = product.category;
    priceCell.textContent = formatPrice(product.price);
    stockCell.textContent = String(product.stock);
    stockCell.className = product.stock <= 5 ? "stock-value stock-value--low" : "stock-value";
    stockCell.setAttribute("aria-label", product.stock <= 5
      ? `Stock bajo: ${product.stock} unidades`
      : `${product.stock} unidades disponibles`);

    actions.className = "table-actions";
    editButton.type = "button";
    editButton.className = "button button--secondary button--table";
    editButton.textContent = "Editar";
    editButton.setAttribute("aria-label", `Editar ${product.name}`);
    editButton.addEventListener("click", () => onEdit(product, editButton));

    deleteButton.type = "button";
    deleteButton.className = "button button--danger button--table";
    deleteButton.textContent = "Eliminar";
    deleteButton.setAttribute("aria-label", `Eliminar ${product.name}`);
    deleteButton.addEventListener("click", () => onDelete(product, deleteButton));

    actions.append(editButton, deleteButton);
    actionsCell.appendChild(actions);
    row.append(nameCell, categoryCell, priceCell, stockCell, actionsCell);
    tableBody.appendChild(row);
  }
}

function currentFilters() {
  return {
    search: document.getElementById("search-products")?.value.trim() ?? "",
    category: document.getElementById("category-filter")?.value ?? "",
  };
}

function getUniqueCategories(products) {
  const unique = new Map();
  for (const product of products) {
    const category = String(product.category ?? "").trim();
    const key = normalizeComparableText(category);
    if (category && key && !unique.has(key)) unique.set(key, category);
  }
  return [...unique.values()].toSorted((left, right) =>
    left.localeCompare(right, "es", { sensitivity: "base" }),
  );
}

function updateCategoryOptions(products, categorySelects = []) {
  const categoryFilter = document.getElementById("category-filter");
  const selectedCategory = categoryFilter.value;
  const categories = getUniqueCategories(products);

  categoryFilter.replaceChildren();
  const allCategories = document.createElement("option");
  allCategories.value = "";
  allCategories.textContent = "Todas las categorías";
  categoryFilter.appendChild(allCategories);

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  }

  const selectedMatch = categories.find((category) =>
    normalizeComparableText(category) === normalizeComparableText(selectedCategory),
  );
  categoryFilter.value = selectedMatch ?? "";

  for (const select of categorySelects) {
    const currentValue = select.value;
    select.replaceChildren();

    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = "Seleccioná una categoría";
    select.appendChild(placeholderOption);

    for (const category of categories) {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    }

    const customOption = document.createElement("option");
    customOption.value = "__new__";
    customOption.textContent = "＋ Crear nueva categoría";
    select.appendChild(customOption);

    const selectedExisting = categories.find((category) =>
      normalizeComparableText(category) === normalizeComparableText(currentValue),
    );
    select.value = currentValue === "__new__" ? "__new__" : selectedExisting ?? "";
  }
}

function validateProductData(product, { includeStock = false } = {}) {
  if (!product.name || !product.name.trim()) return "El nombre es obligatorio.";
  if (product.name.trim().length > 100) return "El nombre no puede superar 100 caracteres.";
  if (!product.category || !product.category.trim()) return "La categoría es obligatoria.";
  if (product.category.trim().length > 50) return "La categoría no puede superar 50 caracteres.";
  if (product.description.length > 500) return "La descripción no puede superar 500 caracteres.";

  if (typeof product.price !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(product.price)) {
    return "El precio debe ser un número no negativo con hasta dos decimales. Usá punto para los decimales.";
  }
  const [whole, fraction = ""] = product.price.split(".");
  const priceInCents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (priceInCents > maximumSafeInteger) return "El precio está fuera del rango admitido.";

  if (includeStock) {
    if (typeof product.stockText !== "string" || !/^\d+$/.test(product.stockText)) {
      return "El stock debe ser un número entero mayor o igual que cero.";
    }
    const stock = Number(product.stockText);
    if (!Number.isSafeInteger(stock) || stock < 0) {
      return "El stock está fuera del rango admitido.";
    }
  }
  return "";
}

function setFormError(message) {
  const formError = document.getElementById("form-error");
  if (!formError) return;
  formError.textContent = message;
  setVisible(formError, Boolean(message));
}

function setEditFormError(message) {
  const formError = document.getElementById("edit-form-error");
  if (!formError) return;
  formError.textContent = message;
  setVisible(formError, Boolean(message));
}

function resetForm(form, clearError = setFormError) {
  form.reset();
  clearError("");
}

let latestInventoryRequest = 0;

async function loadInventory(onEdit, onDelete, filters = {}, updateCategories = false) {
  const requestId = ++latestInventoryRequest;
  const loadingState = document.getElementById("loading-state");
  const emptyState = document.getElementById("empty-state");
  const noResultsState = document.getElementById("no-results-state");
  const errorState = document.getElementById("error-state");
  const deleteErrorState = document.getElementById("delete-error-state");
  const table = document.getElementById("inventory-table");
  const tableBody = document.getElementById("products-list");

  setVisible(loadingState, true);
  setVisible(emptyState, false);
  setVisible(noResultsState, false);
  setVisible(errorState, false);
  setVisible(deleteErrorState, false);
  setVisible(table, false);
  errorState.textContent = "";
  deleteErrorState.textContent = "";
  tableBody.replaceChildren();

  try {
    let activeFilters = filters;
    let products;
    if (updateCategories) {
      const allProducts = await getProducts();
      if (requestId !== latestInventoryRequest) return true;
      const categorySelects = [
        document.getElementById("product-category-select"),
        document.getElementById("edit-product-category-select"),
      ].filter(Boolean);
      updateCategoryOptions(allProducts, categorySelects);
      syncCategoryInputVisibility(
        document.getElementById("product-category-select"),
        document.getElementById("product-category-custom"),
      );
      syncCategoryInputVisibility(
        document.getElementById("edit-product-category-select"),
        document.getElementById("edit-product-category-custom"),
      );
      activeFilters = currentFilters();
      if (!activeFilters.search && !activeFilters.category) products = allProducts;
    }

    if (!products) products = await getProducts(activeFilters);
    if (requestId !== latestInventoryRequest) return true;
    setVisible(loadingState, false);

    if (products.length === 0) {
      setVisible(activeFilters.search || activeFilters.category ? noResultsState : emptyState, true);
      return true;
    }

    renderProducts(products, tableBody, onEdit, onDelete);
    setVisible(table, true);
    return true;
  } catch (error) {
    if (requestId !== latestInventoryRequest) return true;
    setVisible(loadingState, false);
    errorState.textContent = error instanceof Error && error.message
      ? error.message
      : genericErrorMessage;
    setVisible(errorState, true);
    return false;
  }
}

function syncCategoryInputVisibility(selectElement, customInputElement) {
  if (!selectElement || !customInputElement) return;
  const shouldHide = selectElement.value !== "__new__";
  if (!shouldHide && customInputElement.hidden) customInputElement.value = "";
  customInputElement.hidden = shouldHide;
  if (shouldHide) customInputElement.value = "";
}

function setSummaryValues(summary) {
  const summaryProducts = document.getElementById("summary-products");
  const summaryUnits = document.getElementById("summary-units");
  const summaryLowStock = document.getElementById("summary-low-stock");
  if (summaryProducts) summaryProducts.textContent = String(summary?.productsCount ?? 0);
  if (summaryUnits) summaryUnits.textContent = String(summary?.unitsInStock ?? 0);
  if (summaryLowStock) summaryLowStock.textContent = String(summary?.lowStockCount ?? 0);
}

async function loadSummary() {
  const summaryError = document.getElementById("summary-error");
  try {
    const summary = await getSummary();
    setSummaryValues(summary);
    if (summaryError) {
      summaryError.textContent = "";
      setVisible(summaryError, false);
    }
    return true;
  } catch (error) {
    if (summaryError) {
      summaryError.textContent = error instanceof Error && error.message
        ? error.message
        : "No se pudo cargar el resumen del inventario. Intentá nuevamente.";
      setVisible(summaryError, true);
    }
    return false;
  }
}

function formatCentsAsPrice(cents) {
  const value = BigInt(cents);
  const whole = (value / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = String(value % 100n).padStart(2, "0");
  return `$ ${whole},${fraction}`;
}

function priceTextToCents(price) {
  if (typeof price !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(price)) {
    throw new Error("El precio del producto no es válido.");
  }
  const [whole, fraction = ""] = price.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

function formatBudgetDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function createTextCell(text) {
  const cell = document.createElement("td");
  cell.textContent = String(text);
  return cell;
}

function createBudgetPdfLink(budgetId) {
  const link = document.createElement("a");
  link.className = "budget-pdf-link";
  link.href = `/api/budgets/${encodeURIComponent(budgetId)}/pdf`;
  link.textContent = "Descargar PDF";
  link.setAttribute("aria-label", `Descargar PDF del presupuesto ${budgetId}`);
  return link;
}

function initializeBudgetsPage({ refreshInventory, refreshSummary }) {
  const productSelect = document.getElementById("budget-product-select");
  const quantityInput = document.getElementById("budget-product-quantity");
  const stockHelp = document.getElementById("budget-stock-help");
  const addItemButton = document.getElementById("add-budget-item");
  const generateButton = document.getElementById("generate-budget");
  const draftTable = document.getElementById("budget-draft-table");
  const draftBody = document.getElementById("budget-draft-list");
  const draftEmpty = document.getElementById("budget-draft-empty");
  const draftTotal = document.getElementById("budget-draft-total");
  const builderError = document.getElementById("budget-builder-error");
  const budgetSuccess = document.getElementById("budget-success");
  const budgetsLoading = document.getElementById("budgets-loading");
  const budgetsError = document.getElementById("budgets-error");
  const pendingEmpty = document.getElementById("pending-budgets-empty");
  const pendingTable = document.getElementById("pending-budgets-table");
  const pendingBody = document.getElementById("pending-budgets-list");
  const historyEmpty = document.getElementById("budget-history-empty");
  const historyTable = document.getElementById("budget-history-table");
  const historyBody = document.getElementById("budget-history-list");
  const pendingCount = document.getElementById("pending-budget-count");

  if (!productSelect || !generateButton || !pendingBody || !historyBody) return;

  let availableProducts = [];
  let draftItems = [];

  function showBuilderError(message) {
    builderError.textContent = message;
    setVisible(builderError, Boolean(message));
  }

  function showBudgetSuccess(message) {
    budgetSuccess.textContent = message;
    setVisible(budgetSuccess, Boolean(message));
  }

  function selectedProduct() {
    const id = Number(productSelect.value);
    return availableProducts.find((product) => product.id === id) ?? null;
  }

  function syncProductSelection() {
    const product = selectedProduct();
    if (!product) {
      quantityInput.removeAttribute("max");
      stockHelp.textContent = "Seleccioná un producto para ver el stock disponible.";
      return;
    }
    quantityInput.max = String(product.stock);
    stockHelp.textContent = `Stock disponible: ${product.stock} unidades. Precio: ${formatPrice(product.price)}.`;
    if (!quantityInput.value || Number(quantityInput.value) < 1) quantityInput.value = "1";
  }

  async function loadBudgetProducts() {
    const products = await getProducts();
    availableProducts = products;
    const previousValue = productSelect.value;
    productSelect.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = products.some((product) => product.stock > 0)
      ? "Seleccioná un producto"
      : "No hay productos con stock disponible";
    productSelect.appendChild(placeholder);

    for (const product of products) {
      const option = document.createElement("option");
      option.value = String(product.id);
      option.textContent = `${product.name} — ${formatPrice(product.price)} — stock: ${product.stock}`;
      option.disabled = product.stock <= 0;
      productSelect.appendChild(option);
    }

    if (previousValue && products.some((product) => product.id === Number(previousValue) && product.stock > 0)) {
      productSelect.value = previousValue;
    }
    productSelect.disabled = !products.some((product) => product.stock > 0);
    addItemButton.disabled = productSelect.disabled;
    syncProductSelection();

    // Si el stock cambió mientras el usuario armaba el borrador, mantenemos
    // la cantidad escrita solo cuando todavía puede reservarse.
    let stockChanged = false;
    for (const item of draftItems) {
      const latest = products.find((product) => product.id === item.productId);
      item.availableStock = latest?.stock ?? 0;
      if (latest) item.product = latest;
      if (item.availableStock < item.quantity) stockChanged = true;
    }
    renderDraft();
    if (stockChanged) {
      showBuilderError("El stock disponible cambió desde que agregaste un producto. Ajustá la cantidad o quitá la línea antes de generar el presupuesto.");
    }
  }

  function renderDraft() {
    draftBody.replaceChildren();
    let totalCents = 0n;
    let hasInvalidAmount = false;

    for (const item of draftItems) {
      const row = document.createElement("tr");
      const priceCents = priceTextToCents(item.product.price);
      const lineTotal = priceCents * BigInt(item.quantity);
      totalCents += lineTotal;

      row.appendChild(createTextCell(item.product.name));
      row.appendChild(createTextCell(formatPrice(item.product.price)));

      const quantityCell = document.createElement("td");
      const input = document.createElement("input");
      input.className = "budget-quantity-input";
      input.type = "number";
      input.min = "1";
      input.max = String(item.availableStock ?? item.product.stock);
      input.step = "1";
      input.required = true;
      input.inputMode = "numeric";
      input.value = String(item.quantity);
      input.setAttribute("aria-label", `Cantidad de ${item.product.name}`);
      input.addEventListener("change", () => {
        const text = input.value.trim();
        const quantity = Number(text);
        if (!/^\d+$/.test(text) || !Number.isSafeInteger(quantity) || quantity < 1) {
          showBuilderError(`La cantidad de ${item.product.name} debe ser un entero mayor que cero.`);
          input.value = String(item.quantity);
          return;
        }
        if (quantity > (item.availableStock ?? item.product.stock)) {
          showBuilderError(`Solo hay ${item.availableStock ?? item.product.stock} unidades disponibles de ${item.product.name}.`);
          input.value = String(item.quantity);
          return;
        }
        item.quantity = quantity;
        showBuilderError("");
        renderDraft();
      });
      quantityCell.appendChild(input);
      row.appendChild(quantityCell);
      row.appendChild(createTextCell(formatCentsAsPrice(lineTotal)));

      const actionCell = document.createElement("td");
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "button button--danger button--table";
      removeButton.textContent = "Quitar";
      removeButton.setAttribute("aria-label", `Quitar ${item.product.name} del presupuesto`);
      removeButton.addEventListener("click", () => {
        draftItems = draftItems.filter((draftItem) => draftItem.productId !== item.productId);
        showBuilderError("");
        renderDraft();
      });
      actionCell.appendChild(removeButton);
      row.appendChild(actionCell);
      draftBody.appendChild(row);

      if (lineTotal > maximumSafeInteger || totalCents > maximumSafeInteger || item.quantity > (item.availableStock ?? item.product.stock)) {
        hasInvalidAmount = true;
      }
    }

    const hasItems = draftItems.length > 0;
    setVisible(draftTable, hasItems);
    setVisible(draftEmpty, !hasItems);
    draftTotal.textContent = totalCents <= maximumSafeInteger
      ? formatCentsAsPrice(totalCents)
      : "Importe fuera de rango";
    generateButton.disabled = !hasItems || hasInvalidAmount;
    if (hasInvalidAmount) showBuilderError("El importe total supera el máximo admitido. Reducí las cantidades.");
  }

  function appendStatusBadge(status) {
    const badge = document.createElement("span");
    badge.className = `budget-status budget-status--${status}`;
    badge.textContent = status === "paid" ? "Pagado" : status === "rejected" ? "Rechazado" : "Pendiente";
    return badge;
  }

  async function handleResolution(budget, status, button) {
    const isPaid = status === "paid";
    const message = isPaid
      ? `¿Confirmás que el presupuesto #${String(budget.id).padStart(5, "0")} fue pagado? El stock reservado no se devolverá.`
      : `¿Confirmás que el presupuesto #${String(budget.id).padStart(5, "0")} fue rechazado? Se devolverán las unidades reservadas al inventario.`;
    if (!window.confirm(message)) return;

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Procesando…";
    setVisible(budgetsError, false);
    try {
      await resolveBudget(budget.id, status);
      await loadBudgets();
      await loadBudgetProducts();
      await refreshInventory();
      await refreshSummary();
    } catch (error) {
      budgetsError.textContent = error instanceof Error && error.message
        ? error.message
        : "No se pudo actualizar el presupuesto. Intentá nuevamente.";
      setVisible(budgetsError, true);
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }

  async function loadBudgets() {
    setVisible(budgetsLoading, true);
    setVisible(budgetsError, false);
    try {
      const budgets = await getBudgets();
      const pending = budgets.filter((budget) => budget.status === "pending");
      const history = budgets.filter((budget) => budget.status === "paid" || budget.status === "rejected");
      pendingBody.replaceChildren();
      historyBody.replaceChildren();
      pendingCount.textContent = `${pending.length} ${pending.length === 1 ? "pendiente" : "pendientes"}`;

      for (const budget of pending) {
        const row = document.createElement("tr");
        row.appendChild(createTextCell(`#${String(budget.id).padStart(5, "0")}`));
        row.appendChild(createTextCell(formatBudgetDate(budget.createdAt)));
        row.appendChild(createTextCell(`${budget.items.length} productos · ${budget.items.reduce((sum, item) => sum + item.quantity, 0)} unidades`));
        row.appendChild(createTextCell(formatPrice(budget.total)));
        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");
        actions.className = "budget-inline-actions";
        actions.appendChild(createBudgetPdfLink(budget.id));

        const paidButton = document.createElement("button");
        paidButton.type = "button";
        paidButton.className = "button button--primary";
        paidButton.textContent = "Pagado";
        paidButton.addEventListener("click", () => handleResolution(budget, "paid", paidButton));

        const rejectedButton = document.createElement("button");
        rejectedButton.type = "button";
        rejectedButton.className = "button button--danger";
        rejectedButton.textContent = "Rechazado";
        rejectedButton.addEventListener("click", () => handleResolution(budget, "rejected", rejectedButton));
        actions.append(paidButton, rejectedButton);
        actionsCell.appendChild(actions);
        row.appendChild(actionsCell);
        pendingBody.appendChild(row);
      }

      for (const budget of history) {
        const row = document.createElement("tr");
        row.appendChild(createTextCell(`#${String(budget.id).padStart(5, "0")}`));
        row.appendChild(createTextCell(formatBudgetDate(budget.createdAt)));
        const statusCell = document.createElement("td");
        statusCell.appendChild(appendStatusBadge(budget.status));
        row.appendChild(statusCell);
        row.appendChild(createTextCell(formatPrice(budget.total)));
        const pdfCell = document.createElement("td");
        pdfCell.appendChild(createBudgetPdfLink(budget.id));
        row.appendChild(pdfCell);
        historyBody.appendChild(row);
      }

      setVisible(pendingEmpty, pending.length === 0);
      setVisible(pendingTable, pending.length > 0);
      setVisible(historyEmpty, history.length === 0);
      setVisible(historyTable, history.length > 0);
      return true;
    } catch (error) {
      budgetsError.textContent = error instanceof Error && error.message
        ? error.message
        : "No se pudieron cargar los presupuestos. Intentá nuevamente.";
      setVisible(budgetsError, true);
      return false;
    } finally {
      setVisible(budgetsLoading, false);
    }
  }

  productSelect.addEventListener("change", syncProductSelection);

  addItemButton.addEventListener("click", () => {
    showBuilderError("");
    const product = selectedProduct();
    if (!product) {
      showBuilderError("Seleccioná un producto del listado.");
      productSelect.focus();
      return;
    }
    const quantityText = quantityInput.value.trim();
    const quantity = Number(quantityText);
    if (!/^\d+$/.test(quantityText) || !Number.isSafeInteger(quantity) || quantity <= 0) {
      showBuilderError("La cantidad debe ser un número entero mayor que cero.");
      quantityInput.focus();
      return;
    }
    if (quantity > product.stock) {
      showBuilderError(`No hay stock suficiente de ${product.name}. Disponible: ${product.stock} unidades.`);
      quantityInput.focus();
      return;
    }
    if (draftItems.some((item) => item.productId === product.id)) {
      showBuilderError(`Ya agregaste ${product.name}. Cambiá su cantidad directamente en el detalle.`);
      return;
    }
    if (draftItems.length >= 50) {
      showBuilderError("Un presupuesto puede contener como máximo 50 productos diferentes.");
      return;
    }
    draftItems.push({ productId: product.id, quantity, product, availableStock: product.stock });
    renderDraft();
    productSelect.value = "";
    quantityInput.value = "1";
    syncProductSelection();
  });

  generateButton.addEventListener("click", async () => {
    showBuilderError("");
    showBudgetSuccess("");
    if (draftItems.length === 0) {
      showBuilderError("Agregá al menos un producto para generar el presupuesto.");
      return;
    }

    generateButton.disabled = true;
    const originalLabel = generateButton.textContent;
    generateButton.textContent = "Generando presupuesto…";
    try {
      const budget = await createBudget({
        items: draftItems.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      });
      draftItems = [];
      renderDraft();
      let pdfDownloaded = false;
      try {
        const { blob, filename } = await getBudgetPdf(budget.id);
        const objectUrl = URL.createObjectURL(blob);
        const downloadLink = document.createElement("a");
        downloadLink.href = objectUrl;
        downloadLink.download = filename;
        downloadLink.hidden = true;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        pdfDownloaded = true;
      } catch {
        // El presupuesto y la reserva ya se confirmaron. El PDF sigue disponible
        // desde el enlace de descarga que aparece en el listado.
      }

      const refreshed = await loadBudgets();
      await loadBudgetProducts();
      await refreshInventory();
      await refreshSummary();
      showBudgetSuccess(
        `Se generó el presupuesto #${String(budget.id).padStart(5, "0")}${pdfDownloaded ? " y se descargó el PDF." : ". Podés descargar el PDF desde el listado de pendientes."}`,
      );
      if (!refreshed) showBudgetSuccess(`El presupuesto #${budget.id} se generó, pero no se pudo actualizar el listado.`);
    } catch (error) {
      showBuilderError(error instanceof Error && error.message
        ? error.message
        : "No se pudo generar el presupuesto. Revisá los datos e intentá nuevamente.");
      await loadBudgetProducts();
    } finally {
      generateButton.textContent = originalLabel;
      generateButton.disabled = draftItems.length === 0;
      renderDraft();
    }
  });

  loadBudgetProducts().catch((error) => {
    showBuilderError(error instanceof Error && error.message
      ? error.message
      : "No se pudieron cargar los productos para presupuestar.");
    productSelect.disabled = true;
    addItemButton.disabled = true;
  });
  loadBudgets();
  return {
    async refresh() {
      await Promise.all([
        loadBudgets(),
        loadBudgetProducts().catch((error) => {
          showBuilderError(error instanceof Error && error.message
            ? error.message
            : "No se pudo actualizar el stock para presupuestar.");
        }),
        refreshInventory(),
        refreshSummary(),
      ]);
    },
  };
}

function initializeInventoryPage() {
  const createPanel = document.getElementById("create-product-panel");
  const createForm = document.getElementById("create-product-form");
  const openButton = document.getElementById("open-create-product");
  const cancelButton = document.getElementById("cancel-create-product");
  const submitButton = document.getElementById("submit-create-product");
  const successState = document.getElementById("success-state");
  const filterForm = document.getElementById("filter-form");
  const searchInput = document.getElementById("search-products");
  const categoryFilter = document.getElementById("category-filter");
  const editPanel = document.getElementById("edit-product-panel");
  const editForm = document.getElementById("edit-product-form");
  const cancelEditButton = document.getElementById("cancel-edit-product");
  const submitEditButton = document.getElementById("submit-edit-product");
  const backdrop = document.getElementById("modal-backdrop");
  let editTrigger = null;
  let editingProductId = null;
  let activePanel = null;
  let lastFilterKey = null;
  let pendingFilterKey = null;

  function toggleModal(openPanel) {
    const panels = [createPanel, editPanel];
    for (const panel of panels) {
      setVisible(panel, panel === openPanel);
      panel.setAttribute("aria-hidden", panel === openPanel ? "false" : "true");
    }
    activePanel = openPanel;
    setVisible(backdrop, Boolean(openPanel));
    const bodyClassList = document.body?.classList;
    if (bodyClassList) {
      if (openPanel) bodyClassList.add("modal-open");
      else bodyClassList.remove("modal-open");
    }
  }

  function closeCurrentModal() {
    const previousPanel = activePanel;
    toggleModal(null);
    if (previousPanel === editPanel && editTrigger?.focus) editTrigger.focus();
    else openButton.focus();
  }

  function resolveCategoryValue(form, categoryKey, selectKey) {
    const categorySelect = form.elements[selectKey];
    const customInput = form.elements[categoryKey];
    if (categorySelect?.value && categorySelect.value !== "__new__") {
      return categorySelect.value.trim();
    }
    return customInput?.value.trim() ?? "";
  }

  function applyFilters() {
    const filters = currentFilters();
    const filterKey = `${filters.search}\u0000${filters.category}`;
    if (filterKey === lastFilterKey || filterKey === pendingFilterKey) return;
    pendingFilterKey = filterKey;
    lastFilterKey = null;
    loadInventory(showEditForm, removeProduct, filters).then((refreshed) => {
      if (pendingFilterKey !== filterKey) return;
      pendingFilterKey = null;
      if (refreshed) lastFilterKey = filterKey;
    });
  }

  async function removeProduct(product, button) {
    const confirmed = window.confirm(
      `¿Deseás eliminar el producto "${product.name}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    const deleteErrorState = document.getElementById("delete-error-state");
    setVisible(deleteErrorState, false);
    setVisible(successState, false);
    button.disabled = true;
    const originalButtonLabel = button.textContent;
    button.textContent = "Eliminando…";

    try {
      await deleteProduct(product.id);
      const refreshed = await loadInventory(showEditForm, removeProduct, currentFilters(), true);
      await loadSummary();
      successState.textContent = refreshed
        ? `Se eliminó el producto ${product.name}.`
        : `Se eliminó el producto ${product.name}, pero no se pudo actualizar el listado.`;
      setVisible(successState, true);
      openButton.focus();
    } catch (error) {
      deleteErrorState.textContent = error instanceof Error && error.message
        ? error.message
        : genericDeleteErrorMessage;
      setVisible(deleteErrorState, true);
    } finally {
      button.disabled = false;
      button.textContent = originalButtonLabel;
    }
  }

  function showEditForm(product, trigger) {
    editTrigger = trigger;
    editingProductId = product.id;
    toggleModal(editPanel);
    setVisible(successState, false);
    setEditFormError("");
    editForm.elements.name.value = product.name;
    editForm.elements.description.value = product.description || "";
    editForm.elements.price.value = product.price;
    editForm.elements.stock.value = String(product.stock);

    const categorySelect = document.getElementById("edit-product-category-select");
    const categoryInput = document.getElementById("edit-product-category-custom");
    categorySelect.value = product.category;
    if (categorySelect.value) {
      categoryInput.value = product.category;
      categoryInput.hidden = true;
    } else {
      categorySelect.value = "__new__";
      categoryInput.value = product.category;
      categoryInput.hidden = false;
    }
    editForm.elements.name.focus();
  }


  function openCreateModal() {
    toggleModal(createPanel);
    setVisible(successState, false);
    setFormError("");
    resetForm(createForm);
    const createSelect = document.getElementById("product-category-select");
    const createInput = document.getElementById("product-category-custom");
    createSelect.value = "";
    createInput.value = "";
    createInput.hidden = true;
    createForm.elements.name.focus();
  }

  openButton.addEventListener("click", openCreateModal);

  cancelButton.addEventListener("click", () => {
    resetForm(createForm);
    toggleModal(null);
    openButton.focus();
  });

  cancelEditButton.addEventListener("click", () => {
    resetForm(editForm, setEditFormError);
    closeCurrentModal();
  });

  backdrop.addEventListener("click", closeCurrentModal);

  document.addEventListener("keydown", (event) => {
    if (!activePanel) return;
    if (event.key === "Escape") {
      event.preventDefault?.();
      closeCurrentModal();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = [...activePanel.querySelectorAll("button, input, select, textarea")]
      .filter((element) => !element.disabled && !element.hidden);
    if (focusable.length === 0) {
      event.preventDefault?.();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault?.();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault?.();
      first.focus();
    }
  });

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormError("");
    setVisible(successState, false);

    const product = {
      name: createForm.elements.name.value.trim(),
      category: resolveCategoryValue(createForm, "category", "category-select"),
      price: createForm.elements.price.value.trim(),
      stockText: createForm.elements.stock.value.trim(),
      description: createForm.elements.description.value,
    };
    const validationMessage = validateProductData(product, { includeStock: true });
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    const payload = {
      name: product.name,
      category: product.category,
      price: product.price,
      stock: Number(product.stockText),
      description: product.description,
    };
    submitButton.disabled = true;
    const originalSubmitLabel = submitButton.textContent;
    submitButton.textContent = "Guardando…";

    try {
      const createdProduct = await createProduct(payload);
      resetForm(createForm);
      toggleModal(null);
      const refreshed = await loadInventory(showEditForm, removeProduct, currentFilters(), true);
      await loadSummary();
      successState.textContent = refreshed
        ? `Se registró el producto ${createdProduct.name}.`
        : `Se registró el producto ${createdProduct.name}, pero no se pudo actualizar el listado.`;
      setVisible(successState, true);
      openButton.focus();
    } catch (error) {
      setFormError(error instanceof Error && error.message ? error.message : genericCreateErrorMessage);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalSubmitLabel;
    }
  });

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setEditFormError("");
    setVisible(successState, false);

    const product = {
      name: editForm.elements.name.value.trim(),
      description: editForm.elements.description.value,
      category: resolveCategoryValue(editForm, "category", "category-select"),
      price: editForm.elements.price.value.trim(),
      stockText: editForm.elements.stock.value.trim(),
    };
    const validationMessage = validateProductData(product, { includeStock: true });
    if (validationMessage) {
      setEditFormError(validationMessage);
      return;
    }

    submitEditButton.disabled = true;
    const originalSubmitLabel = submitEditButton.textContent;
    submitEditButton.textContent = "Guardando…";

    try {
      const updatedProduct = await updateProduct(editingProductId, {
        name: product.name,
        description: product.description,
        category: product.category,
        price: product.price,
        stock: Number(product.stockText),
      });
      resetForm(editForm, setEditFormError);
      toggleModal(null);
      const refreshed = await loadInventory(showEditForm, removeProduct, currentFilters(), true);
      await loadSummary();
      successState.textContent = refreshed
        ? `Se actualizó el producto ${updatedProduct.name}.`
        : `Se actualizó el producto ${updatedProduct.name}, pero no se pudo actualizar el listado.`;
      setVisible(successState, true);
      openButton.focus();
    } catch (error) {
      setEditFormError(error instanceof Error && error.message ? error.message : genericUpdateErrorMessage);
    } finally {
      submitEditButton.disabled = false;
      submitEditButton.textContent = originalSubmitLabel;
    }
  });


  let searchDebounceTimer = null;
  searchInput.addEventListener("input", () => {
    if (searchDebounceTimer !== null) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchDebounceTimer = null;
      applyFilters();
    }, 220);
  });
  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (searchDebounceTimer !== null) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
    applyFilters();
  });
  categoryFilter.addEventListener("change", applyFilters);

  for (const prefix of ["product", "edit-product"]) {
    const select = document.getElementById(`${prefix}-category-select`);
    const custom = document.getElementById(`${prefix}-category-custom`);
    if (!select || !custom) continue;
    select.addEventListener("change", () => {
      syncCategoryInputVisibility(select, custom);
      if (!custom.hidden) custom.focus();
    });
  }

  const initialFilters = currentFilters();
  const initialFilterKey = `${initialFilters.search}\u0000${initialFilters.category}`;
  pendingFilterKey = initialFilterKey;
  loadInventory(showEditForm, removeProduct, initialFilters, true).then((refreshed) => {
    if (pendingFilterKey !== initialFilterKey) return;
    pendingFilterKey = null;
    if (refreshed) lastFilterKey = initialFilterKey;
  });
  loadSummary();
  const budgetsPage = initializeBudgetsPage({
    refreshInventory: () => loadInventory(
      showEditForm,
      removeProduct,
      currentFilters(),
      true,
    ),
    refreshSummary: loadSummary,
  });
  const budgetsNavigationLink = document.getElementById("open-budgets-section");
  const refreshBudgetsAutomatically = () => budgetsPage?.refresh?.();
  budgetsNavigationLink?.addEventListener("click", refreshBudgetsAutomatically);
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("focus", refreshBudgetsAutomatically);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshBudgetsAutomatically();
  });
}

document.addEventListener("DOMContentLoaded", initializeInventoryPage);
