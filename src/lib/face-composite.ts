/* ------------------------------------------------------------------ */
/*  Face Composite v24 â restores original face onto VTO result        */
/*                                                                      */
/*  The Imagen 3 VTO model sometimes distorts facial features (skin     */
/*  tone shift, eye asymmetry, expression change, beard softening).     */
/*  This module detects the face in both the original photo and VTO     */
/*  result, color-corrects the original to match VTO lighting, then     */
/*  composites it with a multi-layer feathered mask for natural blend.  */
/*                                                                      */
/*  v21 improvements over v18:                                          */
/*  - Color histogram matching (skin tone adapts to VTO lighting)       */
/*  - Multi-layer mask (inner sharp + outer feather for natural edges)  */
/*  - Neck region included in blend zone                                */
/*  - Fallback heuristic tuned for standing full-body photos            */
/* ------------------------------------------------------------------ */

interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Detect face bounding box using Chrome's built-in FaceDetector API.
 * Falls back to a heuristic if the API is unavailable or detection fails.
 */
async function detectFace(img: HTMLImageElement): Promise<FaceBox> {
  if ("FaceDetector" in window) {
    try {
      // @ts-ignore â FaceDetector is a Chrome-only API
      const detector = new FaceDetector({ maxDetectedFaces: 1 });
      const faces = await detector.detect(img);
      if (faces.length > 0) {
        const box = faces[0].boundingBox;
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }
    } catch (e) {
      console.warn("FaceDetector failed, using heuristic:", e);
    }
  }

  // Heuristic for standing full-body photo:
  // Face is roughly horizontally centered, vertically in top 8%-28%
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const faceW = w * 0.35;
  const faceH = h * 0.22;
  return {
    x: (w - faceW) / 2,
    y: h * 0.06,
    width: faceW,
    height: faceH,
  };
}

/** Load a base64 image into an HTMLImageElement. */
function loadImage(base64: string, mimeType = "image/jpeg"): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64.startsWith("data:") ? base64 : `data:${mimeType};base64,${base64}`;
  });
}

/* ------------------------------------------------------------------ */
/*  Color correction: match the original face lighting to the VTO      */
/* ------------------------------------------------------------------ */

interface ColorStats {
  meanR: number; meanG: number; meanB: number;
  stdR: number; stdG: number; stdB: number;
}

/**
 * Sample color statistics from the face region of an image.
 * Only samples skin-tone pixels (heuristic: R > 60, G > 30, B > 15,
 * and R > G > B loosely) to avoid sampling background/hair/clothing.
 */
function getFaceColorStats(
  ctx: CanvasRenderingContext2D,
  box: FaceBox
): ColorStats {
  // Sample from the inner 60% of the face box (avoid hair/ears)
  const innerX = Math.round(box.x + box.width * 0.2);
  const innerY = Math.round(box.y + box.height * 0.15);
  const innerW = Math.round(box.width * 0.6);
  const innerH = Math.round(box.height * 0.7);

  const data = ctx.getImageData(innerX, innerY, innerW, innerH).data;

  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  const rVals: number[] = [], gVals: number[] = [], bVals: number[] = [];

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    // Skip transparent and non-skin pixels
    if (a < 128) continue;
    // Loose skin-tone heuristic (works across diverse skin tones)
    if (r > 40 && g > 20 && r > b * 0.7) {
      sumR += r; sumG += g; sumB += b;
      rVals.push(r); gVals.push(g); bVals.push(b);
      count++;
    }
  }

  if (count < 10) {
    // Fallback: use all pixels
    count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      sumR += data[i]; sumG += data[i + 1]; sumB += data[i + 2];
      rVals.push(data[i]); gVals.push(data[i + 1]); bVals.push(data[i + 2]);
      count++;
    }
  }

  if (count === 0) {
    return { meanR: 128, meanG: 128, meanB: 128, stdR: 40, stdG: 40, stdB: 40 };
  }

  const meanR = sumR / count;
  const meanG = sumG / count;
  const meanB = sumB / count;

  let varR = 0, varG = 0, varB = 0;
  for (let i = 0; i < rVals.length; i++) {
    varR += (rVals[i] - meanR) ** 2;
    varG += (gVals[i] - meanG) ** 2;
    varB += (bVals[i] - meanB) ** 2;
  }

  return {
    meanR, meanG, meanB,
    stdR: Math.sqrt(varR / count) || 1,
    stdG: Math.sqrt(varG / count) || 1,
    stdB: Math.sqrt(varB / count) || 1,
  };
}

