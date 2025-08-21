# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [1.0.7] - 2025-08-21

### Added
- Prompt storage and management system using markdown files
- Save prompt functionality with modal dialog for naming
- Load prompt functionality with dropdown selection
- Configurable prompt storage file location in settings (defaults to `ai-prompts.md`)
- Automatic prompt organization with alphabetical sorting
- Support for easy manual editing of saved prompts in markdown format

### Changed
- Enhanced UI with dedicated prompt management section in all AI tool panels
- Improved settings tab with new "Prompt Storage" section

## [1.0.6] - 2025-08-18

### Added
- Context enable/disable checkbox in sidebar UI
- Platform compatibility warnings for OpenAI Codex (macOS, Linux, and Windows under WSL2 only)

### Changed
- Updated OpenAI Codex command to use `exec --full-auto --skip-git-repo-check`
- Improved header spacing by removing top margin from h4 elements

### Fixed
- UI spacing improvements for better visual hierarchy

## [1.0.5] - 2025-08-17

### Added
- File path autocomplete when typing `@` symbol in prompt input
- Smart file filtering with filename prioritization
- Keyboard navigation (Arrow keys, Enter/Tab, Escape) for autocomplete dropdown
- Collapsible "Tips and examples" section in the UI
- File cache system with automatic invalidation on vault changes
- Debounced search to improve performance with large vaults

### Changed
- Run button now takes full width of the container
- Tips section is now collapsible and renamed to "Tips and examples"
- Improved example prompts with file reference syntax explanation
- Enhanced UI responsiveness for large vault scenarios

### Fixed
- Performance issues with large vaults (10,000+ files) through caching and optimized search
- Memory usage optimization for file path autocomplete

## [1.0.4] - 2025-08-17

### Added
- Line number range support for text selections
- Enhanced context display showing line ranges in UI (e.g., "lines 5-7")

### Changed
- Context JSON format now includes `lineRange: {start: number, end: number}` when text is selected
- Updated documentation to reflect new context format with line range examples

## [1.0.3] - 2025-08-16

### Added
- PowerShell-based release automation script
- `/new_release` command for Claude Code integration
- Automated GitHub release creation with changelog extraction

### Changed
- Release process now fully automated including version updates, builds, and GitHub releases

### Fixed
- Git tag naming convention (removed 'v' prefix to match Obsidian plugin standards)

## [1.0.2] - 2025-08-16

### Changed
- **BREAKING**: Renamed project from "Claude Code + Gemini CLI" to "Obsidian AI CLI"
- Updated plugin ID from "claude-code-gemini-cli" to "obsidian-ai-cli"
- Updated all class names and interfaces to use "ObsidianAICli" prefix
- Updated documentation and README to reflect new project name

## [1.0.1] - 2025-08-16

### Added
- Comprehensive prompt content display in execution logs
- Full stdin content visibility for debugging

### Changed
- **BREAKING**: All prompts now use stdin instead of command line arguments for improved robustness
- Command construction simplified to always use stdin approach
- Enhanced execution logging to show full prompt content being sent

### Fixed
- Complex text selections with special characters no longer break into separate commands
- Improved handling of prompts with newlines, quotes, and formatting
- Shell escaping issues completely eliminated through stdin approach

### Security
- Eliminated shell injection vulnerabilities by removing command line argument escaping

## [1.0.0] - 2025-08-15

### Added
- Obsidian plugin integrating multiple AI CLI tools (Claude Code, Gemini CLI, OpenAI Codex, and Qwen Code)
- Unified sidebar panels for both AI tools
- Automatic file context detection and passing
- Selected text context support
- Real-time output streaming from CLI tools
- Process management with cancel functionality
- Settings panel for CLI tool configuration
- Support for @file_path syntax in prompts
- Context refresh and debug information display

### Changed

### Fixed

### Security

---

## Template for New Releases

When adding a new release, copy this template:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes in existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security improvements
```

## Release Notes Guidelines

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** in case of vulnerabilities

Keep entries concise but descriptive. Include issue/PR numbers when applicable.

