function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3200);
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

const MAX_MODEL_TAGS = 5;

// ==========================================================================
// Candado de acceso
// ==========================================================================

const ADMIN_SESSION_KEY = "mia_admin_unlocked";

function tryUnlock(password) {
  if (password === ADMIN_PASSWORD) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
    document.getElementById("admin-lock").style.display = "none";
    document.getElementById("admin-content").classList.add("show");
    loadModels();
    return true;
  }
  return false;
}

document.getElementById("admin-unlock-btn").addEventListener("click", () => {
  const val = document.getElementById("admin-password-input").value;
  const errorEl = document.getElementById("admin-lock-error");
  if (!tryUnlock(val)) {
    errorEl.classList.add("show");
  } else {
    errorEl.classList.remove("show");
  }
});

document.getElementById("admin-password-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("admin-unlock-btn").click();
});

if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") {
  tryUnlock(ADMIN_PASSWORD);
} else {
  document.getElementById("admin-password-input").focus();
}

// ==========================================================================
// Estado y carga de modelos
// ==========================================================================

let allModels = [];
const editState = {}; // { [modelId]: { tags: [...] } }

async function loadModels() {
  const list = document.getElementById("admin-list");
  list.innerHTML = `<div class="empty-state">Cargando…</div>`;
  try {
    allModels = await DB.listModels({});
    allModels.forEach(m => { editState[m.id] = { tags: [...(m.tags || [])] }; });
    renderList();
  } catch (err) {
    console.error(err);
    list.innerHTML = `<div class="empty-state">Ocurrió un error cargando los modelos.</div>`;
  }
}

function renderList() {
  const list = document.getElementById("admin-list");
  const search = document.getElementById("admin-search").value.trim().toLowerCase();
  const filtered = search
    ? allModels.filter(m => m.name.toLowerCase().includes(search))
    : allModels;

  document.getElementById("admin-count").textContent = `${allModels.length} modelo(s)`;

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state">No hay modelos que coincidan.</div>`;
    return;
  }

  list.innerHTML = filtered.map(rowTemplate).join("");
  filtered.forEach(attachRowHandlers);
}

document.getElementById("admin-search").addEventListener("input", renderList);

function mediaThumb(m) {
  return m.type === "video"
    ? `<div class="admin-media-thumb" data-media-id="${m.id}"><video src="${m.url}" muted></video><button class="admin-media-remove" data-media-id="${m.id}">✕</button></div>`
    : `<div class="admin-media-thumb" data-media-id="${m.id}"><img src="${m.url}" loading="lazy"><button class="admin-media-remove" data-media-id="${m.id}">✕</button></div>`;
}

