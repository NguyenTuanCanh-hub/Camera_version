function parseYMD(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  // 1. Check if Excel Serial Number
  const num = Number(s);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + num * 86400 * 1000);
    return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
  }

  // 2. Try YYYY-MM-DD or YYYY/MM/DD (4-digit year first)
  let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?!\d)/);
  if (m) return [+m[1], +m[2], +m[3]];

  // 3. Try DD/MM/YYYY or MM/DD/YYYY or D/M/YYYY (4-digit year)
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?!\d)/);
  if (m) {
    const [a, b, yr] = [+m[1], +m[2], +m[3]];
    if (a > 12)  return [yr, b, a];   // a must be day  → DD/MM/YYYY
    if (b > 12)  return [yr, a, b];   // b must be day  → MM/DD/YYYY
    return [yr, b, a];                // ambiguous → assume DD/MM/YYYY (VN format)
  }

  // 4. Try DD/MM/YY or MM/DD/YY or D/M/YY (2-digit year)
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})(?!\d)/);
  if (m) {
    const [a, b, y2] = [+m[1], +m[2], +m[3]];
    const yr = y2 >= 70 ? 1900 + y2 : 2000 + y2;
    if (a > 12)  return [yr, b, a];
    if (b > 12)  return [yr, a, b];
    return [yr, b, a]; // assume VN format
  }

  // 5. Fallback: try Javascript built-in parser (for formats like "27-May-2026")
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const date = new Date(parsed);
    // Use local date parts to prevent timezone shift issues
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
  }

  return null;
}

// Test cases
console.log("5/27/2026 ->", parseYMD("5/27/2026"));
console.log("2026/05/27 ->", parseYMD("2026/05/27"));
console.log("5/27/26 ->", parseYMD("5/27/26"));
console.log("27-May-2026 ->", parseYMD("27-May-2026"));
console.log("46169 ->", parseYMD("46169"));
console.log("5/27/2026 3:35:07 PM ->", parseYMD("5/27/2026 3:35:07 PM"));
console.log("5/27/26 15:35:07 ->", parseYMD("5/27/26 15:35:07"));
console.log("invalid ->", parseYMD("hello"));
