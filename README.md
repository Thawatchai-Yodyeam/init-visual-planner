# init-visual-planner 🤖

A lightweight CLI tool to bootstrap and run the **Visual System Planner** workflow in any software repository.

This tool helps AI Agents and developers transition from long text-based system designs in chat windows to interactive, visual HTML specifications with built-in live reloading.

---

## 🚀 Quick Start

You don't need to install this package globally. You can run it directly using `npx`:

### 1. Initialize the Workspace
Run the following command in the root of your target project directory:
```bash
npx init-visual-planner
```
This will automatically generate the following file structure in your directory:
*   `.visual-planner/template.html` (The interactive canvas template)
*   `agents.md` (Strict directives for AI agents working in this repository)
*   `context.md` (Business goals, stack decisions, and design constraints)
*   `tasks.md` (Project task tracker checklist)

### 2. Run the Development Server
When you or your AI Agent creates/updates a visual HTML specification file, launch the local dev server to preview and copy feedback:
```bash
npx init-visual-planner dev <path-to-html-file>
```
*   **Live Reload:** Automatically watches the HTML file and reloads the browser when changes are saved.
*   **Port Auto-Collision Handling:** Automatically searches for an open port if port `3000` is already in use.
*   **Automatic Browser Open:** Opens the file in your default browser instantly.

### 3. Stop the Development Server
When you are finished reviewing or the design has been approved, shut down the running server process cleanly:
```bash
npx init-visual-planner stop
```
*   **Safe Shutdown:** Reads the cached PID and terminates only the specific dev server process, preventing port conflicts and keeping other running Node.js apps safe.

---

## 🎨 Interactive Visual Canvas Features
*   **Sidebar Navigation:** Easily switch between tabs like *System Overview*, *UI/UX Wireframes*, *Workflows*, and *API Specs*.
*   **Interactive Decision Trade-offs:** Click buttons in comparison sections to copy choice JSON prompts directly to the clipboard.
*   **Human-in-the-Loop Feedback:** Click bottom bar utility buttons to copy `APPROVED` or `REQUEST_CHANGES` feedback payloads instantly.

---

## 🛠️ Installation & Customization (For Developers)

If you wish to install it locally in your project:
```bash
npm install init-visual-planner --save-dev
```

And run via:
```bash
npx init-visual-planner
```

---

## 📝 License
This project is licensed under the [MIT License](LICENSE).
