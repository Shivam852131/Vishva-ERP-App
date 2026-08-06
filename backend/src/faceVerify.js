/**
 * Face Verification Module — AI-powered selfie check-in
 *
 * Two-tier detection:
 *   1. ML mode (when @tensorflow/tfjs-node available): full face-api.js with
 *      TinyFaceDetector + FaceLandmark68 + FaceRecognitionNet + FaceExpressionNet
 *   2. Fallback mode: pixel-analysis-based liveness + encoding + cosine similarity
 *
 * On Render (Linux), @tensorflow/tfjs-node installs natively → ML mode activates.
 * On Windows dev, falls back to pixel analysis automatically.
 */

const path = require('path');

const MODEL_DIR = path.join(__dirname, '..', 'models');
let faceapi = null;
let modelsLoaded = false;

// ── Model Loading ──

async function loadModels() {
  if (modelsLoaded) return true;
  try {
    // Try loading @tensorflow/tfjs-node (works on Linux/Render)
    require('@tensorflow/tfjs-node');
    faceapi = require('@vladmandic/face-api');

    await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_DIR);
    await faceapi.nets.faceLandmark68TinyNet.loadFromDisk(MODEL_DIR);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);
    await faceapi.nets.faceExpressionNet.loadFromDisk(MODEL_DIR);

    modelsLoaded = true;
    console.log('[faceVerify] ✅ ML models loaded — full face detection active');
    return true;
  } catch (err) {
    console.warn('[faceVerify] ⚠ ML models unavailable, using pixel-analysis fallback:', err.message);
    modelsLoaded = false;
    return false;
  }
}

// ── Image Analysis Helpers ──

function analyzeImageBuffer(buffer) {
  let sum = 0, min = 255, max = 0;
  let edgeCount = 0, diffSum = 0;
  const sampleSize = Math.min(buffer.length, 20000);
  const n = sampleSize / 4;

  for (let i = 0; i < sampleSize; i += 4) {
    const v = buffer[i];
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
    if (i >= 4) {
      const d = Math.abs(buffer[i] - buffer[i - 4]);
      diffSum += d;
      if (d > 30) edgeCount++;
    }
  }

  return {
    brightness: sum / n,
    contrast: max - min,
    edgeRatio: edgeCount / n,
    avgDiff: diffSum / n,
    size: buffer.length,
  };
}

// ── Liveness Detection ──

function detectLiveness(detections, buffer) {
  // ML path: use face-api detections
  if (detections && detections.length > 0) {
    const checks = {};
    const detection = detections[0];

    checks.singleFace = detections.length === 1;
    if (!checks.singleFace) {
      return { isLive: false, confidence: 0, reasons: [`${detections.length} faces detected`], checks };
    }

    checks.confidence = detection.detection && detection.detection.score > 0.5;

    if (detection.detection && detection.detection.box) {
      const box = detection.detection.box;
      const imgW = detection.detection.imageWidth || 640;
      const imgH = detection.detection.imageHeight || 480;
      const faceRatio = (box.width * box.height) / (imgW * imgH);
      checks.faceSize = faceRatio > 0.05 && faceRatio < 0.8;
    }

    if (detection.expressions) {
      checks.expression = Object.values(detection.expressions).some(v => v > 0.05);
    }

    if (detection.landmarks) {
      checks.landmarks = detection.landmarks.positions && detection.landmarks.positions.length === 68;
    }

    if (buffer) {
      const a = analyzeImageBuffer(buffer);
      checks.brightness = a.brightness > 30 && a.brightness < 230;
      checks.contrast = a.contrast > 40;
    }

    const passed = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return {
      isLive: passed >= 5,
      confidence: Math.round((passed / total) * 100),
      reasons: Object.entries(checks).filter(([, v]) => !v).map(([k]) => `${k} check failed`),
      checks,
    };
  }

  // Fallback path: pixel analysis
  if (!buffer) {
    return { isLive: false, confidence: 0, reasons: ['No image data'], checks: {} };
  }

  const a = analyzeImageBuffer(buffer);
  const checks = {
    brightness: a.brightness > 30 && a.brightness < 230,
    contrast: a.contrast > 40,
    edges: a.edgeRatio > 0.02 && a.edgeRatio < 0.6,
    imageSize: a.size > 5000 && a.size < 5000000,
    format: a.size > 100,
  };

  const passed = Object.values(checks).filter(Boolean).length;
  return {
    isLive: passed >= 4,
    confidence: Math.round((passed / Object.keys(checks).length) * 100),
    reasons: Object.entries(checks).filter(([, v]) => !v).map(([k]) => `${k} check failed`),
    checks,
  };
}

