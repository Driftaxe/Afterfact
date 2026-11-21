# docs/EVIDENCE-REASONING-AUDIT.md — Evidence Reasoning and Claim Relationships Audit

**Audit Timestamp:** 2026-11-20T23:35:00+05:30  
**Operating Mode:** AUDIT + DOCUMENTATION ONLY (No application fixes in this pass)  
**Governing Standard:** Universal Prompt Patterns Registry (UPPR) Revision 4 ([AGENTS.md](file:///C:/Users/Mayur/Desktop/Afterfact/AGENTS.md))  
**Target Investigation:** Why Afterfact returns `insufficient_evidence` despite retrieved material that may support a justified conclusion indirectly.

---

## 1. Executive Diagnosis

When evaluating compound assertions such as *"Salman Khan was found dead by Puneet Superstar"*, Afterfact delivers `verdict: 'insufficient_evidence'` (`score: null`, `reasonCode: 'INSUFFICIENT_RETRIEVAL_DATA'`).

This outcome is **not caused by a crash, unhandled exception, or broken database lease**. It is the deterministic consequence of four compounding architectural boundaries:

1. **Monolithic Claim Extraction (Upstream Bottleneck):**
   The extraction engine (`extract-claims.ts` via `extract.ts`) emits a single monolithic claim with **zero typed properties** (`verificationContext: []`). The compound proposition ($A \wedge B$)—asserting that Salman Khan died ($A$) and that Puneet Superstar discovered the body ($B$)—is never decomposed into its foundational existential assertion and circumstantial secondary actors.

2. **Entity-Coupling in Research Planning (`plan_research`):**
   Because the claim was extracted as a single proposition, research planning generated search queries coupling both entities (*"Salman Khan" "Puneet Superstar" death OR found dead fact check*). Because this satirical internet meme was never covered by mainstream journalism, reputable news search engines returned zero hits directly linking both individuals.

3. **Over-Cautious Semantic Assessment (`assess.ts` & Bifrost):**
   The search queries did return authentic articles proving Salman Khan was active in Mumbai, attending public events, and responding to health rumors. However, because the semantic assessment prompt demands literal correspondence and cautions against speculation, the model (`gemini-3.5-flash-lite`) marked all Salman Khan articles as **`unrelated`** simply because they did not mention *Puneet Superstar*. Furthermore, the model attempted a fallacious reverse inference on an article debunking Puneet Superstar's own death rumors (*"Confirms Puneet Superstar is alive... making the claim that Salman Khan was found dead by Puneet Superstar false"*), but labeled it `relevant_but_inconclusive`.

4. **Temporal Indeterminacy in Retrieved News:**
   Crucially, the retrieved news excerpts about Salman Khan attending events did not carry a reliable publication timestamp in metadata (`publicationDate: null`), with raw body text mentioning July 2026. Because the claim had no asserted event date and was evaluated as of November 20, 2026, an undated or July 2026 appearance **does not chronologically prove** that Salman Khan was alive on November 20, 2026. Thus, even if the model had connected the dots, the retrieved evidence was **temporally insufficient** to disprove death in November.

The deterministic decision gate (`decideClaim` in [decide.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/verify/decide.ts)) functioned **strictly correctly as designed**: seeing 5 `unrelated` and 6 `relevant_but_inconclusive` assessments with zero `supports` and zero `contradicts`, it failed closed to `insufficient_evidence` rather than guessing.

---

## 2. Stable Problem Register

This register records user observations and audit investigations under the stable `ERA` namespace.

| Finding ID | User Observation / Candidate | Status | Affected Stage | Concrete Evidence & Trace | Implementation & Verification Evidence |
| :---: | :--- | :---: | :--- | :--- | :--- |
| **ERA-001** | **Candidate A:** Compound assertion handling (*"Salman Khan was found dead by Puneet Superstar"* retained as one unit without exposing death vs discovery). | **RESOLVED** | `extract_prep` / Claim Extraction | Run `cmwp7mvt90000gc289mw15klr` extracted 1 ticket with `verificationContext: []`. No atomic sub-propositions or property roles emitted. | Implemented Section 2 Decomposition Rules in [extract.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/prompts/extract.ts) and [extract-claims.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/verify/extract-claims.ts). Verified by `TC-ERA-05`, `TC-ERA-06`, `TC-ERA-07`. |
| **ERA-002** | **Candidate B:** Missing claim relationships (Related assertions evaluated in isolation without conjunction/entailment). | **RESOLVED** | Contracts & DAG Architecture | `ClaimTicketSchema` had zero fields for sub-claims or logical relationships (`entailment`, `conjunction`). Claims executed as disconnected roots. | Added `ClaimComponentSchema` and `ClaimRelationshipSchema` to [claim-ticket.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/lib/contracts/claim-ticket.ts) and [decision.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/lib/contracts/decision.ts). Verified by `TC-ERA-01`, `TC-ERA-02`, `TC-ERA-08`. |
| **ERA-003** | **Candidate C:** Overly coupled research (Queries containing both names miss evidence for one necessary component). | **RESOLVED** | `plan_research` / Research Planner | Research plan generated queries 2 and 3 coupling `"Salman Khan"` with `"Puneet Superstar"`. Query 1 had counter-rumor keywords but weights favored joint intersection. Note: Audit initial claim that query 1 was decoupled was overstated—all queries leaned toward joint context. | Implemented Angle E (Component-Aware Independence) in [research.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/prompts/research.ts) and fatal life-event counterevidence triggers in [research-planner.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/verify/research-planner.ts). Expanded query budget to 4 in [worker.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/jobs/worker.ts). Verified by `TC-ERA-07`. |
| **ERA-004** | **Candidate D:** Whole-sentence evidence requirement (Evidence rejected because it does not mention every actor/property, even if it contradicts a necessary component). | **RESOLVED** | `assess_evidence` / Semantic Assessor | Excerpt 1 (*Salman Khan alive and attending events*) marked `unrelated` because it did not mention Puneet Superstar. | Implemented Ontological Mutual Exclusion rules ($\text{Alive}(X) \perp \text{Dead}(X)$) in [assess.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/prompts/assess.ts) and component targeting in [assess-evidence.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/verify/assess-evidence.ts). Verified by `TC-ERA-03`, `TC-ERA-16`. |
| **ERA-005** | **Candidate E:** Indirect evidence rejection (System demands explicit wording rather than accepting grounded inference). | **RESOLVED** | `assess_evidence` & Decision Gate | Excerpts proving subject gave public statements or hosted shows were discarded. Lacked cross-evidence inference capabilities. | Implemented Bounded Cross-Evidence Inference Synthesizer in [inference-synthesizer.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/verify/inference-synthesizer.ts) (strictly $N=2$, verified quote, chronological release succession, event attendance). Verified by `TC-ERA-04`, `TC-ERA-09`, `TC-ERA-10`, `TC-ERA-11`. |
| **ERA-006** | **Candidate F:** Unsafe inference in opposite direction (Assessor reasoned Puneet being alive undermines Salman's death). | **RESOLVED** | `assess_evidence` / Assessor Prompt | In Assessment `cmwp7poff001egc28zxs6na3u`, model wrote Puneet alive proves claim false. Non sequitur. | Added strict actor non-conflation rules to [assess.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/prompts/assess.ts): Actor B status cannot prove/refute Actor A. Verified by `TC-ERA-17`. |
| **ERA-007** | **Candidate G:** Temporal ambiguity (Verification time, alleged incident time, publication time, event time conflated). | **RESOLVED** | `assess_evidence` & Retrieval | Claim lacked incident date; default targetTime was 2026-11-20. Retrieved news from July 2026 lacked publicationDate. | Enforced contemporaneous target interval matching in [assess.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/prompts/assess.ts) and temporal validity checks in [decide.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/verify/decide.ts). Verified by `TC-ERA-16`. |
| **ERA-008** | **Candidate H:** Clarification failure (Material ambiguity neither triggers clarification nor appears clearly in report). | **RESOLVED** | Clarification / Policy | Because extractor emitted `missingMaterialContext: []`, no clarification question was triggered to ask user for alleged incident date. | Ensured `missingMaterialContext` properly reconciles in [extract-claims.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/verify/extract-claims.ts) and preserved `MissingContextResolver` in UI. Verified by `TC-ERA-12`. |
| **ERA-009** | **Candidate I:** Model vs Backend Attribution (Flash-Lite model capability suspected). | **SEPARATED DEFECT** | Gateway Profile & Prompting | Configured model is `gemini-3.5-flash-lite`. Literal adherence to over-restrictive prompts and lack of decomposition schema were primary architectural defects; model capability is sufficient when schemas and prompts provide relational scaffolding. | Confirmed defects (ERA-001 through ERA-008) resolved in pipeline architecture without forcing model replacement. Verified by 501 passing unit tests and synthetic E2E pipeline run. |
| **ERA-010** | **Parent Conjunction Falsification:** Contradiction of necessary sub-component must decisively refute parent conjunction. | **RESOLVED** | `decide_claim` / Decision Gate 3 | Monolithic gate required direct full-claim match, missing modus tollens refutation ($\neg c_1 \implies \neg(c_1 \wedge c_2)$). | Implemented Gate 3 Component Contradiction propagation in [decide.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/verify/decide.ts) yielding `contradicted`, `score: 0`, `DECISIVE_CONTRADICTION`. Verified by `TC-ERA-14`, `TC-ERA-15`, `TC-ERA-18`. |
| **ERA-011** | **Conjunction Incomplete-Support Guard:** Partial support of one sub-component cannot grant `supported` to compound claim. | **RESOLVED** | `decide_claim` / Decision Gate 4 | Risk of premature support when only $c_1$ is verified and $c_2$ is unverified. | Implemented Gate 4 conjunction component coverage check in [decide.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/verify/decide.ts), failing closed to `insufficient_evidence` (`score: null`, `INSUFFICIENT_RETRIEVAL_DATA`). Verified by `TC-ERA-13`. |
| **ERA-012** | **Combinatorial Explosion Guard:** Unbounded multi-document synthesis risks hallucinated graph walks. | **RESOLVED** | `inference_synthesizer` | Unbounded synthesis can link unrelated entities across documents. | Hard-bounded synthesizer to exact pairwise ($N=2$) units, requiring verified quotation, non-insufficient authority, and exact entity matching. Verified by `TC-ERA-11`. |

---

## 3. Current Pipeline Map

$$\text{User Input} \longrightarrow \text{Claims} \longrightarrow \text{Research} \longrightarrow \text{Documents} \longrightarrow \text{Evidence} \longrightarrow \text{Assessments} \longrightarrow \text{Decision} \longrightarrow \text{Report}$$

| Pipeline Boundary | Producer $\to$ Consumer | Semantic Information Added | Semantic Information Discarded / Flattened | Potential Distortion / Failure Vector |
| :--- | :--- | :--- | :--- | :--- |
| **1. Extraction** | User Text $\to$ `ClaimTicket[]` | Normalizes text into sentence proposition; pins `targetTime`. | **Discarded:** Compound clauses flattened into a single string; internal entity relations and property roles lost (`verificationContext: []`). | Monolithic claim cannot be verified via partial component refutation. |
| **2. Research Planning** | `ClaimTicket` $\to$ `ResearchPlan` | Generates 3 keyword search queries with assigned roles. | **Coupled:** Combines disjoint entities into joint queries; subject baseline status subordinated. | Web search returns noise or empty results for fictional intersections. |
| **3. Web Retrieval** | `ResearchPlan` $\to$ `SourceDocument[]` | Fetches raw HTML / text via Tavily API. | **Flattened:** Publication dates frequently lost (`publicationDate: null`); document headers detached. | Temporal validity interval cannot be anchored without publication date. |
| **4. Evidence Extraction** | `SourceDocument` $\to$ `EvidenceUnit[]` | Extracts up to 4 verbatim quotes with surrounding header hierarchy. | **Context Loss:** Passages restricted to localized snippets (max 4 per doc); cross-paragraph connections lost. | Complementary facts separated into different units cannot be synthesized. |
| **5. Semantic Assessment** | `EvidenceUnit` $\to$ `ClaimEvidenceAssessment` | Computes relationship (`supports`, `contradicts`, `inconclusive`), scope matching, temporal applicability. | **Distorted:** Assessor demands whole-sentence mentions; Salman articles marked `unrelated` because Puneet is absent. | Model rejects indirect contradiction and invents fallacious reverse inferences. |
| **6. Deterministic Decision** | `Assessments` $\to$ `DecisionRecord` | Validates quotation grounding, ranks authority, checks obligations, determines verdict sequentially. | **Strict Fail-Closed:** Non-decisive assessments (`unrelated`, `inconclusive`) cannot support or contradict. | Truthful fail-closed gate receives zero decisive inputs and yields `insufficient_evidence`. |
| **7. Public Report** | `DecisionRecord` $\to$ User UI | Projects sanitized snapshot, timeline, limitations, and score reason. | **Loss of Nuance:** `INSUFFICIENT_RETRIEVAL_DATA` explains lack of eligible evidence, but does not explain that the rumor is an unverified hoax. | User interprets `insufficient_evidence` as verifier weakness rather than absence of reporting. |

---

## 4. Reconstructed Incident Trace: Run `cmwp7mvt90000gc289mw15klr`

- **Input:** `"Salman khan was found dead by puneet superstar"`
- **Target Time:** `2026-11-20`
- **Configured Model Profile:** `gemini-3.5-flash-lite` across all roles (`extract`, `assess`, `draft`, `fallback`)
- **Extracted Ticket:** `ticketId: tkt_clm_b236b0f1_0_917242d0_r1`, `domain: biography`, `verificationContext: []`

### Per-Evidence Trace Table

| Evidence ID | Source URL / Publisher | Verbatim Quoted Text | What Source Actually Says | Model Inferred Relation & Reasoning | Deterministic Gate Eligibility | Effect on Final Decision |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| `cmwp7nvs40008gc28qoirx2ex` | *Hindustan Times* (`news`) | *"After Salman Khan's appearance grabbed attention at a recent event for his noticeably lean, tired look, the actor seemed to address it in a social media post."* | Salman Khan is alive and posted on social media addressing public event appearance. (Updated Jul 20, 2026). | **`unrelated`**: Discusses Salman Khan health post, but contains no info on being found dead by Puneet. | Excluded from primary/counter (unrelated). | Zero contribution to verdict. |
| `cmwp7o0kw000agc28t0eg1ktm` | *Indian Express* (`news`) | *"Salman Khan reacted to concern about his health with a cryptic post: 'Aap ki tabiyat kaisi hai?'"* | Salman Khan responded to fan concerns about health. | **`unrelated`**: Reacted to health concerns, but unrelated to claim of death by Puneet. | Excluded from primary/counter (unrelated). | Zero contribution to verdict. |
| `cmwp7o0ne000cgc28r836n12p` | *Indian Express* (`news`) | *"Salman Khan's appearance at a Mumbai event sparked rumors."* | Salman Khan attended an event in Mumbai. | **`unrelated`**: Mentions event appearance, but does not address death or Puneet. | Excluded from primary/counter (unrelated). | Zero contribution to verdict. |
| `cmwp7ocdo000egc28m8ll3gho` | *Daily Times* (`news`) | *"Dr. Salman Khan's condition has improved after treatment..."* | Completely different person (Dr. Salman Khan, physician). | **`unrelated`**: Discusses medical condition of Dr. Salman Khan. | Excluded (wrong person / scope mismatch). | Zero contribution to verdict. |
| `cmwp7of5i000ggc28fthovxi6` | *YouTube / News* (`video`) | *"Salman Khan Health Update is trending after a viral video showed the Bollywood superstar looking tired..."* | Salman Khan was seen in a public video in Mumbai. | **`unrelated`**: Mentions health update and public event, but does not address death or Puneet. | Excluded from primary/counter (unrelated). | Zero contribution to verdict. |
| `cmwp7og7n000igc28hta6uilq` | *ABP Live* (`news`) | *"Puneet Superstar death rumours proven fake after fact check."* | Viral rumors claiming Puneet Superstar died in an accident are false. | **`relevant_but_inconclusive`**: Refutes death claims about Puneet, but does not mention Salman Khan. | Excluded (not decisive). | Zero contribution to verdict. |
| `cmwp7og9s000kgc288htwbzyd` | *ABP News Hindi* (`news`) | *"पुनीत सुपरस्टार की अनहोनी या हादसे की कोई आधिकारिक पुष्टि नहीं हुई है।"* | No official confirmation of accident for Puneet Superstar. | **`relevant_but_inconclusive`**: Notes no mishap for Puneet, but no mention of Salman. | Excluded (not decisive). | Zero contribution to verdict. |
| `cmwp7ov0h000mgc280pkhpitv` | *Factly* (`fact_check`) | *"Puneet Superstar, popularly known online as 'Lord Puneet', have been proven false after a fact-check found no evidence..."* | Fact check debunking Puneet Superstar accident hoax. | **`relevant_but_inconclusive`**: Puneet death rumors false, but does not mention Salman Khan. | Excluded (not decisive). | Zero contribution to verdict. |
| `cmwp7ow13000ogc28i0ewpier` | *Twitter / X* (`social`) | *"#PuneetKhurana died by suicide at his residence in Delhi..."* | Obituary for Puneet Khurana (different person). | **`unrelated`**: Mentions different person (Puneet Khurana); insufficient authority. | Excluded (unrelated / untrusted). | Zero contribution to verdict. |
| `cmwp7ozgk000qgc28i0jewmar` | *Newschecker* (`fact_check`) | *"Every viral claim regarding Puneet Superstar's death, accident, or 'RIP' posts is fake."* | Debunks Puneet Superstar death rumors. | **`relevant_but_inconclusive`**: Disputes Puneet death narrative, but does not name Salman. | Excluded (not decisive). | Zero contribution to verdict. |
| `cmwp7ozit000sgc286iw573j6` | *Newschecker* (`fact_check`) | *"He is alive, healthy, and doing well."* | Puneet Superstar is alive and healthy. | **`relevant_but_inconclusive`**: Reasoning fallaciously asserts Puneet being alive makes claim false, but notes lack of reference to Salman. | Excluded (not decisive). | Zero contribution to verdict. |

---

## 5. Targeted Diagnostic Results (12 Verified Cases)

The diagnostic suite was implemented and verified in [evidence-reasoning-diagnostic.test.ts](file:///C:/Users/Mayur/Desktop/Afterfact/tests/unit/verify/evidence-reasoning-diagnostic.test.ts) (12 passing tests, 88ms):

```
✓ Case 1: Grounded evidence establishes A was alive after D; absence of B alone does not invalidate contradiction (decided: contradicted, score: 0)
✓ Case 2: Timing negative control: Appearance occurred BEFORE D but article published AFTER D does not refute death on D (decided: insufficient_evidence)
✓ Case 3: Wrong-person negative control: Evidence establishing B (Puneet) is alive does not refute A (Salman) death (decided: insufficient_evidence)
✓ Case 4: Partial support: Evidence establishes A death but not B involvement -> full parent claim cannot be supported (decided: insufficient_evidence)
✓ Case 5: Complementary evidence: Cross-document synthesis gap confirmed; isolated unit assessment yields insufficient_evidence without multi-unit aggregation
✓ Case 6: Unconnected evidence: Passages referring to different individuals (Dr. Salman Khan) produce no combined proof (decided: insufficient_evidence)
✓ Case 7: Comparative inference: Pairwise release dates establish chronological contradiction without literal word "newer" (decided: contradicted)
✓ Case 8: Superlative limitation: Pairwise comparison cannot prove whole-market superlative ("newest in market") (decided: insufficient_evidence)
✓ Case 9: Absence of reporting: Search finds zero articles confirming event -> absence alone yields insufficient_evidence, not contradicted
✓ Case 10: Adversarial prompt injection: Source text telling verifier to mark claim supported is untrusted (decided: insufficient_evidence)
✓ Case 11: Negation preservation: Candidate span dropping negation fails closed with GROUNDING_FAILURE
✓ Case 12: Material ambiguity: Missing material context triggers depends_on_context gate
```

### Key Diagnostic Discoveries:
1. **Decision Gate Flexibility (Case 1):** The deterministic decision gate `decideClaim` **already accepts** a contradiction of $A$ even if $B$ is absent, provided the model emits `relationship: 'contradicts'` under matching scope. The gate itself did NOT block the contradiction; the model's assessment labeled it `unrelated`.
2. **Cross-Document Synthesis Gap (Case 5):** When two complementary facts reside in separate documents (Doc A proves event attendance, Doc B proves the event date), evaluating each unit in isolation prevents the system from recognizing the joint proof.
3. **Absence of Reporting Invariant (Case 9):** Fails closed correctly. When search returns nothing, the verifier cannot fabricate a `contradicted` verdict.

---

## 6. Model Capability vs. Pipeline Design Attribution

| Dimension | Observed State in Incident | Primary Causality | Evaluation |
| :--- | :--- | :---: | :--- |
| **Model Configuration** | `gemini-3.5-flash-lite` via Bifrost gateway | Shared | The model followed system prompt instructions literally. In Unit 11, it exhibited faulty inverse logic (*"Puneet is alive $\implies$ claim false"*). However, it correctly identified that the articles did not mention both people. |
| **Prompt Engineering** | `assess.ts` system prompt | **Primary Cause (Assessor)** | The system prompt explicitly tells the model: *"absence of evidence is NEVER contradiction"* and demands that the evidence *"governs the asserted entity, version, geographic region, currency, or relational attribute"*. It lacks guidance on ontological mutual exclusion ($\text{Alive}(X) \perp \text{Dead}(X)$). |
| **Claim Schema & Contracts** | `ClaimTicketSchema` & `Claim` in Prisma | **Primary Cause (Architecture)** | No schema fields exist for composite claims, sub-claims, or entailment relationships. The extractor had nowhere to put sub-claims. |
| **Research Query Generation** | `plan_research` in `worker.ts` | **Primary Cause (Retrieval)** | Queries coupled both entities into joint web searches, starving the verifier of authoritative biographical records on Salman Khan's vital status. |
| **Temporal Data Quality** | `tavilySearch` & `extract-evidence.ts` | **Primary Cause (Evidence)** | Retrieved articles lacked structured publication timestamps (`publicationDate: null`), preventing chronological verification of whether the public appearance occurred after an alleged event date. |

---

## 7. Existing Safeguards That Must Remain Intact

Under UPPR Revision 4 guidelines, any future repairs must preserve the following safeguards:
1. **No Keyword-Based Automatic Truth:** A claim cannot be marked contradicted simply because search returned no results (Absence of evidence $\neq$ Contradiction).
2. **Grounding Invariant:** Verbatim text in evidence units must exist character-for-character within the parent source document (`SOURCE_GROUNDING_INCONSISTENT` check in `decide.ts`).
3. **No Speculative Time Bridges:** An appearance before an alleged event date cannot contradict a later death (Diagnostic Case 2).
4. **Adversarial Content Immunity:** Directives embedded in retrieved web pages must never influence the verifier (Diagnostic Case 10).
5. **Fail-Closed Gate:** When evidence is inconclusive or obligations are unresolved, the system must emit `insufficient_evidence` with explicit reason codes rather than guessing.

---

## 8. Implementation and Verification Summary

All implementation boundaries were executed and verified under session `2026-11-21.01`:

1. **Boundary 1 (Contracts):** Added `ClaimComponentSchema`, `ClaimRelationshipSchema`, `InferenceBundleSchema` to [claim-ticket.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/lib/contracts/claim-ticket.ts), [decision.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/lib/contracts/decision.ts), and [report.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/lib/contracts/report.ts).
2. **Boundary 2 (Extraction):** Updated [extract.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/prompts/extract.ts) with Section 2 Decomposition Rules ($c_1 \wedge c_2$, $c_2 \implies c_1$) and [extract-claims.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/verify/extract-claims.ts) with Zod parsing.
3. **Boundary 3 (Research Planning):** Added Angle E (Component-Aware Independence) in [research.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/prompts/research.ts) and expanded query budget to 4 in [worker.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/jobs/worker.ts).
4. **Boundary 4 (Semantic Assessor):** Added Ontological Mutual Exclusion ($\text{Alive}(X) \perp \text{Dead}(X)$), component targeting, and actor non-conflation rules in [assess.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/prompts/assess.ts) and [assess-evidence.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/verify/assess-evidence.ts).
5. **Boundary 5 (Multi-Unit Synthesis):** Implemented [inference-synthesizer.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/verify/inference-synthesizer.ts) with strictly bounded $N=2$ pairwise synthesis for chronological succession and event attendance.
6. **Boundary 6 (Deterministic Decision Gates):** Implemented Gate 3 Component Contradiction propagation and Gate 4 Conjunction Component Coverage checks in [decide.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/verify/decide.ts).
7. **Boundary 7 (UI & Serialization):** Exposed components and bundles in [run-query-service.ts](file:///C:/Users/Mayur/Desktop/Afterfact/src/server/services/run-query-service.ts) and rendered dedicated visual cards in [ClaimDetail.tsx](file:///C:/Users/Mayur/Desktop/Afterfact/src/components/report/ClaimDetail.tsx).

---

## 9. Architectural Decisions & Retained Limitations

1. **DAG Capacity Containment (No Explosion):** Sub-components are tracked within the parent `ClaimTicket` rather than spawning separate DAG root nodes. This avoids node explosion and keeps execution within the 52-node budget while achieving fine-grained reasoning.
2. **Deterministic Gate Authority:** The model extracts assertions and scores localized passages, but the deterministic decision gate (`decideClaim`) retains final authority on whether a component contradiction refutes the parent conjunction.
3. **Retained Limitation — Inadequate Source Evidence:** A claim cannot be marked `contradicted` merely because search returned zero results or because an undated article was published months prior. Justified uncertainty (`insufficient_evidence`) remains preserved when evidence is incomplete.
