import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

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

	getCurrentContext(): { file: TFile | null, selection: string } {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		const file = activeView?.file || null;
		const selection = activeView?.editor.getSelection() || '';
		return { file, selection };
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
	contextDiv: HTMLDivElement;
	isRunning: boolean = false;
	currentProcess: any = null;

	constructor(leaf: WorkspaceLeaf, plugin: ClaudeCodeGeminiPlugin, toolType: 'claude' | 'gemini') {
		super(leaf);
		this.plugin = plugin;
		this.toolType = toolType;
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
		this.promptInput = promptContainer.createEl("textarea", {
			cls: "prompt-input",
			attr: { 
				placeholder: "Enter your prompt here...",
				rows: "4"
			}
		});

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

		this.outputDiv = container.createDiv("output-container");
		this.outputDiv.createEl("h3", { text: "Output:" });

		this.contextDiv = container.createDiv("context-container");
		this.contextDiv.createEl("h3", { text: "Context:" });
		this.updateContext();

		this.addStyles();
	}

	addStyles() {
		const style = document.createElement('style');
		style.textContent = `
			.prompt-container { margin: 10px 0; }
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
			.output-container, .context-container { 
				margin: 15px 0; 
				padding: 10px;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
			}
			.output-text {
				font-family: var(--font-monospace);
				white-space: pre-wrap;
				background: var(--background-primary-alt);
				padding: 10px;
				border-radius: 4px;
				max-height: 300px;
				overflow-y: auto;
			}
		`;
		document.head.appendChild(style);
	}

	updateContext() {
		const { file, selection } = this.plugin.getCurrentContext();
		this.contextDiv.innerHTML = '<h3>Context:</h3>';
		
		if (file) {
			this.contextDiv.createEl("p", { text: `Current file: ${file.path}` });
		} else {
			this.contextDiv.createEl("p", { text: "No file open" });
		}
		
		if (selection) {
			this.contextDiv.createEl("p", { text: `Selected text: "${selection.substring(0, 100)}${selection.length > 100 ? '...' : ''}"` });
		} else {
			this.contextDiv.createEl("p", { text: "No text selected" });
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
		
		this.outputDiv.innerHTML = '<h3>Output:</h3>';
		const outputText = this.outputDiv.createDiv("output-text");
		outputText.textContent = 'Processing prompt...\n';

		try {
			prompt = await this.plugin.expandFileReferences(prompt);
			const command = this.buildCommand(prompt);
			const vaultPath = (this.plugin.app.vault.adapter as any).basePath || (this.plugin.app.vault.adapter as any).path || process.cwd();
			
			outputText.textContent += `Working directory: ${vaultPath}\n`;
			outputText.textContent += `Command: ${command}\n\n`;
			outputText.textContent += 'Executing...\n';
			
			await this.runCommandWithSpawn(command, vaultPath, outputText);
			
		} catch (error) {
			outputText.textContent += `\nError: ${error.message}`;
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

	async runCommandWithSpawn(command: string, cwd: string, outputText: HTMLDivElement): Promise<void> {
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

			this.currentProcess.stdout?.on('data', (data: Buffer) => {
				const output = data.toString();
				outputText.textContent += output;
				outputText.scrollTop = outputText.scrollHeight;
			});

			this.currentProcess.stderr?.on('data', (data: Buffer) => {
				const output = data.toString();
				outputText.textContent += '\nError: ' + output;
				outputText.scrollTop = outputText.scrollHeight;
			});

			this.currentProcess.on('close', (code: number, signal: string) => {
				if (code === 0) {
					outputText.textContent += '\n\nCommand completed successfully.';
					resolve();
				} else if (signal === 'SIGTERM' || signal === 'SIGKILL') {
					outputText.textContent += '\n\nCommand was cancelled.';
					reject(new Error('Command was cancelled'));
				} else {
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
		
		if (file) {
			contextPrompt += `\n\nCurrent file: ${file.path}`;
		}
		if (selection) {
			contextPrompt += `\n\nSelected text:\n${selection}`;
		}

		if (this.toolType === 'claude') {
			return `${this.plugin.settings.claudeCodePath} -p "${contextPrompt.replace(/"/g, '\\"')}" --allowedTools Edit,Write,Bash,Grep,MultiEdit,WebFetch,TodoRead,TodoWrite,WebSearch`;
		} else {
			return `${this.plugin.settings.geminiCliPath} -p "${contextPrompt.replace(/"/g, '\\"')}" --yolo`;
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
