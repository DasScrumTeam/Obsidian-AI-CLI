import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf, TFile } from 'obsidian';
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
			
			const command = this.buildCommand(prompt);
			const vaultPath = (this.plugin.app.vault.adapter as any).basePath || (this.plugin.app.vault.adapter as any).path || process.cwd();
			
			this.executionDiv.textContent = `Full command being executed:\n${command}\n\nExecuting...\n`;
			console.log(command);
			
			await this.runCommandWithSpawn(command, vaultPath);
			
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

	async runCommandWithSpawn(command: string, cwd: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeout = this.toolType === 'claude' ? 180000 : 60000;
			
			this.currentProcess = spawn(command, [], { 
				cwd,
				shell: true,
				stdio: ['pipe', 'pipe', 'pipe']
			});

			// Close stdin immediately to prevent hanging
			if (this.currentProcess.stdin) {
				this.currentProcess.stdin.end();
			}

			let fullOutput = '';
			let isFirstOutput = true;

			this.currentProcess.stdout?.on('data', (data: Buffer) => {
				const output = data.toString();
				fullOutput += output;
				
				// Add to execution log
				this.executionDiv.textContent += output;
				this.executionDiv.scrollTop = this.executionDiv.scrollHeight;
				
				// Filter output for result display
				let filteredOutput = output;
				if (this.toolType === 'gemini') {
					// Remove "Loaded cached credentials." line for Gemini
					filteredOutput = filteredOutput.replace(/^Loaded cached credentials\.\s*\n?/gm, '');
				}
				
				// Update result with the filtered output
				if (isFirstOutput) {
					this.resultDiv.textContent = '';
					isFirstOutput = false;
				}
				this.resultDiv.textContent += filteredOutput;
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

	buildCommand(prompt: string): string {
		const { file, selection } = this.plugin.getCurrentContext();
		let contextPrompt = prompt;
		
		// Add file reference using @file_path syntax
		if (file) {
			contextPrompt += ` @${file.path}`;
		}
		
		// Add selection as compact JSON context if available
		if (selection && selection.trim()) {
			const contextJson = JSON.stringify({ selectedText: selection });
			contextPrompt += ` Context: ${contextJson}`;
		}

		// Use -p flag with proper escaping
		const escapedPrompt = contextPrompt.replace(/"/g, '\\"');

		if (this.toolType === 'claude') {
			return `${this.plugin.settings.claudeCodePath} -p "${escapedPrompt}" --allowedTools Read,Edit,Write,Bash,Grep,MultiEdit,WebFetch,TodoRead,TodoWrite,WebSearch`;
		} else {
			return `${this.plugin.settings.geminiCliPath} -p "${escapedPrompt}" --yolo`;
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
