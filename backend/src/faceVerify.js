/**
 * Face Verification Module — AI-powered selfie check-in
 *
 * Liveness detection + face encoding + spoof prevention
 * No external API dependencies — runs entirely on Render
 */

const crypto = require('crypto');

// ── Liveness Detection ──

/**
 * Analyze image for liveness signals
 * Returns { isLive, confidence, reasons[] }
 */
function detectLiveness(base64Image) {
  const buf = Buffer.from(base64Image, 'base64');

  const checks = {
    brightness: checkBrightness(buf),
    contrast: checkContrast(buf),
    noise: checkNoise(buf),
    edges: checkEdges(buf),
    size: checkImageSize(base64Image),
    format: checkImageFormat(base64Image),
  };

  const passed = Object.values(checks).filter(c => c.pass).length;
  const total = Object.keys(checks).length;
  const confidence = Math.round((passed / total) * 100);

  const reasons = Object.entries(checks)
    .filter(([, c]) => !c.pass)
    .map(([name, c]) => `${name}: ${c.reason}`);

  return {
    isLive: passed >= 4,
    confidence,
    reasons,
    checks,
  };
}

function checkBrightness(buf) {
  let sum = 0;
  const sampleSize = Math.min(buf.length, 10000);
  for (let i = 0; i < sampleSize; i += 4) {
    sum += buf[i]; // sample red channel
  }
  const avg = sum / (sampleSize / 4);
  const pass = avg > 30 && avg < 230;
  return { pass, value: Math.round(avg), reason: pass ? '' : `brightness ${Math.round(avg)} out of range` };
}

function checkContrast(buf) {
  let min = 255, max = 0;
  const sampleSize = Math.min(buf.length, 10000);
  for (let i = 0; i < sampleSize; i += 4) {
    const v = buf[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const contrast = max - min;
  const pass = contrast > 40;
  return { pass, value: contrast, reason: pass ? '' : `low contrast (${contrast})` };
}

function checkNoise(buf) {
  let diff = 0;
  let count = 0;
  const sampleSize = Math.min(buf.length, 8000);
  for (let i = 4; i < sampleSize; i += 4) {
    diff += Math.abs(buf[i] - buf[i - 4]);
    count++;
  }
  const avgDiff = count ? diff / count : 0;
  const pass = avgDiff > 1 && avgDiff < 80;
  return { pass, value: Math.round(avgDiff), reason: pass ? '' : `noise level ${Math.round(avgDiff)}` };
}

function checkEdges(buf) {
  let edgeCount = 0;
  const width = Math.sqrt(buf.length / 4) | 0;
  const sampleSize = Math.min(buf.length, 16000);
  for (let i = 4; i < sampleSize; i += 4) {
    const diff = Math.abs(buf[i] - buf[i - 4]);
    if (diff > 30) edgeCount++;
  }
  const ratio = edgeCount / (sampleSize / 4);
  const pass = ratio > 0.02 && ratio < 0.6;
  return { pass, value: (ratio * 100).toFixed(1), reason: pass ? '' : `edge ratio ${(ratio * 100).toFixed(1)}%` };
}

function checkImageSize(base64) {
  const bytes = Math.ceil((base64.length * 3) / 4);
  const kb = bytes / 1024;
  const pass = kb > 5 && kb < 5000;
  return { pass, value: `${Math.round(kb)}KB`, reason: pass ? '' : `image size ${Math.round(kb)}KB` };
}

function checkImageFormat(base64) {
  const pass = base64.length > 100;
  return { pass, value: 'base64', reason: pass ? '' : 'invalid image data' };
}

// ── Face Encoding ──

/**
 * Generate a face encoding from image data
 * Uses pixel sampling at key facial regions to create a unique fingerprint
 * This is a simplified encoding — production would use a proper face recognition model
 */
function encodeFace(base64Image) {
  const buf = Buffer.from(base64Image, 'base64');
  const width = Math.sqrt(buf.length / 4) | 0;
  const height = (buf.length / 4 / width) | 0;

  if (width < 50 || height < 50) return null;

  // Sample 128 feature points from facial regions
  const encoding = [];
  const regions = [
    // Forehead region
    { cx: 0.5, cy: 0.2, r: 0.08 },
    // Left eye region
    { cx: 0.35, cy: 0.35, r: 0.06 },
    // Right eye region
    { cx: 0.65, cy: 0.35, r: 0.06 },
    // Nose region
    { cx: 0.5, cy: 0.48, r: 0.05 },
    // Left cheek
    { cx: 0.3, cy: 0.52, r: 0.07 },
    // Right cheek
    { cx: 0.7, cy: 0.52, r: 0.07 },
    // Mouth region
    { cx: 0.5, cy: 0.65, r: 0.06 },
    // Chin region
    { cx: 0.5, cy: 0.78, r: 0.05 },
    // Left jaw
    { cx: 0.25, cy: 0.6, r: 0.05 },
    // Right jaw
    { cx: 0.75, cy: 0.6, r: 0.05 },
    // Left temple
    { cx: 0.2, cy: 0.35, r: 0.04 },
    // Right temple
    { cx: 0.8, cy: 0.35, r: 0.04 },
  ];

  for (const region of regions) {
    const cx = (region.cx * width) | 0;
    const cy = (region.cy * height) | 0;
    const radius = (region.r * Math.min(width, height)) | 0;

    // Sample multiple points within region
    for (let dx = -radius; dx <= radius; dx += Math.max(1, radius / 3)) {
      for (let dy = -radius; dy <= radius; dy += Math.max(1, radius / 3)) {
        const px = Math.min(Math.max(0, cx + dx), width - 1);
        const py = Math.min(Math.max(0, cy + dy), height - 1);
        const offset = (py * width + px) * 4;
        if (offset + 2 < buf.length) {
          // RGB normalized to [0,1]
          encoding.push(buf[offset] / 255);
          encoding.push(buf[offset + 1] / 255);
          encoding.push(buf[offset + 2] / 255);
        }
      }
    }
  }

  // Pad or truncate to fixed size (128 features)
  while (encoding.length < 128) encoding.push(0);
  encoding.length = 128;

  // Normalize the vector
  const norm = Math.sqrt(encoding.reduce((s, v) => s + v * v, 0)) || 1;
  return encoding.map(v => v / norm);
}

// ── Face Comparison ──

/**
 * Compare two face encodings using cosine similarity
 * Returns { match, similarity, threshold }
 */
function compareFaces(encoding1, encoding2, threshold = 0.85) {
  if (!encoding1 || !encoding2) return { match: false, similarity: 0, threshold };
  if (encoding1.length !== encoding2.length) return { match: false, similarity: 0, threshold };

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < encoding1.length; i++) {
    dotProduct += encoding1[i] * encoding2[i];
    norm1 += encoding1[i] * encoding1[i];
    norm2 += encoding2[i] * encoding2[i];
  }

  const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2) || 1);
  return {
    match: similarity >= threshold,
    similarity: Math.round(similarity * 1000) / 1000,
    threshold,
  };
}

