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

## [1.0.3] - 2025-08-16

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

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
