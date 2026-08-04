function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 4500);
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
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

function updateSEOTags(model) {
  const tagsText = (model.tags || []).map(t => `#${t}`).join(" ");
  const description = `Fotos y videos de ${model.name}, modelo de IA${tagsText ? " — " + tagsText : ""}. Calificación ${model.rating_avg.toFixed(1)}★ (${model.rating_count}).`;
  const pageUrl = window.location.href;

  document.getElementById("meta-description").setAttribute("content", description);
  document.getElementById("meta-og-title").setAttribute("content", `${model.name} — Roster`);
  document.getElementById("meta-og-description").setAttribute("content", description);
  document.getElementById("meta-og-url").setAttribute("content", pageUrl);
  document.getElementById("meta-canonical").setAttribute("href", pageUrl);
  if (model.cover) {
    document.getElementById("meta-og-image").setAttribute("content", model.cover);
  }
}

function rateStarsInteractive() {
  let html = '<span class="rate-stars" id="rate-stars">';
  for (let i = 1; i <= 5; i++) {
    html += `<svg viewBox="0 0 24 24" class="star-empty" data-val="${i}"><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9"/></svg>`;
  }
  html += "</span>";
  return html;
}

// ---------- control de "ya calificó este modelo" (por navegador) ----------

const RATED_KEY = "mia_rated_models";

function getRatedIds() {
  try { return JSON.parse(localStorage.getItem(RATED_KEY)) || []; }
  catch { return []; }
}

function markAsRated(id) {
  const ids = getRatedIds();
  if (!ids.includes(id)) {
    ids.push(id);
    localStorage.setItem(RATED_KEY, JSON.stringify(ids));
  }
}

function hasRated(id) {
  return getRatedIds().includes(id);
}

const params = new URLSearchParams(window.location.search);
const modelId = params.get("id");

function socialLinks(socials) {
  if (!socials) return "";
  const map = { instagram: "Instagram", tiktok: "TikTok", other: "Enlace" };
  return Object.entries(socials)
    .filter(([, v]) => v)
    .map(([k, v]) => `<a href="${escapeHTML(v)}" target="_blank" rel="noopener">${map[k] || k}</a>`)
    .join("");
}

function galleryItem(m, i) {
  return m.type === "video"
    ? `<div class="gallery-item viewable" data-index="${i}"><video src="${m.url}" muted playsinline></video></div>`
    : `<div class="gallery-item viewable" data-index="${i}"><img src="${m.url}" loading="lazy"></div>`;
}

