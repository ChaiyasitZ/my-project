# Changelog

All notable changes to the NetConfig Agent GUI are documented in this file.

## [1.2.0] - 2026-07-08

### Changed
- Agent GUI is now Windows-only. Removed macOS/Linux electron-builder build targets and scripts.
- Removed the macOS-specific `window-all-closed` exception; the app now always quits when its window is closed.

### Fixed
- Rebuilt distributable to reflect the Windows-only packaging config.

## [1.1.0] - 2026-03-12

### Added
- Initial cross-platform release (Windows/macOS/Linux) with system tray integration, connection settings, and Ollama status.
