/**
 * Utility functions for normalizing messy, malformed, or incomplete tabular data
 * extracted from AI vision pipeline outputs.
 */

export interface NormalizedTableData {
  headers: string[];
  rows: string[][];
  confidence?: number;
}

/**
 * Normalizes raw data_json into a clean, rectangular grid with unique headers.
 *
 * Rules applied:
 * 1. Determines maximum column count across headers and all rows.
 * 2. Auto-names blank headers ("Column 1", "Column 2", etc.).
 * 3. De-duplicates identical header names by appending numeric suffixes ("Header", "Header (1)", "Header (2)").
 * 4. Pads ragged rows with empty strings ("") to match the final header count.
 * 5. Sanitizes null, undefined, or non-string cell values to clean strings.
 */
export function normalizeTableData(rawInput: any): NormalizedTableData {
  if (!rawInput || typeof rawInput !== 'object') {
    return {
      headers: ['Column 1', 'Column 2', 'Column 3'],
      rows: [['', '', '']],
      confidence: 1.0,
    };
  }

  const rawHeaders: string[] = Array.isArray(rawInput.headers)
    ? rawInput.headers.map((h: any) => (h === null || h === undefined ? '' : String(h).trim()))
    : [];

  const rawRows: any[] = Array.isArray(rawInput.rows) ? rawInput.rows : [];

  // 1. Determine maximum column count across headers and all rows
  let maxCols = rawHeaders.length;
  rawRows.forEach((row) => {
    if (Array.isArray(row) && row.length > maxCols) {
      maxCols = row.length;
    }
  });

  // Ensure at least 1 column
  if (maxCols === 0) {
    maxCols = 1;
  }

  // 2. Build and sanitize headers array up to maxCols
  const candidateHeaders: string[] = [];
  for (let i = 0; i < maxCols; i++) {
    const rawH = rawHeaders[i];
    if (rawH && rawH.trim() !== '') {
      candidateHeaders.push(rawH.trim());
    } else {
      candidateHeaders.push(`Column ${i + 1}`);
    }
  }

  // 3. De-duplicate identical header names
  const headerCounts = new Map<string, number>();
  const normalizedHeaders: string[] = candidateHeaders.map((hdr) => {
    const count = headerCounts.get(hdr) || 0;
    headerCounts.set(hdr, count + 1);

    if (count === 0) {
      return hdr;
    }
    return `${hdr} (${count})`;
  });

  // 4. Normalize and pad all rows to match normalizedHeaders.length
  const normalizedRows: string[][] = [];

  if (rawRows.length === 0) {
    // If no rows existed, add a single empty row matching header count
    normalizedRows.push(Array(normalizedHeaders.length).fill(''));
  } else {
    rawRows.forEach((row) => {
      const rowArr: string[] = [];
      const sourceRow = Array.isArray(row) ? row : [row];

      for (let i = 0; i < normalizedHeaders.length; i++) {
        const val = sourceRow[i];
        if (val === null || val === undefined) {
          rowArr.push('');
        } else {
          rowArr.push(String(val).trim());
        }
      }
      normalizedRows.push(rowArr);
    });
  }

  return {
    headers: normalizedHeaders,
    rows: normalizedRows,
    confidence: typeof rawInput.confidence === 'number' ? rawInput.confidence : 1.0,
  };
}