// ── Anti-Spoofing ──

function detectSpoofing(detections) {
  const warnings = [];
  if (!detections || !detections.length) return { isSpoof: true, warnings: ['No face detected'], scores: {} };

  const detection = detections[0];

  if (detection.expressions) {
    const neutralScore = detection.expressions.neutral || 0;
    if (neutralScore > 0.9) warnings.push('Dominant neutral expression — possible printed photo');
  }

  if (detection.landmarks && detection.landmarks.positions) {
    const lm = detection.landmarks.positions;
    if (lm.length === 68) {
      const eyeDiff = Math.abs(lm[36].y - lm[45].y);
      const faceWidth = Math.abs(lm[45].x - lm[36].x);
      if (faceWidth > 0 && eyeDiff / faceWidth > 0.15) {
        warnings.push('Face tilt too extreme — possible rotated image');
      }
    }
  }

  return { isSpoof: warnings.length >= 2, warnings, scores: {} };
}

// ── Encoding ──

function extractEncoding(detection) {
  if (!detection || !detection.descriptor) return null;
  return Array.from(detection.descriptor);
}

function generateFallbackEncoding(buffer) {
  const width = Math.sqrt(buffer.length / 4) | 0;
  const height = (buffer.length / 4 / width) | 0;
  if (width < 50 || height < 50) return null;

  const encoding = [];
  // Sample 32 regions in a grid pattern for better accuracy
  const gridCols = 8;
  const gridRows = 4;
  for (let gy = 0; gy < gridRows; gy++) {
    for (let gx = 0; gx < gridCols; gx++) {
      const cx = (gx + 0.5) / gridCols;
      const cy = (gy + 0.5) / gridRows;
      const px = Math.min(Math.max(0, (cx * width) | 0), width - 1);
      const py = Math.min(Math.max(0, (cy * height) | 0), height - 1);
      const offset = (py * width + px) * 4;
      if (offset + 2 < buffer.length) {
        encoding.push(buffer[offset] / 255);
        encoding.push(buffer[offset + 1] / 255);
        encoding.push(buffer[offset + 2] / 255);
      }
    }
  }

  // Add gradient features (horizontal and vertical)
  for (let y = 0; y < gridRows; y++) {
    for (let x = 0; x < gridCols - 1; x++) {
      const idx1 = (y * gridCols + x) * 3;
      const idx2 = (y * gridCols + x + 1) * 3;
      if (idx2 + 2 < encoding.length) {
        encoding.push(encoding[idx1] - encoding[idx2]);
        encoding.push(encoding[idx1 + 1] - encoding[idx2 + 1]);
        encoding.push(encoding[idx1 + 2] - encoding[idx2 + 2]);
      }
    }
  }

  while (encoding.length < 128) encoding.push(0);
  encoding.length = 128;

  const norm = Math.sqrt(encoding.reduce((s, v) => s + v * v, 0)) || 1;
  return encoding.map(v => v / norm);
}

// ── Encode Face (for enrollment) ──

