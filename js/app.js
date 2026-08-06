// ==========================================================================
// Utilidades de UI compartidas
// ==========================================================================

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 4500);
}

function starsSVG(fillCount, total = 5) {
  let html = '<span class="stars">';
  for (let i = 1; i <= total; i++) {
    const cls = i <= fillCount ? "star-filled" : "star-empty";
    html += `<svg viewBox="0 0 24 24" class="${cls}"><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9"/></svg>`;
  }
  html += "</span>";
  return html;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ==========================================================================
// Render de la grilla principal
// ==========================================================================

let state = { search: "", tag: "" };

function cardTemplate(model, rank) {
  const hasMultiple = model.images && model.images.length > 1;
  const imagesAttr = hasMultiple ? `data-images='${JSON.stringify(model.images).replace(/'/g, "&apos;")}'` : "";
  const mediaTag = model.coverType === "video"
    ? `<video src="${model.cover}" muted playsinline loop autoplay></video>`
    : `<img class="card-photo" src="${model.cover || ''}" alt="${escapeHTML(model.name)}" loading="lazy" data-index="0" ${imagesAttr}>`;
  const href = model.slug ? `/m/${encodeURIComponent(model.slug)}` : `model.html?id=${model.id}`;

  return `
    <a class="card" href="${href}">
      <div class="card-media">
        ${rank ? `<span class="card-rank mono">#${rank}</span>` : ""}
        ${model.cover ? mediaTag : ""}
      </div>
      <div class="card-body">
        <div class="card-name">${escapeHTML(model.name)}</div>
        <div class="card-tags">${(model.tags || []).slice(0, 3).map(t => `<span>#${escapeHTML(t)}</span>`).join("")}${model.tags && model.tags.length > 3 ? `<span class="tag-more">+${model.tags.length - 3}</span>` : ""}</div>
        <div class="card-footer">
          ${starsSVG(Math.round(model.rating_avg))}
          <span class="rating-count mono">${model.rating_count}</span>
        </div>
      </div>
    </a>`;
}

async function renderGrid() {
  const grid = document.getElementById("grid");
  grid.innerHTML = `<div class="empty-state">Cargando…</div>`;
  try {
    const models = await DB.listModels({ search: state.search, tag: state.tag });
    if (models.length === 0) {
      grid.innerHTML = `<div class="empty-state">No hay modelos todavía. Sube el primero con “+ Subir nueva/o”.</div>`;
      return;
    }
    grid.innerHTML = models.map((m, i) => cardTemplate(m, i < 3 && !state.search && !state.tag ? i + 1 : null)).join("");
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="empty-state">Ocurrió un error cargando el catálogo.</div>`;
  }
}

const MAX_INDEX_TAGS = 8;

async function computeTopTags(limit = MAX_INDEX_TAGS) {
  const allModels = await DB.listModels({});
  const scoreByTag = {};

  allModels.forEach(m => {
    (m.tags || []).forEach(t => {
      if (!scoreByTag[t]) scoreByTag[t] = { sum: 0, count: 0 };
      scoreByTag[t].sum += m.rating_avg || 0;
      scoreByTag[t].count += 1;
    });
  });

  return Object.entries(scoreByTag)
    .map(([tag, { sum, count }]) => ({ tag, avg: sum / count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, limit)
    .map(s => s.tag);
}

async function renderTagRow() {
  const row = document.getElementById("tag-row");
  const topTags = await computeTopTags();
  if (topTags.length === 0) { row.innerHTML = ""; return; }

  row.innerHTML =
    `<button class="tag-chip mono ${state.tag === "" ? "active" : ""}" data-tag="">Todas</button>` +
    topTags.map(t => `<button class="tag-chip mono ${state.tag === t ? "active" : ""}" data-tag="${escapeHTML(t)}">#${escapeHTML(t)}</button>`).join("");

  row.querySelectorAll(".tag-chip[data-tag]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.tag = btn.dataset.tag;
      renderTagRow();
      renderGrid();
    });
  });
}

