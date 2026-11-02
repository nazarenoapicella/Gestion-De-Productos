function moneyFromCents(cents) {
  const value = BigInt(cents);
  const whole = (value / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = String(value % 100n).padStart(2, "0");
  return `$ ${whole},${fraction}`;
}

function cleanPdfText(value) {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function escapePdfText(value) {
  return cleanPdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\xFF]/g, "?");
}

function wrapText(value, maxLength = 44) {
  const words = cleanPdfText(value).split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function textCommand(value, x, y, size = 9) {
  return `BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(value)}) Tj ET`;
}

function lineCommand(x1, y1, x2, y2) {
  return `q 0.82 0.87 0.88 RG 0.6 w ${x1} ${y1} m ${x2} ${y2} l S Q`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}

function buildPageCommands(budget, items, pageNumber, pageCount) {
  const commands = [];
  const budgetNumber = String(budget.id).padStart(5, "0");
  commands.push(textCommand("Stock Simple", 48, 798, 10));
  commands.push(textCommand("PRESUPUESTO", 48, 770, 21));
  commands.push(textCommand(`Nro. ${budgetNumber}`, 430, 790, 10));
  commands.push(textCommand(`Fecha: ${formatDate(budget.created_at)}`, 365, 773, 8));
  commands.push(lineCommand(48, 753, 547, 753));
  commands.push(textCommand("Detalle de productos", 48, 731, 11));
  commands.push(textCommand("Producto", 48, 708, 8));
  commands.push(textCommand("Cant.", 342, 708, 8));
  commands.push(textCommand("Precio unit.", 390, 708, 8));
  commands.push(textCommand("Subtotal", 489, 708, 8));
  commands.push(lineCommand(48, 699, 547, 699));

  let y = 680;
  for (const item of items) {
    const nameLines = wrapText(item.product_name, 43);
    const rowHeight = Math.max(20, nameLines.length * 11 + 7);
    nameLines.forEach((line, index) => {
      commands.push(textCommand(line, 48, y - index * 11, 8));
    });
    commands.push(textCommand(String(item.quantity), 347, y, 8));
    commands.push(textCommand(moneyFromCents(item.unit_price_cents), 390, y, 8));
    commands.push(textCommand(moneyFromCents(item.line_total_cents), 489, y, 8));
    y -= rowHeight;
    commands.push(lineCommand(48, y + 5, 547, y + 5));
  }

  if (pageNumber === pageCount) {
    const totalY = Math.max(80, y - 28);
    commands.push(textCommand("TOTAL", 420, totalY, 12));
    commands.push(textCommand(moneyFromCents(budget.total_cents), 489, totalY, 12));
    commands.push(textCommand("Importes expresados en pesos argentinos (ARS).", 48, 70, 8));
    commands.push(textCommand("Este documento es un presupuesto y no constituye comprobante de pago.", 48, 56, 8));
  } else {
    commands.push(textCommand("Continúa en la página siguiente.", 48, 70, 8));
  }

  commands.push(textCommand(`Página ${pageNumber} de ${pageCount}`, 475, 35, 8));
  return commands.join("\n");
}

function buildPdf(streams) {
  const objects = [];
  const pageCount = streams.length;
  const pageObjectIds = streams.map((_, index) => 3 + index * 2);
  const fontObjectId = 3 + pageCount * 2;

  objects[1] = Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "ascii");
  objects[2] = Buffer.from(
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    "ascii",
  );

  streams.forEach((stream, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    const streamBuffer = Buffer.from(stream, "latin1");
    objects[pageId] = Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      "ascii",
    );
    objects[contentId] = Buffer.concat([
      Buffer.from(`<< /Length ${streamBuffer.length} >>\nstream\n`, "ascii"),
      streamBuffer,
      Buffer.from("\nendstream", "ascii"),
    ]);
  });

  objects[fontObjectId] = Buffer.from(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "ascii",
  );

  const chunks = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets = [0];
  let currentOffset = chunks[0].length;
  for (let id = 1; id < objects.length; id += 1) {
    const objectBuffer = Buffer.concat([
      Buffer.from(`${id} 0 obj\n`, "ascii"),
      objects[id],
      Buffer.from("\nendobj\n", "ascii"),
    ]);
    offsets[id] = currentOffset;
    chunks.push(objectBuffer);
    currentOffset += objectBuffer.length;
  }

  const xrefOffset = currentOffset;
  const xref = [
    `xref\n0 ${objects.length}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  ].join("");
  chunks.push(Buffer.from(xref, "ascii"));
  return Buffer.concat(chunks);
}

function createBudgetPdf(budget) {
  const pageItems = [];
  let currentPage = [];
  let usedRows = 0;

  for (const item of budget.items) {
    const lines = wrapText(item.product_name, 43).length;
    const rowCost = Math.max(1, lines);
    if (currentPage.length > 0 && (currentPage.length >= 18 || usedRows + rowCost > 28)) {
      pageItems.push(currentPage);
      currentPage = [];
      usedRows = 0;
    }
    currentPage.push(item);
    usedRows += rowCost;
  }
  if (currentPage.length > 0 || pageItems.length === 0) pageItems.push(currentPage);

  const streams = pageItems.map((items, index) =>
    buildPageCommands(budget, items, index + 1, pageItems.length),
  );
  return buildPdf(streams);
}

module.exports = { createBudgetPdf };
