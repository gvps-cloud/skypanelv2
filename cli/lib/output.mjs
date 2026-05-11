const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';

export const colors = { RESET, BOLD, DIM, RED, GREEN, YELLOW, BLUE, CYAN };

export function success(msg) {
  return `${GREEN}${msg}${RESET}`;
}

export function error(msg) {
  return `${RED}${msg}${RESET}`;
}

export function warn(msg) {
  return `${YELLOW}${msg}${RESET}`;
}

export function info(msg) {
  return `${CYAN}${msg}${RESET}`;
}

export function dim(msg) {
  return `${DIM}${msg}${RESET}`;
}

export function bold(msg) {
  return `${BOLD}${msg}${RESET}`;
}

export function formatTable(headers, rows) {
  const colWidths = headers.map((h, i) => {
    const maxRowLen = rows.reduce((max, row) => {
      const val = String(row[i] ?? '');
      return val.length > max ? val.length : max;
    }, 0);
    return Math.max(h.length, maxRowLen);
  });

  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join('  ');
  const separator = colWidths.map(w => '-'.repeat(w)).join('  ');
  const dataLines = rows.map(row =>
    headers.map((_, i) => String(row[i] ?? '').padEnd(colWidths[i])).join('  ')
  );

  return [headerLine, separator, ...dataLines].join('\n');
}

export function formatJson(obj) {
  return JSON.stringify(obj, null, 2);
}

export function truncate(str, maxLen = 40) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
}
