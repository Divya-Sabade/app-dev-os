import { MSA_STANDARD_TERMS } from '@/lib/constants'

const FEW_SHOT_EXAMPLES = `
EXAMPLE 1:
CONTRACT EXCERPT:
[PAGE 1]
This Master Service Agreement ("Agreement") is entered into as of March 1, 2026, by and between TechCorp Solutions Inc. ("Service Provider") and GlobalRetail Ltd. ("Client").

[PAGE 3]
Client shall pay Service Provider a monthly retainer of $15,000 USD, due within 30 days of invoice date. Invoices will be issued on the first business day of each month.

EXTRACTED TERMS:
{
  "terms": [
    {
      "term_name": "Parties",
      "value": "TechCorp Solutions Inc. (Service Provider) and GlobalRetail Ltd. (Client)",
      "page_number": 1,
      "confidence_score": 0.99,
      "source_sentence": "This Master Service Agreement is entered into as of March 1, 2026, by and between TechCorp Solutions Inc. and GlobalRetail Ltd."
    },
    {
      "term_name": "Payment Terms",
      "value": "$15,000 USD monthly retainer, due within 30 days of invoice",
      "page_number": 3,
      "confidence_score": 0.97,
      "source_sentence": "Client shall pay Service Provider a monthly retainer of $15,000 USD, due within 30 days of invoice date."
    },
    {
      "term_name": "Invoice Schedule",
      "value": "First business day of each month",
      "page_number": 3,
      "confidence_score": 0.95,
      "source_sentence": "Invoices will be issued on the first business day of each month."
    }
  ]
}

EXAMPLE 2:
CONTRACT EXCERPT:
[PAGE 6]
Either party may terminate this Agreement upon sixty (60) days written notice to the other party. In no event shall either party's liability exceed the total fees paid in the preceding twelve (12) months.

[PAGE 7]
Any disputes arising under this Agreement shall be resolved through binding arbitration under the rules of the American Arbitration Association in the State of Delaware.

EXTRACTED TERMS:
{
  "terms": [
    {
      "term_name": "Termination Clause",
      "value": "60 days written notice by either party",
      "page_number": 6,
      "confidence_score": 0.98,
      "source_sentence": "Either party may terminate this Agreement upon sixty (60) days written notice to the other party."
    },
    {
      "term_name": "Liability Cap",
      "value": "Total fees paid in the preceding 12 months",
      "page_number": 6,
      "confidence_score": 0.96,
      "source_sentence": "In no event shall either party's liability exceed the total fees paid in the preceding twelve (12) months."
    },
    {
      "term_name": "Dispute Resolution",
      "value": "Binding arbitration under AAA rules in Delaware",
      "page_number": 7,
      "confidence_score": 0.95,
      "source_sentence": "Any disputes arising under this Agreement shall be resolved through binding arbitration under the rules of the American Arbitration Association in the State of Delaware."
    }
  ]
}
`

export function buildMSAExtractionPrompt(
  contractText: string,
  customTerms: string[]
): { system: string; user: string } {
  const customTermsList =
    customTerms.length > 0
      ? `\n\nAdditional custom terms to extract:\n${customTerms.map((t) => `- ${t}`).join('\n')}`
      : ''

  const system = `You are a contract analysis assistant specialised in Master Service Agreements (MSAs).

Extract the following key terms from the MSA contract text provided. For each term, return a JSON object with EXACTLY these fields:
- "term_name": string — the exact term name as listed below
- "value": string — the extracted value, or "Not found" if absent from the document
- "page_number": integer — the 1-indexed page number where the term appears (use [PAGE N] markers in the text)
- "confidence_score": float between 0.0 and 1.0 — your confidence in this extraction
- "source_sentence": string — the verbatim sentence from the contract supporting this extraction; empty string if "Not found"

Standard MSA terms to extract:
${MSA_STANDARD_TERMS.map((t) => `- ${t}`).join('\n')}${customTermsList}

Return a JSON object with a single key "terms" containing an array of these objects. Include ALL standard terms plus any custom terms. If a term is not found, include it with value "Not found".

${FEW_SHOT_EXAMPLES}`

  const user = `CONTRACT TEXT:\n${contractText}\n\nExtract all key terms now.`

  return { system, user }
}
