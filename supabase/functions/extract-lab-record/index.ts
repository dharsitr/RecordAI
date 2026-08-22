/// <reference path="../deno.d.ts" />

// ==============================================================================
// Supabase Edge Function: extract-lab-record
// Description: AI extraction pipeline for laboratory notebook pages using Anthropic Vision API.
// Idempotent extraction of sections and observation tables with strict schema validation.
// ==============================================================================

import { createClient } from '@supabase/supabase-js';

// Expected Schema Types
interface ExtractedSection {
  section_type: 'aim' | 'apparatus' | 'procedure' | 'observation' | 'calculation' | 'result' | 'precautions' | string;
  content: string;
  confidence: number;
}

interface ExtractedTable {
  title?: string;
  headers: string[];
  rows: string[][];
  confidence: number;
}

interface ExtractionPayload {
  sections: ExtractedSection[];
  tables: ExtractedTable[];
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Validates that the parsed object strictly satisfies the ExtractionPayload schema shape.
 */
function validateSchema(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Output is not an object.' };
  }

  if (!Array.isArray(data.sections)) {
    return { valid: false, error: 'Field "sections" must be an array.' };
  }

  for (const sec of data.sections) {
    if (!sec || typeof sec !== 'object') {
      return { valid: false, error: 'Section element must be an object.' };
    }
    if (typeof sec.section_type !== 'string') {
      return { valid: false, error: 'Section "section_type" must be a string.' };
    }
    if (typeof sec.content !== 'string') {
      return { valid: false, error: 'Section "content" must be a string.' };
    }
    if (typeof sec.confidence !== 'number' || sec.confidence < 0 || sec.confidence > 1) {
      // Normalize confidence if missing or slightly out of bounds
      sec.confidence = typeof sec.confidence === 'number' ? Math.min(1, Math.max(0, sec.confidence)) : 0.9;
    }
  }

  if (!Array.isArray(data.tables)) {
    return { valid: false, error: 'Field "tables" must be an array.' };
  }

  for (const tbl of data.tables) {
    if (!tbl || typeof tbl !== 'object') {
      return { valid: false, error: 'Table element must be an object.' };
    }
    if (!Array.isArray(tbl.headers)) {
      return { valid: false, error: 'Table "headers" must be an array of strings.' };
    }
    if (!Array.isArray(tbl.rows)) {
      return { valid: false, error: 'Table "rows" must be a 2D array of strings.' };
    }
    if (typeof tbl.confidence !== 'number' || tbl.confidence < 0 || tbl.confidence > 1) {
      tbl.confidence = typeof tbl.confidence === 'number' ? Math.min(1, Math.max(0, tbl.confidence)) : 0.9;
    }
  }

  return { valid: true };
}

/**
 * Strips markdown code block wrappers (e.g. ```json ... ```) from model output.
 */
function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();
  // Remove markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  return cleaned;
}

/**
 * Calls Anthropic Vision API (/v1/messages) with image base64 and prompt
 */
