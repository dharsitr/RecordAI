import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Calculation, Document, Experiment, ObservationTable, Section } from '../types/database';
import { MultiTableEditor } from '../components/TableEditor';
import { CalculationTab } from '../components/CalculationTab';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calculator,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Eye,
  FileCheck,
  FileText,
  FlaskConical,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  Sparkles,
  Square,
  Table,
  Tag,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

// Standard Lab Notebook Sections in Fixed Canonical Order
const CANONICAL_SECTIONS = [
  { key: 'aim', title: 'Aim / Objective', placeholder: 'State the hypothesis, objective, or goal of the experiment...' },
  { key: 'apparatus', title: 'Apparatus & Reagents', placeholder: 'List laboratory equipment, chemicals, glassware, and instruments used...' },
  { key: 'procedure', title: 'Procedure & Protocol', placeholder: 'Detail step-by-step experimental methodology and conditions...' },
  { key: 'observation', title: 'Observations & Data', placeholder: 'Descriptive qualitative observations, color changes, precipitates, gas evolution...' },
  { key: 'calculation', title: 'Calculations & Formulas', placeholder: 'Detail equations, molarity calculations, yield calculations, or statistical formulas...' },
  { key: 'result', title: 'Results & Conclusion', placeholder: 'Summarize key findings, final values, and error percentage...' },
  { key: 'precautions', title: 'Precautions & Safety', placeholder: 'Safety measures, fume hood requirements, waste disposal guidelines...' },
];

export interface FlaggedItem {
  id: string;
  type: 'section' | 'table';
  targetElementId: string;
  title: string;
  confidence: number;
  description: string;
}