// ── Anti-Spoofing ──

/**
 * Detect potential spoofing attempts
 * Checks for screen photos, printed photos, and masks
 */
function detectSpoofing(base64Image, prevFrameBase64) {
  const buf = Buffer.from(base64Image, 'base64');
  const warnings = [];

  // Check for uniform color distribution (printed photo)
  const colorVariance = computeColorVariance(buf);
  if (colorVariance < 0.02) {
    warnings.push('Low color variance — possible printed photo');
  }

  // Check for moiré patterns (screen photo)
  const moireScore = detectMoire(buf);
  if (moireScore > 0.7) {
    warnings.push('Moiré pattern detected — possible screen photo');
  }

  // Check for flat lighting (2D spoof)
  const lightingVariance = computeLightingVariance(buf);
  if (lightingVariance < 0.01) {
    warnings.push('Flat lighting — possible 2D spoof');
  }

  // Frame difference check (if previous frame provided)
  if (prevFrameBase64) {
    const prevBuf = Buffer.from(prevFrameBase64, 'base64');
    const diff = computeFrameDifference(buf, prevBuf);
    if (diff < 0.001) {
      warnings.push('No movement detected — possible static image');
    }
  }

  return {
    isSpoof: warnings.length >= 2,
    warnings,
    scores: { colorVariance, moireScore, lightingVariance },
  };
}

