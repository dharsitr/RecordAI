import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Calculation, Json, ObservationTable } from '../types/database';
import { safeEvaluateFormula, MathEvalResult } from '../utils/safeMathEvaluator';
import {
  AlertCircle,
  Calculator,
  Check,
  CheckCircle,
  CheckCircle2,
  Code,
  Cpu,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Table,
  Trash2,
} from 'lucide-react';

export interface CalculationTabProps {
  experimentId: string;
  extractedCalculationText?: string;
  tables: ObservationTable[];
}

export interface VariableBinding {
  varName: string;
  tableId: string;
  columnName: string;
}

export const CalculationTab: React.FC<CalculationTabProps> = ({
  experimentId,
  extractedCalculationText,
  tables,
}) => {
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form State for creating/editing a calculation formula
  const [expression, setExpression] = useState<string>('avg(V) * 1.05');
  const [bindings, setBindings] = useState<VariableBinding[]>([
    { varName: 'V', tableId: tables[0]?.id || '', columnName: '' },
  ]);

  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Extract available column headers per table for variable binding selector
  const tableColumnsMap = useMemo(() => {
    const map: Record<string, { title: string; columns: string[]; rows: string[][] }> = {};
    tables.forEach((tbl) => {
      const dataObj = (tbl.data_json as any) || {};
      const headers: string[] = Array.isArray(dataObj.headers) ? dataObj.headers : [];
      const rows: string[][] = Array.isArray(dataObj.rows) ? dataObj.rows : [];
      map[tbl.id] = {
        title: tbl.title || 'Observation Table',
        columns: headers,
        rows,
      };
    });
    return map;
  }, [tables]);

  // Set default column for first binding if available
  useEffect(() => {
    if (tables.length > 0 && bindings.length > 0 && !bindings[0].columnName) {
      const firstTableId = tables[0].id;
      const firstCol = tableColumnsMap[firstTableId]?.columns[0] || '';
      setBindings([{ varName: 'V', tableId: firstTableId, columnName: firstCol }]);
    }
  }, [tables, tableColumnsMap]);

  // Fetch existing calculations for this experiment
  useEffect(() => {
    async function fetchCalculations() {
      if (!experimentId) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('calculations')
          .select('*')
          .eq('experiment_id', experimentId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setCalculations(data || []);
      } catch (err: any) {
        console.error('[CalculationTab] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCalculations();
  }, [experimentId]);

  /**
   * Build Scope Object from Variable Bindings & Observation Tables
   * Extracts numeric cell arrays from chosen table columns for mathjs evaluation.
   */
  const evaluationScope = useMemo(() => {
    const scope: Record<string, any> = {};

    bindings.forEach((b) => {
      if (!b.varName || !b.tableId || !b.columnName) return;

      const tblData = tableColumnsMap[b.tableId];
      if (!tblData) return;

      const colIdx = tblData.columns.indexOf(b.columnName);
      if (colIdx === -1) return;

      // Extract values for this column across all rows
      const colValues: number[] = [];
      tblData.rows.forEach((row) => {
        const val = row[colIdx];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const num = Number(String(val).trim());
          if (!isNaN(num)) {
            colValues.push(num);
          }
        }
      });

      // If single value, store as scalar; if multiple, store as array
      scope[b.varName] = colValues.length === 1 ? colValues[0] : colValues;

      // Also support binding column name directly as variable name if valid identifier
      const cleanColVar = b.columnName.replace(/[^a-zA-Z0-9_]/g, '_');
      if (cleanColVar && !scope[cleanColVar]) {
        scope[cleanColVar] = colValues.length === 1 ? colValues[0] : colValues;
      }
    });

    return scope;
  }, [bindings, tableColumnsMap]);

  // Evaluate Expression Live as User Types
  const liveEvalResult: MathEvalResult = useMemo(() => {
    return safeEvaluateFormula(expression, evaluationScope);
  }, [expression, evaluationScope]);

  // Add Variable Binding
  const handleAddBinding = () => {
    const nextVarLetter = String.fromCharCode(65 + (bindings.length % 26)); // A, B, C...
    const defaultTblId = tables[0]?.id || '';
    const defaultCol = tableColumnsMap[defaultTblId]?.columns[0] || '';
    setBindings((prev) => [
      ...prev,
      { varName: nextVarLetter, tableId: defaultTblId, columnName: defaultCol },
    ]);
  };

  const handleRemoveBinding = (index: number) => {
    if (bindings.length <= 1) return;
    setBindings((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateBinding = (index: number, field: keyof VariableBinding, value: string) => {
    setBindings((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // Reset column name if table changed
      if (field === 'tableId') {
        const newCols = tableColumnsMap[value]?.columns || [];
        updated[index].columnName = newCols[0] || '';
      }
      return updated;
    });
  };

  /**
   * Persist calculation formula record to Supabase `calculations` table
   */
  const handleSaveCalculation = async (status: 'pending' | 'confirmed') => {
    if (!liveEvalResult.success || !liveEvalResult.result) {
      setSaveError('Cannot save formula with evaluation errors.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const inputsJson = {
        bindings,
        scopePreview: evaluationScope,
      };

      const { data, error } = await supabase
        .from('calculations')
        .insert({
          experiment_id: experimentId,
          expression,
          inputs: inputsJson as unknown as Json,
          output: liveEvalResult.result,
          verification_status: status,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setCalculations((prev) => [...prev, data as Calculation]);
      }
    } catch (err: any) {
      console.error('[CalculationTab] Save error:', err);
      setSaveError(err?.message || 'Failed saving calculation');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Verification Status ('pending' <-> 'confirmed')
  const handleToggleStatus = async (calc: Calculation) => {
    const nextStatus = calc.verification_status === 'confirmed' ? 'pending' : 'confirmed';

    try {
      const { data, error } = await supabase
        .from('calculations')
        .update({ verification_status: nextStatus })
        .eq('id', calc.id)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setCalculations((prev) => prev.map((c) => (c.id === calc.id ? (data as Calculation) : c)));
      }
    } catch (err: any) {
      console.error('[CalculationTab] Toggle error:', err);
    }
  };

  // Delete Calculation
  const handleDeleteCalculation = async (calcId: string) => {
    try {
      await supabase.from('calculations').delete().eq('id', calcId);
      setCalculations((prev) => prev.filter((c) => c.id !== calcId));
    } catch (err: any) {
      console.error('[CalculationTab] Delete error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. EXTRACTED CALCULATION SECTION STARTING POINT */}
      {extractedCalculationText && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span>Extracted Calculation Text (From Notebook Scan)</span>
          </div>
          <p className="text-xs text-indigo-200/90 font-mono leading-relaxed bg-gray-950/60 p-3 rounded-lg border border-indigo-500/20">
            {extractedCalculationText}
          </p>
        </div>
      )}

      {/* 2. FORMULA BUILDER & LIVE EVALUATOR CARD */}
      <div className="glass-card rounded-2xl p-6 border border-gray-800 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Formula Builder & Live Evaluator</h3>
              <p className="text-xs text-gray-400">
                Safe math evaluation using mathjs. Bind table columns to variables and compute live results.
              </p>
            </div>
          </div>
        </div>

        {/* Variable Bindings Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-300">
            <span className="flex items-center gap-1.5">
              <Table className="h-4 w-4 text-cyan-400" />
              <span>Input Variable Bindings (Table Column Links)</span>
            </span>
            <button
              onClick={handleAddBinding}
              type="button"
              className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Variable</span>
            </button>
          </div>

          <div className="space-y-2">
            {bindings.map((b, idx) => {
              const currentTableCols = tableColumnsMap[b.tableId]?.columns || [];

              return (
                <div key={idx} className="flex flex-wrap items-center gap-3 bg-gray-950/60 p-3 rounded-xl border border-gray-800">
                  {/* Variable Identifier Name */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400 font-mono">Var:</span>
                    <input
                      type="text"
                      value={b.varName}
                      onChange={(e) => handleUpdateBinding(idx, 'varName', e.target.value)}
                      className="w-16 rounded bg-gray-900 border border-gray-700/80 px-2 py-1 text-xs font-mono font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <span className="text-xs text-gray-500 font-mono">=</span>

                  {/* Table Selection */}
                  <div className="flex-1 min-w-[160px]">
                    <select
                      value={b.tableId}
                      onChange={(e) => handleUpdateBinding(idx, 'tableId', e.target.value)}
                      className="w-full rounded bg-gray-900 border border-gray-700/80 px-2.5 py-1 text-xs font-semibold text-gray-200 focus:border-cyan-500 focus:outline-none"
                    >
                      {tables.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title || 'Observation Table'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Column Selection */}
                  <div className="flex-1 min-w-[160px]">
                    <select
                      value={b.columnName}
                      onChange={(e) => handleUpdateBinding(idx, 'columnName', e.target.value)}
                      className="w-full rounded bg-gray-900 border border-gray-700/80 px-2.5 py-1 text-xs font-semibold text-cyan-300 focus:border-cyan-500 focus:outline-none"
                    >
                      {currentTableCols.map((c, cIdx) => (
                        <option key={cIdx} value={c}>
                          Col: {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Scope Value Preview */}
                  <div className="text-[11px] font-mono text-gray-400 bg-gray-900 px-2.5 py-1 rounded border border-gray-800 truncate max-w-[180px]">
                    Values: {JSON.stringify(evaluationScope[b.varName] ?? [])}
                  </div>

                  {/* Remove Binding */}
                  {bindings.length > 1 && (
                    <button
                      onClick={() => handleRemoveBinding(idx)}
                      type="button"
                      className="text-gray-500 hover:text-red-400 p-1 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Expression Input Area */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
            <Code className="h-4 w-4 text-indigo-400" />
            <span>Math Expression (+, -, *, /, ^, avg, sum, sqrt)</span>
          </label>

          <input
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="e.g. avg(V) * 1.05 + sqrt(16)"
            className="w-full rounded-xl bg-gray-950/90 border border-gray-800 p-3 text-sm font-mono text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          {/* Quick Operator Shortcuts */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] text-gray-500 font-mono">Insert Operator:</span>
            {[' + ', ' - ', ' * ', ' / ', ' ^ ', 'avg()', 'sum()', 'sqrt()'].map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => setExpression((prev) => prev + op)}
                className="rounded bg-gray-900 border border-gray-800 px-2 py-0.5 text-[11px] font-mono text-cyan-300 hover:bg-gray-800 hover:text-white transition-colors cursor-pointer"
              >
                {op}
              </button>
            ))}
          </div>
        </div>

        {/* Requirement 3 & 5: Live Computed Output & Inline Error Display */}
        <div className="rounded-xl border p-4 space-y-2 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase text-gray-400">Live Calculated Result</span>
            {liveEvalResult.success ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                <Check className="h-3 w-3" /> Valid Expression
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded-full">
                <AlertCircle className="h-3 w-3" /> Expression Error
              </span>
            )}
          </div>

          {liveEvalResult.success ? (
            <div className="text-xl font-bold font-mono text-emerald-300 bg-gray-950/80 p-3 rounded-lg border border-emerald-500/30 flex items-center justify-between">
              <span>{liveEvalResult.result || '0'}</span>
              <Sparkles className="h-5 w-5 text-emerald-400 animate-pulse" />
            </div>
          ) : (
            <div className="text-xs text-red-300 font-mono bg-red-500/10 p-3 rounded-lg border border-red-500/30 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
              <span>{liveEvalResult.error}</span>
            </div>
          )}
        </div>

        {/* Action Controls for Saving Calculation */}
        {saveError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 flex items-center justify-between">
            <span>{saveError}</span>
            <button onClick={() => setSaveError(null)} className="text-red-400 underline cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-800/80">
          <button
            type="button"
            onClick={() => handleSaveCalculation('pending')}
            disabled={saving || !liveEvalResult.success}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition-all cursor-pointer disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save as Pending</span>
          </button>

          {/* Requirement 4: Explicit Confirm Action (sets verification_status = 'confirmed') */}
          <button
            type="button"
            onClick={() => handleSaveCalculation('confirmed')}
            disabled={saving || !liveEvalResult.success}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2 text-xs font-semibold text-gray-950 shadow-md shadow-emerald-500/20 hover:brightness-110 transition-all cursor-pointer disabled:opacity-40"
          >
            <CheckCircle2 className="h-4 w-4 text-gray-950" />
            <span>Confirm Formula & Result</span>
          </button>
        </div>
      </div>

      {/* 3. PERSISTED CALCULATIONS TABLE */}
      <div className="glass-card rounded-2xl p-6 border border-gray-800 space-y-4 shadow-xl">
        <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
          <Cpu className="h-4 w-4 text-emerald-400" />
          <span>Persisted Experiment Calculations ({calculations.length})</span>
        </h3>

        {calculations.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-6 text-center text-xs text-gray-500">
            No verified calculation records saved yet for this experiment.
          </div>
        ) : (
          <div className="space-y-3">
            {calculations.map((calc) => {
              const isConfirmed = calc.verification_status === 'confirmed';

              return (
                <div
                  key={calc.id}
                  className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                    isConfirmed
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-amber-500/30 bg-amber-500/5'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-white">
                        {calc.expression}
                      </span>
                      <span className="font-mono text-xs text-gray-400">=</span>
                      <span className="font-mono text-sm font-extrabold text-emerald-300">
                        {calc.output}
                      </span>
                    </div>

                    <div className="text-[11px] text-gray-400 font-mono">
                      Status:{' '}
                      <span
                        className={`font-semibold ${
                          isConfirmed ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {calc.verification_status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleStatus(calc)}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all cursor-pointer ${
                        isConfirmed
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                      }`}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>{isConfirmed ? 'Set Pending' : 'Confirm'}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteCalculation(calc.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                      title="Delete calculation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
