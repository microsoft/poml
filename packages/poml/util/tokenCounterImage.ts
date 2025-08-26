/**
 * Image-token estimator covering OpenAI’s three vision price rules
 * (docs dated 2025-07-01).
 */

export type VisionModel =
  | 'gpt-4.1-mini'
  | 'gpt-4.1-nano'
  | 'o4-mini'
  | 'gpt-4o'
  | 'gpt-4.1'
  | 'gpt-4.5'
  | '4o-mini'
  | 'o1'
  | 'o1-pro'
  | 'o3'
  | 'computer-use-preview'
  | 'gpt-image-1';

export type DetailLevel = 'low' | 'high' | 'auto';

const PATCH_MODELS: Record<VisionModel, { factor: number }> = {
  'gpt-4.1-mini': { factor: 1.62 },
  'gpt-4.1-nano': { factor: 2.46 },
  'o4-mini': { factor: 1.72 },
  // non-patch models:
  'gpt-4o': { factor: 0 },
  'gpt-4.1': { factor: 0 },
  'gpt-4.5': { factor: 0 },
  '4o-mini': { factor: 0 },
  'o1': { factor: 0 },
  'o1-pro': { factor: 0 },
  'o3': { factor: 0 },
  'computer-use-preview': { factor: 0 },
  'gpt-image-1': { factor: 0 },
};

const DETAIL_MODEL_TABLE: Record<VisionModel, { base: number; tile: number; shortest: number }> = {
  // detail-based families
  'gpt-4o': { base: 85, tile: 170, shortest: 768 },
  'gpt-4.1': { base: 85, tile: 170, shortest: 768 },
  'gpt-4.5': { base: 85, tile: 170, shortest: 768 },

  '4o-mini': { base: 2_833, tile: 5_667, shortest: 768 },

  'o1': { base: 75, tile: 150, shortest: 768 },
  'o1-pro': { base: 75, tile: 150, shortest: 768 },
  'o3': { base: 75, tile: 150, shortest: 768 },

  'computer-use-preview': { base: 65, tile: 129, shortest: 768 },

  // GPT-Image-1 (same algo, but 512-px shortest side)
  'gpt-image-1': { base: 65, tile: 129, shortest: 512 },

  // dummy rows for patch models (never consulted)
  'gpt-4.1-mini': { base: 0, tile: 0, shortest: 0 },
  'gpt-4.1-nano': { base: 0, tile: 0, shortest: 0 },
  'o4-mini': { base: 0, tile: 0, shortest: 0 },
};

interface Options {
  model: VisionModel;
  /** Ignored for patch models; required for detail models except GPT-Image-1. */
  detail?: DetailLevel;
  /** Return *billable* tokens instead of raw image tokens for patch models. */
  billable?: boolean;
}

/* --- PUBLIC API --- */
export function estimateImageTokens(
  width: number,
  height: number,
  { model, detail = 'high', billable = false }: Options,
): number {
  if (width <= 0 || height <= 0) {
    throw new Error('width/height must be > 0');
  }

  if (!PATCH_MODELS[model] && !DETAIL_MODEL_TABLE[model]) {
    console.warn(`Unknown model "${model}"; using gpt-4o as default.`);
    // If the model is unknown, default to gpt-4o
    // This is a fallback; ideally, the caller should ensure a valid model.
    model = 'gpt-4o';
  }

  /* Patch-grid models (32 px, cap = 1 536) */
  if (PATCH_MODELS[model]?.factor) {
    const raw = patchModelTokens(width, height);
    return billable ? Math.ceil(raw * PATCH_MODELS[model].factor) : raw;
  }

  /* Detail-based models */
  return detailModelTokens(width, height, model, detail);
}

/* --- Patch-grid helper --- */
const PATCH_SIZE = 32;
const PATCH_CAP = 1_536;

/**
 * Implements the two-step doc algorithm:
 *   1. Isotropic shrink so area ≤ cap patches
 *   2. Reduce width patches to an integer that still covers the image but
 *      produces ≤ cap total tokens, keeping aspect ratio.
 */
function patchModelTokens(w: number, h: number): number {
  // quick path
  let pw = Math.ceil(w / PATCH_SIZE);
  let ph = Math.ceil(h / PATCH_SIZE);
  if (pw * ph <= PATCH_CAP) {
    return pw * ph;
  }

  /* Step-1: first isotropic shrink */
  const shrink = Math.sqrt((PATCH_CAP * PATCH_SIZE * PATCH_SIZE) / (w * h));
  const sw = w * shrink;
  const sh = h * shrink;

  /* Step-2: choose the largest integer patch-width that fits cap */
  const pwFloat = sw / PATCH_SIZE; // e.g. 33.94
  for (let pwInt = Math.floor(pwFloat); pwInt >= 1; pwInt--) {
    const scale2 = pwInt / pwFloat; // second isotropic scale
    const newH = sh * scale2;
    const phInt = Math.ceil(newH / PATCH_SIZE);
    const tokens = pwInt * phInt;
    if (tokens <= PATCH_CAP) {
      return tokens; // first one ≤ cap wins
    }
  }
  return PATCH_CAP; // fallback – should never hit
}

/* --- Detail-based helper --- */
const MAX_DIM = 2_048;
const TILE = 512;

function detailModelTokens(w: number, h: number, model: VisionModel, detail: DetailLevel): number {
  const { base, tile, shortest } = DETAIL_MODEL_TABLE[model];

  // GPT-Image-1 ignores detail flag; others honour 'low'
  if (model !== 'gpt-image-1' && detail === 'low') {
    return base;
  }

  // (1) Fit inside 2048^2 square
  if (w > MAX_DIM || h > MAX_DIM) {
    const scale = Math.min(MAX_DIM / w, MAX_DIM / h);
    w *= scale;
    h *= scale;
  }

  // (2) Ensure shortest side == 768 (or 512)
  const scale = shortest / Math.min(w, h);
  w *= scale;
  h *= scale;

  // (3) Count 512-px tiles
  const tiles = Math.ceil(w / TILE) * Math.ceil(h / TILE);
  return base + tile * tiles;
}
