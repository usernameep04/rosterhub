/*
  UTILIDADES DE ARCHIVOS COMPARTIDAS
  ===================================
  1) filterAllowedFiles: quita los videos si ALLOW_VIDEO_UPLOADS está en
     false (ver config.js).
  2) compressImageFile / compressFiles: reduce el peso de las fotos antes
     de subirlas, sin que se note la diferencia a simple vista. Achica
     dimensiones enormes (celulares modernos toman fotos de 4000px+ de
     ancho, mucho más de lo que se ve en pantalla) y baja un poco la
     calidad de compresión JPEG, que en la práctica es visualmente
     idéntica pero pesa una fracción de lo original.
*/

const IMAGE_MAX_DIMENSION = 1600; // lado más largo, en píxeles
const IMAGE_JPEG_QUALITY = 0.85;  // 0-1, entre más alto, mejor calidad y más peso

function isVideoFile(file) {
  return file.type.startsWith("video/");
}

function isImageFile(file) {
  return file.type.startsWith("image/");
}

function filterAllowedFiles(fileList) {
  const allowVideo = typeof ALLOW_VIDEO_UPLOADS === "undefined" ? true : ALLOW_VIDEO_UPLOADS;
  const kept = [];
  let blockedVideos = 0;

  Array.from(fileList).forEach(file => {
    if (isVideoFile(file)) {
      if (allowVideo) kept.push(file);
      else blockedVideos++;
    } else if (isImageFile(file)) {
      kept.push(file);
    }
  });

  return { kept, blockedVideos };
}

function drawWatermarkPill(ctx, width, height, { markSize, opacity, anchor }) {
  const fontSize = markSize * 0.62;
  const gap = markSize * 0.35;
  const pad = markSize * 0.45;

  ctx.save();
  ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  const textWidth = ctx.measureText("RosterHub").width;

  const pillW = markSize + gap + textWidth + pad * 2;
  const pillH = markSize + pad * 0.9;
  const r = pillH / 2;

  let pillX, pillY;
  if (anchor === "center") {
    pillX = (width - pillW) / 2;
    pillY = (height - pillH) / 2;
  } else {
    // Las tarjetas del catálogo siempre recortan la foto a un marco
    // vertical fijo (3:4). Calculamos qué parte de la foto original
    // queda visible dentro de ese marco, para anclar la marca ahí
    // siempre en el mismo lugar relativo, sin importar la forma de
    // cada foto.
    const targetRatio = 3 / 4;
    const imgRatio = width / height;

    let visibleWidth = width, visibleRight = width;
    let visibleHeight = height, visibleBottom = height;

    if (imgRatio < targetRatio) {
      // la foto es más angosta que el marco -> se recorta arriba/abajo
      visibleHeight = width / targetRatio;
      visibleBottom = height - (height - visibleHeight) / 2;
    } else if (imgRatio > targetRatio) {
      // la foto es más ancha que el marco -> se recorta a los lados
      visibleWidth = height * targetRatio;
      visibleRight = width - (width - visibleWidth) / 2;
    }

    const marginX = visibleWidth * 0.08;
    const marginY = visibleHeight * 0.04;
    pillX = visibleRight - marginX - pillW;
    pillY = visibleBottom - marginY - pillH;
  }

  // fondo translúcido, para que se lea encima de cualquier foto
  ctx.globalAlpha = opacity;
  ctx.fillStyle = "#0B0E1A";
  ctx.beginPath();
  ctx.moveTo(pillX + r, pillY);
  ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, r);
  ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, r);
  ctx.arcTo(pillX, pillY + pillH, pillX, pillY, r);
  ctx.arcTo(pillX, pillY, pillX + pillW, pillY, r);
  ctx.closePath();
  ctx.fill();

  // mini logo (cuadro con degradado + corte, igual que el del sitio)
  const iconX = pillX + pad * 0.7;
  const iconY = pillY + (pillH - markSize) / 2;
  const ir = markSize * 0.27;

  ctx.globalAlpha = Math.min(1, opacity + 0.3);
  const grad = ctx.createLinearGradient(iconX, iconY, iconX + markSize, iconY + markSize);
  grad.addColorStop(0, "#7C5CFC");
  grad.addColorStop(1, "#35D5E0");
  ctx.beginPath();
  ctx.moveTo(iconX + ir, iconY);
  ctx.arcTo(iconX + markSize, iconY, iconX + markSize, iconY + markSize, ir);
  ctx.arcTo(iconX + markSize, iconY + markSize, iconX, iconY + markSize, ir);
  ctx.arcTo(iconX, iconY + markSize, iconX, iconY, ir);
  ctx.arcTo(iconX, iconY, iconX + markSize, iconY, ir);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  const inset = markSize * 0.167;
  const ix = iconX + inset, iy = iconY + inset, isz = markSize - inset * 2;
  ctx.beginPath();
  ctx.moveTo(ix, iy);
  ctx.lineTo(ix + isz * 0.6, iy);
  ctx.lineTo(ix + isz, iy + isz);
  ctx.lineTo(ix + isz * 0.4, iy + isz);
  ctx.closePath();
  ctx.fillStyle = "#0B0E1A";
  ctx.fill();

  // texto "Roster"
  ctx.globalAlpha = Math.min(1, opacity + 0.35);
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "middle";
  ctx.fillText("RosterHub", iconX + markSize + gap, pillY + pillH / 2);

  ctx.restore();
}

function drawWatermark(ctx, width, height) {
  // esquina inferior derecha (tamaño original)
  drawWatermarkPill(ctx, width, height, {
    markSize: Math.max(18, Math.min(40, width * 0.05)),
    opacity: 0.55,
    anchor: "corner",
  });
  // una más chica y discreta, centrada
  drawWatermarkPill(ctx, width, height, {
    markSize: Math.max(12, Math.min(26, width * 0.032)),
    opacity: 0.2,
    anchor: "center",
  });
}

function compressImageFile(file) {
  return new Promise((resolve) => {
    // Los GIF se dejan igual (comprimirlos por este método rompe la animación)
    if (!isImageFile(file) || file.type === "image/gif") { resolve(file); return; }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      drawWatermark(ctx, width, height);

      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name, { type: outputType, lastModified: Date.now() }));
      }, outputType, IMAGE_JPEG_QUALITY);
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

async function compressFiles(files) {
  const results = [];
  for (const file of files) {
    results.push(await compressImageFile(file));
  }
  return results;
}

// ---------- para aplicar la marca a fotos que YA estaban subidas ----------

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function watermarkBlob(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      drawWatermark(ctx, canvas.width, canvas.height);

      canvas.toBlob((newBlob) => {
        URL.revokeObjectURL(objectUrl);
        if (!newBlob) { reject(new Error("No se pudo procesar la imagen.")); return; }
        resolve(newBlob);
      }, blob.type || "image/jpeg", IMAGE_JPEG_QUALITY);
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("No se pudo cargar la imagen.")); };
    img.src = objectUrl;
  });
}
