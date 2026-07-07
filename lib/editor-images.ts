/** Shared image helpers for the rich-text editors (browser only). */

/**
 * Read a picked image, downscale it to `maxDim` on its longest side, and return
 * a compressed data URL so documents/templates stay small. Falls back to the
 * raw data URL if canvas encoding isn't available.
 */
export function downscaleImage(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a valid image."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, width, height);
        const type = /png|gif|svg|webp/i.test(file.type) ? "image/png" : "image/jpeg";
        try { resolve(canvas.toDataURL(type, quality)); }
        catch { resolve(dataUrl); }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
