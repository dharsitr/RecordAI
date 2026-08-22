import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { ObservationTable } from '../types/database';
import { normalizeTableData } from '../utils/tableNormalization';
import { ObservationChart } from './ObservationChart';
import {
  AlertTriangle,
  Check,
  Columns,
  Edit3,
  Plus,
  PlusCircle,
  Rows,
  Save,
  Table as TableIcon,
  Trash2,
} from 'lucide-react';

export interface TableEditorProps {
  table: ObservationTable;
  onSave?: (updatedTable: ObservationTable) => void;
  onDelete?: (tableId: string) => void;
  readOnly?: boolean;
}

export const TableEditor: React.FC<TableEditorProps> = ({
  table,
  onSave,
  onDelete,
  readOnly = false,
}) => {
  // Normalize messy data_json on load
  const normalizedData = normalizeTableData(table.data_json);

  const [title, setTitle] = useState<string>(table.title || 'Observation Table');
  const [headers, setHeaders] = useState<string[]>(normalizedData.headers);
  const [rows, setRows] = useState<string[][]>(normalizedData.rows);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // References to input DOM elements for keyboard grid navigation [rowIndex][colIndex]
  const cellRefs = useRef<(HTMLInputElement | null)[][]>([]);

  // Keep cellRefs grid dimension in sync with rows and headers length
  useEffect(() => {
    cellRefs.current = cellRefs.current.slice(0, rows.length).map((rowArr, rIdx) => {
      const existing = rowArr || [];
      return existing.slice(0, headers.length);
    });
  }, [rows.length, headers.length]);

  // Re-normalize if table prop changes externally
  useEffect(() => {
    const norm = normalizeTableData(table.data_json);
    setHeaders(norm.headers);
    setRows(norm.rows);
    if (table.title) {
      setTitle(table.title);
    }
  }, [table]);

  /**
   * Helper: Determine if a cell string is a valid numeric value
   */
  const isValidNumber = (val: string): boolean => {
    if (!val || val.trim() === '') return false;
    return !isNaN(Number(val.trim()));
  };

  /**
   * Numeric Anomaly Detection Rule:
   * A column is majority numeric if >= 50% of its non-empty cells contain valid numbers.
   */
  const numericColumns = React.useMemo(() => {
    const numCols: boolean[] = [];

    for (let cIdx = 0; cIdx < headers.length; cIdx++) {
      let nonEmptyCount = 0;
      let numericCount = 0;

      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const val = rows[rIdx] && rows[rIdx][cIdx] ? String(rows[rIdx][cIdx]).trim() : '';
        if (val !== '') {
          nonEmptyCount++;
          if (isValidNumber(val)) {
            numericCount++;
          }
        }
      }

      const isNumericCol = nonEmptyCount > 0 && numericCount / nonEmptyCount >= 0.5;
      numCols.push(isNumericCol);
    }

    return numCols;
  }, [headers.length, rows]);

  /**
   * Cell Change Handler
   */
  const handleCellChange = (rIdx: number, cIdx: number, value: string) => {
    setRows((prevRows) => {
      const newRows = prevRows.map((r) => [...r]);
      if (!newRows[rIdx]) newRows[rIdx] = Array(headers.length).fill('');
      newRows[rIdx][cIdx] = value;
      return newRows;
    });
  };

  /**
   * Header Change Handler
   */
  const handleHeaderChange = (cIdx: number, value: string) => {
    setHeaders((prev) => {
      const newHeaders = [...prev];
      newHeaders[cIdx] = value;
      return newHeaders;
    });
  };

  /**
   * Keyboard Grid Focus Navigation (Tab, Shift+Tab, Enter, Arrow Keys)
   */
  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    rIdx: number,
    cIdx: number
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (rIdx < rows.length - 1) {
        cellRefs.current[rIdx + 1]?.[cIdx]?.focus();
      } else {
        handleAddRow();
        setTimeout(() => {
          cellRefs.current[rIdx + 1]?.[cIdx]?.focus();
        }, 50);
      }
    } else if (e.key === 'Tab') {
      if (!e.shiftKey && cIdx === headers.length - 1 && rIdx < rows.length - 1) {
        e.preventDefault();
        cellRefs.current[rIdx + 1]?.[0]?.focus();
      } else if (e.shiftKey && cIdx === 0 && rIdx > 0) {
        e.preventDefault();
        cellRefs.current[rIdx - 1]?.[headers.length - 1]?.focus();
      }
    } else if (e.key === 'ArrowDown' && rIdx < rows.length - 1) {
      cellRefs.current[rIdx + 1]?.[cIdx]?.focus();
    } else if (e.key === 'ArrowUp' && rIdx > 0) {
      cellRefs.current[rIdx - 1]?.[cIdx]?.focus();
    }
  };

  /**
   * Table Manipulation Actions: Add/Remove Rows and Columns
   */
  const handleAddRow = () => {
    setRows((prev) => [...prev, Array(headers.length).fill('')]);
  };

  const handleRemoveRow = (rIdx: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, index) => index !== rIdx));
  };

  const handleAddColumn = () => {
    const newColName = `Column ${headers.length + 1}`;
    setHeaders((prev) => [...prev, newColName]);
    setRows((prev) => prev.map((row) => [...row, '']));
  };

  const handleRemoveColumn = (cIdx: number) => {
    if (headers.length <= 1) return;
    setHeaders((prev) => prev.filter((_, index) => index !== cIdx));
    setRows((prev) => prev.map((row) => row.filter((_, index) => index !== cIdx)));
  };

  /**
   * Save table changes to Supabase observation_tables table
   */
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const rawDataObj = (table.data_json as any) || {};
      const updatedDataJson = {
        ...rawDataObj,
        headers,
        rows,
      };

      const { data, error } = await supabase
        .from('observation_tables')
        .update({
          title,
          data_json: updatedDataJson,
        })
        .eq('id', table.id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      setSaveSuccess(true);
      if (onSave && data) {
        onSave(data as ObservationTable);
      }

      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      console.error('[TableEditor] Error saving table:', err);
      setSaveError(err?.message || 'Failed saving table data');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 border border-gray-800 space-y-4 shadow-xl">
      {/* Header Bar: Editable Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800/80 pb-4">
        <div className="flex items-center gap-2.5 flex-1 max-w-md">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <TableIcon className="h-4 w-4" />
          </div>
          {readOnly ? (
            <h3 className="font-bold text-white text-base">{title}</h3>
          ) : (
            <div className="relative flex-1">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Table Title (e.g. Titration Observations)"
                className="w-full rounded-lg bg-gray-900/80 border border-gray-700/60 px-3 py-1.5 text-sm font-semibold text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <Edit3 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          )}
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddRow}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800/60 px-2.5 py-1.5 text-xs font-semibold text-gray-300 hover:bg-gray-700 hover:text-white transition-all cursor-pointer"
              title="Add new row"
            >
              <Rows className="h-3.5 w-3.5 text-emerald-400" />
              <span>+ Row</span>
            </button>

            <button
              onClick={handleAddColumn}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800/60 px-2.5 py-1.5 text-xs font-semibold text-gray-300 hover:bg-gray-700 hover:text-white transition-all cursor-pointer"
              title="Add new column"
            >
              <Columns className="h-3.5 w-3.5 text-cyan-400" />
              <span>+ Column</span>
            </button>

            {onDelete && (
              <button
                onClick={() => onDelete(table.id)}
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                title="Delete Table"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={isSaving}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-gray-950 shadow-md shadow-emerald-500/20 hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
            >
              {saveSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-gray-950" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 text-gray-950" />
                  <span>{isSaving ? 'Saving...' : 'Save Table'}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Save Error Alert */}
      {saveError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 flex items-center justify-between">
          <span>{saveError}</span>
          <button onClick={() => setSaveError(null)} className="text-red-400 underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Grid Container */}
      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-950/60 p-1">
        <table className="w-full text-left text-xs border-collapse">
          {/* Table Headers */}
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/90">
              <th className="w-8 p-2 text-center text-gray-600 font-mono">#</th>
              {headers.map((hdr, cIdx) => (
                <th key={cIdx} className="p-1.5 min-w-[140px] relative group">
                  <div className="flex items-center gap-1">
                    {readOnly ? (
                      <span className="font-mono font-bold text-emerald-300 px-2 py-1">
                        {hdr}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={hdr}
                        onChange={(e) => handleHeaderChange(cIdx, e.target.value)}
                        className="w-full rounded bg-gray-800/80 border border-gray-700/60 px-2.5 py-1 text-xs font-mono font-bold text-emerald-300 placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                        placeholder={`Column ${cIdx + 1}`}
                      />
                    )}

                    {!readOnly && headers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveColumn(cIdx)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-500 hover:text-red-400 cursor-pointer"
                        title="Delete Column"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              {!readOnly && <th className="w-8 p-2"></th>}
            </tr>
          </thead>

          {/* Table Body Rows */}
          <tbody className="divide-y divide-gray-800/60">
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-gray-900/40 transition-colors">
                {/* Row Index Number */}
                <td className="p-2 text-center font-mono text-[10px] text-gray-500 select-none">
                  {rIdx + 1}
                </td>

                {/* Table Cells */}
                {headers.map((_, cIdx) => {
                  const cellValue = row && row[cIdx] !== undefined ? String(row[cIdx]) : '';
                  const isColumnNumeric = numericColumns[cIdx];
                  const hasValue = cellValue.trim() !== '';
                  const isNumericAnomaly = isColumnNumeric && hasValue && !isValidNumber(cellValue);

                  return (
                    <td key={cIdx} className="p-1 relative">
                      <div className="relative">
                        <input
                          ref={(el) => {
                            if (!cellRefs.current[rIdx]) cellRefs.current[rIdx] = [];
                            cellRefs.current[rIdx][cIdx] = el;
                          }}
                          type="text"
                          readOnly={readOnly}
                          value={cellValue}
                          onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                          placeholder="—"
                          className={`w-full rounded px-2.5 py-1.5 font-mono text-xs transition-all border ${
                            isNumericAnomaly
                              ? 'bg-red-500/20 text-red-200 border-red-500/60 focus:border-red-400 focus:ring-1 focus:ring-red-400'
                              : 'bg-gray-900/60 text-gray-100 border-gray-800 focus:border-cyan-500 focus:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-cyan-500'
                          }`}
                        />

                        {/* Numeric Anomaly Warning Badge */}
                        {isNumericAnomaly && (
                          <div
                            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center text-red-400 pointer-events-none"
                            title="Non-numeric value in a numeric column"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}

                {/* Delete Row Control */}
                {!readOnly && (
                  <td className="p-1 text-center">
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(rIdx)}
                        className="p-1 text-gray-600 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete Row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Grid Legend & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 pt-1">
        <div className="flex items-center gap-4">
          <span>
            Grid: <strong className="text-gray-400">{rows.length} rows</strong> ×{' '}
            <strong className="text-gray-400">{headers.length} columns</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500/80 inline-block" />
            <span className="text-gray-400">Highlighted cells indicate non-numeric text in numeric column</span>
          </span>
        </div>

        <span className="font-mono text-gray-600">Press Tab / Enter to navigate cells</span>
      </div>

      {/* Render Data Visualization Graph if table has 2+ numeric columns */}
      <ObservationChart table={table} onSaveConfig={onSave} readOnly={readOnly} />
    </div>
  );
};

/**
 * Container Component to render multiple TableEditor cards per document
 * Includes zero-tables empty state handling & "Add Table" action.
 */
export interface MultiTableEditorProps {
  tables: ObservationTable[];
  onSaveTable?: (updatedTable: ObservationTable) => void;
  onDeleteTable?: (tableId: string) => void;
  onAddTable?: () => void;
  readOnly?: boolean;
}

export const MultiTableEditor: React.FC<MultiTableEditorProps> = ({
  tables,
  onSaveTable,
  onDeleteTable,
  onAddTable,
  readOnly = false,
}) => {
  // Gracefully handle zero-tables case
  if (!tables || tables.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center border border-gray-800 space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
          <TableIcon className="h-7 w-7" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h3 className="text-base font-bold text-white">No Observation Tables Extracted</h3>
          <p className="text-xs text-gray-400">
            No structured data tables were automatically detected in the uploaded lab notebook pages.
          </p>
        </div>

        {!readOnly && onAddTable && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onAddTable}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-xs font-semibold text-gray-950 shadow-md shadow-emerald-500/20 hover:brightness-110 transition-all cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Add Table From Scratch</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* List of Observation Table Cards */}
      {tables.map((tbl) => (
        <TableEditor
          key={tbl.id}
          table={tbl}
          onSave={onSaveTable}
          onDelete={onDeleteTable}
          readOnly={readOnly}
        />
      ))}

      {/* Add Table Control at Bottom */}
      {!readOnly && onAddTable && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onAddTable}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Another Observation Table</span>
          </button>
        </div>
      )}
    </div>
  );
};
