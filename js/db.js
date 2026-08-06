/*
  CAPA DE DATOS
  =============
  Expone un objeto global `DB` con funciones async. Internamente decide
  si usa el modo DEMO (localStorage, todo en tu navegador) o el modo REAL
  (Supabase, compartido entre todos) según si config.js tiene llaves.

  El resto del sitio (app.js, model.js) solo llama a DB.xxx() y no le
  importa cuál de los dos modos está activo.
*/

const DB = (() => {
  let REAL_MODE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  let supabase = null;

  if (REAL_MODE) {
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (err) {
      console.error(
        "js/config.js tiene una URL o llave de Supabase inválida. " +
        "El sitio va a seguir funcionando en modo demo mientras tanto. Detalle:",
        err
      );
      REAL_MODE = false;
    }
  }

  // ---------- límites del modo DEMO ----------
  // localStorage solo permite unos pocos MB en total en el navegador.
  // Los videos pesan mucho, así que ponemos un tope razonable para que
  // el modo demo no truene. Al conectar Supabase (modo real) este límite
  // ya no aplica.
  const DEMO_MAX_FILE_MB = 4;
  const DEMO_MAX_FILE_BYTES = DEMO_MAX_FILE_MB * 1024 * 1024;

  function assertFileSizeOk(file) {
    if (!REAL_MODE && file.size > DEMO_MAX_FILE_BYTES) {
      const err = new Error(
        `"${file.name}" pesa ${(file.size / 1024 / 1024).toFixed(1)}MB. ` +
        `En modo demo (sin Supabase conectado) el límite es ${DEMO_MAX_FILE_MB}MB por archivo, ` +
        `porque se guarda temporalmente en tu navegador. Conecta la base de datos real (ver README) para subir archivos más grandes.`
      );
      err.code = "FILE_TOO_LARGE";
      throw err;
    }
  }

  // ---------- utilidades compartidas ----------

  function normalizeName(name) {
    return name
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita acentos
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  // convierte el nombre en algo apto para una URL, ej. "Valentina Nova" -> "valentina-nova"
  function slugify(name) {
    return (
      name
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "modelo"
    );
  }

  // distancia de Levenshtein simple, para detectar nombres "parecidos"
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  function isSimilarName(a, b) {
    const na = normalizeName(a), nb = normalizeName(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (na.includes(nb) || nb.includes(na)) return true;
    const dist = levenshtein(na, nb);
    const threshold = Math.max(1, Math.floor(Math.min(na.length, nb.length) * 0.2));
    return dist <= threshold;
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ---------- modo DEMO (localStorage) ----------

  const LS_MODELS = "mia_models";
  const LS_MEDIA = "mia_media";
  const LS_RATINGS = "mia_ratings";

  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  }
  function lsSet(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      const err = new Error(
        "No hay espacio suficiente en tu navegador para guardar este archivo (modo demo). " +
        "Prueba con un archivo más ligero, o conecta la base de datos real (ver README) para quitar este límite."
      );
      err.code = "STORAGE_FULL";
      throw err;
    }
  }

  function seedDemoDataIfEmpty() {
    if (lsGet(LS_MODELS).length > 0) return;
    const now = Date.now();
    const placeholder = (seed) =>
      `https://picsum.photos/seed/${seed}/600/800`;

    const seedModels = [
      { name: "Valentina Nova", tags: ["lifestyle", "beauty"], socials: { instagram: "https://instagram.com/valentinanova" } },
      { name: "Kai Rin", tags: ["gaming", "anime"], socials: { tiktok: "https://tiktok.com/@kairin" } },
      { name: "Marco Estelar", tags: ["fitness", "moda"], socials: {} },
      { name: "Luna Vega", tags: ["moda", "viajes"], socials: { instagram: "https://instagram.com/lunavega" } },
    ];

    const models = [];
    const media = [];
    const ratings = [];

    seedModels.forEach((m, i) => {
      const id = uid();
      models.push({
        id,
        name: m.name,
        name_normalized: normalizeName(m.name),
        tags: m.tags,
        socials: m.socials,
        created_at: now - i * 100000,
      });
      for (let k = 0; k < 3; k++) {
        media.push({ id: uid(), model_id: id, type: "image", url: placeholder(m.name + k), created_at: now });
      }
      const numRatings = 3 + i;
      for (let r = 0; r < numRatings; r++) {
        ratings.push({ id: uid(), model_id: id, stars: 3 + (r % 3), created_at: now });
      }
    });

    lsSet(LS_MODELS, models);
    lsSet(LS_MEDIA, media);
    lsSet(LS_RATINGS, ratings);
  }

  function computeStats(modelId, ratings) {
    const rs = ratings.filter(r => r.model_id === modelId);
    const count = rs.length;
    const avg = count ? rs.reduce((s, r) => s + r.stars, 0) / count : 0;
    return { avg, count };
  }

  async function demoListModels({ search = "", tag = "" } = {}) {
    seedDemoDataIfEmpty();
    const models = lsGet(LS_MODELS);
    const media = lsGet(LS_MEDIA);
    const ratings = lsGet(LS_RATINGS);

    let list = models.map(m => {
      const modelMedia = media.filter(x => x.model_id === m.id);
      const images = modelMedia.filter(x => x.type === "image").slice(0, 5).map(x => x.url);
      const firstAny = modelMedia[0];
      const stats = computeStats(m.id, ratings);
      return {
        ...m,
        images,
        media: modelMedia,
        cover: images[0] || firstAny?.url || null,
        coverType: images.length ? "image" : (firstAny?.type || "image"),
        rating_avg: stats.avg,
        rating_count: stats.count,
      };
    });

    if (search) {
      const ns = normalizeName(search);
      list = list.filter(m => m.name_normalized.includes(ns) || m.tags.some(t => t.toLowerCase().includes(search.toLowerCase())));
    }
    if (tag) {
      list = list.filter(m => m.tags.includes(tag));
    }
    return list.sort((a, b) => b.rating_avg - a.rating_avg || b.created_at - a.created_at);
  }

  async function demoGetModel(id) {
    const models = lsGet(LS_MODELS);
    const model = models.find(m => m.id === id);
    if (!model) return null;
    const media = lsGet(LS_MEDIA).filter(x => x.model_id === id).sort((a, b) => b.created_at - a.created_at);
    const ratings = lsGet(LS_RATINGS);
    const stats = computeStats(id, ratings);
    return { ...model, media, rating_avg: stats.avg, rating_count: stats.count };
  }

  async function demoGetModelBySlug(slug) {
    const match = lsGet(LS_MODELS).find(m => m.slug === slug);
    return match ? demoGetModel(match.id) : null;
  }

  async function demoFindSimilar(name) {
    const models = lsGet(LS_MODELS);
    return models.filter(m => isSimilarName(m.name, name));
  }

  async function demoGetAllTags() {
    const models = lsGet(LS_MODELS);
    const set = new Set();
    models.forEach(m => m.tags.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }

  async function demoEnsureUniqueSlug(name) {
    const base = slugify(name);
    const existing = new Set(lsGet(LS_MODELS).map(m => m.slug).filter(Boolean));
    let slug = base, n = 2;
    while (existing.has(slug)) { slug = `${base}-${n}`; n++; }
    return slug;
  }

  async function demoCreateModel({ name, tags, socials, files }) {
    files.forEach(assertFileSizeOk);

    const models = lsGet(LS_MODELS);
    const media = lsGet(LS_MEDIA);
    const id = uid();
    const now = Date.now();
    const slug = await demoEnsureUniqueSlug(name);

    models.push({ id, name, name_normalized: normalizeName(name), slug, tags, socials, created_at: now });

    for (const file of files) {
      const url = await fileToDataURL(file);
      media.push({ id: uid(), model_id: id, type: file.type.startsWith("video") ? "video" : "image", url, created_at: now });
    }

    lsSet(LS_MODELS, models);
    lsSet(LS_MEDIA, media);
    return id;
  }

  async function demoAddMedia(modelId, files) {
    files.forEach(assertFileSizeOk);

    const media = lsGet(LS_MEDIA);
    const now = Date.now();
    for (const file of files) {
      const url = await fileToDataURL(file);
      media.push({ id: uid(), model_id: modelId, type: file.type.startsWith("video") ? "video" : "image", url, created_at: now });
    }
    lsSet(LS_MEDIA, media);
  }

  async function demoAddRating(modelId, stars) {
    const ratings = lsGet(LS_RATINGS);
    ratings.push({ id: uid(), model_id: modelId, stars, created_at: Date.now() });
    lsSet(LS_RATINGS, ratings);
  }

  async function demoUpdateModel(id, { name, tags }) {
    const models = lsGet(LS_MODELS);
    const idx = models.findIndex(m => m.id === id);
    if (idx === -1) throw new Error("Modelo no encontrado.");
    if (name !== undefined) {
      models[idx].name = name;
      models[idx].name_normalized = normalizeName(name);
    }
    if (tags !== undefined) models[idx].tags = tags;
    lsSet(LS_MODELS, models);
  }

  async function demoDeleteModel(id) {
    lsSet(LS_MODELS, lsGet(LS_MODELS).filter(m => m.id !== id));
    lsSet(LS_MEDIA, lsGet(LS_MEDIA).filter(m => m.model_id !== id));
    lsSet(LS_RATINGS, lsGet(LS_RATINGS).filter(r => r.model_id !== id));
  }

  async function demoDeleteMedia(mediaId) {
    lsSet(LS_MEDIA, lsGet(LS_MEDIA).filter(m => m.id !== mediaId));
  }

  // ---------- modo REAL (Supabase) ----------
  // Requiere las tablas creadas con schema.sql y un bucket "model-media".

  async function realListModels({ search = "", tag = "" } = {}) {
    let query = supabase.from("models").select("*, model_media(id, url, type, created_at), model_ratings(stars)");
    if (tag) query = query.contains("tags", [tag]);
    const { data, error } = await query;
    if (error) throw error;

    let list = (data || []).map(m => {
      const media = (m.model_media || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const images = media.filter(x => x.type === "image").slice(0, 5).map(x => x.url);
      const ratings = m.model_ratings || [];
      const count = ratings.length;
      const avg = count ? ratings.reduce((s, r) => s + r.stars, 0) / count : 0;
      return {
        ...m,
        images,
        media,
        cover: images[0] || media[0]?.url || null,
        coverType: images.length ? "image" : (media[0]?.type || "image"),
        rating_avg: avg,
        rating_count: count,
      };
    });

    if (search) {
      const ns = normalizeName(search);
      list = list.filter(m => m.name_normalized.includes(ns) || (m.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase())));
    }
    return list.sort((a, b) => b.rating_avg - a.rating_avg);
  }

  async function realGetModel(id) {
    const { data, error } = await supabase.from("models").select("*, model_media(*), model_ratings(stars)").eq("id", id).single();
    if (error) return null;
    const media = (data.model_media || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const ratings = data.model_ratings || [];
    const count = ratings.length;
    const avg = count ? ratings.reduce((s, r) => s + r.stars, 0) / count : 0;
    return { ...data, media, rating_avg: avg, rating_count: count };
  }

  async function realGetModelBySlug(slug) {
    const { data, error } = await supabase.from("models").select("id").eq("slug", slug).single();
    if (error || !data) return null;
    return realGetModel(data.id);
  }

  async function realEnsureUniqueSlug(name) {
    const base = slugify(name);
    const { data } = await supabase.from("models").select("slug").ilike("slug", `${base}%`);
    const existing = new Set((data || []).map(r => r.slug).filter(Boolean));
    let slug = base, n = 2;
    while (existing.has(slug)) { slug = `${base}-${n}`; n++; }
    return slug;
  }

  async function realFindSimilar(name) {
    const { data, error } = await supabase.from("models").select("id, name");
    if (error) throw error;
    return (data || []).filter(m => isSimilarName(m.name, name));
  }

  async function realGetAllTags() {
    const { data, error } = await supabase.from("models").select("tags");
    if (error) throw error;
    const set = new Set();
    (data || []).forEach(m => (m.tags || []).forEach(t => set.add(t)));
    return Array.from(set).sort();
  }

  async function uploadFile(modelId, file) {
    const ext = file.name.split(".").pop();
    const path = `${modelId}/${uid()}.${ext}`;
    const { error } = await supabase.storage.from("model-media").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("model-media").getPublicUrl(path);
    return { url: data.publicUrl, type: file.type.startsWith("video") ? "video" : "image" };
  }

  async function realCreateModel({ name, tags, socials, files }) {
    const slug = await realEnsureUniqueSlug(name);
    const { data, error } = await supabase
      .from("models")
      .insert({ name, name_normalized: normalizeName(name), slug, tags, socials })
      .select()
      .single();
    if (error) throw error;
    const id = data.id;
    await realAddMedia(id, files);
    return id;
  }

  async function realAddMedia(modelId, files) {
    for (const file of files) {
      const { url, type } = await uploadFile(modelId, file);
      const { error } = await supabase.from("model_media").insert({ model_id: modelId, url, type });
      if (error) throw error;
    }
  }

  async function realAddRating(modelId, stars) {
    const { error } = await supabase.from("model_ratings").insert({ model_id: modelId, stars });
    if (error) throw error;
  }

  function storagePathFromUrl(url) {
    const marker = "/model-media/";
    const idx = url.indexOf(marker);
    return idx === -1 ? null : url.slice(idx + marker.length);
  }

  async function realUpdateModel(id, { name, tags }) {
    const patch = {};
    if (name !== undefined) { patch.name = name; patch.name_normalized = normalizeName(name); }
    if (tags !== undefined) patch.tags = tags;
    const { error } = await supabase.from("models").update(patch).eq("id", id);
    if (error) throw error;
  }

  async function realDeleteMedia(mediaId) {
    const { data: row } = await supabase.from("model_media").select("url").eq("id", mediaId).single();
    const { error } = await supabase.from("model_media").delete().eq("id", mediaId);
    if (error) throw error;
    if (row?.url) {
      const path = storagePathFromUrl(row.url);
      if (path) await supabase.storage.from("model-media").remove([path]).catch(() => {});
    }
  }

  async function realDeleteModel(id) {
    const { data: mediaRows } = await supabase.from("model_media").select("url").eq("model_id", id);
    const { error } = await supabase.from("models").delete().eq("id", id);
    if (error) throw error;
    const paths = (mediaRows || []).map(r => storagePathFromUrl(r.url)).filter(Boolean);
    if (paths.length) await supabase.storage.from("model-media").remove(paths).catch(() => {});
  }

  // ---------- API pública ----------

  return {
    mode: REAL_MODE ? "real" : "demo",
    listModels: REAL_MODE ? realListModels : demoListModels,
    getModel: REAL_MODE ? realGetModel : demoGetModel,
    getModelBySlug: REAL_MODE ? realGetModelBySlug : demoGetModelBySlug,
    findSimilarNames: REAL_MODE ? realFindSimilar : demoFindSimilar,
    getAllTags: REAL_MODE ? realGetAllTags : demoGetAllTags,
    createModel: REAL_MODE ? realCreateModel : demoCreateModel,
    addMedia: REAL_MODE ? realAddMedia : demoAddMedia,
    addRating: REAL_MODE ? realAddRating : demoAddRating,
    updateModel: REAL_MODE ? realUpdateModel : demoUpdateModel,
    deleteModel: REAL_MODE ? realDeleteModel : demoDeleteModel,
    deleteMedia: REAL_MODE ? realDeleteMedia : demoDeleteMedia,
  };
})();
