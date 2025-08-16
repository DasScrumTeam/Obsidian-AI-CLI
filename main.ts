import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf, TFile, addIcon } from 'obsidian';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

interface ClaudeCodeGeminiSettings {
	claudeCodePath: string;
	geminiCliPath: string;
	defaultTool: 'claude' | 'gemini';
}

const DEFAULT_SETTINGS: ClaudeCodeGeminiSettings = {
	claudeCodePath: 'claude',
	geminiCliPath: 'gemini',
	defaultTool: 'claude'
}

const CLAUDE_VIEW_TYPE = 'claude-code-view';
const GEMINI_VIEW_TYPE = 'gemini-cli-view';

export default class ClaudeCodeGeminiPlugin extends Plugin {
	settings: ClaudeCodeGeminiSettings;

	async onload() {
		await this.loadSettings();

		// Register custom icons
		console.log('Registering Claude and Gemini icons...');
		addIcon('claude-icon', `<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" image-rendering="optimizeQuality" fill-rule="evenodd" clip-rule="evenodd" viewBox="0 0 512 509.64"><path fill="#D77655" d="M115.612 0h280.775C459.974 0 512 52.026 512 115.612v278.415c0 63.587-52.026 115.612-115.613 115.612H115.612C52.026 509.639 0 457.614 0 394.027V115.612C0 52.026 52.026 0 115.612 0z"/><path fill="#FCF2EE" fill-rule="nonzero" d="M142.27 316.619l73.655-41.326 1.238-3.589-1.238-1.996-3.589-.001-12.31-.759-42.084-1.138-36.498-1.516-35.361-1.896-8.897-1.895-8.34-10.995.859-5.484 7.482-5.03 10.717.935 23.683 1.617 35.537 2.452 25.782 1.517 38.193 3.968h6.064l.86-2.451-2.073-1.517-1.618-1.517-36.776-24.922-39.81-26.338-20.852-15.166-11.273-7.683-5.687-7.204-2.451-15.721 10.237-11.273 13.75.935 3.513.936 13.928 10.716 29.749 23.027 38.848 28.612 5.687 4.727 2.275-1.617.278-1.138-2.553-4.271-21.13-38.193-22.546-38.848-10.035-16.101-2.654-9.655c-.935-3.968-1.617-7.304-1.617-11.374l11.652-15.823 6.445-2.073 15.545 2.073 6.547 5.687 9.655 22.092 15.646 34.78 24.265 47.291 7.103 14.028 3.791 12.992 1.416 3.968 2.449-.001v-2.275l1.997-26.641 3.69-32.707 3.589-42.084 1.239-11.854 5.863-14.206 11.652-7.683 9.099 4.348 7.482 10.716-1.036 6.926-4.449 28.915-8.72 45.294-5.687 30.331h3.313l3.792-3.791 15.342-20.372 25.782-32.227 11.374-12.789 13.27-14.129 8.517-6.724 16.1-.001 11.854 17.617-5.307 18.199-16.581 21.029-13.75 17.819-19.716 26.54-12.309 21.231 1.138 1.694 2.932-.278 44.536-9.479 24.062-4.347 28.714-4.928 12.992 6.066 1.416 6.167-5.106 12.613-30.71 7.583-36.018 7.204-53.636 12.689-.657.48.758.935 24.164 2.275 10.337.556h25.301l47.114 3.514 12.309 8.139 7.381 9.959-1.238 7.583-18.957 9.655-25.579-6.066-59.702-14.205-20.474-5.106-2.83-.001v1.694l17.061 16.682 31.266 28.233 39.152 36.397 1.997 8.999-5.03 7.102-5.307-.758-34.401-25.883-13.27-11.651-30.053-25.302-1.996-.001v2.654l6.926 10.136 36.574 54.975 1.895 16.859-2.653 5.485-9.479 3.311-10.414-1.895-21.408-30.054-22.092-33.844-17.819-30.331-2.173 1.238-10.515 113.261-4.929 5.788-11.374 4.348-9.478-7.204-5.03-11.652 5.03-23.027 6.066-30.052 4.928-23.886 4.449-29.674 2.654-9.858-.177-.657-2.173.278-22.37 30.71-34.021 45.977-26.919 28.815-6.445 2.553-11.173-5.789 1.037-10.337 6.243-9.2 37.257-47.392 22.47-29.371 14.508-16.961-.101-2.451h-.859l-98.954 64.251-17.618 2.275-7.583-7.103.936-11.652 3.589-3.791 29.749-20.474-.101.102.024.101z"/></svg>`);
		console.log('Claude icon registered');

		addIcon('gemini-icon', `<svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M16 8.016A8.522 8.522 0 008.016 16h-.032A8.521 8.521 0 000 8.016v-.032A8.521 8.521 0 007.984 0h.032A8.522 8.522 0 0016 7.984v.032z" fill="url(#prefix__paint0_radial_980_20147)"/><defs><radialGradient id="prefix__paint0_radial_980_20147" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="matrix(16.1326 5.4553 -43.70045 129.2322 1.588 6.503)"><stop offset=".067" stop-color="#9168C0"/><stop offset=".343" stop-color="#5684D1"/><stop offset=".672" stop-color="#1BA1E3"/></radialGradient></defs></svg>`);
		console.log('Gemini icon registered');

		this.registerView(
			CLAUDE_VIEW_TYPE,
			(leaf) => new ToolView(leaf, this, 'claude')
		);

		this.registerView(
			GEMINI_VIEW_TYPE,
			(leaf) => new ToolView(leaf, this, 'gemini')
		);

		this.addCommand({
			id: 'open-claude-code',
			name: 'Claude Code',
			callback: () => {
				this.activateView(CLAUDE_VIEW_TYPE);
			}
		});

		this.addCommand({
			id: 'open-gemini-cli',
			name: 'Gemini CLI',
			callback: () => {
				this.activateView(GEMINI_VIEW_TYPE);
			}
		});

		this.addSettingTab(new ClaudeCodeGeminiSettingTab(this.app, this));
	}