document.getElementById("search-input").addEventListener("input", (e) => {
  state.search = e.target.value.trim();
  renderGrid();
});

// ==========================================================================
// CAPTCHA (Cloudflare Turnstile)
// ==========================================================================
// Si TURNSTILE_SITE_KEY está vacío en config.js, no se muestra ni se exige
// nada (queda igual que antes). En cuanto pongas tu Site Key ahí, el
// widget aparece solo y el botón de publicar no se habilita hasta que la
// persona lo resuelva.

let turnstileWidgetId = null;
let turnstileToken = "";

window.onTurnstileLoad = function () {
  if (!TURNSTILE_SITE_KEY) return;
  document.getElementById("turnstile-field").style.display = "block";
  turnstileWidgetId = turnstile.render("#turnstile-widget", {
    sitekey: TURNSTILE_SITE_KEY,
    callback: (token) => { turnstileToken = token; },
    "expired-callback": () => { turnstileToken = ""; },
    "error-callback": () => { turnstileToken = ""; },
  });
};

function resetTurnstile() {
  turnstileToken = "";
  if (turnstileWidgetId !== null && window.turnstile) {
    turnstile.reset(turnstileWidgetId);
  }
}

// ==========================================================================
// Modal de subida
// ==========================================================================

const overlay = document.getElementById("upload-overlay");
const form = document.getElementById("upload-form");
let selectedFiles = [];
let selectedTags = [];
let duplicateBlocking = false;

function openModal() {
  overlay.style.display = "flex";
  document.getElementById("f-name").focus();
  loadKnownTags();
}
function closeModal() {
  overlay.style.display = "none";
  form.reset();
  selectedFiles = [];
  selectedTags = [];
  duplicateBlocking = false;
  renderPreviewGrid();
  renderTagPills();
  document.getElementById("duplicate-warning").classList.remove("show");
  document.getElementById("upload-error").classList.remove("show");
  hideTagSuggestions();
  resetTurnstile();
}

document.getElementById("btn-open-upload").addEventListener("click", openModal);
document.getElementById("btn-close-upload").addEventListener("click", closeModal);
overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });

// ---- detección de nombres repetidos/similares ----

let nameCheckTimer = null;
document.getElementById("f-name").addEventListener("input", (e) => {
  clearTimeout(nameCheckTimer);
  const name = e.target.value.trim();
  const warnEl = document.getElementById("duplicate-warning");
  if (!name) { warnEl.classList.remove("show"); duplicateBlocking = false; return; }

  nameCheckTimer = setTimeout(async () => {
    const matches = await DB.findSimilarNames(name);
    if (matches.length > 0) {
      duplicateBlocking = true;
      const list = matches.slice(0, 3).map(m => `<a href="model.html?id=${m.id}" target="_blank">${escapeHTML(m.name)}</a>`).join(", ");
      warnEl.innerHTML = `Ya existe algo parecido: ${list}. Si es el mismo, ábrelo y agrega ahí las fotos nuevas en vez de crear otro.`;
      warnEl.classList.add("show");
    } else {
      duplicateBlocking = false;
      warnEl.classList.remove("show");
    }
  }, 350);
});

// Pone mayúscula la primera letra de cada palabra del nombre
document.getElementById("f-name").addEventListener("blur", (e) => {
  e.target.value = e.target.value.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
});

// ---- dropzone de archivos ----

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("f-files");

