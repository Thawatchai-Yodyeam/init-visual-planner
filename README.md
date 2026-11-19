# init-visual-planner 🤖

A lightweight CLI tool to bootstrap and run the **Visual System Planner** workflow in any software repository.

This tool helps AI Agents and developers transition from long text-based system designs in chat windows to interactive, visual HTML specifications with built-in live reloading.

---

## 🚀 Quick Start

You don't need to install this package globally. Run it directly with `npx` (Node.js 18.3+).

### 1. Initialize the Workspace
Run in the root of your target project:
```bash
npx init-visual-planner
```
This generates:

| Path | Purpose |
| --- | --- |
| `.visual-planner/spec_template.html` | Full spec: overview, wireframes, SVG flows, API specs |
| `.visual-planner/meeting_template.html` | Meeting minutes, timeline, checkable action items |
| `.visual-planner/comparison_template.html` | A/B/C/D option comparison with selection buttons |
| `.visual-planner/priority_template.html` | Drag-and-drop High/Medium/Low priority board |
| `.visual-planner/explainer_template.html` | Architecture walkthroughs with SVG + annotated code |
| `agents.md` | Directives for AI agents working in this repository |
| `context.md` | Business goals, stack decisions, design constraints |
| `tasks.md` | Project task tracker checklist |

Existing files are never overwritten. Pass `--force` to reset them to the bundled templates, or a directory to initialize somewhere other than the current folder (`npx init-visual-planner ./my-app`).

### 2. Run the Development Server
```bash
npx init-visual-planner dev <path-to-html-file>
```
* **Live Reload:** Watches the HTML file's folder and reloads the browser on save.
* **Port Handling:** Starts on `--port` / `$PORT` / `3000` and moves to the next free port if it's busy.
* **Idempotent:** If a server is already running for this project, `dev` prints its URL instead of starting another.
* **Browser Open:** Opens the page in your default browser (skip with `--no-open`).
* **Local Only:** Binds to `127.0.0.1` by default; use `--host 0.0.0.0` to expose it (e.g. inside a container).

### 3. Check or Stop the Server
```bash
npx init-visual-planner status
```
```bash
npx init-visual-planner stop
```
The server records its PID and URL in `.visual-planner/server.json` (in the folder you ran `dev` from). `stop` signals only that PID, so other Node.js processes are never affected, and the file is cleaned up automatically when the server exits.

---

## 🎨 Interactive Visual Canvas Features
* **Sidebar Navigation:** Switch between tabs like *System Overview*, *UI/UX Wireframes*, *Workflows*, and *API Specs*.
* **Interactive Decision Trade-offs:** Click buttons in comparison sections to copy choice JSON prompts to the clipboard.
* **Human-in-the-Loop Feedback:** Bottom bar buttons copy `APPROVED` or `REQUEST_CHANGES` feedback payloads instantly.

---

## 📁 Project Structure
```
bin/cli.js              CLI entry point (argument parsing, help, signal handling)
src/commands/init.js    Scaffolds templates into a project
src/commands/dev.js     Static server + live reload
src/commands/stop.js    Stops the recorded dev server
src/lib/                Shared helpers (paths, server state file)
src/index.js            Programmatic API
templates/canvas/       HTML canvases → copied to .visual-planner/
templates/docs/         Markdown docs → copied to the project root
test/                   node:test suites (`npm test`)
```

New templates dropped into `templates/canvas/` or `templates/docs/` are picked up by `init` automatically.

## 🛠️ Development
```bash
npm install
```
```bash
npm test
```

---

## 📝 License
This project is licensed under the [MIT License](LICENSE).