	async activateView(viewType: string) {
		const { workspace } = this.app;
		
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(viewType);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: viewType, active: true });
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(CLAUDE_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(GEMINI_VIEW_TYPE);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	getCurrentContext(): { file: TFile | null, selection: string, debug: string } {
		let debugInfo = '';
		let file = null;
		let selection = '';

		// Method 1: Try getActiveFile() (most reliable)
		file = this.app.workspace.getActiveFile();
		debugInfo += `getActiveFile(): ${file ? file.path : 'null'}\n`;

		// Method 2: Get active MarkdownView for selection
		let activeView = null;
		
		// First try getMostRecentLeaf (since this worked for you)
		const mostRecentLeaf = this.app.workspace.getMostRecentLeaf();
		if (mostRecentLeaf?.view instanceof MarkdownView) {
			activeView = mostRecentLeaf.view;
			debugInfo += `Found MarkdownView via getMostRecentLeaf\n`;
		}

		// Fallback to getActiveViewOfType
		if (!activeView) {
			activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				debugInfo += `Found MarkdownView via getActiveViewOfType\n`;
			} else {
				debugInfo += `No MarkdownView found via getActiveViewOfType\n`;
			}
		}

		// Fallback to activeLeaf
		if (!activeView) {
			const activeLeaf = this.app.workspace.activeLeaf;
			if (activeLeaf?.view instanceof MarkdownView) {
				activeView = activeLeaf.view;
				debugInfo += `Found MarkdownView via activeLeaf\n`;
			}
		}

		// Get selection if we have an activeView
		if (activeView) {
			debugInfo += `ActiveView file: ${activeView.file?.path || 'null'}\n`;
			
			// If getActiveFile() didn't work, use the file from activeView
			if (!file && activeView.file) {
				file = activeView.file;
				debugInfo += `Using file from activeView\n`;
			}
			
			// Try to get selection from the editor
			if (activeView.editor) {
				selection = activeView.editor.getSelection() || '';
				debugInfo += `Selection length: ${selection.length}\n`;
				if (selection.length > 0) {
					debugInfo += `Selection preview: "${selection.substring(0, 50)}${selection.length > 50 ? '...' : ''}"\n`;
				}
			} else {
				debugInfo += `No editor found on activeView\n`;
			}
		} else {
			debugInfo += `No MarkdownView found\n`;
		}

		return { file, selection, debug: debugInfo };
	}

	async expandFileReferences(prompt: string): Promise<string> {
		const filePattern = /@([^\s]+\.md)/g;
		let expandedPrompt = prompt;
		const matches = prompt.match(filePattern);
		
		if (matches) {
			for (const match of matches) {
				const fileName = match.substring(1);
				const file = this.app.vault.getAbstractFileByPath(fileName);
				
				if (file instanceof TFile) {
					try {
						const content = await this.app.vault.read(file);
						expandedPrompt = expandedPrompt.replace(match, `File: ${fileName}\nContent:\n${content}\n`);
					} catch (error) {
						expandedPrompt = expandedPrompt.replace(match, `[Error reading file: ${fileName}]`);
					}
				} else {
					expandedPrompt = expandedPrompt.replace(match, `[File not found: ${fileName}]`);
				}
			}
		}
		
		return expandedPrompt;
	}
}