export const VerifyPage: React.FC = () => {
  const { experimentId } = useParams<{ experimentId: string }>();
  const navigate = useNavigate();

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tables, setTables] = useState<ObservationTable[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Persistence & Dirty State Tracking
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Flagged Items Review Confirmation Checkbox State
  const [hasConfirmedReview, setHasConfirmedReview] = useState<boolean>(false);

  // Active Document / Page Index for Left Image Viewer
  const [activeDocIndex, setActiveDocIndex] = useState<number>(0);
  const [imageScale, setImageScale] = useState<number>(1);
  const [signedImageUrls, setSignedImageUrls] = useState<Record<string, string>>({});

  // Local Editable Sections state keyed by section_type
  const [sectionMap, setSectionMap] = useState<
    Record<string, { id?: string; document_id?: string; section_type: string; content: string; confidence: number | null }>
  >({});

  // View Tab state ('sections' vs 'calculations')
  const [activeViewTab, setActiveViewTab] = useState<'sections' | 'calculations'>('sections');

  // Initial Load
  useEffect(() => {
    async function loadVerificationData() {
      if (!experimentId) return;

      try {
        setLoading(true);
        setSaveError(null);

        // 1. Fetch Experiment
        const { data: expData, error: expErr } = await supabase
          .from('experiments')
          .select('*')
          .eq('id', experimentId)
          .single();

        if (expErr) throw expErr;
        setExperiment(expData);

        // 2. Fetch Documents
        const { data: docsData, error: docsErr } = await supabase
          .from('documents')
          .select('*')
          .eq('experiment_id', experimentId)
          .order('created_at', { ascending: true });

        if (docsErr) throw docsErr;
        setDocuments(docsData || []);

        if (docsData && docsData.length > 0) {
          // Generate public/signed image URLs for document storage paths
          const urlMap: Record<string, string> = {};
          for (const doc of docsData) {
            if (doc.file_path) {
              const { data: pubData } = supabase.storage
                .from('lab-uploads')
                .getPublicUrl(doc.file_path);

              if (pubData?.publicUrl) {
                urlMap[doc.id] = pubData.publicUrl;
              }
            }
          }
          setSignedImageUrls(urlMap);

          const docIds = docsData.map((d) => d.id);

          // 3. Fetch Sections
          const { data: secData } = await supabase
            .from('sections')
            .select('*')
            .in('document_id', docIds);

          const sMap: Record<
            string,
            { id?: string; document_id?: string; section_type: string; content: string; confidence: number | null }
          > = {};

          CANONICAL_SECTIONS.forEach((sec) => {
            sMap[sec.key] = {
              section_type: sec.key,
              content: '',
              confidence: null,
            };
          });

          if (secData && secData.length > 0) {
            secData.forEach((sec) => {
              const key = (sec.section_type || '').toLowerCase();
              sMap[key] = {
                id: sec.id,
                document_id: sec.document_id,
                section_type: sec.section_type,
                content: sec.content || '',
                confidence: sec.confidence ?? null,
              };
            });
          }

          setSectionMap(sMap);

          // 4. Fetch Observation Tables
          const { data: tblData } = await supabase
            .from('observation_tables')
            .select('*')
            .in('document_id', docIds);

          if (tblData) setTables(tblData);
        }
      } catch (err: any) {
        console.error('[VerifyPage] Error loading verification data:', err);
        setSaveError(err?.message || 'Failed loading experiment verification data');
      } finally {
        setLoading(false);
      }
    }

    loadVerificationData();
  }, [experimentId]);

  // Compute Flagged Items list (confidence < 0.7)
  const flaggedItems = useMemo<FlaggedItem[]>(() => {
    const items: FlaggedItem[] = [];

    // 1. Scan Sections for confidence < 0.7
    CANONICAL_SECTIONS.forEach((secDef) => {
      const secData = sectionMap[secDef.key];
      if (secData && secData.confidence !== null && secData.confidence < 0.7) {
        items.push({
          id: `flag-sec-${secDef.key}`,
          type: 'section',
          targetElementId: `section-field-${secDef.key}`,
          title: secDef.title,
          confidence: secData.confidence,
          description: `Extracted section has a low AI confidence score of ${Math.round(secData.confidence * 100)}%`,
        });
      }
    });

    // 2. Scan Observation Tables for confidence < 0.7
    tables.forEach((tbl) => {
      const dataObj = (tbl.data_json as any) || {};
      const tblConfidence = typeof dataObj.confidence === 'number' ? dataObj.confidence : 1.0;

      if (tblConfidence < 0.7) {
        items.push({
          id: `flag-tbl-${tbl.id}`,
          type: 'table',
          targetElementId: `table-field-${tbl.id}`,
          title: tbl.title || 'Observation Table',
          confidence: tblConfidence,
          description: `Extracted table data has a low AI confidence score of ${Math.round(tblConfidence * 100)}%`,
        });
      }
    });

    return items;
  }, [sectionMap, tables]);

  // Scroll & Focus Navigation Handler
  const handleScrollToFlaggedItem = (targetElementId: string) => {
    const el = document.getElementById(targetElementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
    }
  };

  // Section Textarea Change Handler
  const handleSectionContentChange = (sectionKey: string, newContent: string) => {
    setIsDirty(true);
    setSectionMap((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        content: newContent,
      },
    }));
  };

  // Image Viewer Controls
  const handleZoomIn = () => setImageScale((prev) => Math.min(prev + 0.25, 3.0));
  const handleZoomOut = () => setImageScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setImageScale(1);

  const activeDoc = documents[activeDocIndex];
  const activeImageUrl = activeDoc ? signedImageUrls[activeDoc.id] : null;

  // Add Custom Table Handler
  const handleAddTable = async () => {
    if (documents.length === 0) return;
    const targetDocId = documents[0].id;

    try {
      const { data: newTbl, error } = await supabase
        .from('observation_tables')
        .insert({
          document_id: targetDocId,
          title: 'Custom Observation Table',
          data_json: {
            headers: ['Parameter', 'Measured Value', 'Units'],
            rows: [
              ['', '', ''],
              ['', '', ''],
            ],
            confidence: 1.0,
          },
        })
        .select()
        .single();

      if (error) throw error;
      if (newTbl) {
        setTables((prev) => [...prev, newTbl as ObservationTable]);
        setIsDirty(true);
      }
    } catch (err: any) {
      console.error('[VerifyPage] Error adding table:', err);
      setSaveError(`Failed creating new table: ${err?.message}`);
    }
  };

  const handleSaveTable = (updatedTable: ObservationTable) => {
    setTables((prev) => prev.map((t) => (t.id === updatedTable.id ? updatedTable : t)));
    setIsDirty(true);
  };

  const handleDeleteTable = async (tableId: string) => {
    try {
      await supabase.from('observation_tables').delete().eq('id', tableId);
      setTables((prev) => prev.filter((t) => t.id !== tableId));
      setIsDirty(true);
    } catch (err: any) {
      console.error('[VerifyPage] Error deleting table:', err);
      setSaveError(`Failed deleting table: ${err?.message}`);
    }
  };

  /**
   * BATCHED SAVE OPERATION
   */
  const performSaveOperation = async (navigateOnSuccess = false) => {
    if (!documents || documents.length === 0) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const primaryDocId = documents[0].id;

      // 1. Batch Sections Updates & Inserts
      const sectionPromises = Object.values(sectionMap).map(async (item) => {
        if (!item.content && !item.id) return;

        if (item.id) {
          const { error } = await supabase
            .from('sections')
            .update({ content: item.content })
            .eq('id', item.id);
          if (error) throw new Error(`Error updating section "${item.section_type}": ${error.message}`);
        } else {
          const { data: inserted, error } = await supabase
            .from('sections')
            .insert({
              document_id: primaryDocId,
              section_type: item.section_type,
              content: item.content,
              confidence: 1.0,
            })
            .select()
            .single();

          if (error) throw new Error(`Error inserting section "${item.section_type}": ${error.message}`);
          if (inserted) {
            setSectionMap((prev) => ({
              ...prev,
              [item.section_type]: {
                ...prev[item.section_type],
                id: inserted.id,
              },
            }));
          }
        }
      });

      // 2. Batch Observation Tables Updates
      const tablePromises = tables.map(async (tbl) => {
        const { error } = await supabase
          .from('observation_tables')
          .update({
            title: tbl.title,
            data_json: tbl.data_json,
          })
          .eq('id', tbl.id);
        if (error) throw new Error(`Error updating table "${tbl.title}": ${error.message}`);
      });

      await Promise.all([...sectionPromises, ...tablePromises]);

      setIsDirty(false);
      setSaveSuccess(true);

      if (navigateOnSuccess) {
        navigate(`/generate/${experimentId}`);
      } else {
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err: any) {
      console.error('[VerifyPage] Save failure:', err);
      setSaveError(err?.message || 'Error persisting verification changes to database');
    } finally {
      setSaving(false);
    }
  };

  // Determine if "Save & Continue" should be gated by review confirmation
  const isSaveAndContinueDisabled =
    saving || (flaggedItems.length > 0 && !hasConfirmedReview);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* 1. TOP STEPPER & SAVE CONTROLS BAR */}
      <div className="glass-panel rounded-2xl p-4 sm:p-6 border border-gray-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800/80 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
                <FlaskConical className="h-5 w-5 text-emerald-400" />
                <span>Verification & Confidence Audit</span>
              </h1>

              {/* Unsaved Changes Indicator Badge */}
              {isDirty ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Unsaved changes
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  All changes saved
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Verify extracted sections and tables side-by-side with original notebook scans before generating final reports.
            </p>
          </div>

          {/* Stepper & Main Action Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => performSaveOperation(false)}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {saveSuccess ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span>Draft Saved</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 text-emerald-400" />
                  <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                </>
              )}
            </button>

            {/* Save & Continue Button */}
            <button
              onClick={() => performSaveOperation(true)}
              disabled={isSaveAndContinueDisabled}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2 text-xs font-semibold text-gray-950 shadow-md shadow-emerald-500/20 hover:brightness-110 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                flaggedItems.length > 0 && !hasConfirmedReview
                  ? 'Please confirm review of all flagged items before proceeding'
                  : 'Save all verification changes and proceed to report export'
              }
            >
              <span>{saving ? 'Saving Batched Changes...' : 'Save & Continue'}</span>
              <ArrowRight className="h-4 w-4 text-gray-950" />
            </button>
          </div>
        </div>

        {/* Four-Step Progress Stepper */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-gray-950 font-bold text-xs">
              <Check className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono font-bold text-emerald-400">Step 1</div>
              <div className="text-xs font-semibold text-white">Upload Pages</div>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-gray-950 font-bold text-xs">
              <Check className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono font-bold text-emerald-400">Step 2</div>
              <div className="text-xs font-semibold text-white">AI Extraction</div>
            </div>
          </div>

          <div className="rounded-xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 p-3 flex items-center gap-3 shadow-lg shadow-emerald-500/10">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400 text-gray-950 font-bold text-xs animate-pulse">
              3
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono font-bold text-emerald-300">Active Step</div>
              <div className="text-xs font-bold text-white">Human Verification</div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-3 flex items-center gap-3 opacity-60">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-800 text-gray-400 font-bold text-xs">
              4
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono font-bold text-gray-500">Step 4</div>
              <div className="text-xs font-semibold text-gray-400">Report Export</div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Failure Error Banner */}
      {saveError && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5 text-red-300 space-y-3 animate-fadeIn">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm text-red-200">Save Operation Failed</h3>
              <p className="text-xs text-red-300/90 mt-0.5">{saveError}</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-red-500/20">
            <button
              onClick={() => setSaveError(null)}
              className="text-xs text-red-400 hover:text-white px-3 py-1.5 rounded-lg border border-red-500/20 cursor-pointer"
            >
              Dismiss
            </button>
            <button
              onClick={() => performSaveOperation(false)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/20 border border-red-500/40 px-4 py-1.5 text-xs font-bold text-red-200 hover:bg-red-500/30 transition-all cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? 'Retrying...' : 'Retry Saving'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Initial Loading State */}
      {loading && (
        <div className="glass-panel rounded-2xl p-16 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-400" />
          <p className="text-sm text-gray-400 font-medium">Loading experiment scan images and extracted sections...</p>
        </div>
      )}

      {/* 2. SPLIT LAYOUT CONTAINER */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ========================================================================= */}
          {/* LEFT PANE: ZOOMABLE MULTI-PAGE IMAGE VIEWER (lg:col-span-5) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 glass-panel rounded-2xl p-4 border border-gray-800 space-y-4 lg:sticky lg:top-24 max-h-[85vh] flex flex-col">
            {/* Viewer Header & Page Navigation */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Notebook Page Scan ({documents.length})
                </span>
              </div>

              {documents.length > 1 && (
                <div className="flex items-center gap-1.5 rounded-lg bg-gray-900 border border-gray-800 px-2 py-1">
                  <button
                    onClick={() => setActiveDocIndex((prev) => Math.max(prev - 1, 0))}
                    disabled={activeDocIndex === 0}
                    className="text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer p-0.5"
                    title="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-[11px] font-mono text-emerald-400 px-1 font-bold">
                    {activeDocIndex + 1} / {documents.length}
                  </span>
                  <button
                    onClick={() => setActiveDocIndex((prev) => Math.min(prev + 1, documents.length - 1))}
                    disabled={activeDocIndex === documents.length - 1}
                    className="text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer p-0.5"
                    title="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Zoom Controls Bar */}
            <div className="flex items-center justify-between rounded-xl bg-gray-900/90 border border-gray-800 px-3 py-1.5 text-xs text-gray-300">
              <span className="font-mono text-[11px] text-gray-400">
                Zoom: <strong className="text-emerald-400">{Math.round(imageScale * 100)}%</strong>
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleZoomOut}
                  className="rounded p-1 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="rounded p-1 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
                  title="Reset Zoom"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleZoomIn}
                  className="rounded p-1 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Image Canvas Container */}
            <div className="flex-1 overflow-auto rounded-xl border border-gray-800 bg-gray-950/80 p-2 min-h-[350px] max-h-[550px] flex items-center justify-center relative">
              {activeImageUrl ? (
                <div
                  className="transition-transform duration-200 ease-out origin-center"
                  style={{ transform: `scale(${imageScale})` }}
                >
                  <img
                    src={activeImageUrl}
                    alt={`Notebook page ${activeDocIndex + 1}`}
                    className="max-w-full h-auto rounded shadow-lg object-contain"
                  />
                </div>
              ) : (
                <div className="text-center p-8 space-y-2 text-gray-500">
                  <ImageIcon className="h-10 w-10 mx-auto text-gray-700" />
                  <p className="text-xs">No image preview available for this document.</p>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT PANE: FLAGGED REVIEW PANEL & CANONICAL SECTIONS EDITOR (lg:col-span-7) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 space-y-6">
            {/* REQUIREMENT 1: FLAGGED ITEMS REVIEW PANEL ABOVE SECTION LIST */}
            {flaggedItems.length > 0 ? (
              <div className="glass-panel rounded-2xl p-5 border border-amber-500/40 bg-amber-500/5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <ShieldAlert className="h-4 w-4 animate-bounce" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Flagged Low-Confidence Items</span>
                        <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-mono font-bold text-amber-300 border border-amber-500/40">
                          {flaggedItems.length} item{flaggedItems.length > 1 ? 's' : ''} need review
                        </span>
                      </h2>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-amber-200/90 leading-relaxed">
                  The AI vision model flagged low confidence (&lt; 70%) on the following fields. Click any item to jump directly to its editor field.
                </p>

                {/* List of Flagged Items with Click-to-Scroll Action */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {flaggedItems.map((flag) => (
                    <button
                      key={flag.id}
                      type="button"
                      onClick={() => handleScrollToFlaggedItem(flag.targetElementId)}
                      className="text-left rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 hover:bg-amber-500/20 hover:border-amber-500/50 transition-all cursor-pointer group flex items-start justify-between"
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-white group-hover:text-amber-200 transition-colors flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5 text-amber-400" />
                          <span>{flag.title}</span>
                        </div>
                        <p className="text-[11px] text-amber-300/80 leading-tight">
                          {flag.description}
                        </p>
                      </div>

                      <span className="text-xs text-amber-400 font-mono font-bold group-hover:translate-x-1 transition-transform">
                        Jump &rarr;
                      </span>
                    </button>
                  ))}
                </div>

                {/* REQUIREMENT 3: EXPLICIT REVIEW CONFIRMATION CHECKBOX GATE */}
                <div className="pt-3 border-t border-amber-500/20">
                  <label className="flex items-center gap-3 p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs font-semibold text-amber-200 cursor-pointer hover:bg-amber-900/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={hasConfirmedReview}
                      onChange={(e) => setHasConfirmedReview(e.target.checked)}
                      className="h-4 w-4 rounded border-amber-500/50 bg-gray-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>
                      I have reviewed and confirmed all {flaggedItems.length} low-confidence item(s) before final export.
                    </span>
                  </label>
                </div>
              </div>
            ) : (
              /* High Confidence Success Banner */
              <div className="glass-panel rounded-2xl p-4 border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-3 text-xs text-emerald-300">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                <span>
                  High confidence extraction: All sections and tables scored ≥ 70% confidence. No low-confidence flags detected.
                </span>
              </div>
            )}

            {/* SECTIONS / CALCULATIONS TAB NAVIGATION */}
            <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
              <button
                type="button"
                onClick={() => setActiveViewTab('sections')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                  activeViewTab === 'sections'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-md shadow-emerald-500/10'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Lab Notebook Sections</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveViewTab('calculations')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                  activeViewTab === 'calculations'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-md shadow-indigo-500/10'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <Calculator className="h-4 w-4 text-indigo-400" />
                <span>Formula & Calculation Verifier</span>
              </button>
            </div>

            {/* TAB CONTENT 1: CANONICAL SECTIONS EDITOR */}
            {activeViewTab === 'sections' && (
              <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-6">
                <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="h-5 w-5 text-emerald-400" />
                    <span>Lab Notebook Sections</span>
                  </h2>

                  <span className="text-xs font-mono text-gray-400">
                    Fixed Canonical Order
                  </span>
                </div>

                {/* Render Canonical Sections in Order */}
                <div className="space-y-6">
                {CANONICAL_SECTIONS.map((secDef) => {
                  const secData = sectionMap[secDef.key] || {
                    section_type: secDef.key,
                    content: '',
                    confidence: null,
                  };

                  const isObservation = secDef.key === 'observation';
                  const hasConfidence = secData.confidence !== null;
                  const confidenceVal = secData.confidence ?? 1.0;
                  const isLowConfidence = hasConfidence && confidenceVal < 0.7;
                  const confidencePct = hasConfidence ? Math.round(confidenceVal * 100) : null;
                  const fieldId = `section-field-${secDef.key}`;

                  return (
                    <div
                      key={secDef.key}
                      className={`rounded-xl border p-4 space-y-3 shadow-lg transition-all ${
                        isLowConfidence
                          ? 'border-l-4 border-l-amber-500 border-amber-500/30 bg-amber-500/5'
                          : 'border-gray-800 bg-gray-900/60'
                      }`}
                    >
                      {/* Section Card Header */}
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-white flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full inline-block ${
                              isLowConfidence ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                            }`}
                          />
                          <span>{secDef.title}</span>
                        </label>

                        {/* Low Confidence Signaling Badge */}
                        {isLowConfidence ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                            <AlertTriangle className="h-3 w-3 text-amber-400" />
                            <span>Low confidence ({confidencePct}%)</span>
                          </span>
                        ) : hasConfidence ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                            <Sparkles className="h-3 w-3" />
                            <span>{confidencePct}% Confidence</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-gray-500 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded">
                            Manual / Optional
                          </span>
                        )}
                      </div>

                      {/* Section Text Area with unique HTML ID for click-to-focus scrolling */}
                      <textarea
                        id={fieldId}
                        rows={isObservation ? 2 : 4}
                        value={secData.content}
                        onChange={(e) => handleSectionContentChange(secDef.key, e.target.value)}
                        placeholder={secDef.placeholder}
                        className={`w-full rounded-xl p-3 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 leading-relaxed font-sans border transition-all max-h-96 overflow-y-auto resize-y min-h-[100px] ${
                          isLowConfidence
                            ? 'bg-amber-950/20 border-amber-500/40 focus:border-amber-400 focus:ring-amber-400'
                            : 'bg-gray-950/80 border-gray-800 focus:border-emerald-500 focus:ring-emerald-500'
                        }`}
                      />

                      {/* Embed TableEditor / MultiTableEditor inline inside Observation section */}
                      {isObservation && (
                        <div className="pt-2 border-t border-gray-800/80 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                              <Table className="h-4 w-4 text-cyan-400" />
                              <span>Observation Tables</span>
                            </span>
                          </div>

                          <div id="table-field-observation">
                            <MultiTableEditor
                              tables={tables}
                              onSaveTable={handleSaveTable}
                              onDeleteTable={handleDeleteTable}
                              onAddTable={handleAddTable}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Save & Continue Action Bar */}
              <div className="pt-4 border-t border-gray-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-gray-400">
                  {isDirty ? (
                    <span className="text-amber-400 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                      Unsaved changes in local draft buffer.
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      All verification edits saved.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => performSaveOperation(false)}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                  </button>

                  <button
                    onClick={() => performSaveOperation(true)}
                    disabled={isSaveAndContinueDisabled}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 text-xs font-semibold text-gray-950 shadow-md shadow-emerald-500/20 hover:brightness-110 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title={
                      flaggedItems.length > 0 && !hasConfirmedReview
                        ? 'Please confirm review of all flagged items before proceeding'
                        : 'Save all verification changes and proceed to report export'
                    }
                  >
                    <span>{saving ? 'Persisting All Changes...' : 'Save & Continue'}</span>
                    <ArrowRight className="h-4 w-4 text-gray-950" />
                  </button>
                </div>
              </div>
            </div>
          )}

            {/* TAB CONTENT 2: FORMULA & CALCULATION VERIFIER */}
            {activeViewTab === 'calculations' && (
              <CalculationTab
                experimentId={experimentId!}
                extractedCalculationText={sectionMap['calculation']?.content}
                tables={tables}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
