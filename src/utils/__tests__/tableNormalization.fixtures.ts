import { normalizeTableData, NormalizedTableData } from '../tableNormalization';

/**
 * Sample malformed extraction input fixtures mimicking inconsistent AI Vision outputs.
 */
export const SAMPLE_MALFORMED_INPUTS = {
  // Case 1: Ragged rows with varying column counts
  raggedRows: {
    headers: ['Sample ID', 'Mass (g)'],
    rows: [
      ['S-01', '12.4'],
      ['S-02', '15.8', 'Excess Column 3', 'Excess Column 4'], // Row longer than headers
      ['S-03'], // Row shorter than headers
    ],
  },

  // Case 2: Blank or whitespace-only headers
  blankHeaders: {
    headers: ['', '   ', 'Temperature (°C)', ''],
    rows: [
      ['25', '1.01', '37.5', 'Normal'],
      ['30', '1.05', '40.0', 'Elevated'],
    ],
  },

  // Case 3: Duplicate header names
  duplicateHeaders: {
    headers: ['Volume', 'Volume', 'Volume', 'Notes'],
    rows: [
      ['10mL', '20mL', '30mL', 'Initial test'],
      ['15mL', '25mL', '35mL', 'Secondary test'],
    ],
  },

  // Case 4: Missing, null, or completely empty inputs
  nullOrEmpty: null,
  emptyObject: {},
  corruptedFields: {
    headers: 'Not an array',
    rows: 'Invalid row data',
  },
};

/**
 * Self-contained test suite executor for table normalization logic.
 * Can be imported and run in-browser or via test runner.
 */
export function runNormalizationTests(): { name: string; passed: boolean; result: NormalizedTableData }[] {
  const testResults = [];

  // Test 1: Ragged Rows
  const res1 = normalizeTableData(SAMPLE_MALFORMED_INPUTS.raggedRows);
  const pass1 =
    res1.headers.length === 4 &&
    res1.rows.every((r) => r.length === 4) &&
    res1.headers[2] === 'Column 3' &&
    res1.rows[2][1] === '';
  testResults.push({ name: 'Normalize Ragged Rows', passed: pass1, result: res1 });

  // Test 2: Blank Headers
  const res2 = normalizeTableData(SAMPLE_MALFORMED_INPUTS.blankHeaders);
  const pass2 =
    res2.headers[0] === 'Column 1' &&
    res2.headers[1] === 'Column 2' &&
    res2.headers[2] === 'Temperature (°C)' &&
    res2.headers[3] === 'Column 4';
  testResults.push({ name: 'Normalize Blank Headers', passed: pass2, result: res2 });

  // Test 3: Duplicate Headers
  const res3 = normalizeTableData(SAMPLE_MALFORMED_INPUTS.duplicateHeaders);
  const pass3 =
    res3.headers[0] === 'Volume' &&
    res3.headers[1] === 'Volume (1)' &&
    res3.headers[2] === 'Volume (2)' &&
    res3.headers[3] === 'Notes';
  testResults.push({ name: 'De-duplicate Identical Headers', passed: pass3, result: res3 });

  // Test 4: Corrupted / Empty Input
  const res4 = normalizeTableData(SAMPLE_MALFORMED_INPUTS.corruptedFields);
  const pass4 =
    res4.headers.length === 3 &&
    res4.rows.length === 1 &&
    res4.headers[0] === 'Column 1';
  testResults.push({ name: 'Graceful Fallback on Corrupted Input', passed: pass4, result: res4 });

  return testResults;
}
