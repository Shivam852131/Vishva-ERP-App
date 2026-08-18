import { FileAssembler } from '../src/localshare/utils/fileAssembler';
import { splitIntoChunks, formatFileSize } from '../src/localshare/utils/fileChunker';

describe('FileAssembler', () => {
  let assembler;

  beforeEach(() => {
    assembler = new FileAssembler();
  });

  it('reassembles chunks in correct order', () => {
    const data = btoa('Hello World');
    const chunks = [data.slice(0, 4), data.slice(4)];
    assembler.addChunk('f1', 0, 2, chunks[0]);
    const complete = assembler.addChunk('f1', 1, 2, chunks[1]);
    expect(complete).toBe(true);

    const result = assembler.assemble('f1');
    expect(result).toBeTruthy();
    const text = String.fromCharCode(...result);
    expect(text).toBe('Hello World');
  });

  it('tracks progress correctly', () => {
    assembler.addChunk('f1', 0, 3, 'aaa');
    expect(assembler.getProgress('f1')).toEqual({ received: 1, total: 3 });

    assembler.addChunk('f1', 1, 3, 'bbb');
    expect(assembler.getProgress('f1')).toEqual({ received: 2, total: 3 });

    assembler.addChunk('f1', 2, 3, 'ccc');
    expect(assembler.getProgress('f1')).toEqual({ received: 3, total: 3 });
  });

  it('ignores duplicate chunks', () => {
    assembler.addChunk('f1', 0, 2, 'aa');
    assembler.addChunk('f1', 0, 2, 'aa');
    expect(assembler.getProgress('f1')).toEqual({ received: 1, total: 2 });
  });

  it('returns null if not complete', () => {
    assembler.addChunk('f1', 0, 2, 'aa');
    const result = assembler.assemble('f1');
    expect(result).toBeNull();
  });

  it('cleanup removes buffer', () => {
    assembler.addChunk('f1', 0, 1, 'x');
    assembler.cleanup('f1');
    expect(assembler.getProgress('f1')).toEqual({ received: 0, total: 0 });
  });

  it('cleanup all removes all buffers', () => {
    assembler.addChunk('f1', 0, 1, 'x');
    assembler.addChunk('f2', 0, 1, 'y');
    assembler.cleanup();
    expect(assembler.getProgress('f1')).toEqual({ received: 0, total: 0 });
    expect(assembler.getProgress('f2')).toEqual({ received: 0, total: 0 });
  });
});

describe('splitIntoChunks', () => {
  it('splits data into correct chunk sizes', () => {
    const data = 'A'.repeat(100);
    const chunks = splitIntoChunks(data, 30);
    expect(chunks).toHaveLength(4);
    expect(chunks[0]).toHaveLength(30);
    expect(chunks[1]).toHaveLength(30);
    expect(chunks[2]).toHaveLength(30);
    expect(chunks[3]).toHaveLength(10);
  });

  it('returns single chunk if data fits', () => {
    const data = 'Hello';
    const chunks = splitIntoChunks(data, 1024);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Hello');
  });

  it('returns empty array for empty data', () => {
    const chunks = splitIntoChunks('', 1024);
    expect(chunks).toHaveLength(0);
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
    expect(formatFileSize(2621440)).toBe('2.5 MB');
  });
});