class ToolView extends ItemView {
	plugin: ClaudeCodeGeminiPlugin;
	toolType: 'claude' | 'gemini';
	promptInput: HTMLTextAreaElement;
	runButton: HTMLButtonElement;
	cancelButton: HTMLButtonElement;
	outputDiv: HTMLDivElement;
	resultDiv: HTMLDivElement;
	executionDiv: HTMLDivElement;
	contextDiv: HTMLDivElement;
	isRunning: boolean = false;
	currentProcess: any = null;
	private eventRefs: any[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: ClaudeCodeGeminiPlugin, toolType: 'claude' | 'gemini') {
		super(leaf);
		this.plugin = plugin;
		this.toolType = toolType;
		this.eventRefs = [];
	}

	registerEvent(eventRef: any) {
		this.eventRefs.push(eventRef);
	}

	getViewType() {
		return this.toolType === 'claude' ? CLAUDE_VIEW_TYPE : GEMINI_VIEW_TYPE;
	}

	getDisplayText() {
		return this.toolType === 'claude' ? "Claude Code" : "Gemini CLI";
	}

	getIcon() {
		const iconName = this.toolType === 'claude' ? 'claude-icon' : 'gemini-icon';
		console.log(`getIcon() called for ${this.toolType}, returning: ${iconName}`);
		return iconName;
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl("h2", { text: this.getDisplayText() });

		const promptContainer = container.createDiv("prompt-container");
		promptContainer.createEl("label", { text: "Prompt:" });
		
		// Add help text
		const helpText = promptContainer.createEl("div", {
			cls: "help-text",
			text: "💡 Tip: Open a file and/or select text for automatic context. Try: 'Translate the selected text to French' or 'Fix grammar in this file'"
		});
		
		this.promptInput = promptContainer.createEl("textarea", {
			cls: "prompt-input",
			attr: { 
				placeholder: "Enter your prompt here...",
				rows: "4"
			}
		});

		// Update context when user focuses on the prompt input
		this.promptInput.addEventListener('focus', () => {
			this.updateContext();
		});

		// Register workspace change listeners
		this.registerEvent(this.plugin.app.workspace.on('active-leaf-change', () => {
			this.updateContext();
		}));

		this.registerEvent(this.plugin.app.workspace.on('file-open', () => {
			this.updateContext();
		}));

		const buttonContainer = promptContainer.createDiv("button-container");
		
		this.runButton = buttonContainer.createEl("button", {
			text: "Run",
			cls: "run-button"
		});
		this.runButton.onclick = () => this.runTool();

		this.cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
			cls: "cancel-button"
		});
		this.cancelButton.onclick = () => this.cancelTool();
		this.cancelButton.style.display = 'none';

		// Result section (always visible)
		const resultContainer = container.createDiv("result-container");
		resultContainer.createEl("h3", { text: "Result:" });
		this.resultDiv = resultContainer.createDiv("result-text");
		
		// Command execution section (collapsible)
		this.outputDiv = container.createDiv("output-container");
		const executionDetails = this.outputDiv.createEl("details");
		executionDetails.createEl("summary", { text: "Command Execution" });
		this.executionDiv = executionDetails.createDiv("execution-text");

		this.contextDiv = container.createDiv("context-container");
		this.contextDiv.createEl("h3", { text: "Context:" });
		
		this.updateContext();

		this.addStyles();
	}

	addStyles() {
		const style = document.createElement('style');
		style.textContent = `
			.prompt-container { margin: 10px 0; }
			.help-text {
				font-size: 0.9em;
				color: var(--text-muted);
				margin: 5px 0;
				padding: 8px;
				background: var(--background-secondary);
				border-radius: 4px;
				border-left: 3px solid var(--interactive-accent);
			}
			.prompt-input { 
				width: 100%; 
				margin: 5px 0; 
				padding: 8px;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				resize: vertical;
			}
			.button-container {
				display: flex;
				gap: 10px;
				margin: 5px 0;
			}
			.run-button, .cancel-button { 
				padding: 8px 16px; 
				border: none;
				border-radius: 4px;
				cursor: pointer;
			}
			.run-button {
				background: var(--interactive-accent);
				color: var(--text-on-accent);
			}
			.cancel-button {
				background: var(--text-error);
				color: white;
			}
			.run-button:disabled, .cancel-button:disabled {
				background: var(--background-modifier-border);
				cursor: not-allowed;
			}
			.result-container, .output-container, .context-container { 
				margin: 15px 0; 
				padding: 10px;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
			}
			.result-text, .execution-text {
				font-family: var(--font-monospace);
				white-space: pre-wrap;
				background: var(--background-primary-alt);
				padding: 10px;
				border-radius: 4px;
				max-height: 300px;
				overflow-y: auto;
				user-select: text;
				-webkit-user-select: text;
				-moz-user-select: text;
				-ms-user-select: text;
			}
			.execution-text {
				margin-top: 10px;
			}
			.context-notice {
				font-size: 0.85em;
				color: var(--text-muted);
				margin: 8px 0;
				padding: 6px;
				background: var(--background-secondary);
				border-radius: 3px;
				border-left: 2px solid var(--interactive-accent);
			}
		`;
		document.head.appendChild(style);
	}

	updateContext() {
		const { file, selection, debug } = this.plugin.getCurrentContext();
		
		// Clear existing context content but keep the header
		const existingContent = this.contextDiv.querySelector('.context-content');
		if (existingContent) {
			existingContent.remove();
		}
		
		const contentDiv = this.contextDiv.createDiv("context-content");
		
		if (file) {
			contentDiv.createEl("p", { 
				text: `📄 Current file: ${file.path}`,
				cls: "context-file"
			});
		} else {
			contentDiv.createEl("p", { 
				text: "📄 No file open",
				cls: "context-no-file"
			});
		}
		
		if (selection && selection.trim()) {
			const truncated = selection.length > 100 ? selection.substring(0, 100) + '...' : selection;
			contentDiv.createEl("p", { 
				text: `✏️ Selected: "${truncated}"`,
				cls: "context-selection"
			});
		} else {
			contentDiv.createEl("p", { 
				text: "✏️ No text selected",
				cls: "context-no-selection"
			});
		}
		
		// Add notice about text selection requirement
		const noticeDiv = contentDiv.createDiv("selection-notice");
		noticeDiv.createEl("p", {
			text: "💡 Note: Text selection only works when the note is in edit mode, not preview mode.",
			cls: "context-notice"
		});
	}

	async runTool() {
		if (this.isRunning) return;
		
		let prompt = this.promptInput.value.trim();
		if (!prompt) {
			new Notice('Please enter a prompt');
			return;
		}

		this.isRunning = true;
		this.runButton.disabled = true;
		this.runButton.textContent = 'Running...';
		this.cancelButton.style.display = 'inline-block';
		
		this.resultDiv.textContent = 'Processing prompt...';
		this.executionDiv.textContent = '';

		try {
			prompt = await this.plugin.expandFileReferences(prompt);
			
			const commandInfo = this.buildCommand(prompt);
			const vaultPath = (this.plugin.app.vault.adapter as any).basePath || (this.plugin.app.vault.adapter as any).path || process.cwd();
			
			let executionText = `Full command being executed:\n${commandInfo.command}\n`;
			
			if (commandInfo.useStdin && commandInfo.stdinContent) {
				executionText += `\nPrompt content being sent via stdin:\n${'-'.repeat(50)}\n${commandInfo.stdinContent}\n${'-'.repeat(50)}\n`;
			}
			
			executionText += '\nExecuting...\n';
			this.executionDiv.textContent = executionText;
			console.log(commandInfo.command);
			
			await this.runCommandWithSpawn(commandInfo.command, vaultPath, commandInfo.stdinContent);
			
		} catch (error) {
			this.resultDiv.textContent = `Error: ${error.message}`;
			this.executionDiv.textContent += `\nError: ${error.message}`;
			if (error.message.includes('ENOENT')) {
				new Notice('CLI tool not found. Check the path in settings.');
			} else if (error.message.includes('cancelled')) {
				new Notice('Command was cancelled.');
			} else {
				new Notice('Command execution failed. Check output for details.');
			}
		} finally {
			this.isRunning = false;
			this.runButton.disabled = false;
			this.runButton.textContent = 'Run';
			this.cancelButton.style.display = 'none';
			this.currentProcess = null;
		}
	}

	async runCommandWithSpawn(command: string, cwd: string, stdinContent?: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeout = this.toolType === 'claude' ? 180000 : 60000;
			
			this.currentProcess = spawn(command, [], { 
				cwd,
				shell: true,
				stdio: ['pipe', 'pipe', 'pipe']
			});

			// Handle stdin content or close immediately to prevent hanging
			if (this.currentProcess.stdin) {
				if (stdinContent) {
					this.currentProcess.stdin.write(stdinContent);
					this.currentProcess.stdin.end();
				} else {
					this.currentProcess.stdin.end();
				}
			}

			let fullOutput = '';
			let resultBuffer = '';
			let isFirstOutput = true;


			this.currentProcess.stdout?.on('data', (data: Buffer) => {
				const output = data.toString();
				fullOutput += output;
				
				// Add to execution log
				this.executionDiv.textContent += output;
				this.executionDiv.scrollTop = this.executionDiv.scrollHeight;
				
				// For result display, accumulate in buffer and filter
				resultBuffer += output;
				
				// Apply filtering for Gemini
				let filteredResult = resultBuffer;
				if (this.toolType === 'gemini') {
					filteredResult = filteredResult.replace(/^Loaded cached credentials\.\s*\n?/m, '');
				}
				
				// Update result display
				this.resultDiv.textContent = filteredResult;
				this.resultDiv.scrollTop = this.resultDiv.scrollHeight;
			});

			this.currentProcess.stderr?.on('data', (data: Buffer) => {
				const output = data.toString();
				this.executionDiv.textContent += '\nStderr: ' + output;
				this.executionDiv.scrollTop = this.executionDiv.scrollHeight;
			});

			this.currentProcess.on('close', (code: number, signal: string) => {
				if (code === 0) {
					this.executionDiv.textContent += '\n\nCommand completed successfully.';
					resolve();
				} else if (signal === 'SIGTERM' || signal === 'SIGKILL') {
					this.executionDiv.textContent += '\n\nCommand was cancelled.';
					this.resultDiv.textContent = 'Command was cancelled.';
					reject(new Error('Command was cancelled'));
				} else {
					this.executionDiv.textContent += `\n\nCommand failed with exit code ${code}`;
					reject(new Error(`Command failed with exit code ${code}`));
				}
			});

			this.currentProcess.on('error', (error: Error) => {
				reject(error);
			});

			// Set timeout
			setTimeout(() => {
				if (this.currentProcess && !this.currentProcess.killed) {
					this.currentProcess.kill('SIGTERM');
					reject(new Error(`Command timed out after ${timeout/1000} seconds`));
				}
			}, timeout);
		});
	}

	buildCommand(prompt: string): { command: string, useStdin: boolean, stdinContent: string } {
		const { file, selection } = this.plugin.getCurrentContext();
		let contextPrompt = prompt;
		
		// Add file reference using @file_path syntax (both tools support this)
		if (file) {
			contextPrompt += ` @${file.path}`;
		}
		
		// Add selection as compact JSON context if available
		if (selection && selection.trim()) {
			const contextJson = JSON.stringify({ selectedText: selection });
			contextPrompt += ` Context: ${contextJson}`;
		}

		// Always use stdin for consistency and robustness
		if (this.toolType === 'claude') {
			return {
				command: `${this.plugin.settings.claudeCodePath} --allowedTools Read,Edit,Write,Bash,Grep,MultiEdit,WebFetch,TodoRead,TodoWrite,WebSearch`,
				useStdin: true,
				stdinContent: contextPrompt
			};
		} else {
			return {
				command: `${this.plugin.settings.geminiCliPath} --yolo`,
				useStdin: true,
				stdinContent: contextPrompt
			};
		}
	}

	cancelTool() {
		if (this.currentProcess && !this.currentProcess.killed) {
			// Try SIGTERM first, then SIGKILL if it doesn't respond
			this.currentProcess.kill('SIGTERM');
			setTimeout(() => {
				if (this.currentProcess && !this.currentProcess.killed) {
					this.currentProcess.kill('SIGKILL');
				}
			}, 2000);
			
			// Reset UI state immediately
			this.isRunning = false;
			this.runButton.disabled = false;
			this.runButton.textContent = 'Run';
			this.cancelButton.style.display = 'none';
			this.currentProcess = null;
		}
	}

	async onClose() {
		// Clean up event listeners
		this.eventRefs.forEach(ref => {
			if (ref && typeof ref.off === 'function') {
				ref.off();
			}
		});
		this.eventRefs = [];
		
		// Clean up any running process
		if (this.currentProcess && !this.currentProcess.killed) {
			this.currentProcess.kill('SIGTERM');
		}
	}
}