function rowTemplate(model) {
  const tags = editState[model.id].tags;
  return `
    <div class="admin-row" data-id="${model.id}">
      <div class="admin-row-head">
        <img class="admin-thumb" src="${model.cover || ''}" alt="">
        <div class="admin-row-info">
          <input type="text" class="admin-name-input" value="${escapeHTML(model.name)}">
          <div class="admin-meta">★ ${model.rating_avg.toFixed(1)} (${model.rating_count}) · ${model.media ? model.media.length : ''} archivo(s)</div>
          <div class="admin-tags-editor" id="tags-editor-${model.id}">
            ${tags.map((t, i) => `<span class="tag-pill">#${escapeHTML(t)} <button type="button" class="tag-remove" data-i="${i}">✕</button></span>`).join("")}
            <input type="text" class="admin-tag-input" placeholder="${tags.length >= MAX_MODEL_TAGS ? 'Máximo 5' : 'agregar etiqueta…'}" ${tags.length >= MAX_MODEL_TAGS ? "disabled" : ""}>
          </div>
        </div>
        <div class="admin-row-actions">
          <button class="btn btn-primary admin-save">Guardar <span class="admin-save-status">✓</span></button>
          <button class="btn btn-danger admin-delete-model">Eliminar modelo</button>
        </div>
      </div>
      <div class="admin-media-grid" id="media-grid-${model.id}">
        ${(model.media || []).map(mediaThumb).join("")}
      </div>
    </div>`;
}

function attachRowHandlers(model) {
  const row = document.querySelector(`.admin-row[data-id="${model.id}"]`);
  if (!row) return;

  // etiquetas
  const tagEditor = row.querySelector(".admin-tags-editor");
  const tagInput = row.querySelector(".admin-tag-input");

  function refreshTagEditor() {
    const tags = editState[model.id].tags;
    tagEditor.querySelectorAll(".tag-pill").forEach(el => el.remove());
    tags.forEach((tag, i) => {
      const pill = document.createElement("span");
      pill.className = "tag-pill";
      pill.innerHTML = `#${escapeHTML(tag)} <button type="button" class="tag-remove" data-i="${i}">✕</button>`;
      tagEditor.insertBefore(pill, tagInput);
    });
    tagEditor.querySelectorAll(".tag-remove").forEach(btn => {
      btn.addEventListener("click", () => {
        tags.splice(Number(btn.dataset.i), 1);
        refreshTagEditor();
      });
    });
    const atLimit = tags.length >= MAX_MODEL_TAGS;
    tagInput.disabled = atLimit;
    tagInput.placeholder = atLimit ? "Máximo 5" : "agregar etiqueta…";
  }

  tagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = tagInput.value.trim().replace(/^#/, "").toLowerCase();
      const tags = editState[model.id].tags;
      if (val && tags.length < MAX_MODEL_TAGS && !tags.includes(val)) {
        tags.push(val);
        refreshTagEditor();
      }
      tagInput.value = "";
    }
  });

  refreshTagEditor(); // conecta los botones ✕ de las etiquetas que ya traía el modelo

  // guardar (nombre + etiquetas)
  row.querySelector(".admin-save").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const nameInput = row.querySelector(".admin-name-input");
    const newName = nameInput.value.trim();
    if (!newName) { showToast("El nombre no puede estar vacío."); return; }

    btn.disabled = true;
    try {
      await DB.updateModel(model.id, { name: newName, tags: editState[model.id].tags });
      const statusEl = btn.querySelector(".admin-save-status");
      statusEl.classList.add("show");
      setTimeout(() => statusEl.classList.remove("show"), 1600);
      showToast("Cambios guardados ✓");
    } catch (err) {
      console.error(err);
      showToast("Error al guardar los cambios.");
    } finally {
      btn.disabled = false;
    }
  });

  // eliminar modelo completo
  row.querySelector(".admin-delete-model").addEventListener("click", async () => {
    const ok = confirm(`¿Eliminar "${model.name}" por completo? Esto borra todas sus fotos/videos y no se puede deshacer.`);
    if (!ok) return;
    try {
      await DB.deleteModel(model.id);
      allModels = allModels.filter(m => m.id !== model.id);
      delete editState[model.id];
      showToast("Modelo eliminado.");
      renderList();
    } catch (err) {
      console.error(err);
      showToast("Error al eliminar el modelo.");
    }
  });

  // eliminar foto/video individual
  row.querySelectorAll(".admin-media-remove").forEach(btn => {
    btn.addEventListener("click", async () => {
      const mediaId = btn.dataset.mediaId;
      const ok = confirm("¿Eliminar este archivo?");
      if (!ok) return;
      try {
        await DB.deleteMedia(mediaId);
        btn.closest(".admin-media-thumb").remove();
        showToast("Archivo eliminado.");
      } catch (err) {
        console.error(err);
        showToast("Error al eliminar el archivo.");
      }
    });
  });
}

// ==========================================================================
// Aplicar marca de agua a fotos ya subidas
// ==========================================================================

document.getElementById("btn-rewatermark").addEventListener("click", async () => {
  const ok = confirm(
    "Esto vuelve a guardar TODAS las fotos ya subidas con la marca de agua encima. " +
    "Puede tardar varios minutos si hay muchas fotos, y no se puede deshacer. ¿Continuar?"
  );
  if (!ok) return;

  const btn = document.getElementById("btn-rewatermark");
  btn.disabled = true;

  try {
    await DB.rewatermarkExisting((done, total) => {
      btn.textContent = `Marcando fotos… ${done}/${total}`;
    });
    showToast("Listo, se aplicó la marca de agua a las fotos existentes ✓");
    await loadModels();
  } catch (err) {
    console.error(err);
    showToast("Ocurrió un error aplicando la marca de agua.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Aplicar marca de agua a fotos existentes";
  }
});
