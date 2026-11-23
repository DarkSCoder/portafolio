# Graph Report - Skills  (2026-11-23)

## Corpus Check
- Corpus is ~18,620 words - fits in a single context window. You may not need a graph.

## Summary
- 106 nodes · 154 edges · 13 communities (9 shown, 4 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Ink Reveal Animation
- Privacy Consent
- Main Portfolio Script
- Spanish Portfolio Automation
- Build Tooling
- CV AI Projects
- English Automation Workflow
- Portuguese Automation Workflow
- Privacy Integrations
- AI Memory Portfolio
- Terms and Contracts
- Graphify Query Guidance

## God Nodes (most connected - your core abstractions)
1. `prepareScene()` - 9 edges
2. `updateProgress()` - 8 edges
3. `updateMode()` - 8 edges
4. `onResize()` - 8 edges
5. `destroy()` - 6 edges
6. `drawInk()` - 5 edges
7. `updateInkState()` - 5 edges
8. `showUnavailable()` - 5 edges
9. `chooseLanguage()` - 5 edges
10. `Lucian Rodríguez Plasencia` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Artificial Intelligence` --semantically_similar_to--> `Clasificación por IA`  [INFERRED] [semantically similar]
  index.html → assets/automation-workflow.svg
- `n8n` --semantically_similar_to--> `Orquestación n8n`  [INFERRED] [semantically similar]
  index.html → assets/automation-workflow.svg

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Automation Workflow** — assets_automation_workflow_en_contact_input, assets_automation_workflow_en_n8n, assets_automation_workflow_en_ai, assets_automation_workflow_en_database [EXTRACTED 1.00]
- **Fluxo de Automação** — assets_automation_workflow_pt_contact_input, assets_automation_workflow_pt_n8n, assets_automation_workflow_pt_ai, assets_automation_workflow_pt_database [EXTRACTED 1.00]

## Communities (13 total, 4 thin omitted)

### Community 0 - "Ink Reveal Animation"
Cohesion: 0.21
Nodes (25): destroy(), drawInk(), drawRaggedCircle(), fbm(), getLocalizedMessage(), hashNoise(), isPhone(), measureGeometry() (+17 more)

### Community 1 - "Privacy Consent"
Cohesion: 0.17
Nodes (19): chooseLanguage(), closeLanguageOptions(), hideCookieBanner(), loadAnalytics(), moveLanguageOption(), normalizeLanguage(), openLanguageOptions(), readConsent() (+11 more)

### Community 2 - "Main Portfolio Script"
Cohesion: 0.15
Nodes (14): handleReducedMotionChange(), measureParallaxOrigins(), navToggle, parallaxElements, parallaxItems, primaryNavigation, protectedContactLinks, protectedContacts (+6 more)

### Community 3 - "Spanish Portfolio Automation"
Cohesion: 0.20
Nodes (11): Clasificación por IA, Entrada de Contacto, Registro PostgreSQL / CRM, Orquestación n8n, Artificial Intelligence, Computer Engineering, Cookie and Analytics Preferences, Digital Services (+3 more)

### Community 4 - "Build Tooling"
Cohesion: 0.25
Nodes (4): outputDirectory, pages, projectRoot, publicFiles

### Community 5 - "CV AI Projects"
Cohesion: 0.40
Nodes (5): Aptik, Beelight, Water Meter Management System Using Computer Vision, Lucian Rodríguez Plasencia, University of Pinar del Río

### Community 6 - "English Automation Workflow"
Cohesion: 0.50
Nodes (4): Applied AI Classification, Contact Input, PostgreSQL / CRM Record, n8n Orchestrator

### Community 7 - "Portuguese Automation Workflow"
Cohesion: 0.50
Nodes (4): Classificação por IA, Entrada de Contato, Registro PostgreSQL / CRM, Orquestração n8n

### Community 8 - "Privacy Integrations"
Cohesion: 0.50
Nodes (4): Cloudflare Pages, Google Analytics 4, Privacy Policy, WhatsApp

## Knowledge Gaps
- **22 isolated node(s):** `Curriculum PDF Source of Truth`, `Graphify Query Guidance`, `Computer Engineering`, `University of Pinar del Río`, `Cookie and Analytics Preferences` (+17 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 43 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 2 inferred relationships involving `updateProgress()` (e.g. with `ink-reveal.js` and `destroy()`) actually correct?**
  _`updateProgress()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Curriculum PDF Source of Truth`, `Graphify Query Guidance`, `Computer Engineering` to the rest of the system?**
  _22 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Are the 2 inferred relationships involving `onResize()` (e.g. with `ink-reveal.js` and `destroy()`) actually correct?**
  _`onResize()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `destroy()` (e.g. with `ink-reveal.js` and `onContextLost()`) actually correct?**
  _`destroy()` has 6 INFERRED edges - model-reasoned connections that need verification._