/**
 * Help page script - loads and renders instructions.md as HTML
 */

import { marked } from 'marked';

async function loadMarkdown(): Promise<void> {
	const contentEl = document.getElementById('content');
	if (!contentEl) return;

	try {
		const response = await fetch('instructions.md');
		if (!response.ok) throw new Error('Failed to load instructions');
		const markdown = await response.text();
		contentEl.innerHTML = await marked.parse(markdown);
	} catch (error) {
		contentEl.innerHTML = '<p style="color: #cc0000;">Error loading documentation. Please try again.</p>';
		console.error(error);
	}
}

loadMarkdown();
