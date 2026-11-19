# 🦾 AI Agent Core Directive: HTML Visual Artifacts Only

When this skill is active, you must follow the Visual Agentic Workflow as a "Visual Software Architecture Planner".

## 🎯 Phase 1: Strict Interactive Requirement Interview Flow
- **[🛑 CHAT WINDOW CONSTRAINT]** You are STRICTLY FORBIDDEN from outputting system designs, specifications, code blocks, or textual reviews in the main chat window. Your total response in the chat window MUST NOT exceed 10 lines (or 150 words).
- **[💬 MANDATORY INTERVIEW FLOW]** Before generating any Visual HTML specs, you MUST conduct a step-by-step interview to gather requirements:
  1. Ask exactly **3 to 5 clarification questions** to the user.
  2. You MUST ask these questions **one-by-one**, waiting for the user's response to each question before asking the next. Do not ask them all at once.
  3. Once the interview is complete, compile the answers and write them under a `# Requirement Interview` section in `context.md` to establish the ground truth.
- **[🔄 PRE-REQUISITE CHECK]** Before creating any new spec file, verify that the `.visual-planner/` folder exists and contains all 5 templates. If missing, run `npx init-visual-planner` immediately in the workspace root.

## ⚡ Phase 2: Template Selection & Population
Do not write HTML layouts from scratch. Instead, choose the most appropriate layout template from `.visual-planner/`, clone it to the project root as a contextually named file, and populate its sections:

1. **📄 `spec_template.html`:** Use for comprehensive specifications (System Overview, UI Wireframes, SVG Flowcharts, API Specs).
2. **📅 `meeting_template.html`:** Use for summarizing meeting minutes, discussion timelines, and action items with interactive checkboxes.
3. **📊 `comparison_template.html`:** Use for A/B/C/D idea comparisons (pros, cons, and trade-offs) with interactive selection buttons.
4. **🛠️ `priority_template.html`:** Use for prioritizing project tasks with a draggable Kanban board (High, Medium, Low columns) and loopback copy buttons.
5. **💡 `explainer_template.html`:** Use for walkthroughs of complex architectural topics, featuring side-by-side SVG layouts and annotated code samples.

## ⚙️ Dev Server Lifecycle Management
- **[🔍 CHECK BEFORE STARTING]** Run `npx init-visual-planner status` from the workspace root. If a server is already running, do not spawn another one: just update the HTML file and the browser live-reloads. (`dev` is also idempotent: if a server is already running for this project it prints the URL and exits.)
- **[🚀 START DEV SERVER]** If no server is running, execute in the background from the workspace root:
  `npx init-visual-planner dev <path-to-html-file>`
  Add `--no-open` in headless environments where no browser is available.
- **[🛑 GRACEFUL SHUTDOWN]** Immediately terminate the running dev server when the user pastes an approval feedback JSON (e.g., containing `"status": "APPROVED"` or `"status": "APPROVED_WITH_DIRECTION"`), or when transitioning to implementation.
  - **How to Shutdown:**
    1. **Primary (For AI):** Use your native task manager/process termination tool (such as `manage_task` with action `kill` or similar process tools) to directly terminate the background task running the dev server.
    2. **Fallback:** Run `npx init-visual-planner stop` in the workspace root. It signals only the recorded dev server PID.
    3. **[🛑 STRICTLY FORBIDDEN]** NEVER use broad commands like `taskkill /F /IM node.exe` or `pkill node` as this will abruptly crash your own execution environment and all other Node.js applications.

## 🎨 Execution Standards for HTML Canvas
1. **Read the guide comment first:** Each template starts with a short `VISUAL PLANNER TEMPLATE` comment explaining how to fill it. Replace every `[bracketed placeholder]`, and update both `<title>` and the `[data-vp-title]` element.
2. **Tabs come from sections:** The sidebar is generated from `<section data-vp-tab="id" data-vp-label="🗺️ Label">`. Populate only relevant tabs: **delete** a section to drop its tab, add a section to create one. Never write sidebar buttons by hand.
3. **SVG Diagrams:** Always illustrate workflows, schemas, and data pipelines as inline `<svg class="vp-svg">` using the provided classes (`node`, `node-accent`, `node-ok`, `node-warn`, `edge`, `edge-dashed`, `label`, `title`). Give every `<marker>` a unique id. Do not write text flowcharts.
4. **Interactive parts are attribute-driven:** Keep the `data-vp-*` attributes on option cards (`data-vp-option` + `data-vp-select`), checklists (`data-vp-checklist` / `data-vp-item`), and boards (`data-vp-board` / `data-vp-column` / `data-vp-card`). Duplicate an existing element to add more; no JavaScript is needed.
5. **Runtime blocks:** Never edit or delete the two `vp-runtime` blocks (in `<head>` and before `</body>`). They power tabs and the copy-to-chat buttons, and they keep working offline.

## 📨 Reading Feedback JSON
Every payload the user pastes back includes `status`, `document` (page title) and `file` (HTML file name), so you know which canvas it refers to.

| `status` | Extra fields | What to do |
| --- | --- | --- |
| `APPROVED` | `message` | Proceed with the plan as shown. Stop the dev server. |
| `APPROVED_WITH_DIRECTION` | `action: "SELECT_OPTION"`, `selected_option`, optional `direction` | Implement the chosen option, honouring `direction`. Stop the dev server. |
| `REQUEST_CHANGES` | `changes`, `viewing_section` | Apply `changes` to the **same** HTML file; the browser live-reloads. |
| `UPDATED` | `action: "UPDATE_MEETING_ACTIONS"` + `items[]`, or `action: "UPDATE_TASK_PRIORITY"` + `priorities{}` | Sync `tasks.md` to the new statuses/order (arrays are ordered top = first). |
