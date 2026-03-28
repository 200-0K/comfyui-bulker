# Changelog

All notable changes to this project will be documented in this file.

## 0.3.0 - 2026-03-28

- Added configurable dynamic output naming with per-parameter inclusion, ordering, label editing, and safe filename sanitization
- Added compact output naming controls with previews, collapsible UI, and editable prefixes for batch result identification
- Fixed queueing failures for UI-only controls and improved naming behavior for empty prefixes and disabled dynamic naming

## 0.2.0 - 2026-03-23

- Added sortable selected-value rows so per-input execution order can be rearranged directly in the UI
- Added repeat controls and compact row actions for selected values, with subtle available-to-selected transitions
- Fixed Bulker queue submission order so jobs now execute in the same order they are generated

## 0.1.0 - 2026-03-22

- Initial public release of Bulker
- Added topbar launcher and modal UI
- Added node and input selection for widget-backed workflow inputs
- Added combo, text, number, and boolean modifier support
- Added Cartesian product generation and prompt queue submission
- Added local persistence and queue progress UI
- Fixed modal rendering and selector interaction issues
- Fixed scroll-jump behavior in picker and values interactions
