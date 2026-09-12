/**
 * TEACHER OS — AI STUDIO EXPORT V3
 * HTML → PNG Rasterizer (client-side, no headless browser)
 *
 * Uses the SVG <foreignObject> technique: the XHTML slide markup is embedded
 * into an SVG document, loaded as an <img>, then drawn onto an oversized
 * canvas for a crisp 2x render. This runs entirely in the browser and keeps
 * the export flow client-side, matching the existing export architecture.
 */

import { SLIDE_WIDTH, SLIDE_HEIGHT } from "./slide-html";

export interface HtmlToPngOptions {
  width?: number;
  height?: number;
  /** Device scale factor for crispness. 2 => 2560x1440 output. */
  scale?: number;
}

/**
 * Rasterizes standalone slide XHTML (a namespaced root div with embedded
 * <style>) into a PNG data URL.
 */
export async function renderHtmlToPngDataUrl(
  slideXhtml: string,
  options: HtmlToPngOptions = {}
): Promise<string> {
  const width = options.width ?? SLIDE_WIDTH;
  const height = options.height ?? SLIDE_HEIGHT;
  const scale = options.scale ?? 2;

  if (typeof document === "undefined") {
    throw new Error(
      "Ekspor PPTX visual hanya dapat dijalankan di browser (lingkungan DOM tidak ditemukan)."
    );
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    `<foreignObject x="0" y="0" width="100%" height="100%">`,
    slideXhtml,
    `</foreignObject>`,
    `</svg>`,
  ].join("");

  const svgUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

  const image = new Image();
  image.width = width;
  image.height = height;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () =>
      reject(new Error("Gagal merender slide ke gambar. Silakan coba ekspor ulang."));
    image.src = svgUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context tidak tersedia di browser ini.");
  }

  // Opaque background so PNG has no unnecessary alpha noise.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/png");
}