/**
 * Apply color transfer: adjust source image pixels so that the face region's
 * color distribution matches the target face region's distribution.
 * Uses Reinhard color transfer (mean/std matching per channel).
 */
function applyColorCorrection(
  srcCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  srcStats: ColorStats,
  tgtStats: ColorStats,
  box: FaceBox,
  featherRadius: number
): void {
  const imgData = srcCtx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const maxDist = Math.max(box.width, box.height) / 2 + featherRadius;

  // Scale factors per channel
  const scaleR = tgtStats.stdR / srcStats.stdR;
  const scaleG = tgtStats.stdG / srcStats.stdG;
  const scaleB = tgtStats.stdB / srcStats.stdB;

  // Clamp scale factors to avoid extreme corrections
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const sR = clamp(scaleR, 0.5, 2.0);
  const sG = clamp(scaleG, 0.5, 2.0);
  const sB = clamp(scaleB, 0.5, 2.0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Calculate distance from face center â apply stronger correction near face
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist > maxDist) continue; // Skip pixels far from face

      // Blend factor: 1.0 at face center, fades to 0.0 at edges
      const blend = clamp(1 - dist / maxDist, 0, 1);

      // Reinhard transfer per channel
      const newR = (data[idx] - srcStats.meanR) * sR + tgtStats.meanR;
      const newG = (data[idx + 1] - srcStats.meanG) * sG + tgtStats.meanG;
      const newB = (data[idx + 2] - srcStats.meanB) * sB + tgtStats.meanB;

      // Blend between original and corrected
      data[idx] = clamp(data[idx] * (1 - blend) + newR * blend, 0, 255);
      data[idx + 1] = clamp(data[idx + 1] * (1 - blend) + newG * blend, 0, 255);
      data[idx + 2] = clamp(data[idx + 2] * (1 - blend) + newB * blend, 0, 255);
    }
  }

  srcCtx.putImageData(imgData, 0, 0);
}

/* ------------------------------------------------------------------ */
/*  Multi-layer feathered mask                                         */
/* ------------------------------------------------------------------ */

function createFeatheredMask(
  width: number,
  height: number,
  box: FaceBox,
  feather = 0.12
): HTMLCanvasElement {
  const mask = document.createElement("canvas");
  mask.width = width;
  mask.height = height;
  const ctx = mask.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);

  // v24: Very tight mask â face only, NO chin/neck extension
  // v23 still bled into collar/chest shifting garment color
  const neckExtend = 0;  // was 0.10 â completely removed to protect garment collar
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;  // centered on face, no downward offset
  const expandX = box.width * feather;
  const expandY = box.height * feather;
  const rx = box.width / 2 + expandX;
  const ry = box.height / 2 + expandY;
  const maxR = Math.max(rx, ry);

  // Sharper gradient â solid core larger, faster falloff at edges
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.55, "rgba(255,255,255,1)");    // Larger solid core
  gradient.addColorStop(0.70, "rgba(255,255,255,0.7)");  // Start fade later
  gradient.addColorStop(0.82, "rgba(255,255,255,0.25)"); // Faster drop
  gradient.addColorStop(0.92, "rgba(255,255,255,0.05)"); // Nearly gone
  gradient.addColorStop(1.0, "rgba(255,255,255,0)");     // Fully transparent

  // Draw elliptical mask
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx / maxR, ry / maxR);
  ctx.translate(-cx, -cy);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // v25: Hard clip bottom of mask to prevent collar/neck color bleed
  const bottomFadeStart = box.y + box.height * 0.70;
  const bottomFadeEnd = box.y + box.height * 0.85;
  ctx.globalCompositeOperation = "destination-out";
  const fadeGrad = ctx.createLinearGradient(0, bottomFadeStart, 0, bottomFadeEnd);
  fadeGrad.addColorStop(0, "rgba(0,0,0,0)");
  fadeGrad.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = fadeGrad;
  ctx.fillRect(0, bottomFadeStart, mask.width, bottomFadeEnd - bottomFadeStart);
  ctx.clearRect(0, bottomFadeEnd, mask.width, mask.height - bottomFadeEnd);
  ctx.globalCompositeOperation = "source-over";

  return mask;
}