if (typeof ALLOW_VIDEO_UPLOADS !== "undefined" && !ALLOW_VIDEO_UPLOADS) {
  fileInput.accept = "image/*";
  document.getElementById("dropzone-hint").textContent = "Solo fotos por ahora (videos desactivados temporalmente)";
}

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("drag"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag");
  addFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", (e) => addFiles(e.target.files));

function addFiles(fileList) {
  const { kept, blockedVideos } = filterAllowedFiles(fileList);
  if (blockedVideos > 0) {
    showToast(`Los videos están desactivados por ahora — se agregaron solo las fotos (${blockedVideos} video(s) omitido(s)).`);
  }
  compressFiles(kept).then(compressed => {
    selectedFiles.push(...compressed);
    renderPreviewGrid();
  });
}

function renderPreviewGrid() {
  const grid = document.getElementById("preview-grid");
  grid.innerHTML = selectedFiles.map((file, i) => {
    const url = URL.createObjectURL(file);
    const media = file.type.startsWith("video/")
      ? `<video src="${url}" muted></video>`
      : `<img src="${url}">`;
    return `<div class="preview-thumb">${media}<button type="button" class="preview-remove" data-i="${i}">✕</button></div>`;
  }).join("");

  grid.querySelectorAll(".preview-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedFiles.splice(Number(btn.dataset.i), 1);
      renderPreviewGrid();
    });
  });
}

// ---- etiquetas ----

const tagInput = document.getElementById("f-tag-input");
const tagSuggestionsEl = document.getElementById("tag-suggestions");
let allKnownTags = [];

async function loadKnownTags() {
  allKnownTags = await DB.getAllTags();
}

const MAX_MODEL_TAGS = 5;

function addTag(tag) {
  const val = tag.trim().replace(/^#/, "").toLowerCase();
  if (!val) return;

  if (selectedTags.length >= MAX_MODEL_TAGS) {
    showTagLimitMessage();
    tagInput.value = "";
    hideTagSuggestions();
    return;
  }

  if (!selectedTags.includes(val)) {
    selectedTags.push(val);
    renderTagPills();
  }
  tagInput.value = "";
  hideTagSuggestions();
}

function showTagLimitMessage() {
  const hint = document.getElementById("tag-limit-hint");
  hint.classList.add("show");
  setTimeout(() => hint.classList.remove("show"), 2200);
}

function showTagSuggestions() {
  const typed = tagInput.value.trim().toLowerCase().replace(/^#/, "");
  if (!typed) { hideTagSuggestions(); return; }

  const matches = allKnownTags
    .filter(t => t.includes(typed) && !selectedTags.includes(t))
    .slice(0, 6);

  if (matches.length === 0) { hideTagSuggestions(); return; }

  tagSuggestionsEl.innerHTML = matches
    .map(t => `<div class="tag-suggestion-item" data-tag="${escapeHTML(t)}">#${escapeHTML(t)}</div>`)
    .join("");
  tagSuggestionsEl.classList.add("show");

  tagSuggestionsEl.querySelectorAll(".tag-suggestion-item").forEach(item => {
    item.addEventListener("mousedown", (e) => {
      e.preventDefault(); // evita que el input pierda foco antes del click
      addTag(item.dataset.tag);
    });
  });
}

function hideTagSuggestions() {
  tagSuggestionsEl.classList.remove("show");
  tagSuggestionsEl.innerHTML = "";
}

tagInput.addEventListener("input", showTagSuggestions);
tagInput.addEventListener("focus", showTagSuggestions);
tagInput.addEventListener("blur", () => setTimeout(hideTagSuggestions, 120));

tagInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    const firstMatch = tagSuggestionsEl.querySelector(".tag-suggestion-item");
    if (tagSuggestionsEl.classList.contains("show") && firstMatch) {
      addTag(firstMatch.dataset.tag);
    } else {
      addTag(tagInput.value);
    }
  }
});

function renderTagPills() {
  const row = document.getElementById("tag-input-row");
  row.querySelectorAll(".tag-pill").forEach(el => el.remove());
  selectedTags.forEach((tag, i) => {
    const pill = document.createElement("span");
    pill.className = "tag-pill";
    pill.innerHTML = `#${escapeHTML(tag)} <button type="button" data-i="${i}">✕</button>`;
    row.insertBefore(pill, tagInput);
  });
  row.querySelectorAll(".tag-pill button").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedTags.splice(Number(btn.dataset.i), 1);
      renderTagPills();
    });
  });

  const atLimit = selectedTags.length >= MAX_MODEL_TAGS;
  tagInput.disabled = atLimit;
  tagInput.placeholder = atLimit ? "Máximo 5 etiquetas" : "Escribe y presiona Enter…";
}

