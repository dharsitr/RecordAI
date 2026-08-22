import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { FileUploadZone } from '../components/FileUploadZone';
import { TemplatePicker } from '../components/TemplatePicker';
import type { Template } from '../types/database';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FilePlus,
  FlaskConical,
  FolderCheck,
  Loader2,
  Sparkles,
  Tag,
} from 'lucide-react';

export const NewRecordPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Wizard Step: 1 = Form, 2 = Upload, 3 = Complete
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [subjectOption, setSubjectOption] = useState<string>('Physics');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [experimentNumber, setExperimentNumber] = useState<string>(
    `EXP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Created Experiment State
  const [createdExperimentId, setCreatedExperimentId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState<number>(0);

  const subjectsList = ['Physics', 'Chemistry', 'Electronics', 'Custom'];

  // Step 1 Submit: Create Experiment Row in Supabase
  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!user) {
      setErrorMessage('You must be logged in to create an experiment.');
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Please enter an experiment title.');
      return;
    }

    const finalSubject = subjectOption === 'Custom' ? customSubject.trim() : subjectOption;
    if (subjectOption === 'Custom' && !finalSubject) {
      setErrorMessage('Please specify your custom subject name.');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('experiments')
        .insert({
          user_id: user.id,
          title: trimmedTitle,
          subject: finalSubject || 'General',
          experiment_number: experimentNumber.trim() || null,
          template_id: selectedTemplateId || null,
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message || 'Failed to create experiment record.');
      }

      setCreatedExperimentId(data.id);
      setCurrentStep(2);
    } catch (err: any) {
      console.error('[NewRecordPage] Error creating experiment:', err);
      setErrorMessage(err?.message || 'An unexpected error occurred while saving the experiment.');
    } finally {
      setLoading(false);
    }
  };

  const handleAllUploadsFinished = (count: number) => {
    setUploadedCount(count);
  };

  const handleFinishUploadStep = () => {
    if (uploadedCount > 0) {
      setCurrentStep(3);
    } else {
      setErrorMessage('Please upload at least one document before continuing.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header & Step Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FilePlus className="h-7 w-7 text-emerald-400" />
            Digitize New Lab Record
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Create an experiment record and upload handwritten notebook pages or PDFs.
          </p>
        </div>

        {/* Wizard Step Badges */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
              currentStep === 1
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-gray-800 bg-gray-900/60 text-gray-500'
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px]">
              1
            </span>
            <span>Details</span>
          </span>

          <span className="text-gray-600">&rarr;</span>

          <span
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
              currentStep === 2
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-gray-800 bg-gray-900/60 text-gray-500'
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px]">
              2
            </span>
            <span>Upload</span>
          </span>

          <span className="text-gray-600">&rarr;</span>

          <span
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
              currentStep === 3
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-gray-800 bg-gray-900/60 text-gray-500'
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px]">
              3
            </span>
            <span>Complete</span>
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 animate-fadeIn">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400 mt-0.5" />
          <span className="leading-snug">{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: EXPERIMENT DETAILS FORM */}
      {currentStep === 1 && (
        <form onSubmit={handleCreateExperiment} className="glass-panel rounded-2xl p-8 border border-gray-800 space-y-6">
          <div className="border-b border-gray-800/80 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-emerald-400" />
              Experiment Metadata
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Specify the academic subject, experiment title, and identifier code.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Subject Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Subject / Template
              </label>
              <div className="grid grid-cols-2 gap-2">
                {subjectsList.map((subj) => (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => {
                      setSubjectOption(subj);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-semibold border transition-all ${
                      subjectOption === subj
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-sm shadow-emerald-500/20'
                        : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:border-gray-700 hover:text-white'
                    }`}
                  >
                    <Tag className="h-3.5 w-3.5" />
                    <span>{subj}</span>
                  </button>
                ))}
              </div>

              {subjectOption === 'Custom' && (
                <div className="mt-3">
                  <input
                    type="text"
                    required
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Enter custom subject (e.g., Biochemistry)"
                    className="w-full rounded-xl border border-gray-800 bg-gray-900/80 px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              )}
            </div>

            {/* Experiment Number */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Experiment Number / Code
              </label>
              <input
                type="text"
                required
                value={experimentNumber}
                onChange={(e) => setExperimentNumber(e.target.value)}
                placeholder="e.g. EXP-2026-001"
                className="w-full rounded-xl border border-gray-800 bg-gray-900/80 px-4 py-2.5 text-sm font-mono text-emerald-300 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-gray-500 mt-1">Unique identifier for laboratory records audit trail</p>
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Experiment Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="e.g., Verification of Ohm's Law and Circuit Analysis"
              className="w-full rounded-xl border border-gray-800 bg-gray-900/80 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Template Picker */}
          <div className="pt-2">
            <TemplatePicker
              selectedTemplateId={selectedTemplateId}
              subject={subjectOption === 'Custom' ? customSubject : subjectOption}
              onSelectTemplate={(tpl) => setSelectedTemplateId(tpl.id)}
            />
          </div>

          {/* Submit Step 1 Button */}
          <div className="pt-4 border-t border-gray-800/80 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-gray-950 shadow-lg shadow-emerald-500/20 hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-gray-950" />
                  <span>Creating Record...</span>
                </>
              ) : (
                <>
                  <span>Next: Upload Documents</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: FILE UPLOAD ZONE */}
      {currentStep === 2 && createdExperimentId && (
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-6 border border-gray-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Current Record</span>
              <h2 className="text-lg font-bold text-white">{title}</h2>
              <span className="text-xs text-emerald-400 font-mono mt-0.5 inline-block">
                {experimentNumber} • {subjectOption === 'Custom' ? customSubject : subjectOption}
              </span>
            </div>
            <span className="text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full">
              Bucket: lab-uploads
            </span>
          </div>

          <FileUploadZone
            experimentId={createdExperimentId}
            onAllUploadsFinished={handleAllUploadsFinished}
          />

          <div className="flex items-center justify-between pt-4 border-t border-gray-800/80">
            <p className="text-xs text-gray-400">
              {uploadedCount > 0 ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {uploadedCount} file(s) successfully uploaded
                </span>
              ) : (
                'Upload at least 1 document file to proceed.'
              )}
            </p>

            <button
              type="button"
              disabled={uploadedCount === 0}
              onClick={handleFinishUploadStep}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-gray-950 shadow-lg shadow-emerald-500/20 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <span>Review & Finish</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: SUCCESS & CONTINUE */}
      {currentStep === 3 && createdExperimentId && (
        <div className="glass-panel rounded-2xl p-8 border border-gray-800 text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400 shadow-xl shadow-emerald-500/10">
            <FolderCheck className="h-10 w-10 animate-bounce" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Record & Uploads Complete!</h2>
            <p className="text-sm text-gray-300 max-w-md mx-auto">
              Your experiment <span className="text-emerald-400 font-semibold">{title}</span> and {uploadedCount} document file(s) have been persisted to Supabase.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl bg-gray-900/80 border border-gray-800 px-4 py-2 text-xs font-mono text-cyan-400">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span>Ready for AI OCR & Section Extraction</span>
          </div>

          <div className="pt-6 border-t border-gray-800/80 flex justify-center gap-4">
            <button
              onClick={() => navigate(`/process/${createdExperimentId}`)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-8 py-3.5 text-sm font-bold text-gray-950 shadow-lg shadow-emerald-500/25 hover:brightness-110 transition-all cursor-pointer"
            >
              <span>Continue to Processing</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
