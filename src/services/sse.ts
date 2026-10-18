/** Reads SSE `data:` payloads without assuming network chunks align to lines/events. */
export async function* readSseData(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let dataLines: string[] = [];

  const consumeLine = (line: string): string | null => {
    if (line === '') {
      if (!dataLines.length) return null;
      const data = dataLines.join('\n');
      dataLines = [];
      return data;
    }
    if (line.startsWith(':')) return null;
    if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
    return null;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        let line = buffer.slice(0, newline);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        buffer = buffer.slice(newline + 1);
        const data = consumeLine(line);
        if (data !== null) yield data;
        newline = buffer.indexOf('\n');
      }
    }

    buffer += decoder.decode();
    if (buffer) {
      const data = consumeLine(buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer);
      if (data !== null) yield data;
    }
    if (dataLines.length) yield dataLines.join('\n');
  } finally {
    reader.releaseLock();
  }
}
