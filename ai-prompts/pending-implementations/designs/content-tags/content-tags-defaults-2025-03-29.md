**Strategy: Multi-Level Default Tag Sets**

Instead of just flat lists, let's structure the default tags into hierarchical or thematic sets that users can selectively import. This allows for better organization and relevance.

**1. Foundational/Universal Sets (Most users might want these):**

*   **Set Name:** `workflow_status`
    *   **Description:** General tags for tracking the status of research items.
    *   **Tags:** `To Read`, `Reading`, `Read - Important`, `Read - Skimmed`, `Needs Review`, `Needs Summarization`, `Needs Fact-Checking`, `Cited`, `To Include in Draft`, `Requires Follow-up`, `Key Evidence`, `Contradictory Evidence`, `Archived`, `Discarded` (Colors: Grays, Blues, Greens, Reds, Oranges, Purples)
*   **Set Name:** `content_type_general`
    *   **Description:** Common types of digital content.
    *   **Tags:** `Article`, `Blog Post`, `News Report`, `Web Page`, `Book Chapter`, `PDF Document`, `Presentation Slides`, `Image`, `Video`, `Audio Recording`, `Dataset`, `Code Snippet`, `Forum Post`, `Social Media Post`, `Email Thread`, `Meeting Notes` (Colors: Various distinct colors)
*   **Set Name:** `source_credibility`
    *   **Description:** Tags indicating the general reliability or type of source.
    *   **Tags:** `Peer-Reviewed`, `Preprint`, `Government Source`, `Industry Report`, `Reputable News Outlet`, `Established Blog`, `Expert Opinion`, `Primary Source`, `Secondary Source`, `Tertiary Source`, `Caution - Potential Bias`, `Unverified Source`, `User Generated Content` (Colors: Greens for high, Yellows for medium/preprint, Blues for official, Oranges/Reds for caution)
*   **Set Name:** `personal_assessment`
    *   **Description:** Tags for personal evaluation and prioritization.
    *   **Tags:** `Crucial`, `High Priority`, `Medium Priority`, `Low Priority`, `Interesting`, `Review Later`, `Key Insight`, `Potential Counterargument`, `Needs Deeper Dive`, `Questionable Claim` (Colors: Reds, Oranges, Yellows, Blues, Grays, Purples)

**2. Domain-Specific Sets (Users import based on their field):**

*   **Set Name:** `academic_research_methods`
    *   **Description:** Common methodologies used in academic research.
    *   **Tags:** `Literature Review`, `Systematic Review`, `Meta-Analysis`, `Qualitative Research`, `Quantitative Research`, `Mixed Methods`, `Case Study`, `Ethnography`, `Grounded Theory`, `Survey Research`, `Experimental Design`, `Quasi-Experimental`, `Longitudinal Study`, `Cross-Sectional Study`, `Theoretical Framework`, `Simulation/Modeling` (Colors: Blues, Teals, Greens)
*   **Set Name:** `legal_research`
    *   **Description:** Tags specific to legal document analysis and case research.
    *   **Tags:** `Case Law`, `Statute`, `Regulation`, `Constitution`, `Treaty`, `Plaintiff Filing`, `Defendant Filing`, `Motion`, `Order`, `Judgment`, `Discovery Document`, `Deposition Transcript`, `Expert Witness Report`, `Legal Brief`, `Law Review Article`, `Binding Precedent`, `Persuasive Authority`, `Jurisdiction: Federal`, `Jurisdiction: State`, `Jurisdiction: [Specific State/Circuit]`, `Issue: [Specific Legal Issue]`, `Holding`, `Dicta` (Colors: Reds, Blues, Purples, Grays)
*   **Set Name:** `medical_clinical_research`
    *   **Description:** Tags for medical literature, clinical trials, and healthcare research.
    *   **Tags:** `Clinical Trial - Phase 1`, `Clinical Trial - Phase 2`, `Clinical Trial - Phase 3`, `Clinical Trial - Phase 4`, `Randomized Controlled Trial (RCT)`, `Observational Study`, `Cohort Study`, `Case-Control Study`, `Cross-Sectional Study`, `Diagnostic Study`, `Prognostic Study`, `Treatment Guideline`, `Systematic Review (Medical)`, `Meta-Analysis (Medical)`, `Patient Data`, `Imaging Study`, `Lab Result`, `Drug Information`, `Medical Device`, `Public Health Report`, `Epidemiology` (Colors: Greens, Blues, Cyans, Pinks)
*   **Set Name:** `pharmaceutical_research`
    *   **Description:** Tags relevant to drug discovery, development, and regulation.
    *   **Tags:** `Drug Discovery`, `Preclinical Study`, `Pharmacokinetics (PK)`, `Pharmacodynamics (PD)`, `Toxicology`, `Clinical Trial Data`, `Regulatory Submission (FDA)`, `Regulatory Submission (EMA)`, `Manufacturing Process`, `Patent Application`, `Competitor Drug`, `Mechanism of Action (MOA)`, `Target Identification`, `Biomarker`, `Adverse Event Report` (Colors: Teals, Blues, Oranges, Violets)
*   **Set Name:** `financial_market_analysis`
    *   **Description:** Tags for financial research, market analysis, and investment.
    *   **Tags:** `Market Report`, `Equity Research`, `Fixed Income Analysis`, `Economic Forecast`, `Company Filing (SEC)`, `Earnings Transcript`, `Analyst Note`, `Investment Thesis`, `Risk Assessment`, `Valuation Model`, `Technical Analysis`, `Fundamental Analysis`, `Macroeconomic Trend`, `Industry Analysis`, `Commodity Data`, `Currency Exchange` (Colors: Greens, Blues, Grays, Ambers)
