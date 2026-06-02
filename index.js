#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { runServer, stopServer } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function init() {
  const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  console.log(`\n🚀 Initializing Visual Planner in: ${targetDir}`);

  // Paths in target directory
  const vpDir = path.join(targetDir, '.visual-planner');
  const agentsDest = path.join(targetDir, 'agents.md');
  const contextDest = path.join(targetDir, 'context.md');
  const tasksDest = path.join(targetDir, 'tasks.md');

  // Paths to template files in this package
  const templatesSrcDir = path.join(__dirname, 'templates');
  const agentsSrc = path.join(templatesSrcDir, 'agents.md');
  const contextSrc = path.join(templatesSrcDir, 'context.md');
  const tasksSrc = path.join(templatesSrcDir, 'tasks.md');

  const htmlTemplates = [
    'spec_template.html',
    'meeting_template.html',
    'comparison_template.html',
    'priority_template.html',
    'explainer_template.html'
  ];

  try {
    // Ensure target folder .visual-planner exists
    await fs.mkdir(vpDir, { recursive: true });

    // Helper to copy file with check
    async function copyFile(src, dest, label) {
      try {
        await fs.access(dest);
        console.log(`⚠️  ${label} already exists. Skipping to avoid overwriting.`);
      } catch {
        await fs.copyFile(src, dest);
        console.log(`✅ Created ${label}`);
      }
    }

    // Copy all 5 HTML templates
    for (const tempFile of htmlTemplates) {
      await copyFile(
        path.join(templatesSrcDir, tempFile),
        path.join(vpDir, tempFile),
        `.visual-planner/${tempFile}`
      );
    }

    await copyFile(agentsSrc, agentsDest, 'agents.md');
    await copyFile(contextSrc, contextDest, 'context.md');
    await copyFile(tasksSrc, tasksDest, 'tasks.md');

    console.log('\n🎉 Visual Planner initialized successfully!');
    console.log('Now AI Agents working in this repository will follow the Visual Agentic Workflow.');
  } catch (error) {
    console.error('❌ Error initializing Visual Planner:', error.message);
    process.exit(1);
  }
}

// Entry point checking for subcommands
if (process.argv[2] === 'dev') {
  const htmlFile = process.argv[3];
  if (!htmlFile) {
    console.error('❌ Error: Please specify the HTML file path to serve. Example: init-visual-planner dev meeting_room_spec.html');
    process.exit(1);
  }
  runServer(path.resolve(htmlFile));
} else if (process.argv[2] === 'stop') {
  const targetDir = process.argv[3] ? path.resolve(process.argv[3]) : process.cwd();
  stopServer(targetDir);
} else {
  init();
}
