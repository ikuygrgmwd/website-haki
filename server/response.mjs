// Send success only after the database transaction has committed.
export function bufferedResponse() {
  const headers = new Map();
  let status = 200, bytes;
  return {
    setHeader: (key, value) => headers.set(key.toLowerCase(), value),
    writeHead(code, values = {}) { status = code; for (const [key, value] of Object.entries(values)) headers.set(key.toLowerCase(), value); },
    end(value) { bytes = value; },
    flush(res) { for (const [key, value] of headers) res.setHeader(key, value); res.writeHead(status); res.end(bytes); },
  };
}