async function render() {
  const content = document.getElementById("content");

  if (!modelId) {
    content.innerHTML = `<div class="empty-state">No se especificó una chica.</div>`;
    return;
  }

  const model = await DB.getModel(modelId);
  if (!model) {
    content.innerHTML = `<div class="empty-state">No se encontró a esta chica.</div>`;
    return;
  }

  document.title = `${model.name} — Roster Hub`;
  updateSEOTags(model);

  content.innerHTML = `
    <a href="index.html" class="back-link">← Catálogo</a>

    <div class="detail-head">
      <div>
        <h1 class="detail-name">${escapeHTML(model.name)}</h1>
        <div class="detail-tags">${(model.tags || []).map(t => `<a href="index.html?tag=${encodeURIComponent(t)}">#${escapeHTML(t)}</a>`).join("")}</div>
        <div class="socials">${socialLinks(model.socials)}</div>
      </div>
      <div class="rating-block">
        <div class="rating-big">
          <span class="rating-num">${model.rating_avg.toFixed(1)}</span>
          ${starsSVG(Math.round(model.rating_avg))}
          <span class="rating-count mono">(${model.rating_count})</span>
        </div>
        ${hasRated(modelId)
          ? `<div class="rated-msg">Ya calificaste a esta chica ✓</div>`
          : `<div class="rate-prompt">Califica a esta chica:</div>${rateStarsInteractive()}`}
      </div>
    </div>

    <div class="section-head">
      <h2>Galería</h2>
      <span class="section-tag mono">${model.media.length} archivo(s)</span>
    </div>

    <div class="gallery" id="gallery">
      ${model.media.map(galleryItem).join("")}
      <div class="gallery-item add-more-tile" id="add-more-tile">
        <span class="plus-icon">+</span>
        <span>Agregar fotos<br>o videos</span>
      </div>
    </div>
  `;

  setupLightbox(model.media);

  // rating interaction (solo si aún no ha calificado)
  const rateStars = document.getElementById("rate-stars");
  if (rateStars) {
    rateStars.querySelectorAll("svg").forEach(star => {
      star.addEventListener("mouseenter", () => highlightStars(rateStars, Number(star.dataset.val)));
      star.addEventListener("click", async () => {
        await DB.addRating(modelId, Number(star.dataset.val));
        markAsRated(modelId);
        showToast("¡Gracias por tu calificación!");
        render();
      });
    });
    rateStars.addEventListener("mouseleave", () => highlightStars(rateStars, 0));
  }

  // add more media
  document.getElementById("add-more-tile").addEventListener("click", () => {
    document.getElementById("add-media-input").click();
  });
}

function highlightStars(container, count) {
  container.querySelectorAll("svg").forEach(star => {
    const val = Number(star.dataset.val);
    star.classList.toggle("star-filled", val <= count);
    star.classList.toggle("star-empty", val > count);
  });
}

document.getElementById("fab-add").addEventListener("click", () => {
  document.getElementById("add-media-input").click();
});

if (typeof ALLOW_VIDEO_UPLOADS !== "undefined" && !ALLOW_VIDEO_UPLOADS) {
  document.getElementById("add-media-input").accept = "image/*";
}

document.getElementById("add-media-input").addEventListener("change", async (e) => {
  const { kept, blockedVideos } = filterAllowedFiles(e.target.files);
  if (blockedVideos > 0) {
    showToast(`Los videos están desactivados por ahora — se agregaron solo las fotos (${blockedVideos} video(s) omitido(s)).`);
  }
  if (kept.length === 0) { e.target.value = ""; return; }

  try {
    const compressed = await compressFiles(kept);
    await DB.addMedia(modelId, compressed);
    showToast("Archivos agregados ✓");
    render();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Error al subir archivos");
  }
  e.target.value = "";
});

// ==========================================================================
// Lightbox / carrusel
// ==========================================================================

const lightboxOverlay = document.getElementById("lightbox-overlay");
const lightboxMedia = document.getElementById("lightbox-media");
const lightboxCounter = document.getElementById("lightbox-counter");

let lightboxItems = [];
let lightboxIndex = 0;

function setupLightbox(media) {
  lightboxItems = media;
  document.querySelectorAll(".gallery-item.viewable").forEach(el => {
    el.addEventListener("click", () => openLightbox(Number(el.dataset.index)));
  });
}

function openLightbox(index) {
  lightboxIndex = index;
  renderLightbox();
  lightboxOverlay.classList.add("show");
}

function closeLightbox() {
  lightboxOverlay.classList.remove("show");
  lightboxMedia.innerHTML = "";
}

function renderLightbox() {
  const item = lightboxItems[lightboxIndex];
  lightboxMedia.innerHTML = item.type === "video"
    ? `<video src="${item.url}" controls autoplay playsinline></video>`
    : `<img src="${item.url}">`;
  lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxItems.length}`;
  document.getElementById("lightbox-prev").style.display = lightboxItems.length > 1 ? "flex" : "none";
  document.getElementById("lightbox-next").style.display = lightboxItems.length > 1 ? "flex" : "none";
}

function lightboxPrev() {
  lightboxIndex = (lightboxIndex - 1 + lightboxItems.length) % lightboxItems.length;
  renderLightbox();
}

function lightboxNext() {
  lightboxIndex = (lightboxIndex + 1) % lightboxItems.length;
  renderLightbox();
}

document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
document.getElementById("lightbox-prev").addEventListener("click", lightboxPrev);
document.getElementById("lightbox-next").addEventListener("click", lightboxNext);

// clic fuera de la imagen (en el fondo) cierra
lightboxOverlay.addEventListener("click", (e) => {
  if (e.target === lightboxOverlay || e.target.id === "lightbox-stage") closeLightbox();
});

document.addEventListener("keydown", (e) => {
  if (!lightboxOverlay.classList.contains("show")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") lightboxPrev();
  if (e.key === "ArrowRight") lightboxNext();
});

render();
