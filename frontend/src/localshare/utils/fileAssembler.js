export class FileAssembler {
  constructor() {
    this.buffers = new Map();
  }

  addChunk(fileId, index, total, data) {
    if (!this.buffers.has(fileId)) {
      this.buffers.set(fileId, { chunks: new Array(total), received: 0, total });
    }
    const buf = this.buffers.get(fileId);
    if (!buf.chunks[index]) {
      buf.chunks[index] = data;
      buf.received++;
    }
    return buf.received === buf.total;
  }

  assemble(fileId) {
    const buf = this.buffers.get(fileId);
    if (!buf || buf.received !== buf.total) return null;
    const binary = atob(buf.chunks.join(''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    this.buffers.delete(fileId);
    return bytes;
  }

  getProgress(fileId) {
    const buf = this.buffers.get(fileId);
    if (!buf) return { received: 0, total: 0 };
    return { received: buf.received, total: buf.total };
  }

  cleanup(fileId) {
    if (fileId) this.buffers.delete(fileId);
    else this.buffers.clear();
  }
}
