export function layoutOutput(entries, { align }) {
  const lines = [];
  const kinds = [];

  const pushEntry = (entry) => {
    for (const part of entry.text.split('\n')) {
      lines.push(part);
      kinds.push(entry.kind);
    }
  };

  if (!align) {
    entries.forEach(pushEntry);
    return { text: lines.join('\n'), kinds };
  }

  const byLine = new Map();
  for (const entry of entries) {
    if (!byLine.has(entry.line)) byLine.set(entry.line, []);
    byLine.get(entry.line).push(entry);
  }
  for (const line of [...byLine.keys()].sort((a, b) => a - b)) {
    while (lines.length < line - 1) {
      lines.push('');
      kinds.push(null);
    }
    byLine.get(line).forEach(pushEntry);
  }
  return { text: lines.join('\n'), kinds };
}