async function callAnthropicVisionAPI(
  apiKey: string,
  base64Data: string,
  mediaType: string,
  isRetry: boolean = false
): Promise<string> {
  const promptText = isRetry
    ? `CRITICAL INSTRUCTION: Your previous response could not be parsed as valid JSON. Return ONLY raw valid JSON without any markdown formatting, prose, explanations, or code blocks.
Extract sections and tables from this laboratory notebook page matching this EXACT JSON schema:
{
  "sections": [
    { "section_type": "aim|apparatus|procedure|observation|calculation|result|precautions", "content": "string", "confidence": 0.95 }
  ],
  "tables": [
    { "title": "string", "headers": ["Header1", "Header2"], "rows": [["val1", "val2"]], "confidence": 0.9 }
  ]
}`
    : `You are an expert scientific laboratory notebook digitizer and OCR parser.
Analyze this laboratory record image carefully. Extract all text sections (aim, apparatus, procedure, observation, calculation, result, precautions) and any tabular data.

Output ONLY strict raw JSON matching the following schema. Do NOT include markdown code blocks, prose, or introductory text:
{
  "sections": [
    { "section_type": "aim|apparatus|procedure|observation|calculation|result|precautions", "content": "extracted text", "confidence": 0.95 }
  ],
  "tables": [
    { "title": "Table title or description", "headers": ["Column 1", "Column 2"], "rows": [["Row 1 Val 1", "Row 1 Val 2"]], "confidence": 0.90 }
  ]
}`;

  // Map media type to Anthropic supported image media types
  let anthropicMediaType = 'image/png';
  if (mediaType.includes('jpeg') || mediaType.includes('jpg')) {
    anthropicMediaType = 'image/jpeg';
  } else if (mediaType.includes('webp')) {
    anthropicMediaType = 'image/webp';
  } else if (mediaType.includes('png')) {
    anthropicMediaType = 'image/png';
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: anthropicMediaType,
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: promptText,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Anthropic Vision API Error (${response.status}): ${errBody}`);
  }

  const resJson = await response.json();
  const textContent = resJson?.content?.[0]?.text;
  if (!textContent) {
    throw new Error('Anthropic Vision API returned empty text response.');
  }

  return textContent;
}

// Handler
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    // 1. Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Parse Request Body
    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: 'Missing required field "document_id"' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      });
    }

    // 3. Fetch Document Record
    const { data: docRecord, error: docFetchErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single();

    if (docFetchErr || !docRecord) {
      throw new Error(`Document record not found for id "${document_id}": ${docFetchErr?.message}`);
    }

    // Update status to 'processing'
    await supabase
      .from('documents')
      .update({ processing_status: 'processing' })
      .eq('id', document_id);

    // 4. Download File from Storage Bucket 'lab-uploads'
    const filePath = docRecord.file_path;
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from('lab-uploads')
      .download(filePath);

    if (downloadErr || !fileData) {
      throw new Error(`Failed to download file "${filePath}" from storage: ${downloadErr?.message}`);
    }

    // Convert file Blob to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    const fileType = docRecord.file_type || 'image/png';
    const mediaType = fileType.includes('pdf') ? 'application/pdf' : fileType;

    // 5. Vision API Extraction with 1 Retry Fallback
    let parsedPayload: ExtractionPayload | null = null;
    let attempts = 0;
    let lastError = '';

    while (attempts < 2 && !parsedPayload) {
      attempts++;
      try {
        if (!anthropicApiKey) {
          throw new Error('ANTHROPIC_API_KEY is not configured in Edge Function environment variables.');
        }

        const isRetry = attempts > 1;
        const rawResponse = await callAnthropicVisionAPI(anthropicApiKey, base64Data, mediaType, isRetry);
        const cleanedJson = cleanJsonString(rawResponse);
        const parsed = JSON.parse(cleanedJson);

        // Validate Schema
        const validation = validateSchema(parsed);
        if (!validation.valid) {
          throw new Error(`Schema Validation Error: ${validation.error}`);
        }

        parsedPayload = parsed as ExtractionPayload;
      } catch (err: any) {
        lastError = err?.message || String(err);
        console.warn(`[extract-lab-record] Attempt ${attempts} failed: ${lastError}`);
      }
    }

    // 6. Handle Extraction Failure
    if (!parsedPayload) {
      await supabase
        .from('documents')
        .update({ processing_status: 'failed' })
        .eq('id', document_id);

      return new Response(
        JSON.stringify({
          error: 'AI extraction failed after retry.',
          details: lastError,
          document_id,
        }),
        {
          status: 422,
          headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
        }
      );
    }

    // 7. Idempotent Database Insertions
    // Clean up any existing sections & observation tables for document_id
    await supabase.from('sections').delete().eq('document_id', document_id);
    await supabase.from('observation_tables').delete().eq('document_id', document_id);

    // Insert Sections
    if (parsedPayload.sections && parsedPayload.sections.length > 0) {
      const sectionRows = parsedPayload.sections.map((sec) => ({
        document_id,
        section_type: sec.section_type || 'observation',
        content: sec.content || '',
        confidence: sec.confidence ?? 0.9,
      }));

      const { error: secInsertErr } = await supabase.from('sections').insert(sectionRows);
      if (secInsertErr) {
        throw new Error(`Failed inserting sections: ${secInsertErr.message}`);
      }
    }

    // Insert Observation Tables
    if (parsedPayload.tables && parsedPayload.tables.length > 0) {
      const tableRows = parsedPayload.tables.map((tbl) => ({
        document_id,
        title: tbl.title || 'Extracted Observations',
        data_json: {
          headers: tbl.headers || [],
          rows: tbl.rows || [],
          confidence: tbl.confidence ?? 0.9,
        },
      }));

      const { error: tblInsertErr } = await supabase.from('observation_tables').insert(tableRows);
      if (tblInsertErr) {
        throw new Error(`Failed inserting observation tables: ${tblInsertErr.message}`);
      }
    }

    // Update document status to 'extracted'
    await supabase
      .from('documents')
      .update({ processing_status: 'extracted' })
      .eq('id', document_id);

    return new Response(
      JSON.stringify({
        success: true,
        document_id,
        sections_count: parsedPayload.sections.length,
        tables_count: parsedPayload.tables.length,
        status: 'extracted',
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[extract-lab-record] Unhandled Exception:', err);
    return new Response(
      JSON.stringify({
        error: err?.message || 'An unexpected error occurred during extraction.',
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      }
    );
  }
});
