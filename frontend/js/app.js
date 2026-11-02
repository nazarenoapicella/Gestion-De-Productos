import {
  getProducts,
  getSummary,
  createProduct,
  updateProduct,
  adjustProductStock,
  deleteProduct,
} from "./api.js";

const genericErrorMessage = "No se pudieron cargar los productos. Intentá nuevamente.";
const genericCreateErrorMessage = "No se pudo registrar el producto. Intentá nuevamente.";
const genericUpdateErrorMessage = "No se pudo actualizar el producto. Intentá nuevamente.";
const genericAdjustErrorMessage = "No se pudo ajustar el stock. Intentá nuevamente.";
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

function renderProducts(products, tableBody, onEdit, onAdjust, onDelete) {
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
    const adjustButton = document.createElement("button");
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

    adjustButton.type = "button";
    adjustButton.className = "button button--secondary button--table";
    adjustButton.textContent = "Ajustar stock";
    adjustButton.setAttribute("aria-label", `Ajustar stock de ${product.name}`);
    adjustButton.addEventListener("click", () => onAdjust(product, adjustButton));

    deleteButton.type = "button";
    deleteButton.className = "button button--danger button--table";
    deleteButton.textContent = "Eliminar";
    deleteButton.setAttribute("aria-label", `Eliminar ${product.name}`);
    deleteButton.addEventListener("click", () => onDelete(product, deleteButton));

    actions.append(editButton, adjustButton, deleteButton);
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
      return "El stock inicial debe ser un número entero mayor o igual que cero.";
    }
    const stock = Number(product.stockText);
    if (!Number.isSafeInteger(stock) || stock < 0) {
      return "El stock inicial está fuera del rango admitido.";
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

function setAdjustmentFormError(message) {
  const formError = document.getElementById("stock-adjustment-error");
  if (!formError) return;
  formError.textContent = message;
  setVisible(formError, Boolean(message));
}

function resetForm(form, clearError = setFormError) {
  form.reset();
  clearError("");
}

let latestInventoryRequest = 0;

async function loadInventory(onEdit, onAdjust, onDelete, filters = {}, updateCategories = false) {
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

    renderProducts(products, tableBody, onEdit, onAdjust, onDelete);
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
  const clearFiltersButton = document.getElementById("clear-filters");
  const editPanel = document.getElementById("edit-product-panel");
  const editForm = document.getElementById("edit-product-form");
  const cancelEditButton = document.getElementById("cancel-edit-product");
  const submitEditButton = document.getElementById("submit-edit-product");
  const stockPanel = document.getElementById("stock-adjustment-panel");
  const stockForm = document.getElementById("stock-adjustment-form");
  const cancelStockButton = document.getElementById("cancel-stock-adjustment");
  const submitStockButton = document.getElementById("submit-stock-adjustment");
  const backdrop = document.getElementById("modal-backdrop");
  let editTrigger = null;
  let stockTrigger = null;
  let editingProductId = null;
  let adjustingProduct = null;
  let activePanel = null;
  let lastFilterKey = null;
  let pendingFilterKey = null;

  function toggleModal(openPanel) {
    const panels = [createPanel, editPanel, stockPanel];
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
    else if (previousPanel === stockPanel && stockTrigger?.focus) stockTrigger.focus();
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
    loadInventory(showEditForm, showStockAdjustmentForm, removeProduct, filters).then((refreshed) => {
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
      const refreshed = await loadInventory(showEditForm, showStockAdjustmentForm, removeProduct, currentFilters(), true);
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

  function showStockAdjustmentForm(product, trigger) {
    stockTrigger = trigger;
    adjustingProduct = product;
    toggleModal(stockPanel);
    setVisible(successState, false);
    setAdjustmentFormError("");
    stockForm.reset();
    stockForm.elements.operation.value = "increase";
    stockForm.elements.quantity.value = "";
    document.getElementById("stock-adjustment-title").textContent = `Ajustar stock: ${product.name}`;
    document.getElementById("stock-adjustment-current").textContent = `Stock actual: ${product.stock} unidades`;
    stockForm.elements.operation.focus();
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

  cancelStockButton.addEventListener("click", () => {
    resetForm(stockForm, setAdjustmentFormError);
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
      const refreshed = await loadInventory(showEditForm, showStockAdjustmentForm, removeProduct, currentFilters(), true);
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
    };
    const validationMessage = validateProductData(product);
    if (validationMessage) {
      setEditFormError(validationMessage);
      return;
    }

    submitEditButton.disabled = true;
    const originalSubmitLabel = submitEditButton.textContent;
    submitEditButton.textContent = "Guardando…";

    try {
      const updatedProduct = await updateProduct(editingProductId, product);
      resetForm(editForm, setEditFormError);
      toggleModal(null);
      const refreshed = await loadInventory(showEditForm, showStockAdjustmentForm, removeProduct, currentFilters(), true);
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

  stockForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAdjustmentFormError("");
    setVisible(successState, false);

    const operation = stockForm.elements.operation.value;
    const quantityText = stockForm.elements.quantity.value.trim();
    if (!["increase", "decrease"].includes(operation)) {
      setAdjustmentFormError("Seleccioná una operación válida.");
      return;
    }
    if (!/^\d+$/.test(quantityText)) {
      setAdjustmentFormError("La cantidad debe ser un número entero mayor que cero.");
      return;
    }
    const quantity = Number(quantityText);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      setAdjustmentFormError("La cantidad debe ser un número entero positivo dentro del rango admitido.");
      return;
    }

    submitStockButton.disabled = true;
    const originalSubmitLabel = submitStockButton.textContent;
    submitStockButton.textContent = "Aplicando…";
    try {
      const updatedProduct = await adjustProductStock(adjustingProduct.id, { operation, quantity });
      toggleModal(null);
      const refreshed = await loadInventory(showEditForm, showStockAdjustmentForm, removeProduct, currentFilters(), true);
      await loadSummary();
      successState.textContent = refreshed
        ? `Stock actualizado: ${updatedProduct.name} ahora tiene ${updatedProduct.stock} unidades.`
        : `El stock de ${updatedProduct.name} se actualizó, pero no se pudo refrescar el listado.`;
      setVisible(successState, true);
      openButton.focus();
    } catch (error) {
      setAdjustmentFormError(error instanceof Error && error.message ? error.message : genericAdjustErrorMessage);
    } finally {
      submitStockButton.disabled = false;
      submitStockButton.textContent = originalSubmitLabel;
    }
  });

  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applyFilters();
  });
  categoryFilter.addEventListener("change", applyFilters);

  clearFiltersButton.addEventListener("click", () => {
    searchInput.value = "";
    categoryFilter.value = "";
    applyFilters();
  });

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
  loadInventory(showEditForm, showStockAdjustmentForm, removeProduct, initialFilters, true).then((refreshed) => {
    if (pendingFilterKey !== initialFilterKey) return;
    pendingFilterKey = null;
    if (refreshed) lastFilterKey = initialFilterKey;
  });
  loadSummary();
}

document.addEventListener("DOMContentLoaded", initializeInventoryPage);