// ---- envío del formulario ----

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("upload-error");
  errorEl.classList.remove("show");

  const name = document.getElementById("f-name").value.trim();

  if (duplicateBlocking) {
    errorEl.textContent = "Ese nombre ya existe o es muy parecido a uno existente. Ábrelo desde el aviso de arriba para agregar fotos ahí.";
    errorEl.classList.add("show");
    return;
  }
  if (selectedFiles.length === 0) {
    errorEl.textContent = "Sube al menos una foto o video.";
    errorEl.classList.add("show");
    return;
  }
  if (TURNSTILE_SITE_KEY && !turnstileToken) {
    errorEl.textContent = "Completa la verificación (el cuadro de \"no soy un robot\") antes de publicar.";
    errorEl.classList.add("show");
    return;
  }

  const socials = {};
  const ig = document.getElementById("f-instagram").value.trim();
  const tt = document.getElementById("f-tiktok").value.trim();
  const tw = document.getElementById("f-twitter").value.trim();
  if (ig) socials.instagram = ig;
  if (tt) socials.tiktok = tt;
  if (tw) socials.other = tw;

  const btn = document.getElementById("btn-submit-upload");
  btn.disabled = true;
  btn.textContent = "Publicando…";

  try {
    const id = await DB.createModel({ name, tags: selectedTags, socials, files: selectedFiles });
    closeModal();
    showToast("Modelo publicado ✓");
    await renderTagRow();
    await renderGrid();
    setTimeout(() => { window.location.href = `model.html?id=${id}`; }, 500);
  } catch (err) {
    console.error(err);
    errorEl.textContent = err.message || "Ocurrió un error al publicar. Intenta de nuevo.";
    errorEl.classList.add("show");
  } finally {
    btn.disabled = false;
    btn.textContent = "Publicar modelo";
  }
});

// ==========================================================================
// Rotación automática de fotos en las tarjetas
// ==========================================================================
// Un solo temporizador global revisa todas las tarjetas visibles y avanza
// cada una a su siguiente foto. No crea elementos nuevos ni guarda copias
// extra en memoria: solo cambia el "src" entre las fotos que el modelo
// ya tiene, así que el costo es mínimo.

function tickCardRotation() {
  document.querySelectorAll(".card-photo[data-images]").forEach(img => {
    let images;
    try { images = JSON.parse(img.dataset.images.replace(/&apos;/g, "'")); }
    catch { return; }
    if (!images || images.length < 2) return;

    const nextIndex = (Number(img.dataset.index || 0) + 1) % images.length;
    img.dataset.index = nextIndex;

    img.style.opacity = 0;
    setTimeout(() => {
      img.src = images[nextIndex];
      img.style.opacity = 1;
    }, 220);
  });
}

setInterval(tickCardRotation, 4000);

// ==========================================================================
// Botón de comunidad (Discord/Telegram)
// ==========================================================================

const communityBtn = document.getElementById("btn-community");
if (typeof COMMUNITY_URL !== "undefined" && COMMUNITY_URL) {
  communityBtn.href = COMMUNITY_URL;
  communityBtn.style.display = "inline-flex";

  const urlLower = COMMUNITY_URL.toLowerCase();
  const isTelegram = urlLower.includes("t.me") || urlLower.includes("telegram");
  const isDiscord = urlLower.includes("discord");

  document.getElementById("icon-telegram").style.display = isTelegram ? "block" : "none";
  document.getElementById("icon-discord").style.display = isDiscord ? "block" : "none";
  document.getElementById("icon-generic").style.display = (isTelegram || isDiscord) ? "none" : "block";
}

// ==========================================================================
// Init
// ==========================================================================

const urlParams = new URLSearchParams(window.location.search);
const tagFromURL = urlParams.get("tag");
if (tagFromURL) state.tag = tagFromURL;

renderTagRow();
renderGrid();
