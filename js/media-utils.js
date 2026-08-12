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

function drawWatermark(ctx, width, height) {
  const markSize = Math.max(18, Math.min(40, width * 0.05));
  const fontSize = markSize * 0.62;
  const gap = markSize * 0.35;
  const pad = markSize * 0.45;

  ctx.save();
  ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  const textWidth = ctx.measureText("Roster").width;

  const pillW = markSize + gap + textWidth + pad * 2;
  const pillH = markSize + pad * 0.9;
  const pillX = width - pad * 1.6 - pillW;
  const pillY = height - pad * 1.6 - pillH;
  const r = pillH / 2;

  // fondo translúcido, para que se lea encima de cualquier foto
  ctx.globalAlpha = 0.55;
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

  ctx.globalAlpha = 0.9;
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
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "middle";
  ctx.fillText("Roster", iconX + markSize + gap, pillY + pillH / 2);

  ctx.restore();
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