/* ------------------------------------------------------------------ */
/*  Main composite function                                            */
/* ------------------------------------------------------------------ */

/**
 * Composite the original face onto the VTO result with color correction.
 *
 * Steps:
 * 1. Detect face in original and VTO images
 * 2. Color-correct original face to match VTO lighting
 * 3. Scale & align original face to VTO face position
 * 4. Blend with multi-layer feathered mask
 * 5. Return composited image as base64
 */
export async function compositeFaceOntoVTO(
  originalBase64: string,
  vtoResultBase64: string,
  originalMime = "image/jpeg",
  vtoMime = "image/png"
): Promise<string> {
  const [origImg, vtoImg] = await Promise.all([
    loadImage(originalBase64, originalMime),
    loadImage(vtoResultBase64, vtoMime),
  ]);

  // Detect faces
  const [origFace, vtoFace] = await Promise.all([
    detectFace(origImg),
    detectFace(vtoImg),
  ]);

  const outW = vtoImg.naturalWidth;
  const outH = vtoImg.naturalHeight;

  // --- Get color stats from both face regions ---
  // Draw original at its natural size for stats sampling
  const origStatCanvas = document.createElement("canvas");
  origStatCanvas.width = origImg.naturalWidth;
  origStatCanvas.height = origImg.naturalHeight;
  const origStatCtx = origStatCanvas.getContext("2d")!;
  origStatCtx.drawImage(origImg, 0, 0);
  const origStats = getFaceColorStats(origStatCtx, origFace);

  // Draw VTO at output size for stats sampling
  const vtoStatCanvas = document.createElement("canvas");
  vtoStatCanvas.width = outW;
  vtoStatCanvas.height = outH;
  const vtoStatCtx = vtoStatCanvas.getContext("2d")!;
  vtoStatCtx.drawImage(vtoImg, 0, 0);
  const vtoStats = getFaceColorStats(vtoStatCtx, vtoFace);

  // --- Create aligned + color-corrected original ---
  const origCanvas = document.createElement("canvas");
  origCanvas.width = outW;
  origCanvas.height = outH;
  const origCtx = origCanvas.getContext("2d")!;

  // Scale to align face centers
  const scaleX = vtoFace.width / origFace.width;
  const scaleY = vtoFace.height / origFace.height;
  const scale = (scaleX + scaleY) / 2;

  const origCx = origFace.x + origFace.width / 2;
  const origCy = origFace.y + origFace.height / 2;
  const vtoCx = vtoFace.x + vtoFace.width / 2;
  const vtoCy = vtoFace.y + vtoFace.height / 2;

  const offsetX = vtoCx - origCx * scale;
  const offsetY = vtoCy - origCy * scale;

  origCtx.drawImage(
    origImg, offsetX, offsetY,
    origImg.naturalWidth * scale,
    origImg.naturalHeight * scale
  );

  // Apply Reinhard color correction to match VTO lighting
  // v24: Much smaller radius â only correct pixels very close to face center
  // v23 radius of 0.3 still reached collar/chest and shifted garment color
  applyColorCorrection(
    origCtx, outW, outH,
    origStats, vtoStats,
    vtoFace,
    Math.max(vtoFace.width, vtoFace.height) * 0.10  // v24: minimal â face only
  );

  // v24: Very tight mask â no neck extension, sharper falloff
  const mask = createFeatheredMask(outW, outH, vtoFace, 0.12);

  // --- Composite: VTO base + masked original face ---
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;

  // Draw VTO as base
  ctx.drawImage(vtoImg, 0, 0, outW, outH);

  // Create masked face layer
  const maskedCanvas = document.createElement("canvas");
  maskedCanvas.width = outW;
  maskedCanvas.height = outH;
  const maskedCtx = maskedCanvas.getContext("2d")!;
  maskedCtx.drawImage(origCanvas, 0, 0);
  maskedCtx.globalCompositeOperation = "destination-in";
  maskedCtx.drawImage(mask, 0, 0);

  // Overlay masked face onto VTO result
  ctx.drawImage(maskedCanvas, 0, 0);

  // Export as PNG for quality
  const dataUrl = canvas.toDataURL("image/png");
  return dataUrl.split(",")[1];
}