class ClaudeCodeGeminiSettingTab extends PluginSettingTab {
	plugin: ClaudeCodeGeminiPlugin;

	constructor(app: App, plugin: ClaudeCodeGeminiPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Claude Code + Gemini CLI Settings'});

		new Setting(containerEl)
			.setName('Claude Code Path')
			.setDesc('Path to the Claude Code CLI executable')
			.addText(text => text
				.setPlaceholder('claude')
				.setValue(this.plugin.settings.claudeCodePath)
				.onChange(async (value) => {
					this.plugin.settings.claudeCodePath = value;
					await this.plugin.saveSettings();
				}))
			.addButton(button => button
				.setButtonText('Test')
				.onClick(async () => {
					try {
						await execAsync(`${this.plugin.settings.claudeCodePath} --version`);
						new Notice('Claude Code CLI found and working!');
					} catch (error) {
						new Notice('Claude Code CLI not found or not working. Check the path.');
					}
				}));

		new Setting(containerEl)
			.setName('Gemini CLI Path')
			.setDesc('Path to the Gemini CLI executable')
			.addText(text => text
				.setPlaceholder('gemini')
				.setValue(this.plugin.settings.geminiCliPath)
				.onChange(async (value) => {
					this.plugin.settings.geminiCliPath = value;
					await this.plugin.saveSettings();
				}))
			.addButton(button => button
				.setButtonText('Test')
				.onClick(async () => {
					try {
						await execAsync(`${this.plugin.settings.geminiCliPath} --version`);
						new Notice('Gemini CLI found and working!');
					} catch (error) {
						new Notice('Gemini CLI not found or not working. Check the path.');
					}
				}));

		new Setting(containerEl)
			.setName('Default Tool')
			.setDesc('Which tool to prefer when using keyboard shortcuts')
			.addDropdown(dropdown => dropdown
				.addOption('claude', 'Claude Code')
				.addOption('gemini', 'Gemini CLI')
				.setValue(this.plugin.settings.defaultTool)
				.onChange(async (value: 'claude' | 'gemini') => {
					this.plugin.settings.defaultTool = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('p', {
			text: 'Note: Make sure Claude Code and/or Gemini CLI are installed and accessible from your system PATH.',
			cls: 'setting-item-description'
		});
	}
}
