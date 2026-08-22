import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ObservationTable } from '../types/database';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  BarChart2,
  Check,
  LineChart as LineChartIcon,
  Save,
  ScatterChart as ScatterChartIcon,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

export interface ObservationChartProps {
  table: ObservationTable;
  onSaveConfig?: (updatedTable: ObservationTable) => void;
  readOnly?: boolean;
}

export const ObservationChart: React.FC<ObservationChartProps> = ({
  table,
  onSaveConfig,
  readOnly = false,
}) => {
  const dataObj = (table.data_json as any) || {};
  const headers: string[] = Array.isArray(dataObj.headers) ? dataObj.headers : [];
  const rows: string[][] = Array.isArray(dataObj.rows) ? dataObj.rows : [];
  const savedChartConfig = dataObj.chartConfig || null;

  /**
   * 1. Detect Numeric Columns
   * A column is numeric if >= 50% of non-empty cell values are valid numbers.
   */
  const numericColumnIndices = useMemo(() => {
    const numericIndices: number[] = [];

    headers.forEach((_, cIdx) => {
      let nonEmptyCount = 0;
      let numericCount = 0;

      rows.forEach((row) => {
        const val = row[cIdx] !== undefined ? String(row[cIdx]).trim() : '';
        if (val !== '') {
          nonEmptyCount++;
          if (!isNaN(Number(val))) {
            numericCount++;
          }
        }
      });

      if (nonEmptyCount > 0 && numericCount / nonEmptyCount >= 0.5) {
        numericIndices.push(cIdx);
      }
    });

    return numericIndices;
  }, [headers, rows]);

  // Constraint: Gracefully hide the graph component if less than 2 numeric columns exist
  if (numericColumnIndices.length < 2) {
    return null;
  }

  // 2. Default X and Y column selections
  const defaultXIdx = savedChartConfig?.xIdx ?? numericColumnIndices[0];
  const defaultYIdx = savedChartConfig?.yIdx ?? numericColumnIndices[1];
  const defaultType = savedChartConfig?.type ?? 'line';

  const [xIdx, setXIdx] = useState<number>(defaultXIdx);
  const [yIdx, setYIdx] = useState<number>(defaultYIdx);
  const [chartType, setChartType] = useState<'line' | 'bar' | 'scatter'>(defaultType);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Sync if savedChartConfig changes
  useEffect(() => {
    if (savedChartConfig) {
      if (typeof savedChartConfig.xIdx === 'number') setXIdx(savedChartConfig.xIdx);
      if (typeof savedChartConfig.yIdx === 'number') setYIdx(savedChartConfig.yIdx);
      if (savedChartConfig.type) setChartType(savedChartConfig.type);
    }
  }, [savedChartConfig]);

  const xHeader = headers[xIdx] || `Column ${xIdx + 1}`;
  const yHeader = headers[yIdx] || `Column ${yIdx + 1}`;

  /**
   * 3. Transform Row Data for Recharts Rendering
   */
  const chartData = useMemo(() => {
    return rows
      .map((row, idx) => {
        const valX = row[xIdx] !== undefined ? String(row[xIdx]).trim() : '';
        const valY = row[yIdx] !== undefined ? String(row[yIdx]).trim() : '';

        const numX = Number(valX);
        const numY = Number(valY);

        if (isNaN(numY)) return null; // Skip rows where Y value is non-numeric

        return {
          rowNum: idx + 1,
          xVal: !isNaN(numX) ? numX : valX,
          yVal: numY,
        };
      })
      .filter(Boolean);
  }, [rows, xIdx, yIdx]);

  /**
   * 4. Save Graph Action
   */
  const handleSaveGraph = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updatedChartConfig = {
        xIdx,
        yIdx,
        xHeader,
        yHeader,
        type: chartType,
      };

      const updatedDataJson = {
        ...dataObj,
        chartConfig: updatedChartConfig,
      };

      const { data, error } = await supabase
        .from('observation_tables')
        .update({ data_json: updatedDataJson })
        .eq('id', table.id)
        .select()
        .single();

      if (error) throw error;

      setSaveSuccess(true);
      if (onSaveConfig && data) {
        onSaveConfig(data as ObservationTable);
      }
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('[ObservationChart] Save chart config error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 border border-gray-800 space-y-4 shadow-xl">
      {/* Header Controls & Config Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <span>Data Visualization Graph</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <Sparkles className="h-3 w-3" /> Auto-suggested
              </span>
            </h4>
            <p className="text-xs text-gray-400">
              Interactive chart for observation table: <strong className="text-gray-300">{table.title || 'Table'}</strong>
            </p>
          </div>
        </div>

        {/* Controls: Chart Type Selector & Column Mappings */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Chart Type Selector */}
          <div className="flex items-center gap-1 rounded-xl bg-gray-900 border border-gray-800 p-1">
            <button
              onClick={() => setChartType('line')}
              type="button"
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                chartType === 'line'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Line Chart"
            >
              <LineChartIcon className="h-3.5 w-3.5" />
              <span>Line</span>
            </button>

            <button
              onClick={() => setChartType('bar')}
              type="button"
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                chartType === 'bar'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Bar Chart"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span>Bar</span>
            </button>

            <button
              onClick={() => setChartType('scatter')}
              type="button"
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                chartType === 'scatter'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Scatter Plot"
            >
              <ScatterChartIcon className="h-3.5 w-3.5" />
              <span>Scatter</span>
            </button>
          </div>

          {!readOnly && (
            <button
              onClick={handleSaveGraph}
              disabled={isSaving}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-gray-950 shadow-md shadow-emerald-500/20 hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
            >
              {saveSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-gray-950" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 text-gray-950" />
                  <span>{isSaving ? 'Saving...' : 'Save Graph'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Axis Mapping Pickers Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-950/60 p-3 rounded-xl border border-gray-800 text-xs">
        {/* X-Axis Selector */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-gray-400 font-bold min-w-[50px]">X-Axis:</span>
          <select
            value={xIdx}
            onChange={(e) => setXIdx(Number(e.target.value))}
            className="w-full rounded-lg bg-gray-900 border border-gray-700/80 px-2.5 py-1 text-xs font-semibold text-emerald-300 focus:border-emerald-500 focus:outline-none"
          >
            {numericColumnIndices.map((idx) => (
              <option key={idx} value={idx}>
                {headers[idx] || `Column ${idx + 1}`}
              </option>
            ))}
          </select>
        </div>

        {/* Y-Axis Selector */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-gray-400 font-bold min-w-[50px]">Y-Axis:</span>
          <select
            value={yIdx}
            onChange={(e) => setYIdx(Number(e.target.value))}
            className="w-full rounded-lg bg-gray-900 border border-gray-700/80 px-2.5 py-1 text-xs font-semibold text-cyan-300 focus:border-cyan-500 focus:outline-none"
          >
            {numericColumnIndices.map((idx) => (
              <option key={idx} value={idx}>
                {headers[idx] || `Column ${idx + 1}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Recharts Render Canvas Container */}
      <div className="w-full h-64 sm:h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="xVal"
                stroke="#9ca3af"
                fontSize={11}
                tickLine={false}
                label={{ value: xHeader, position: 'bottom', offset: 10, fill: '#10b981', fontSize: 12, fontWeight: 'bold' }}
              />
              <YAxis
                stroke="#9ca3af"
                fontSize={11}
                tickLine={false}
                label={{ value: yHeader, angle: -90, position: 'insideLeft', fill: '#06b6d4', fontSize: 12, fontWeight: 'bold' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px', fontSize: '12px' }}
                labelStyle={{ color: '#10b981', fontWeight: 'bold' }}
              />
              <Legend verticalAlign="top" height={36} />
              <Line
                type="monotone"
                dataKey="yVal"
                name={yHeader}
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#10b981', stroke: '#047857' }}
                activeDot={{ r: 6, fill: '#34d399' }}
              />
            </LineChart>
          ) : chartType === 'bar' ? (
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="xVal"
                stroke="#9ca3af"
                fontSize={11}
                tickLine={false}
                label={{ value: xHeader, position: 'bottom', offset: 10, fill: '#10b981', fontSize: 12, fontWeight: 'bold' }}
              />
              <YAxis
                stroke="#9ca3af"
                fontSize={11}
                tickLine={false}
                label={{ value: yHeader, angle: -90, position: 'insideLeft', fill: '#06b6d4', fontSize: 12, fontWeight: 'bold' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px', fontSize: '12px' }}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="yVal" name={yHeader} fill="#06b6d4" radius={[6, 6, 0, 0]} />
            </BarChart>
          ) : (
            <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="xVal"
                name={xHeader}
                stroke="#9ca3af"
                fontSize={11}
                tickLine={false}
                label={{ value: xHeader, position: 'bottom', offset: 10, fill: '#10b981', fontSize: 12, fontWeight: 'bold' }}
              />
              <YAxis
                dataKey="yVal"
                name={yHeader}
                stroke="#9ca3af"
                fontSize={11}
                tickLine={false}
                label={{ value: yHeader, angle: -90, position: 'insideLeft', fill: '#06b6d4', fontSize: 12, fontWeight: 'bold' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px', fontSize: '12px' }}
                cursor={{ strokeDasharray: '3 3' }}
              />
              <Legend verticalAlign="top" height={36} />
              <Scatter name={yHeader} data={chartData} fill="#8b5cf6" />
            </ScatterChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
