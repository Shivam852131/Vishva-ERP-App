const { parentPort } = require('worker_threads');
const path = require('path');

const MODEL_DIR = path.join(__dirname, '..', '..', 'models');
let faceapi = null;
let canvasMod = null;
let modelsLoaded = false;

async function init() {
  try {
    require('@tensorflow/tfjs-node');
    faceapi = require('@vladmandic/face-api');
    canvasMod = require('canvas');

    await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_DIR);
    await faceapi.nets.faceLandmark68TinyNet.loadFromDisk(MODEL_DIR);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);
    await faceapi.nets.faceExpressionNet.loadFromDisk(MODEL_DIR);

    modelsLoaded = true;
    parentPort.postMessage({ type: 'ready', ok: true });
  } catch (err) {
    parentPort.postMessage({ type: 'ready', ok: false, error: err.message });
  }
}

function serializeDetection(d) {
  return {
    score: d.detection.score,
    box: d.detection.box,
    imageWidth: d.detection.imageWidth,
    imageHeight: d.detection.imageHeight,
    landmarks: d.landmarks
      ? { positions: d.landmarks.positions.map(p => ({ x: p.x, y: p.y })) }
      : null,
    descriptor: d.descriptor ? Array.from(d.descriptor) : null,
    expressions: d.expressions,
  };
}

parentPort.on('message', async (msg) => {
  if (msg.type !== 'detect' && msg.type !== 'encode') return;

  if (!modelsLoaded) {
    parentPort.postMessage({ id: msg.id, type: 'error', error: 'Models not loaded' });
    return;
  }

  try {
    const buffer = Buffer.from(msg.buffer);
    const img = new canvasMod.Image();
    img.src = buffer;
    const c = canvasMod.createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);

    let pipeline = faceapi
      .detectAllFaces(c, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
      .withFaceLandmarks(true);

    if (msg.type === 'encode') {
      pipeline = pipeline.withFaceDescriptors();
    }
    pipeline = pipeline.withFaceExpressions();

    const detections = await pipeline;

    parentPort.postMessage({
      id: msg.id,
      type: 'result',
      detections: detections.map(serializeDetection),
    });
  } catch (err) {
    parentPort.postMessage({ id: msg.id, type: 'error', error: err.message });
  }
});

init();
