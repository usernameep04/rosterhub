import { HTMLRewriter } from "https://ghuc.cc/worker-tools/html-rewriter/index.ts";

// Mismos valores que tienes en js/config.js. Si algún día cambias de
// proyecto de Supabase, actualízalos aquí también.
const SUPABASE_URL = "https://mbuabdwfncctdnrizyzj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_LKA_eYIeH-pJDDYHWRvSBA_yfPWH8wR";

function setAttr(attr, value) {
  return { element(el) { if (value) el.setAttribute(attr, value); } };
}
function setText(value) {
  return { element(el) { if (value) el.setInnerContent(value); } };
}

export default async (request, context) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const response = await context.next();

  if (!id) return response;

  try {
    const apiUrl =
      `${SUPABASE_URL}/rest/v1/models?id=eq.${encodeURIComponent(id)}` +
      `&select=name,tags,model_media(url,type),model_ratings(stars)`;

    const res = await fetch(apiUrl, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    const rows = await res.json();
    const model = Array.isArray(rows) ? rows[0] : null;
    if (!model) return response;

    const media = model.model_media || [];
    const images = media.filter((m) => m.type === "image");
    const cover = images[0]?.url || media[0]?.url || "";

    const ratings = model.model_ratings || [];
    const count = ratings.length;
    const avg = count ? ratings.reduce((s, r) => s + r.stars, 0) / count : 0;

    const tagsText = (model.tags || []).map((t) => `#${t}`).join(" ");
    const description =
      `Todo el contenido  de ${model.name} gratis${tagsText ? " — " + tagsText : ""}. ` +
      `${avg.toFixed(1)}★ (${count}).`;
    const title = `${model.name} — Roster Hub`;

    return new HTMLRewriter()
      .on("title", setText(title))
      .on('meta[name="description"]', setAttr("content", description))
      .on('meta[property="og:title"]', setAttr("content", title))
      .on('meta[property="og:description"]', setAttr("content", description))
      .on('meta[property="og:image"]', setAttr("content", cover))
      .on('meta[property="og:url"]', setAttr("content", request.url))
      .on('link[rel="canonical"]', setAttr("href", request.url))
      .transform(response);
  } catch (err) {
    // Si algo falla, mostramos la página normal en vez de tronar el sitio.
    return response;
  }
};
