const { Worker } = require('worker_threads');
const path = require('path');

const WORKER_SCRIPT = path.join(__dirname, 'faceWorker.js');
const DEFAULT_POOL_SIZE = 2;
const DETECT_TIMEOUT_MS = 30000;

class FacePool {
  constructor(poolSize = DEFAULT_POOL_SIZE) {
    this.workers = [];
    this.ready = false;
    this.poolSize = poolSize;
    this.nextWorker = 0;
  }

  async start() {
    const results = await Promise.all(
      Array.from({ length: this.poolSize }, () => this._spawnWorker())
    );
    this.ready = results.some(Boolean);
    if (this.ready) {
      console.log(`[facePool] ${results.filter(Boolean).length}/${this.poolSize} workers ready`);
    }
    return this.ready;
  }

  _spawnWorker() {
    return new Promise((resolve) => {
      const worker = new Worker(WORKER_SCRIPT);
      const info = { worker, busy: false };
      this.workers.push(info);

      const timer = setTimeout(() => resolve(false), 15000);
      worker.on('message', (msg) => {
        if (msg.type === 'ready') {
          clearTimeout(timer);
          resolve(msg.ok);
        }
      });
      worker.on('error', () => { clearTimeout(timer); resolve(false); });
    });
  }

  detect(buffer, action = 'detect') {
    if (!this.ready) return Promise.reject(new Error('Pool not ready'));

    const info = this._next();
    if (!info) return Promise.reject(new Error('All workers busy'));

    return new Promise((resolve, reject) => {
      const id = Date.now() + Math.random();
      const timer = setTimeout(() => {
        info.busy = false;
        info.worker.removeAllListeners('message');
        reject(new Error('Face detection timeout'));
      }, DETECT_TIMEOUT_MS);

      const handler = (msg) => {
        if (msg.id !== id) return;
        clearTimeout(timer);
        info.busy = false;
        info.worker.removeListener('message', handler);
        msg.type === 'error' ? reject(new Error(msg.error)) : resolve(msg.detections);
      };

      info.worker.on('message', handler);
      info.worker.postMessage({ id, type: action, buffer: Array.from(buffer) });
    });
  }

  _next() {
    for (let i = 0; i < this.poolSize; i++) {
      const idx = (this.nextWorker + i) % this.poolSize;
      if (!this.workers[idx].busy) {
        this.nextWorker = (idx + 1) % this.poolSize;
        this.workers[idx].busy = true;
        return this.workers[idx];
      }
    }
    return null;
  }

  async shutdown() {
    await Promise.all(this.workers.map(({ worker }) => worker.terminate()));
    this.workers = [];
    this.ready = false;
  }
}

module.exports = { FacePool };
