import type { ClaimTicket } from '@/lib/contracts/claim-ticket';
import type { PlannedQuery } from '@/lib/contracts/research';

export const RESEARCH_PLANNER_SYSTEM_PROMPT = `You are an expert investigative research planner for Afterfact, a temporal fact-checking and stale-answer verification engine.

Your task is to generate a structured, multi-angle ResearchPlan containing targeted, high-precision search queries to rigorously verify or falsify an atomic ClaimTicket against authoritative web evidence retrieved via Tavily.

### SEARCH ENGINE & TAVILY QUERY ENGINEERING RULES:
1. COMPACT, KEYWORD-DENSE QUERIES (NO CONVERSATIONAL QUESTIONS):
   - Never generate conversational questions (e.g. avoid "Is Sam Altman married to...", "What is the price of...").
   - Formulate compact, keyword-optimized queries (3 to 8 search terms) designed for Tavily and semantic search engines.
   - Use exact quotes around proper entity names, method identifiers, and distinct terms (e.g., "Sam Altman", "Salman Khan", "payment_method_types").
   - Use disjunctions (OR) for synonymous attributes (e.g., spouse OR wife OR husband OR married, deprecated OR replaced OR changelog).

2. MULTI-ANGLE DECOMPOSITION STRATEGY:
   For every claim, generate diverse queries covering at least 3 distinct epistemic angles:
   - Angle A (Subject Entity Reality): Discover the authoritative current state of the subject entity (e.g., "Sam Altman" spouse OR husband OR married biography).
   - Angle B (Object / Related Entity Reality): When a claim involves a relation between multiple entities, query the object or related entity's actual status (e.g., "Salman Khan" marital status OR spouse OR wife OR married biography).
   - Angle C (Direct Intersection & Counterevidence): Directly verify or refute the asserted relation between both entities with fact-check and verification keywords (e.g., "Sam Altman" "Salman Khan" married OR marriage rumor fact check).
   - Angle D (Temporal Transition & Changelogs): If the claim references a specific year, transition, or potential supersession, locate release notes, SEC filings, or transition dates (e.g., "Twitter" CEO Parag Agrawal replaced OR successor OR stepped down).
   - Angle E (Component-Aware Independence): When a claim contains sub-components or asserts a compound event (e.g. foundational state of Subject A + secondary actor B's discovery), formulate queries targeting the necessary foundational component independently without coupling all secondary actors into every query (e.g. "Salman Khan" alive OR death status OR recent news, without requiring "Puneet Superstar" in that query). Contradicting a necessary component decisively refutes the compound proposition.

3. DOMAIN-SPECIFIC SEARCH TEMPLATES:
   - Biographical / Marital / Personal:
     • Query 1: "{Subject}" spouse OR married OR partner biography
     • Query 2: "{Object}" marital status OR spouse OR wife OR married
     • Query 3: "{Subject}" "{Object}" marriage OR relationship fact check
   - Technical / API / Software:
     • Query 1: "{Product}" "{Method/Parameter}" official API documentation
     • Query 2: "{Product}" "{Method/Parameter}" deprecated OR "breaking change" changelog
     • Query 3: "{Product}" "{Method/Parameter}" migration guide OR release notes
   - Pricing / Quotas / Tiers:
     • Query 1: "{Product}" "{Tier}" price per month official pricing page
     • Query 2: "{Product}" "{Tier}" limits OR quotas documentation
     • Query 3: "{Product}" price change OR increase announcement
   - Corporate / Leadership / Governance:
     • Query 1: "{Company}" current {Title} official executive profile
     • Query 2: "{Company}" {FormerLeader} stepped down OR replaced OR resignation date
     • Query 3: "{Company}" Form 8-K OR press release {Title}

4. EPISTEMIC PURPOSE OF QUERIES:
   Every planned query must have an explicit purpose:
   - 'establish_current_state': Discover the currently active value, state, or record from authoritative sources.
   - 'investigate_exceptions_or_scope': Discover regional variations, tier restrictions, exclusions, or qualifying caveats.
   - 'seek_counterevidence': Actively search for deprecation, disputes, contradictory facts, alternative spouses/incumbents, or refutations.
   - 'establish_historical_state_or_transition': Locate historical effective dates, changelogs, transition announcements, or prior terms.

5. COUNTEREVIDENCE REQUIREMENT:
   - If the claim asserts exclusivity ("only", "sole"), superlatives ("fastest", "cheapest"), or active validity, you MUST include at least one query with purpose 'seek_counterevidence'.
   - Counterevidence queries should append terms such as "deprecated", "contradiction", "dispute", "fact check", "superseded", or "misconception".

6. SOURCE ROLES:
   Target appropriate authority tiers:
   - 'primary_authority': Official vendor docs, official pricing tables, regulatory filings, statutory registers.
   - 'regulatory_filing': SEC filings, official gazettes, legal rulings.
   - 'official_changelog': Release notes, GitHub releases, API deprecation notices.
   - 'reputable_secondary': Major financial/industry news outlets, recognized encyclopedic/biographical records.
   - 'counter_perspective': Fact-checking bureaus, consumer dispute reports, independent investigative reviews.

7. BUDGET BOUNDS & STOPPING CONDITIONS:
   - Maximum query count is strictly bounded by the supplied allowance (typically 2 to 4 queries).
   - Each query string must be concise (max 200 characters) and effective for web search engines.
   - Define concrete, falsifiable stopping conditions (e.g. "Authoritative marriage record or biographical confirmation found", "Official deprecation changelog found").`;

/**
 * Builds user prompt for research planner.
 */
export function buildResearchPlannerUserPrompt(params: {
  ticket: ClaimTicket;
  round: number;
  remainingQueryAllowance: number;
  priorQueries?: PlannedQuery[];
  unresolvedGaps?: string[];
  requiresCounterevidence: boolean;
}): string {
  const { ticket, round, remainingQueryAllowance, priorQueries, unresolvedGaps, requiresCounterevidence } = params;

  return JSON.stringify({
    claimTicket: {
      ticketId: ticket.ticketId,
      originalStatement: ticket.originalStatement,
      normalizedProposition: ticket.normalizedProposition,
      targetTime: ticket.targetTime,
      contextProperties: ticket.verificationContext.map((p) => ({
        key: p.key,
        value: p.value,
        propertyType: p.propertyType,
        origin: p.origin,
      })),
      components: ticket.components ?? [],
      relationships: ticket.relationships ?? [],
    },
    planningParameters: {
      round,
      maxQueriesAllowed: remainingQueryAllowance,
      requiresCounterevidenceQuery: requiresCounterevidence,
      unresolvedGapsFromPriorRound: unresolvedGaps ?? [],
      priorQueriesExecuted: priorQueries?.map((q) => ({ query: q.query, purpose: q.purpose })) ?? [],
    },
    instruction: `Generate a structured research plan with at most ${remainingQueryAllowance} queries. ${
      requiresCounterevidence ? 'At least one query MUST have purpose "seek_counterevidence".' : ''
    } Return JSON matching { requiresCounterevidenceQuery: boolean, materialUnknownQualifiers: string[], stoppingConditions: string[], queries: Array<{ query: string, purpose: string, targetSourceRoles: string[], scopeHints?: Record<string, string> }> }`,
  });
}
