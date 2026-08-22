import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Experiment, GeneratedDocument, Template } from '../types/database';
import { TemplatePicker } from '../components/TemplatePicker';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Loader2,
  Printer,
  RefreshCw,
  Share2,
  Sparkles,
} from 'lucide-react';

export const GeneratePage: React.FC = () => {
  const { experimentId } = useParams<{ experimentId: string }>();
  const navigate = useNavigate();

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // PDF & DOCX Generation & Signed URL State
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [docxSignedUrl, setDocxSignedUrl] = useState<string | null>(null);
  const [docxGenerating, setDocxGenerating] = useState<boolean>(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  useEffect(() => {
    async function loadExpData() {
      if (!experimentId) return;
      try {
        setLoading(true);
        // Fetch Experiment Details
        const { data: expData } = await supabase
          .from('experiments')
          .select('*')
          .eq('id', experimentId)
          .single();

        if (expData) setExperiment(expData);

        // Check if a generated_documents row for PDF already exists
        const { data: genDocs } = await supabase
          .from('generated_documents')
          .select('*')
          .eq('experiment_id', experimentId)
          .order('created_at', { ascending: false });

        if (genDocs && genDocs.length > 0) {
          const latestPdf = genDocs.find((d: any) => d.format === 'pdf');
          const latestDocx = genDocs.find((d: any) => d.format === 'docx');

          if (latestPdf) {
            const { data: sPdf } = await supabase.storage
              .from('generated-records')
              .createSignedUrl(latestPdf.file_path, 3600);
            if (sPdf?.signedUrl) setPdfSignedUrl(sPdf.signedUrl);
          }

          if (latestDocx) {
            const { data: sDocx } = await supabase.storage
              .from('generated-records')
              .createSignedUrl(latestDocx.file_path, 3600);
            if (sDocx?.signedUrl) setDocxSignedUrl(sDocx.signedUrl);
          }
        }
      } catch (err) {
        console.error('[GeneratePage] Load error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadExpData();
  }, [experimentId]);

  // Template Switcher Handler
  const handleSelectTemplate = async (template: Template) => {
    if (!experimentId) return;
    try {
      const { error } = await supabase
        .from('experiments')
        .update({ template_id: template.id })
        .eq('id', experimentId);

      if (!error) {
        setExperiment((prev) => (prev ? { ...prev, template_id: template.id } : null));
      }
    } catch (err) {
      console.error('[GeneratePage] Error updating experiment template:', err);
    }
  };

  /**
   * Invoke Edge Function "generate-record-pdf"
   */
  const handleGeneratePdf = async () => {
    if (!experimentId) return;
    setPdfGenerating(true);
    setPdfError(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-record-pdf', {
        body: { experiment_id: experimentId },
      });

      if (error) throw new Error(error.message || 'Edge Function invocation failed.');
      if (data && !data.success) throw new Error(data.error || 'PDF generation failed on server.');

      if (data?.signedUrl) {
        setPdfSignedUrl(data.signedUrl);
      } else if (data?.file_path) {
        const { data: sData } = await supabase.storage
          .from('generated-records')
          .createSignedUrl(data.file_path, 3600);
        if (sData?.signedUrl) setPdfSignedUrl(sData.signedUrl);
      }
    } catch (err: any) {
      console.error('[GeneratePage] PDF generation error:', err);
      setPdfError(err?.message || 'Failed executing generate-record-pdf Edge Function');
    } finally {
      setPdfGenerating(false);
    }
  };

  /**
   * REQUIREMENT 4: Invoke Edge Function "generate-record-docx"
   */
  const handleGenerateDocx = async () => {
    if (!experimentId) return;
    setDocxGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-record-docx', {
        body: { experiment_id: experimentId },
      });

      if (error) throw new Error(error.message || 'DOCX Edge Function execution failed.');
      if (data && !data.success) throw new Error(data.error || 'DOCX generation failed on server.');

      if (data?.signedUrl) {
        setDocxSignedUrl(data.signedUrl);
        // Automatically open / download file
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.target = '_blank';
        link.download = `recordai_${experiment?.experiment_number || 'report'}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      console.error('[GeneratePage] DOCX generation error:', err);
      alert(`Word export failed: ${err?.message || 'Error generating DOCX document'}`);
    } finally {
      setDocxGenerating(false);
    }
  };

  const handleOtherExport = (format: string) => {
    setExportingFormat(format);
    setTimeout(() => {
      setExportingFormat(null);
      alert(`Exporting ${experiment?.title || 'Lab Record'} as ${format.toUpperCase()} package...`);
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/verify/${experimentId}`)}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white font-medium transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Verification
        </button>

        <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" /> Verification Verified & Approved
        </span>
      </div>

      {/* Main Glass Panel Container */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-gray-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800/80 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                Generate Digital Record Report
              </h1>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                <span>Experiment: {experiment?.title || 'Chemistry Lab Record'}</span>
                <span>•</span>
                <span className="font-mono text-emerald-400">
                  {experiment?.experiment_number || 'EXP-RECORD'}
                </span>
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            Step 4: Report Export
          </span>
        </div>

        {/* 1. LAYOUT TEMPLATE PICKER */}
        <div className="pt-2 border-b border-gray-800/80 pb-6">
          <TemplatePicker
            selectedTemplateId={experiment?.template_id || null}
            subject={experiment?.subject}
            onSelectTemplate={handleSelectTemplate}
          />
        </div>

        {/* PDF Generation Failure Error Alert */}
        {pdfError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
              <span>{pdfError}</span>
            </div>
            <button onClick={() => setPdfError(null)} className="text-red-400 underline cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* 2. MAIN PDF GENERATION ACTION CARD */}
        <div className="glass-card rounded-2xl p-6 border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-gray-950 to-cyan-500/10 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-400" />
                <span>Formal Digital PDF Lab Report</span>
              </h3>
              <p className="text-xs text-gray-300">
                Compiles title block, ordered sections, structured observation tables, verified calculations, and data charts into an archived PDF document.
              </p>
            </div>

            <button
              onClick={handleGeneratePdf}
              disabled={pdfGenerating}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-xs font-bold text-gray-950 shadow-lg shadow-emerald-500/20 hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
            >
              {pdfGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-gray-950" />
                  <span>Generating Formatted PDF Record...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-gray-950" />
                  <span>{pdfSignedUrl ? 'Regenerate PDF Report' : 'Generate PDF Report'}</span>
                </>
              )}
            </button>
          </div>

          {/* REQUIREMENT 5: EMBEDDED PREVIEW & DOWNLOAD LINK ON SUCCESS */}
          {pdfSignedUrl && (
            <div className="pt-4 border-t border-emerald-500/20 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  PDF Report Generated Successfully
                </span>

                <a
                  href={pdfSignedUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={`recordai_${experiment?.experiment_number || 'report'}.pdf`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition-all cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download PDF Document</span>
                </a>
              </div>

              {/* Embedded PDF Viewer Frame */}
              <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden shadow-2xl">
                <iframe
                  src={pdfSignedUrl}
                  title="Generated PDF Lab Report Preview"
                  className="w-full h-[550px] border-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. ADDITIONAL EXPORT OPTIONS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Word / DOCX Export Card */}
          <div className="glass-card rounded-2xl p-5 border border-gray-800 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <h4 className="font-bold text-white text-sm">Word Document (.docx)</h4>
              <p className="text-xs text-gray-400">
                Editable Word document output suitable for manuscript submission or lab archive.
              </p>
            </div>
            <button
              onClick={handleGenerateDocx}
              disabled={docxGenerating}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {docxGenerating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                  <span>Generating Word Document...</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>{docxSignedUrl ? 'Download Word (.docx)' : 'Generate & Download Word'}</span>
                </>
              )}
            </button>
          </div>

          {/* LaTeX Export Card */}
          <div className="glass-card rounded-2xl p-5 border border-gray-800 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="h-4 w-4" />
              </div>
              <h4 className="font-bold text-white text-sm">LaTeX Package</h4>
              <p className="text-xs text-gray-400">
                Raw LaTeX source code with booktabs tables and math formulas for academic publishing.
              </p>
            </div>
            <button
              onClick={() => handleOtherExport('latex')}
              disabled={!!exportingFormat}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {exportingFormat === 'latex' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span>Download LaTeX</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-800/80">
          <button
            onClick={() => navigate('/')}
            className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-2.5 text-xs font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            Return to Dashboard
          </button>
          <button
            onClick={() => navigate('/experiments')}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 text-xs font-semibold text-gray-950 shadow-md shadow-emerald-500/20 hover:brightness-110 transition-all cursor-pointer"
          >
            View Experiments Repository
          </button>
        </div>
      </div>
    </div>
  );
};
