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
- **[🔍 PORT COLLISION PREVENTION]** Before spawning a new dev server, verify if the port (e.g. 3000) is already active. If active, do not spawn a new process. Simply update the HTML file—the server will automatically trigger a browser Live Reload.
- **[🚀 START DEV SERVER]** If no server is running, execute in the background:
  `npx init-visual-planner dev <path-to-html-file>`
- **[🛑 GRACEFUL SHUTDOWN]** Immediately terminate the running dev server background process when the user pastes an approval feedback JSON (e.g., containing `"status": "APPROVED"` or `"status": "APPROVED_WITH_DIRECTION"`), or when transitioning to implementation.
  - **How to Shutdown:** 
    1. **Primary (For AI):** Use your native task manager/process termination tool (such as `manage_task` with action `kill` or similar process tools) to directly terminate the background task running the dev server.
    2. **Fallback:** Run `npx init-visual-planner stop` in the workspace root.
    3. **[🛑 STRICTLY FORBIDDEN]** NEVER use broad commands like `taskkill /F /IM node.exe` as this will abruptly crash your own execution environment and all other Node.js applications.

## 🎨 Execution Standards for HTML Canvas
1. **SVG Diagrams:** Always illustrate workflows, schemas, and data pipelines using clean, raw SVG code embedded directly in the HTML. Do not write text flowcharts.
2. **Dynamic Tabbed Layout:** Populate only relevant tabs. Hide non-applicable tabs from the sidebar navigation using the CSS `hidden` class, or replace the content with: `[Not Applicable for this Specification]`.
3. **Loopback scripts:** Never delete the loopback utility scripts at the bottom of the templates. They are crucial for letting users copy feedback JSON back to the chat.
