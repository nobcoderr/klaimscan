# KLAIMSCAN AI — Evidence and Evaluation Method

This document describes the current implementation and its limits. Automated tests verify code paths and safeguards; they do not establish real-world fact-checking accuracy.

## Retrieval and evidence selection

`src/lib/pipeline/evidence-retriever.ts` makes three separate OpenAI web-search requests in the initial pass: exact claim, entity/event, and primary-source discovery. Google Fact Check is queried separately with up to two text queries. If all initial web searches return no candidates, one contradiction-search fallback may run.

After the first claim-to-evidence comparison, the orchestrator runs up to three additional, separate searches only when no evidence aligns with the claim or no aligned primary-source candidate was identified. The total is bounded by the pipeline deadline; a search or comparison that cannot fit the remaining budget is skipped, with a warning. A source's domain alone does not establish relevance or source nature.

Candidate selection deduplicates sanitized URLs and distributes up to eight initial and four supplemental candidates across publisher roots and source tiers. This improves coverage within the 12-source comparison limit; it does not certify source independence.

## Provenance and verdict safeguards

- Search summaries are not passed to the evidence comparator. Only individually cited candidate metadata and excerpts are available there.
- OpenAI search excerpts are labeled `ai_search_summary`; Google Fact Check entries are labeled `fact_check_api_metadata`; URL-only candidates are explicitly marked. None means the original article was fetched or read directly.
- A single AI search summary classified as a primary record, research, institutional data, or direct statement cannot independently establish `TRUE` or `FALSE`. The verdict engine requires directly inspected source content for a single decisive primary source, or at least two aligned, non-public, independently classified sources after publisher deduplication.
- The application does not currently fetch article pages, so it does not produce `direct_source_content` evidence. A lone primary-source search summary therefore remains insufficient for a decisive verdict. Direct fetching is deferred until a safe redirect/DNS/response-size boundary can be implemented.
- `sourceTier` is a host classification, not a numeric truth score. Verdict weights are based on `evidenceNature` (primary record/original research/institutional data: 2.5; direct statement/fact check/independent reporting: 1.5; commentary: 0.75; unknown: 1). These weights do not replace claim alignment.
- `publishedAt` is reserved for verified publication metadata; URL-derived dates remain inferred, and event dates remain separate. Search summaries are not treated as verified publication metadata.
- Insufficient, irrelevant, conflicting, or uncorroborated evidence must not be upgraded to a definitive verdict. `UNVERIFIED` remains the conservative outcome.

## Automated evaluation

The unit and E2E suites cover input sanitization, OCR/text-first extraction, source URL safety, source classification, temporal context, claim/evidence alignment, verdict aggregation, and UI/API behavior. Relevant test files include:

- `tests/unit/evidence-retriever.test.ts`
- `tests/unit/evidence-comparator.test.ts`
- `tests/unit/verdict-engine.test.ts`
- `tests/unit/orchestrator.test.ts`
- `tests/unit/regression-cases.test.ts`
- `tests/e2e/dashboard.spec.ts`

Run the available checks from the repository root:

```text
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

Passing mocked or synthetic tests demonstrates implementation behavior only. It is not a measurement of retrieval recall, citation validity on live pages, verdict precision/recall, or unseen-story generalization.

## Evaluation status and limitations

- There is no separate, human-reviewed, held-out dataset of 60 or more diverse stories in this repository. No benchmark accuracy, precision, recall, false-positive rate, abstention rate, unseen-story score, API cost-per-analysis, or live latency metric is claimed.
- Source relevance, evidence nature, and independence still depend partly on model comparison of search-provided excerpts. Those excerpts may be incomplete or inaccurate; the original page is not independently fetched.
- Search results may omit new, local, paywalled, unindexed, or non-web evidence. Time-bounded supplemental search can be skipped under load or deadline pressure.
- API smoke tests require configured service credentials and must be run separately from mocked tests. No live result should be reported unless it was actually observed.

For a defensible accuracy claim, create a separately maintained development set and a held-out set with human-reviewed atomic claims and evidence labels; record retrieval recall, citation reachability, alignment accuracy, verdict confusion matrices, abstention, latency, and API cost. Keep held-out labels out of production rules and tune decisions only on the development set.
