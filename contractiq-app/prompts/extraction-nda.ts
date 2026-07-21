import { NDA_STANDARD_TERMS } from '@/lib/constants'

const FEW_SHOT_EXAMPLES = `
EXAMPLE 1:
CONTRACT EXCERPT:
[PAGE 2]
This Non-Disclosure Agreement ("Agreement") is entered into as of January 15, 2026 ("Effective Date"), by and between Acme Corp, a Delaware corporation ("Disclosing Party"), and Beta LLC, a California limited liability company ("Receiving Party").

[PAGE 4]
This Agreement shall be governed by and construed in accordance with the laws of the State of New York, without regard to its conflict of law provisions.

EXTRACTED TERMS:
{
  "terms": [
    {
      "term_name": "Parties",
      "value": "Acme Corp (Disclosing Party) and Beta LLC (Receiving Party)",
      "page_number": 2,
      "confidence_score": 0.98,
      "source_sentence": "This Non-Disclosure Agreement is entered into as of January 15, 2026, by and between Acme Corp, a Delaware corporation, and Beta LLC, a California limited liability company."
    },
    {
      "term_name": "Effective Date",
      "value": "January 15, 2026",
      "page_number": 2,
      "confidence_score": 0.99,
      "source_sentence": "This Non-Disclosure Agreement is entered into as of January 15, 2026."
    },
    {
      "term_name": "Governing Law",
      "value": "New York",
      "page_number": 4,
      "confidence_score": 0.97,
      "source_sentence": "This Agreement shall be governed by and construed in accordance with the laws of the State of New York, without regard to its conflict of law provisions."
    }
  ]
}

EXAMPLE 2:
CONTRACT EXCERPT:
[PAGE 3]
The Receiving Party agrees to hold all Confidential Information in strict confidence and not to disclose any Confidential Information to third parties without the prior written consent of the Disclosing Party.

[PAGE 5]
This Agreement shall remain in full force and effect for a period of three (3) years from the Effective Date.

EXTRACTED TERMS:
{
  "terms": [
    {
      "term_name": "Confidentiality Obligations",
      "value": "Hold in strict confidence; no disclosure to third parties without prior written consent",
      "page_number": 3,
      "confidence_score": 0.96,
      "source_sentence": "The Receiving Party agrees to hold all Confidential Information in strict confidence and not to disclose any Confidential Information to third parties without the prior written consent of the Disclosing Party."
    },
    {
      "term_name": "Term & Duration",
      "value": "3 years from Effective Date",
      "page_number": 5,
      "confidence_score": 0.98,
      "source_sentence": "This Agreement shall remain in full force and effect for a period of three (3) years from the Effective Date."
    }
  ]
}
`

export function buildNDAExtractionPrompt(
  contractText: string,
  customTerms: string[]
): { system: string; user: string } {
  const customTermsList =
    customTerms.length > 0
      ? `\n\nAdditional custom terms to extract:\n${customTerms.map((t) => `- ${t}`).join('\n')}`
      : ''

  const system = `You are a contract analysis assistant specialised in Non-Disclosure Agreements (NDAs).

Extract the following key terms from the NDA contract text provided. For each term, return a JSON object with EXACTLY these fields:
- "term_name": string — the exact term name as listed below
- "value": string — the extracted value, or "Not found" if absent from the document
- "page_number": integer — the 1-indexed page number where the term appears (use [PAGE N] markers in the text)
- "confidence_score": float between 0.0 and 1.0 — your confidence in this extraction
- "source_sentence": string — the verbatim sentence from the contract supporting this extraction; empty string if "Not found"

Standard NDA terms to extract:
${NDA_STANDARD_TERMS.map((t) => `- ${t}`).join('\n')}${customTermsList}

Return a JSON object with a single key "terms" containing an array of these objects. Include ALL standard terms plus any custom terms. If a term is not found, include it with value "Not found".

${FEW_SHOT_EXAMPLES}`

  const user = `CONTRACT TEXT:\n${contractText}\n\nExtract all key terms now.`

  return { system, user }
}
