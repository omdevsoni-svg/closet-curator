/* ------------------------------------------------------------------ */
/*  Face Composite — restores original face onto VTO result             */
/*                                                                      */
/*  The Imagen 3 VTO model sometimes distorts facial features (skin     */
/*  tone shift, eye asymmetry, expression change, beard softening).     */
/*  This module detects the face region in both the original photo and  */
/*  VTO result, then composites the original face back onto the VTO     */
/*  output with a soft feathered mask for natural blending.             */
/*                                                                      */
/*  Face detection strategy:                                            */
/*  1. Chrome FaceDetector API (built-in, fast, no library needed)      */
/*  2. Fallback: heuristic top-center region (~20% of image height)     */
/*                                                                      */
/*  v18: Initial implementation                                         */
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
async function detectFace(
  img: HTMLImageElement
): Promise<FaceBox> {
  // Try Chrome's built-in FaceDetector API
  if ("FaceDetector" in window) {
    try {
      // @ts-ignore — FaceDetector is a Chrome-only API
      const detector = new FaceDetector({ maxDetectedFaces: 1 });
      const faces = await detector.detect(img);
      if (faces.length > 0) {
        const box = faces[0].boundingBox;
        return {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        };
      }
    } catch (e) {
      console.warn("FaceDetector failed, using heuristic:", e);
    }
  }

  // Fallback heuristic: assume face is in the upper-center portion
  // For a typical standing person photo, the face is roughly:
  // - Horizontally centered (30%–70% of width)
  // - Vertically in the top 8%–28% of the image
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

/**
 * Load a base64-encoded image into an HTMLImageElement.
 */
function loadImage(base64: string, mimeType = "image/jpeg"): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    // Handle both with and without data: prefix
    if (base64.startsWith("data:")) {
      img.src = base64;
    } else {
      img.src = `data:${mimeType};base64,${base64}`;
    }
  });
}

/**
 * Create a soft elliptical gradient mask on a canvas.
 * The mask is white (opaque) at the center and fades to transparent at edges.
 * The feather parameter controls how soft the transition is (0–1).
 */
function createFeatheredMask(
  width: number,
  height: number,
  box: FaceBox,
  feather = 0.35
): HTMLCanvasElement {
  const mask = document.createElement("canvas");
  mask.width = width;
  mask.height = height;
  const ctx = mask.getContext("2d")!;

  // Start fully transparent
  ctx.clearRect(0, 0, width, height);

  // Expand the box slightly for the feather region
  const expandX = box.width * feather;
  const expandY = box.height * feather;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rx = box.width / 2 + expandX;
  const ry = box.height / 2 + expandY;

  // Draw radial gradient ellipse
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));

  // Inner solid region (70% of radius = fully opaque)
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.55, "rgba(255,255,255,1)");
  // Feathered transition
  gradient.addColorStop(0.75, "rgba(255,255,255,0.7)");
  gradient.addColorStop(0.9, "rgba(255,255,255,0.2)");
  gradient.addColorStop(1.0, "rgba(255,255,255,0)");

  // Draw the elliptical mask
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
  ctx.translate(-cx, -cy);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(rx, ry), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return mask;
}

/**
 * Composite the original face onto the VTO result.
 *
 * Steps:
 * 1. Detect face region in original photo
 * 2. Detect face region in VTO result (should be similar position)
 * 3. Create a feathered elliptical mask around the face
 * 4. Paint the original face onto the VTO result using the mask
 * 5. Return the composited image as base64
 */
export async function compositeFaceOntoVTO(
  originalBase64: string,
  vtoResultBase64: string,
  originalMime = "image/jpeg",
  vtoMime = "image/png"
): Promise<string> {
  // Load both images
  const [origImg, vtoImg] = await Promise.all([
    loadImage(originalBase64, originalMime),
    loadImage(vtoResultBase64, vtoMime),
  ]);

  // Detect face in both images
  const [origFace, vtoFace] = await Promise.all([
    detectFace(origImg),
    detectFace(vtoImg),
  ]);

  // Create output canvas at VTO result dimensions
  const outW = vtoImg.naturalWidth;
  const outH = vtoImg.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;

  // Step 1: Draw VTO result as the base layer
  ctx.drawImage(vtoImg, 0, 0, outW, outH);

  // Step 2: Create a temporary canvas with the original image
  // scaled/positioned to align the original face with the VTO face position
  const origCanvas = document.createElement("canvas");
  origCanvas.width = outW;
  origCanvas.height = outH;
  const origCtx = origCanvas.getContext("2d")!;

  // Calculate scale and offset to align original face → VTO face position
  const scaleX = vtoFace.width / origFace.width;
  const scaleY = vtoFace.height / origFace.height;
  const scale = (scaleX + scaleY) / 2; // Average scale

  // Center of original face in original image space
  const origCx = origFace.x + origFace.width / 2;
  const origCy = origFace.y + origFace.height / 2;

  // Center of VTO face in VTO image space
  const vtoCx = vtoFace.x + vtoFace.width / 2;
  const vtoCy = vtoFace.y + vtoFace.height / 2;

  // Draw original image, aligned so face centers match
  const offsetX = vtoCx - origCx * scale;
  const offsetY = vtoCy - origCy * scale;

  origCtx.drawImage(
    origImg,
    offsetX,
    offsetY,
    origImg.naturalWidth * scale,
    origImg.naturalHeight * scale
  );

  // Step 3: Create feathered mask around the VTO face position
  const mask = createFeatheredMask(outW, outH, vtoFace, 0.35);

  // Step 4: Use the mask to composite original face onto VTO result
  // Strategy: Use "destination-in" to cut the original to only the face region,
  // then draw that on top of the VTO result

  // Create a masked version of the original-aligned image
  const maskedCanvas = document.createElement("canvas");
  maskedCanvas.width = outW;
  maskedCanvas.height = outH;
  const maskedCtx = maskedCanvas.getContext("2d")!;

  // Draw the aligned original
  maskedCtx.drawImage(origCanvas, 0, 0);

  // Apply the mask — only keep pixels where mask is opaque
  maskedCtx.globalCompositeOperation = "destination-in";
  maskedCtx.drawImage(mask, 0, 0);

  // Step 5: Draw the masked face on top of VTO result
  ctx.drawImage(maskedCanvas, 0, 0);

  // Export as base64 (PNG for quality)
  const dataUrl = canvas.toDataURL("image/png");
  return dataUrl.split(",")[1]; // Strip the data:image/png;base64, prefix
}
