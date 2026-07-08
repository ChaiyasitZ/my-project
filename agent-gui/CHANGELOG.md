# Changelog

All notable changes to the NetConfig Agent GUI are documented in this file.

## [1.3.0] - 2026-07-08

### Changed
- Command polling interval lowered from 2s to 1s, so SSH/deploy/console actions started from the web app are picked up about twice as fast.
- Interactive shell input polling tightened from 500ms to 300ms for a more responsive live console.

## [1.2.0] - 2026-07-08

### Changed
- Agent GUI is now Windows-only. Removed macOS/Linux electron-builder build targets and scripts.
- Removed the macOS-specific `window-all-closed` exception; the app now always quits when its window is closed.

### Fixed
- Rebuilt distributable to reflect the Windows-only packaging config.

## [1.1.0] - 2026-03-12

### Added
- Initial cross-platform release (Windows/macOS/Linux) with system tray integration, connection settings, and Ollama status.
