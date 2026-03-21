# Bulker

<p align="center">
  <img src="./assets/readme/bulker-icon.png" alt="Bulker icon" width="160">
</p>

<p align="center">
  <img src="./assets/readme/bulker-demo.gif" alt="Bulker demo" width="900">
</p>

Bulker is a frontend-first workflow variant queue builder for ComfyUI.

It adds a `Bulker` button to the ComfyUI top bar so you can select existing node inputs, assign multiple values, preview the Cartesian product, and queue one prompt per combination without cloning your workflow into a mess of near-duplicates.

## Highlights

- Build variant batches from the workflow you already have open
- Target real widget-backed node inputs instead of duplicating graphs
- Mix multiple modifiers to generate full Cartesian combinations
- Searchable node and input pickers
- Fast combo-value selection plus manual text/number/boolean entry
- Live preview, live job count, and queue progress tracking
- Draggable, resizable modal with local persistence via `localStorage`
- Minimal Python footprint, plain JS frontend, no bundler

## Installation

### ComfyUI-Manager

After Bulker is published to the Comfy Registry, install it from ComfyUI-Manager by searching for `Bulker`.

### Manual install

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/<your-account>/comfyui-bulker.git comfyui-bulker
```

Restart ComfyUI after installation.

## Quick Start

1. Open a workflow in ComfyUI.
2. Click `Bulker` in the top bar.
3. Add one or more modifiers.
4. For each modifier, choose a node and a supported input.
5. Add multiple values.
6. Check the preview and total job count.
7. Click `Start` to queue all combinations.

## Supported Inputs

Bulker currently targets widget-backed inputs that can be safely inspected and mutated from the frontend.

| Input type | Supported |
| --- | --- |
| Combo / select | Yes |
| Text / string | Yes |
| Number | Yes |
| Boolean / toggle | Yes |

## Why It Exists

ComfyUI makes it easy to build workflows, but exploring many prompt or parameter variants often means duplicating nodes, maintaining alternate branches, or manually re-queueing changes. Bulker keeps the workflow single-source and turns value exploration into a queue-building step instead.

## How It Works

Bulker reads the active graph from the frontend, inspects editable widget-backed inputs, exports the current workflow with `app.graphToPrompt()`, mutates selected values for each combination, and submits the resulting prompts sequentially to the ComfyUI queue.

## Usage Notes

- Combo inputs use searchable available and selected lists
- Manual inputs support one-by-one entry and paste-many mode
- Blank lines in paste-many mode are ignored
- Job count is the Cartesian product of all valid modifiers
- `Stop` only stops future Bulker submissions; it does not cancel already accepted ComfyUI jobs
- Large value sets can produce very large queue counts, so batch carefully

## Project Structure

- `__init__.py` exposes `WEB_DIRECTORY = "./js"`
- `js/bulker.js` registers the extension and renders the UI
- `js/graph.js` discovers nodes and supported widgets
- `js/values.js` parses and normalizes entered values
- `js/combinations.js` builds combinations and preview summaries
- `js/queue.js` mutates exported prompts and queues jobs sequentially
- `js/state.js` and `js/persistence.js` manage UI state and `localStorage`
- `js/bulker.css` contains the dialog styling

## Scope

Bulker is intentionally lightweight.

- No custom backend execution nodes
- No external UI framework
- No bundler step
- No remote service or cloud dependency

## Known Limitations

- Only inputs that are detectable as editable widgets in the active graph are shown
- The current batching model is Cartesian product only
- State is stored locally in the browser, not in workflow metadata
- Extremely large combinations can create long queue runs

## Roadmap

- Preset save/load
- Import/export config
- Alternate batching modes beyond Cartesian product
- Better preview ergonomics for large runs
- Example workflows for common use cases

## Development

Bulker is a plain JavaScript ComfyUI frontend extension with a minimal Python entrypoint.

```bash
cd ComfyUI/custom_nodes/comfyui-bulker
```

Edit files in `js/`, refresh or restart ComfyUI, and test from the `Bulker` topbar button.

## Credits

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) for the core application and extension APIs