async function encodeFace(selfieBase64) {
  const buffer = Buffer.from(selfieBase64, 'base64');

  // Try ML detection first
  if (modelsLoaded && faceapi) {
    try {
      const { createCanvas, Image } = require('canvas');
      const img = new Image();
      img.src = buffer;
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const detections = await faceapi
        .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
        .withFaceLandmarks(true)
        .withFaceDescriptors()
        .withFaceExpressions();

      if (detections.length === 1) {
        const encoding = extractEncoding(detections[0]);
        if (encoding) {
          const liveness = detectLiveness(detections, buffer);
          return { ok: true, encoding, liveness, ml: true };
        }
      }
    } catch (err) {
      console.warn('[faceVerify] ML encode error, using fallback:', err.message);
    }
  }

  // Fallback: pixel-based encoding
  const encoding = generateFallbackEncoding(buffer);
  if (!encoding) {
    return { ok: false, error: 'Could not generate face encoding' };
  }
  const liveness = detectLiveness(null, buffer);
  return { ok: true, encoding, liveness, ml: false };
}

// ── Face Comparison ──

function compareFaces(encoding1, encoding2, threshold = 0.6) {
  if (!encoding1 || !encoding2) return { match: false, distance: 1, threshold };
  if (encoding1.length !== encoding2.length) return { match: false, distance: 1, threshold };

  let sumSq = 0;
  for (let i = 0; i < encoding1.length; i++) {
    const diff = encoding1[i] - encoding2[i];
    sumSq += diff * diff;
  }
  const distance = Math.sqrt(sumSq);
  const similarity = Math.max(0, 1 - distance);

  return {
    match: distance <= threshold,
    distance: Math.round(distance * 1000) / 1000,
    similarity: Math.round(similarity * 1000) / 1000,
    threshold,
  };
}

// ── Full Verification Pipeline ──

async function verifyFace(selfieBase64, enrolledProfile, prevFrameBase64 = null) {
  const buffer = Buffer.from(selfieBase64, 'base64');

  // Try ML detection
  let detections = null;
  let usedML = false;

  if (modelsLoaded && faceapi) {
    try {
      const { createCanvas, Image } = require('canvas');
      const img = new Image();
      img.src = buffer;
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      detections = await faceapi
        .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
        .withFaceLandmarks(true)
        .withFaceDescriptors()
        .withFaceExpressions();

      usedML = true;
    } catch (err) {
      console.warn('[faceVerify] ML detection error, using fallback:', err.message);
    }
  }

  // ── Liveness ──
  const liveness = detectLiveness(usedML ? detections : null, buffer);
  if (!liveness.isLive) {
    return { ok: false, status: 'liveness_failed', message: 'Liveness check failed',
      detail: `Confidence: ${liveness.confidence}%. ${liveness.reasons.join('; ')}`, liveness };
  }

  // ── Anti-spoofing (ML only) ──
  if (usedML) {
    const spoof = detectSpoofing(detections);
    if (spoof.isSpoof) {
      return { ok: false, status: 'spoof_detected', message: 'Spoof attempt detected',
        detail: spoof.warnings.join('; '), liveness, spoof };
    }
  }

  // ── Encoding ──
  const encoding = usedML ? extractEncoding(detections[0]) : generateFallbackEncoding(buffer);
  if (!encoding) {
    return { ok: false, status: 'encoding_failed', message: 'Could not generate face encoding',
      detail: 'Ensure your face is clearly visible', liveness };
  }

  // ── New enrollment ──
  if (!enrolledProfile || !enrolledProfile.encoding) {
    return { ok: true, status: 'enrolled', message: 'Face enrolled successfully',
      detail: 'Your face is now registered for check-in',
      encoding, liveness, isNewEnrollment: true, ml: usedML };
  }

  // ── Compare ──
  const threshold = usedML ? 0.6 : 0.7;
  const comparison = compareFaces(encoding, enrolledProfile.encoding, threshold);
  if (!comparison.match) {
    return { ok: false, status: 'mismatch', message: 'Face does not match enrolled profile',
      detail: `Similarity: ${(comparison.similarity * 100).toFixed(1)}%`,
      liveness, comparison };
  }

  return { ok: true, status: 'verified', message: 'Face verified successfully',
    detail: `Match confidence: ${(comparison.similarity * 100).toFixed(1)}%`,
    encoding, liveness, comparison, isNewEnrollment: false, ml: usedML };
}

module.exports = { loadModels, detectLiveness, detectSpoofing, extractEncoding, compareFaces, verifyFace, encodeFace };