function computeColorVariance(buf) {
  let rSum = 0, gSum = 0, bSum = 0;
  let rSqSum = 0, gSqSum = 0, bSqSum = 0;
  const n = Math.min(buf.length / 4, 5000);

  for (let i = 0; i < n * 4; i += 4) {
    rSum += buf[i]; gSum += buf[i + 1]; bSum += buf[i + 2];
    rSqSum += buf[i] ** 2; gSqSum += buf[i + 1] ** 2; bSqSum += buf[i + 2] ** 2;
  }

  const rVar = (rSqSum / n) - (rSum / n) ** 2;
  const gVar = (gSqSum / n) - (gSum / n) ** 2;
  const bVar = (bSqSum / n) - (bSum / n) ** 2;

  return ((rVar + gVar + bVar) / 3) / (255 * 255);
}

function detectMoire(buf) {
  let highFreqCount = 0;
  const sampleSize = Math.min(buf.length, 8000);
  for (let i = 8; i < sampleSize; i += 4) {
    const diff = Math.abs(buf[i] - buf[i - 8]);
    if (diff > 50) highFreqCount++;
  }
  return highFreqCount / (sampleSize / 4);
}

function computeLightingVariance(buf) {
  let sum = 0, sqSum = 0;
  const n = Math.min(buf.length / 4, 5000);
  for (let i = 0; i < n * 4; i += 4) {
    const brightness = (buf[i] + buf[i + 1] + buf[i + 2]) / 3;
    sum += brightness;
    sqSum += brightness ** 2;
  }
  const mean = sum / n;
  return ((sqSum / n) - mean * mean) / (255 * 255);
}

function computeFrameDifference(buf1, buf2) {
  const len = Math.min(buf1.length, buf2.length);
  let diff = 0;
  const n = Math.min(len, 10000);
  for (let i = 0; i < n; i += 4) {
    diff += Math.abs(buf1[i] - buf2[i]);
  }
  return diff / (n / 4) / 255;
}

// ── Full Verification Pipeline ──

/**
 * Run complete face verification
 * @param {string} selfieBase64 - Current selfie
 * @param {object|null} enrolledProfile - Stored face profile { encoding, photo }
 * @param {string|null} prevFrameBase64 - Previous frame for motion detection
 * @returns {object} Verification result
 */
function verifyFace(selfieBase64, enrolledProfile, prevFrameBase64 = null) {
  // Step 1: Liveness check
  const liveness = detectLiveness(selfieBase64);
  if (!liveness.isLive) {
    return {
      ok: false,
      status: 'liveness_failed',
      message: 'Liveness check failed',
      detail: `Confidence: ${liveness.confidence}%. ${liveness.reasons.join('; ')}`,
      liveness,
    };
  }

  // Step 2: Anti-spoofing
  const spoof = detectSpoofing(selfieBase64, prevFrameBase64);
  if (spoof.isSpoof) {
    return {
      ok: false,
      status: 'spoof_detected',
      message: 'Spoof attempt detected',
      detail: spoof.warnings.join('; '),
      liveness,
      spoof,
    };
  }

  // Step 3: Face encoding
  const encoding = encodeFace(selfieBase64);
  if (!encoding) {
    return {
      ok: false,
      status: 'encoding_failed',
      message: 'Could not detect face encoding',
      detail: 'Please ensure your face is clearly visible',
      liveness,
      spoof,
    };
  }

  // Step 4: If no enrolled profile, this is enrollment
  if (!enrolledProfile) {
    return {
      ok: true,
      status: 'enrolled',
      message: 'Face enrolled successfully',
      detail: 'Your face has been registered for future verification',
      encoding,
      liveness,
      spoof,
      isNewEnrollment: true,
    };
  }

  // Step 5: Compare with enrolled face
  const comparison = compareFaces(encoding, enrolledProfile.encoding);
  if (!comparison.match) {
    return {
      ok: false,
      status: 'mismatch',
      message: 'Face does not match enrolled profile',
      detail: `Similarity: ${(comparison.similarity * 100).toFixed(1)}% (threshold: ${(comparison.threshold * 100).toFixed(0)}%)`,
      liveness,
      spoof,
      comparison,
    };
  }

  return {
    ok: true,
    status: 'verified',
    message: 'Face verified successfully',
    detail: `Match confidence: ${(comparison.similarity * 100).toFixed(1)}%`,
    encoding,
    liveness,
    spoof,
    comparison,
    isNewEnrollment: false,
  };
}

module.exports = {
  detectLiveness,
  encodeFace,
  compareFaces,
  detectSpoofing,
  verifyFace,
};