*   **Set Name:** `business_intelligence_strategy`
    *   **Description:** Tags for market research, competitive analysis, and strategic planning.
    *   **Tags:** `Market Research Report`, `Competitor Profile`, `SWOT Analysis`, `PESTLE Analysis`, `Industry Trend`, `Consumer Survey`, `Focus Group Results`, `Sales Data`, `Marketing Campaign Analysis`, `Product Roadmap`, `Strategic Partnership`, `M&A Target`, `Customer Feedback`, `Pricing Analysis` (Colors: Indigos, Blues, Limes, Oranges)
*   **Set Name:** `engineering_technical_docs`
    *   **Description:** Tags for software engineering, hardware design, and technical documentation.
    *   **Tags:** `System Architecture`, `API Documentation`, `Code Review`, `Bug Report`, `Performance Benchmark`, `Technical Specification`, `Design Pattern`, `Algorithm Analysis`, `Hardware Schematic`, `Datasheet`, `Test Plan`, `User Manual`, `Security Audit` (Colors: Slates, Cyans, Greens, Yellows)

**3. AI-Generated Tag Suggestions (Potential Future Set):**

*   **Set Name:** `ai_suggested_concepts`
    *   **Description:** Tags automatically extracted by AI identifying key concepts.
    *   **Tags:** *(These would be dynamically generated per source, but the *set* indicates their origin)* Examples: `Concept: Natural Language Processing`, `Entity: OpenAI`, `Topic: Large Language Models` (Color: A specific color like Pink or Fuchsia to denote AI generation)

**Implementation Considerations:**

1.  **Seed Script (`prisma/seed.ts`):** This is where you'll define the `DefaultTagSet` records and loop through the corresponding tag lists to create the `DefaultTag` records using `prisma.defaultTagSet.upsert` and `prisma.defaultTag.upsert`. Make this script robust and idempotent.
2.  **Admin UI:** Create an interface for SuperAdmins to view, create, edit, activate/deactivate `DefaultTagSet`s and manage the `DefaultTag`s within them.
3.  **Tenant Import UI:** In the tenant settings (likely under a "Tags" or "Organization" section), provide an interface to:
    *   List available, active `DefaultTagSet`s (fetched via a new API endpoint).
    *   Allow tenants to select one or more sets to import.
    *   Include a preview of the tags within a selected set.
    *   A button to trigger the import process (calling the NestJS `POST /api/app/:tenantId/tags/import-defaults` endpoint).
4.  **NestJS `DefaultTagService`:** Implement the `importDefaultTags` logic as described previously, ensuring it correctly uses `prisma.contentTag.upsert` to add tags to the specific tenant's scope without creating duplicates if they already exist by name within that tenant.

**Refined Actionable Steps (Tag Seeding & Import):**

*(These steps integrate into the previous plan, likely after Phase 1)*

**Phase 1.B: Implement Default Tag System**

**Step 1.B.1: Define Default Tag Data**
    *   **Action:** In a suitable location (e.g., `rko-backend/src/tags/data/default-tag-sets.ts`), define the structured data for the default tag sets and their tags (like the categorized lists above). Export this data.
    *   **Context:** Creates the source content for seeding.

**Step 1.B.2: Implement Seed Logic**
    *   **Action:** Open `prisma/seed.ts`. Import the default tag data.
    *   **Action:** Implement/Update the `seedDefaultTags(prisma)` function. Loop through the defined sets and tags, using `prisma.defaultTagSet.upsert` and `prisma.defaultTag.upsert` to populate the database idempotently.
    *   **Action:** Ensure the main seed function calls `seedDefaultTags(prisma)`.
    *   **Action:** Run `npx prisma db seed` to populate the development database.
    *   **Context:** Seeds the database with the predefined tag structures.

**Phase 2.B: Implement Backend Logic for Tag Import**

**Step 2.B.1: Create `DefaultTagService`**
    *   **Action:** Create `rko-backend/src/tags/default-tags.service.ts`.
    *   **Action:** Implement the `importDefaultTags(tenantId, defaultTagSetIds)` method using `prisma.contentTag.upsert` as detailed previously.
    *   **Action:** Implement a method `listAvailableSets()` to fetch active `DefaultTagSet`s (potentially with tag counts) for the frontend UI.
    *   **Context:** Encapsulates the logic for managing and importing default tags.

**Step 2.B.2: Create API Endpoints for Default Tags**
    *   **Action:** Create/Modify a controller (e.g., `DefaultTagsController` or add to `TenantSettingsController`).
    *   **Action:** Implement `GET /api/default-tag-sets` endpoint calling `defaultTagService.listAvailableSets()`. This might be public or require admin privileges depending on your design.
    *   **Action:** Implement `POST /api/app/:tenantId/tags/import-defaults` endpoint (secured for tenant admins/owners) calling `defaultTagService.importDefaultTags()`.
    *   **Context:** Exposes the default tag functionality via the API.

**Phase X: Frontend Implementation (Separate Task/Sprint)**

*   **Action:** Build the Admin UI for managing `DefaultTagSet`s and `DefaultTag`s.
*   **Action:** Build the Tenant Settings UI for listing available `DefaultTagSet`s and allowing users to select and import them.
