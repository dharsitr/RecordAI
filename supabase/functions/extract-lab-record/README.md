# Supabase Edge Function: `extract-lab-record`

This Edge Function turns uploaded laboratory notebook images/PDFs into structured JSON data (`sections` and `observation_tables`).

## Required Environment Variables

To run and deploy this Edge Function, configure the following secrets in your Supabase environment:

| Variable Name | Description | Example / Location |
| :--- | :--- | :--- |
| `ANTHROPIC_API_KEY` | Anthropic API Key for vision model calls (`claude-3-5-sonnet-20241022`). | `sk-ant-api03-...` |
| `SUPABASE_URL` | Your Supabase project URL (automatically injected by Supabase platform). | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role secret key for administrative DB access. | `eyJhbGciOi...` |

### Setting Environment Secrets via Supabase CLI

```bash
supabase secrets set ANTHROPIC_API_KEY="sk-ant-api03-YOUR_KEY_HERE"
```

---

## Endpoint Usage

**HTTP Method**: `POST`  
**URL**: `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/extract-lab-record`

### Request Body
```json
{
  "document_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Response Schema (Success 200)
```json
{
  "success": true,
  "document_id": "123e4567-e89b-12d3-a456-426614174000",
  "sections_count": 4,
  "tables_count": 1,
  "status": "extracted"
}
```

### Idempotency & Failure Handling
- **Idempotent**: Pre-existing sections and observation tables associated with `document_id` are purged before inserting new extractions.
- **Retry Mechanism**: If the vision model output fails JSON parsing or schema validation, it retries once with a strict instruction. If it fails again, `documents.processing_status` is updated to `'failed'`.
