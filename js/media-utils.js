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
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (!blob || blob.size >= file.size) { resolve(file); return; } // si no ayudó, se queda el original
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
