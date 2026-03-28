import { app } from "../../scripts/app.js";
import { $el } from "../../scripts/ui.js";
import {
  appendFilenameSuffix,
  buildCombinationFilenameSuffix,
  getDefaultFilenameRuleLabel,
  getOutputNamingBasePrefix,
} from "./filenames.js";
import { DEFAULT_QUEUE_DELAY_MS, queueCombinations } from "./queue.js";
import {
  formatCombinationSummary,
  getCombinationPreview,
  getJobCount,
  getModifierExecutionCount,
  getValidModifiers,
} from "./combinations.js";
import {
  getEditableWidget,
  getEditableWidgets,
  getNodeById,
  getNodeChoices,
  validateModifier,
} from "./graph.js";
import { loadState, saveState } from "./persistence.js";
import { createModifier, createModifierValueRow, createOutputNamingRule, createState } from "./state.js";
import { dedupeValues, formatValue, getValueKey, parseManualValues, valuesToText } from "./values.js";

const EXTENSION_NAME = "bulker";
const EXTENSION_LABEL = "Bulker";
const DEBUG = false;

const MIN_MODAL_WIDTH = 720;
const MIN_MODAL_HEIGHT = 520;
const EDGE_PADDING = 16;
const VALUE_TRANSITION_MS = 180;
const REPEAT_BADGE_POP_MS = 140;

const ICONS = {
  add: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>`,
  remove: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>`,
  trash: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 4.5h9M6.5 2.75h3M5.2 4.5l.5 7h4.6l.5-7"/><path d="M6.5 6.5v3.5M9.5 6.5v3.5"/></svg>`,
  play: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.75l7 4.25-7 4.25z"/></svg>`,
  stop: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 5h6v6H5z"/></svg>`,
  forward: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l4 4-4 4M8 4l4 4-4 4"/></svg>`,
  paste: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2.75h4M5.5 4H4.75v8.25h6.5V11.5"/><path d="M9.5 5.5h3.75v3.75M8.25 10.5L13.25 5.5"/></svg>`,
  search: `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="3.75"/><path d="M10 10l2.75 2.75"/></svg>`,
  queue: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.25h10M3 8h10M3 11.75h6"/></svg>`,
  list: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.75 4.25h7.5M4.75 8h7.5M4.75 11.75h7.5"/><circle cx="3" cy="4.25" r=".8"/><circle cx="3" cy="8" r=".8"/><circle cx="3" cy="11.75" r=".8"/></svg>`,
  fork: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.25v4.5M11 3.25v2.5M8 12.75V9.5M5 7.75c0 1.5 1.25 1.75 3 1.75s3-.25 3-1.75"/><circle cx="5" cy="2.5" r="1.25"/><circle cx="11" cy="2.5" r="1.25"/><circle cx="8" cy="13.5" r="1.25"/></svg>`,
  modifier: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M3 8h10M3 12h10"/></svg>`,
  close: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>`,
  plusBox: `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.75" y="2.75" width="10.5" height="10.5" rx="2"/><path d="M8 5.25v5.5M5.25 8h5.5"/></svg>`,
  checkBox: `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.75" y="2.75" width="10.5" height="10.5" rx="2"/><path d="M5.5 8.25l1.75 1.75 3.25-3.5"/></svg>`,
  arrowUp: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 12.25v-8.5M4.75 7l3.25-3.25L11.25 7"/></svg>`,
  arrowDown: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.75v8.5M4.75 9l3.25 3.25L11.25 9"/></svg>`,
  chevronDown: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6.25 8 9.75l3.5-3.5"/></svg>`,
  chevronRight: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.25 4.5 9.75 8l-3.5 3.5"/></svg>`,
  grip: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.25 3.5h.01M5.25 8h.01M5.25 12.5h.01M10.75 3.5h.01M10.75 8h.01M10.75 12.5h.01"/></svg>`,
  dot: `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.2"/></svg>`,
};

function debugLog(...args) {
  if (DEBUG) {
    console.log("[bulker]", ...args);
  }
}

function ensureStylesheet() {
  const styleId = "bulker-styles";
  if (document.getElementById(styleId)) {
    return;
  }

  const link = document.createElement("link");
  link.id = styleId;
  link.rel = "stylesheet";
  link.href = new URL("./bulker.css", import.meta.url).href;
  document.head.appendChild(link);
}

function notify(message, severity = "info", detail = "") {
  try {
    if (app.extensionManager?.toast?.add) {
      app.extensionManager.toast.add({
        severity,
        summary: EXTENSION_LABEL,
        detail: detail || message,
        life: severity === "error" ? 5000 : 3000,
      });
      return;
    }

    if (app.extensionManager?.toast?.addAlert) {
      app.extensionManager.toast.addAlert(detail || message);
      return;
    }
  } catch (error) {
    debugLog("Toast failed", error);
  }

  alert(detail || message);
}

function truncate(text, maxLength = 36) {
  const value = String(text ?? "");
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function displayText(value, fallback = "-") {
  if (value == null) {
    return fallback;
  }

  const text = String(value);
  return text.length ? text : fallback;
}

function displayValue(value) {
  if (value == null) {
    return "Empty";
  }

  return formatValue(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getViewportMaxWidth() {
  return Math.max(MIN_MODAL_WIDTH, window.innerWidth - EDGE_PADDING * 2);
}

function getViewportMaxHeight() {
  return Math.max(MIN_MODAL_HEIGHT, window.innerHeight - EDGE_PADDING * 2);
}

function getDefaultModalRect() {
  const maxWidth = getViewportMaxWidth();
  const maxHeight = getViewportMaxHeight();
  const width = clamp(920, MIN_MODAL_WIDTH, maxWidth);
  const height = clamp(700, MIN_MODAL_HEIGHT, maxHeight);

  return {
    width,
    height,
    left: Math.round((window.innerWidth - width) / 2),
    top: Math.round((window.innerHeight - height) / 2),
  };
}

function clampModalRect(rect) {
  const maxWidth = getViewportMaxWidth();
  const maxHeight = getViewportMaxHeight();
  const width = clamp(rect.width, MIN_MODAL_WIDTH, maxWidth);
  const height = clamp(rect.height, MIN_MODAL_HEIGHT, maxHeight);
  const left = clamp(rect.left, EDGE_PADDING, window.innerWidth - EDGE_PADDING - width);
  const top = clamp(rect.top, EDGE_PADDING, window.innerHeight - EDGE_PADDING - height);

  return {
    width,
    height,
    left,
    top,
  };
}

function getIcon(name, className = "") {
  return $el("span", {
    className: `bulker-icon ${className}`.trim(),
    innerHTML: ICONS[name] ?? ICONS.dot,
  });
}

function createIconButton({
  icon,
  title,
  onclick,
  disabled = false,
  tone = "default",
  active = false,
  className = "",
}) {
  return $el(
    "button",
    {
      type: "button",
      className: `bulker-icon-button bulker-icon-button-${tone} ${active ? "is-active" : ""} ${className}`.trim(),
      title,
      disabled,
      onclick,
      "aria-label": title,
      "aria-pressed": active ? "true" : "false",
      dataset: {
        tooltip: title,
      },
    },
    [getIcon(icon)]
  );
}

function createPickerState() {
  return {
    open: false,
    filter: "",
  };
}

function summarizeModifierState(modifier) {
  if (modifier.valid) {
    return "valid";
  }

  if (!modifier.nodeId || !modifier.inputName || !modifier.values.length) {
    return "partial";
  }

  return "invalid";
}

function formatFactorFormula(modifiers) {
  const factors = getValidModifiers(modifiers).map((modifier) => getModifierExecutionCount(modifier));
  return factors.length ? factors.join(" x ") : "0";
}

function getRowRepeat(row) {
  return Math.max(1, Number(row?.repeat) || 1);
}

function getRowValueKey(inputType, row) {
  return getValueKey(inputType, row?.value);
}

function expandModifierRows(rows) {
  const expanded = [];

  for (const row of rows ?? []) {
    for (let repeatIndex = 0; repeatIndex < getRowRepeat(row); repeatIndex += 1) {
      expanded.push(row?.value);
    }
  }

  return expanded;
}

function syncManualValueText(modifier, rows) {
  if (modifier.inputType === "combo") {
    return modifier.manualValueText;
  }

  return valuesToText(expandModifierRows(rows));
}

function setModifierRows(modifier, rows) {
  return {
    ...modifier,
    values: rows,
    manualValueText: syncManualValueText(modifier, rows),
  };
}

function createUniqueRows(modifier, values) {
  const existingKeys = new Set((modifier.values ?? []).map((row) => getRowValueKey(modifier.inputType, row)));
  return dedupeValues(modifier.inputType, values)
    .filter((value) => !existingKeys.has(getValueKey(modifier.inputType, value)))
    .map((value) => createModifierValueRow({ value, repeat: 1 }));
}

function getSelectedRowDropPosition(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY >= rect.top + rect.height / 2 ? "after" : "before";
}

function getAvailablePaneEmptyMessage(filteredOptions, filteredAvailableOptions) {
  if (!filteredOptions.length) {
    return "No matches";
  }

  if (!filteredAvailableOptions.length) {
    return "All matching values are selected";
  }

  return "No matches";
}

function getOutputNamingSourceLabel(modifier) {
  const nodeLabel = displayText(modifier?.nodeLabel, modifier?.nodeId ? `[${modifier.nodeId}] Node` : "Node");
  const inputLabel = displayText(modifier?.inputLabel, modifier?.inputName || "Input");
  return `${nodeLabel} -> ${inputLabel}`;
}

function getOrderedOutputNamingModifierIds(existingRules, modifiers) {
  const modifierIds = new Set((modifiers ?? []).map((modifier) => String(modifier.id)));
  const orderedModifierIds = [];

  for (const rule of existingRules ?? []) {
    const modifierId = String(rule?.modifierId ?? "");
    if (!modifierId || !modifierIds.has(modifierId) || orderedModifierIds.includes(modifierId)) {
      continue;
    }

    orderedModifierIds.push(modifierId);
  }

  for (const modifier of modifiers ?? []) {
    const modifierId = String(modifier.id);
    if (!orderedModifierIds.includes(modifierId)) {
      orderedModifierIds.push(modifierId);
    }
  }

  return orderedModifierIds;
}

class BulkerDialog {
  constructor(controller) {
    this.controller = controller;
    const initialRect = getDefaultModalRect();
    this.element = $el(
      "div.bulker-modal",
      {
        parent: document.body,
        style: { display: "none" },
        onclick: (event) => {
          if (event.target === this.element) {
            this.controller.close();
          }
        },
      },
      [
        (this.shell = $el("div.bulker-shell", {
          style: {
            width: `${initialRect.width}px`,
            height: `${initialRect.height}px`,
            left: `${initialRect.left}px`,
            top: `${initialRect.top}px`,
          },
        }, [
          (this.header = $el("div.bulker-header", {
            onmousedown: (event) => this.controller.startDrag(event),
          }, [
            $el("div.bulker-header-main", {}, [
              $el("div.bulker-title-row", {}, [
                getIcon("modifier"),
                $el("h2.bulker-title", { textContent: EXTENSION_LABEL }),
              ]),
              $el("div.bulker-title-sub", { textContent: "Workflow variant queue builder" }),
            ]),
            (this.headerStats = $el("div.bulker-header-stats")),
          ])),
          $el("div.bulker-body", {}, [
            $el("div.bulker-main", {}, [
              (this.modifiersContainer = $el("div.bulker-modifiers", {
                dataset: {
                  bulkerScrollKey: "modifiers",
                },
              })),
            ]),
            (this.sidebar = $el("div.bulker-sidebar", { dataset: { bulkerScrollKey: "sidebar" } }, [
              (this.previewCard = $el("div.bulker-side-card")),
              (this.namingCard = $el("div.bulker-side-card")),
              (this.progressCard = $el("div.bulker-side-card")),
            ])),
          ]),
          $el("div.bulker-footer", {}, [
            (this.footerMeta = $el("div.bulker-footer-meta")),
            $el("div.bulker-footer-actions", {}, [
              (this.addButton = createIconButton({
                icon: "add",
                title: "Add modifier",
                onclick: () => this.controller.addModifier(),
              })),
              (this.startButton = createIconButton({
                icon: "play",
                title: "Start queueing",
                onclick: () => this.controller.startQueueing(),
                tone: "accent",
              })),
              (this.stopButton = createIconButton({
                icon: "stop",
                title: "Stop queueing",
                onclick: () => this.controller.stopQueueing(),
                tone: "danger",
              })),
              (this.closeButton = createIconButton({
                icon: "close",
                title: "Close Bulker",
                onclick: () => this.controller.close(),
              })),
            ]),
          ]),
          (this.resizeHandle = $el("div.bulker-resize-handle", {
            title: "Resize",
            onmousedown: (event) => this.controller.startResize(event),
          })),
        ])),
      ]
    );
  }

  show() {
    this.element.style.display = "flex";
  }

  close() {
    this.element.style.display = "none";
  }
}

class BulkerController {
  constructor() {
    this.state = createState(loadState());
    this.uiState = { modifiers: {} };
    this.queueState = {
      active: false,
      stopRequested: false,
      queuedJobs: 0,
      totalJobs: 0,
      status: "idle",
      currentSummary: "Waiting to queue.",
    };
    this.pendingScrollSnapshot = null;
    this.skipNextFocusRestore = false;
    this.modalRect = getDefaultModalRect();
    this.dragState = null;
    this.selectedRowDrag = null;
    this.namingRuleDrag = null;
    this.resizeState = null;
    this.dialog = new BulkerDialog(this);
    this.toolbarButton = null;

    if (!this.state.modifiers.length) {
      this.state.modifiers.push(createModifier());
    }

    this.state.modifiers = this.state.modifiers.map((modifier) => {
      if (
        modifier.inputType &&
        modifier.inputType !== "combo" &&
        (!Array.isArray(modifier.values) || modifier.values.length === 0) &&
        modifier.manualValueText
      ) {
        const parsed = parseManualValues(modifier.inputType, modifier.manualValueText);
        return {
          ...modifier,
          values: parsed.values.map((value) => createModifierValueRow({ value, repeat: 1 })),
          parseErrors: parsed.errors,
        };
      }

      return modifier;
    });

    this.attachGlobalHandlers();
    this.syncState();
  }

  attachGlobalHandlers() {
    window.addEventListener("mousemove", (event) => this.handlePointerMove(event));
    window.addEventListener("mouseup", () => this.endPointerAction());
    window.addEventListener("resize", () => {
      this.modalRect = clampModalRect(this.modalRect);
      this.applyModalRect();
    });
    document.addEventListener("mousedown", (event) => {
      if (!this.dialog.element.contains(event.target)) {
        this.closeAllPickers();
      }
    });
  }

  persist() {
    saveState(this.state);
  }

  getModifier(modifierId) {
    return this.state.modifiers.find((modifier) => modifier.id === modifierId) ?? null;
  }

  getModifierUiState(modifierId) {
    if (!this.uiState.modifiers[modifierId]) {
      const modifier = this.getModifier(modifierId);
      this.uiState.modifiers[modifierId] = {
        manualDraft: "",
        draftError: "",
        pasteOpen: false,
        pasteBuffer: modifier?.manualValueText ?? "",
        animations: {
          enteringSelected: new Set(),
          leavingAvailable: new Map(),
          bumpRepeat: new Set(),
        },
        pickers: {
          node: createPickerState(),
          input: createPickerState(),
        },
      };
    }

    return this.uiState.modifiers[modifierId];
  }

  cleanupUiState() {
    const validIds = new Set(this.state.modifiers.map((modifier) => modifier.id));
    for (const modifierId of Object.keys(this.uiState.modifiers)) {
      if (!validIds.has(modifierId)) {
        delete this.uiState.modifiers[modifierId];
      }
    }

    for (const modifier of this.state.modifiers) {
      this.getModifierUiState(modifier.id);
    }
  }

  syncOutputNamingRules() {
    const existingRules = this.state.outputNaming?.rules ?? [];
    const rulesByModifierId = new Map(
      existingRules.map((rule) => [String(rule.modifierId ?? ""), rule])
    );
    const orderedModifierIds = getOrderedOutputNamingModifierIds(existingRules, this.state.modifiers);

    this.state.outputNaming = {
      enabled: Boolean(this.state.outputNaming?.enabled),
      collapsed: Boolean(this.state.outputNaming?.collapsed),
      basePrefix: String(this.state.outputNaming?.basePrefix ?? "bulker-"),
      rules: orderedModifierIds.map((modifierId) =>
        createOutputNamingRule({
          ...rulesByModifierId.get(modifierId),
          modifierId,
        })
      ),
    };
  }

  getOutputNamingModifiers() {
    const configuredModifierIds = new Set(
      this.state.modifiers
        .filter((modifier) => modifier?.nodeId && modifier?.inputName)
        .map((modifier) => modifier.id)
    );

    return (this.state.outputNaming?.rules ?? [])
      .map((rule) => ({
        rule,
        modifier: this.getModifier(rule.modifierId),
      }))
      .filter(({ modifier }) => modifier && configuredModifierIds.has(modifier.id));
  }

  getOutputNamingPreviewEntries(limit = 3) {
    if (!this.state.outputNaming?.enabled) {
      return [];
    }

    const basePrefix = getOutputNamingBasePrefix(this.state.outputNaming);
    const previewEntries = getCombinationPreview(this.state.modifiers, limit)
      .map((combination) =>
        buildCombinationFilenameSuffix({
          combination,
          outputNaming: this.state.outputNaming,
          modifiers: this.state.modifiers,
        })
      )
      .filter(Boolean)
      .map((suffix) => appendFilenameSuffix(basePrefix, suffix));

    if (previewEntries.length) {
      return previewEntries;
    }

    return basePrefix ? [basePrefix] : [];
  }

  scheduleModifierAnimationCleanup(modifierId, cleanup, delay = VALUE_TRANSITION_MS) {
    window.setTimeout(() => {
      const uiState = this.uiState.modifiers[modifierId];
      if (!uiState) {
        return;
      }

      cleanup(uiState);
      if (this.getModifier(modifierId)) {
        this.renderModifierUpdate(modifierId);
      }
    }, delay);
  }

  markSelectedRowEntering(modifierId, rowId) {
    const uiState = this.getModifierUiState(modifierId);
    uiState.animations.enteringSelected.add(rowId);
    this.scheduleModifierAnimationCleanup(modifierId, (nextUiState) => {
      nextUiState.animations.enteringSelected.delete(rowId);
    });
  }

  markAvailableValueLeaving(modifierId, value) {
    const modifier = this.getModifier(modifierId);
    if (!modifier) {
      return;
    }

    const uiState = this.getModifierUiState(modifierId);
    const valueKey = getValueKey(modifier.inputType, value);
    uiState.animations.leavingAvailable.set(valueKey, value);
    this.scheduleModifierAnimationCleanup(modifierId, (nextUiState) => {
      nextUiState.animations.leavingAvailable.delete(valueKey);
    });
  }

  bumpRepeatBadge(modifierId, rowId) {
    const uiState = this.getModifierUiState(modifierId);
    uiState.animations.bumpRepeat.add(rowId);
    this.scheduleModifierAnimationCleanup(modifierId, (nextUiState) => {
      nextUiState.animations.bumpRepeat.delete(rowId);
    }, REPEAT_BADGE_POP_MS);
  }

  appendModifierRows(modifierId, values, { duplicateMessage = "", animateAvailable = false } = {}) {
    const modifier = this.getModifier(modifierId);
    if (!modifier) {
      return { added: false, message: duplicateMessage };
    }

    const nextRows = createUniqueRows(modifier, values ?? []);
    if (!nextRows.length) {
      return { added: false, message: duplicateMessage };
    }

    this.prepareSelectionMutation();

    nextRows.forEach((row) => {
      if (animateAvailable) {
        this.markAvailableValueLeaving(modifierId, row.value);
      }
      this.markSelectedRowEntering(modifierId, row.id);
    });

    this.updateModifier(modifierId, (currentModifier) =>
      setModifierRows(currentModifier, [...currentModifier.values, ...nextRows])
    );

    return { added: true, message: "" };
  }

  updateModifierRowRepeat(modifierId, rowId, updater) {
    this.updateModifier(modifierId, (modifier) =>
      setModifierRows(
        modifier,
        modifier.values.map((row) =>
          row.id === rowId
            ? {
                ...row,
                repeat: Math.max(1, Math.round(updater(getRowRepeat(row)))),
              }
            : row
        )
      )
    );
  }

  captureFocusSnapshot() {
    const activeElement = document.activeElement;
    if (!activeElement || !this.dialog.element.contains(activeElement)) {
      return null;
    }

    const focusKey = activeElement.dataset?.bulkerFocusKey;
    if (!focusKey) {
      return null;
    }

    return {
      focusKey,
      selectionStart:
        typeof activeElement.selectionStart === "number" ? activeElement.selectionStart : null,
      selectionEnd:
        typeof activeElement.selectionEnd === "number" ? activeElement.selectionEnd : null,
      selectionDirection: activeElement.selectionDirection ?? "none",
      scrollTop: typeof activeElement.scrollTop === "number" ? activeElement.scrollTop : 0,
    };
  }

  restoreFocusSnapshot(snapshot) {
    if (!snapshot) {
      return;
    }

    requestAnimationFrame(() => {
      const element = Array.from(
        this.dialog.element.querySelectorAll("[data-bulker-focus-key]")
      ).find((candidate) => candidate.dataset.bulkerFocusKey === snapshot.focusKey);
      if (!element) {
        return;
      }

      try {
        element.focus({ preventScroll: true });
      } catch {
        element.focus();
      }

      if (
        typeof snapshot.selectionStart === "number" &&
        typeof snapshot.selectionEnd === "number" &&
        typeof element.setSelectionRange === "function"
      ) {
        element.setSelectionRange(
          snapshot.selectionStart,
          snapshot.selectionEnd,
          snapshot.selectionDirection
        );
      }

      if (typeof element.scrollTop === "number") {
        element.scrollTop = snapshot.scrollTop;
      }
    });
  }

  captureScrollSnapshot() {
    const snapshot = {};
    const scrollableElements = this.dialog.element.querySelectorAll("[data-bulker-scroll-key]");

    scrollableElements.forEach((element) => {
      const key = element.dataset?.bulkerScrollKey;
      if (!key) {
        return;
      }

      snapshot[key] = {
        top: typeof element.scrollTop === "number" ? element.scrollTop : 0,
        left: typeof element.scrollLeft === "number" ? element.scrollLeft : 0,
      };
    });

    return snapshot;
  }

  stashScrollSnapshot(snapshot = this.captureScrollSnapshot()) {
    this.pendingScrollSnapshot = snapshot;
  }

  prepareSelectionMutation() {
    this.stashScrollSnapshot();
    this.skipNextFocusRestore = true;

    const activeElement = document.activeElement;
    if (
      activeElement &&
      activeElement !== document.body &&
      this.dialog.element.contains(activeElement) &&
      typeof activeElement.blur === "function"
    ) {
      activeElement.blur();
    }
  }

  restoreScrollSnapshot(snapshot) {
    if (!snapshot) {
      return;
    }

    const applySnapshot = () => {
      const scrollableElements = Array.from(
        this.dialog.element.querySelectorAll("[data-bulker-scroll-key]")
      );

      for (const [key, position] of Object.entries(snapshot)) {
        const element = scrollableElements.find(
          (candidate) => candidate.dataset?.bulkerScrollKey === key
        );
        if (!element) {
          continue;
        }

        element.scrollTop = position.top ?? 0;
        element.scrollLeft = position.left ?? 0;
      }
    };

    applySnapshot();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applySnapshot();
      });
    });
  }

  closeAllPickers(except = null) {
    for (const modifierId of Object.keys(this.uiState.modifiers)) {
      const pickerState = this.getModifierUiState(modifierId).pickers;
      for (const kind of Object.keys(pickerState)) {
        if (except && except.modifierId === modifierId && except.kind === kind) {
          continue;
        }
        pickerState[kind].open = false;
      }
    }
  }

  hasOpenPickerOutside(modifierId, kind) {
    for (const candidateModifierId of Object.keys(this.uiState.modifiers)) {
      const pickerState = this.getModifierUiState(candidateModifierId).pickers;
      for (const candidateKind of Object.keys(pickerState)) {
        if (candidateModifierId === modifierId && candidateKind === kind) {
          continue;
        }

        if (pickerState[candidateKind].open) {
          return true;
        }
      }
    }

    return false;
  }

  syncState() {
    this.state.modifiers = this.state.modifiers.map((modifier) => {
      const nextModifier = { ...modifier, parseErrors: [] };
      return validateModifier(nextModifier);
    });

    this.syncOutputNamingRules();
    this.cleanupUiState();
    this.persist();
  }

  open() {
    this.state.ui.open = true;
    this.syncState();
    this.dialog.show();
    this.modalRect = clampModalRect(this.modalRect || getDefaultModalRect());
    this.applyModalRect();
    this.render();
  }

  close() {
    this.state.ui.open = false;
    this.closeAllPickers();
    this.selectedRowDrag = null;
    this.namingRuleDrag = null;
    this.persist();
    this.dialog.close();
  }

  applyModalRect() {
    const rect = clampModalRect(this.modalRect || getDefaultModalRect());
    this.modalRect = rect;
    Object.assign(this.dialog.shell.style, {
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      transform: "none",
    });
  }

  isInteractiveTarget(target) {
    return Boolean(
      target.closest(
        "button,input,textarea,select,option,.bulker-picker-option,.bulker-resize-handle,.bulker-value-row"
      )
    );
  }

  startDrag(event) {
    if (event.button !== 0 || this.isInteractiveTarget(event.target)) {
      return;
    }

    event.preventDefault();
    this.dragState = {
      startX: event.clientX,
      startY: event.clientY,
      rect: { ...this.modalRect },
    };
  }

  startResize(event) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.resizeState = {
      startX: event.clientX,
      startY: event.clientY,
      rect: { ...this.modalRect },
    };
  }

  handlePointerMove(event) {
    if (this.dragState) {
      const nextRect = {
        ...this.dragState.rect,
        left: this.dragState.rect.left + (event.clientX - this.dragState.startX),
        top: this.dragState.rect.top + (event.clientY - this.dragState.startY),
      };
      this.modalRect = clampModalRect(nextRect);
      this.applyModalRect();
      return;
    }

    if (this.resizeState) {
      const nextRect = {
        ...this.resizeState.rect,
        width: this.resizeState.rect.width + (event.clientX - this.resizeState.startX),
        height: this.resizeState.rect.height + (event.clientY - this.resizeState.startY),
      };
      this.modalRect = clampModalRect(nextRect);
      this.applyModalRect();
    }
  }

  endPointerAction() {
    this.dragState = null;
    this.resizeState = null;
  }

  clearSelectedRowDropIndicator() {
    if (!this.selectedRowDrag?.indicatorElement) {
      return;
    }

    this.selectedRowDrag.indicatorElement.classList.remove(
      "is-drop-before",
      "is-drop-after",
      "is-drop-target"
    );
    this.selectedRowDrag.indicatorElement = null;
    this.selectedRowDrag.dropPosition = null;
    this.selectedRowDrag.dropRowId = null;
  }

  startSelectedRowDrag(event, modifierId, rowId) {
    if (this.queueState.active) {
      event.preventDefault();
      return;
    }

    event.stopPropagation();
    this.stashScrollSnapshot();
    this.selectedRowDrag = {
      modifierId,
      rowId,
      indicatorElement: null,
      dropPosition: null,
      dropRowId: null,
    };

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", rowId);
    }

    const rowElement = event.currentTarget.closest(".bulker-selected-row");
    if (rowElement) {
      rowElement.classList.add("is-dragging");
    }
  }

  updateSelectedRowDropIndicator(element, position, rowId) {
    if (!this.selectedRowDrag) {
      return;
    }

    if (this.selectedRowDrag.indicatorElement !== element) {
      this.clearSelectedRowDropIndicator();
    }

    element.classList.add("is-drop-target");
    element.classList.toggle("is-drop-before", position === "before");
    element.classList.toggle("is-drop-after", position === "after");
    this.selectedRowDrag.indicatorElement = element;
    this.selectedRowDrag.dropPosition = position;
    this.selectedRowDrag.dropRowId = rowId;
  }

  handleSelectedRowDragOver(event, modifierId, rowId) {
    if (!this.selectedRowDrag || this.selectedRowDrag.modifierId !== modifierId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (this.selectedRowDrag.rowId === rowId) {
      this.clearSelectedRowDropIndicator();
      return;
    }

    const position = getSelectedRowDropPosition(event);
    this.updateSelectedRowDropIndicator(event.currentTarget, position, rowId);
  }

  handleSelectedRowDragLeave(event) {
    if (!this.selectedRowDrag || this.selectedRowDrag.indicatorElement !== event.currentTarget) {
      return;
    }

    const nextTarget = event.relatedTarget;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }

    this.clearSelectedRowDropIndicator();
  }

  moveModifierValueRow(modifierId, rowId, targetRowId, position) {
    if (!targetRowId || !position) {
      return;
    }

    this.prepareSelectionMutation();
    this.updateModifier(modifierId, (modifier) => {
      const rows = [...modifier.values];
      const fromIndex = rows.findIndex((row) => row.id === rowId);
      const targetIndex = rows.findIndex((row) => row.id === targetRowId);
      if (fromIndex === -1 || targetIndex === -1) {
        return modifier;
      }

      const [movedRow] = rows.splice(fromIndex, 1);
      const insertionIndex = rows.findIndex((row) => row.id === targetRowId);
      if (insertionIndex === -1) {
        rows.push(movedRow);
      } else {
        rows.splice(position === "after" ? insertionIndex + 1 : insertionIndex, 0, movedRow);
      }

      return setModifierRows(modifier, rows);
    });
  }

  handleSelectedRowDrop(event, modifierId, rowId) {
    if (!this.selectedRowDrag || this.selectedRowDrag.modifierId !== modifierId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (this.selectedRowDrag.rowId === rowId) {
      this.clearSelectedRowDropIndicator();
      return;
    }

    const position = getSelectedRowDropPosition(event);
    this.moveModifierValueRow(modifierId, this.selectedRowDrag.rowId, rowId, position);
    this.clearSelectedRowDropIndicator();
  }

  endSelectedRowDrag(event) {
    event.currentTarget.closest(".bulker-selected-row")?.classList.remove("is-dragging");
    this.clearSelectedRowDropIndicator();
    this.selectedRowDrag = null;
  }

  clearNamingRuleDropIndicator() {
    if (!this.namingRuleDrag?.indicatorElement) {
      return;
    }

    this.namingRuleDrag.indicatorElement.classList.remove(
      "is-drop-before",
      "is-drop-after",
      "is-drop-target"
    );
    this.namingRuleDrag.indicatorElement = null;
    this.namingRuleDrag.dropPosition = null;
    this.namingRuleDrag.dropModifierId = null;
  }

  startNamingRuleDrag(event, modifierId) {
    if (this.queueState.active) {
      event.preventDefault();
      return;
    }

    event.stopPropagation();
    this.stashScrollSnapshot();
    this.namingRuleDrag = {
      modifierId,
      indicatorElement: null,
      dropPosition: null,
      dropModifierId: null,
    };

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", modifierId);
    }

    const rowElement = event.currentTarget.closest(".bulker-naming-rule-shell");
    if (rowElement) {
      rowElement.classList.add("is-dragging");
    }
  }

  updateNamingRuleDropIndicator(element, position, modifierId) {
    if (!this.namingRuleDrag) {
      return;
    }

    if (this.namingRuleDrag.indicatorElement !== element) {
      this.clearNamingRuleDropIndicator();
    }

    element.classList.add("is-drop-target");
    element.classList.toggle("is-drop-before", position === "before");
    element.classList.toggle("is-drop-after", position === "after");
    this.namingRuleDrag.indicatorElement = element;
    this.namingRuleDrag.dropPosition = position;
    this.namingRuleDrag.dropModifierId = modifierId;
  }

  handleNamingRuleDragOver(event, modifierId) {
    if (!this.namingRuleDrag) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (this.namingRuleDrag.modifierId === modifierId) {
      this.clearNamingRuleDropIndicator();
      return;
    }

    const position = getSelectedRowDropPosition(event);
    this.updateNamingRuleDropIndicator(event.currentTarget, position, modifierId);
  }

  handleNamingRuleDragLeave(event) {
    if (!this.namingRuleDrag || this.namingRuleDrag.indicatorElement !== event.currentTarget) {
      return;
    }

    const nextTarget = event.relatedTarget;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }

    this.clearNamingRuleDropIndicator();
  }

  moveOutputNamingRuleToTarget(modifierId, targetModifierId, position) {
    if (!modifierId || !targetModifierId || !position) {
      return;
    }

    const rules = [...(this.state.outputNaming?.rules ?? [])];
    const fromIndex = rules.findIndex((rule) => rule.modifierId === modifierId);
    if (fromIndex === -1) {
      return;
    }

    const nextRules = [...rules];
    const [movedRule] = nextRules.splice(fromIndex, 1);
    const insertionIndex = nextRules.findIndex((rule) => rule.modifierId === targetModifierId);
    if (insertionIndex === -1) {
      return;
    }

    nextRules.splice(position === "after" ? insertionIndex + 1 : insertionIndex, 0, movedRule);
    this.prepareSelectionMutation();
    this.state.outputNaming = {
      ...this.state.outputNaming,
      rules: nextRules,
    };
    this.render();
  }

  handleNamingRuleDrop(event, modifierId) {
    if (!this.namingRuleDrag) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (this.namingRuleDrag.modifierId === modifierId) {
      this.clearNamingRuleDropIndicator();
      return;
    }

    const position = getSelectedRowDropPosition(event);
    this.moveOutputNamingRuleToTarget(this.namingRuleDrag.modifierId, modifierId, position);
    this.clearNamingRuleDropIndicator();
  }

  endNamingRuleDrag(event) {
    event.currentTarget.closest(".bulker-naming-rule-shell")?.classList.remove("is-dragging");
    this.clearNamingRuleDropIndicator();
    this.namingRuleDrag = null;
  }

  render() {
    const focusSnapshot = this.skipNextFocusRestore ? null : this.captureFocusSnapshot();
    this.skipNextFocusRestore = false;
    const scrollSnapshot = this.pendingScrollSnapshot ?? this.captureScrollSnapshot();
    this.pendingScrollSnapshot = null;
    this.syncState();
    this.renderChrome();
    this.renderModifiers();
    this.renderPreview();
    this.renderProgress();
    this.renderOutputNamingSafe();
    this.restoreFocusSnapshot(focusSnapshot);
    this.restoreScrollSnapshot(scrollSnapshot);
  }

  renderModifierUpdate(modifierId) {
    const focusSnapshot = this.skipNextFocusRestore ? null : this.captureFocusSnapshot();
    this.skipNextFocusRestore = false;
    const scrollSnapshot = this.pendingScrollSnapshot ?? this.captureScrollSnapshot();
    this.pendingScrollSnapshot = null;
    this.syncState();

    this.renderChrome();
    this.renderModifierCardInPlace(modifierId);
    this.renderPreview();
    this.renderProgress();
    this.renderOutputNamingSafe();
    this.restoreFocusSnapshot(focusSnapshot);
    this.restoreScrollSnapshot(scrollSnapshot);
  }

  renderOutputNamingSafe() {
    try {
      this.renderOutputNaming();
    } catch (error) {
      console.error("[bulker] Output naming render failed", error);
      this.dialog.namingCard.replaceChildren(
        ...[
          $el("div.bulker-side-head", {}, [
            $el("div.bulker-side-title", {}, [getIcon("checkBox"), $el("span", { textContent: "Output Names" })]),
          ]),
          $el("div", {
            className: "bulker-inline-note bulker-inline-error",
            textContent: error?.message || "Output naming failed to render.",
          }),
        ].filter(Boolean)
      );
    }
  }

  renderChrome() {
    const totalJobs = getJobCount(this.state.modifiers);
    const validModifiers = getValidModifiers(this.state.modifiers);
    const outputNamingEnabled = Boolean(this.state.outputNaming?.enabled);

    this.dialog.headerStats.replaceChildren(
      this.renderStatChip("fork", `${this.state.modifiers.length}`, "Modifier count"),
      this.renderStatChip("list", `${totalJobs}`, "Job count")
    );
    this.dialog.footerMeta.textContent = `${validModifiers.length} ready • ${DEFAULT_QUEUE_DELAY_MS}ms delay • names ${outputNamingEnabled ? "on" : "off"}`;
    this.dialog.addButton.disabled = this.queueState.active;
    this.dialog.startButton.disabled = this.queueState.active || totalJobs === 0;
    this.dialog.stopButton.disabled = !this.queueState.active;
  }

  renderStatChip(icon, value, title) {
    return $el("div.bulker-stat-chip", { title }, [
      getIcon(icon),
      $el("span", { textContent: value }),
    ]);
  }

  renderModifiers() {
    const nodeChoices = getNodeChoices().map((choice) => ({
      value: choice.id,
      label: displayText(choice.label, `[${choice.id}] Node`),
    }));

    this.dialog.modifiersContainer.replaceChildren();

    if (!this.state.modifiers.length) {
      this.dialog.modifiersContainer.append(
        $el("div.bulker-empty", {}, [
          $el("div.bulker-empty-title", { textContent: "No modifiers yet" }),
          $el("div.bulker-empty-note", { textContent: "Add one to start building combinations." }),
        ])
      );
      return;
    }

    this.state.modifiers.forEach((modifier, index) => {
      this.dialog.modifiersContainer.append(this.renderModifierCard(modifier, index, nodeChoices));
    });
  }

  renderModifierCard(modifier, index, nodeChoices) {
    const node = getNodeById(modifier.nodeId);
    const widgets = node ? getEditableWidgets(node) : [];
    const widgetChoices = widgets.map((widget) => ({
      value: widget.name,
      label: displayText(widget.label, widget.name),
    }));
    const selectedWidget = widgets.find((widget) => widget.name === modifier.inputName) ?? null;
    const state = summarizeModifierState(modifier);

    return $el(
      "div",
      {
        className: `bulker-modifier bulker-modifier-${state}`,
        dataset: { modifierId: modifier.id },
      },
      [
        $el("div.bulker-modifier-head", {}, [
          $el("div.bulker-modifier-title", {}, [
            $el("span.bulker-modifier-index", { textContent: String(index + 1) }),
            $el("span", { className: `bulker-modifier-state bulker-modifier-state-${state}` }),
          ]),
          createIconButton({
            icon: "remove",
            title: `Remove modifier ${index + 1}`,
            onclick: () => this.removeModifier(modifier.id),
            disabled: this.queueState.active,
          }),
        ]),
        $el("div.bulker-selector-row", {}, [
          this.renderSearchablePicker({
            modifier,
            kind: "node",
            options: nodeChoices,
            selectedValue: modifier.nodeId,
            placeholder: "Node",
            disabled: this.queueState.active,
            onChoose: (value) => this.updateModifierNode(modifier.id, value),
          }),
          this.renderSearchablePicker({
            modifier,
            kind: "input",
            options: widgetChoices,
            selectedValue: modifier.inputName,
            placeholder: "Input",
            disabled: this.queueState.active || !modifier.nodeId,
            onChoose: (value) => this.updateModifierInput(modifier.id, value),
          }),
        ]),
        this.renderValuesSection(modifier, selectedWidget),
      ]
    );
  }

  renderModifierCardInPlace(modifierId) {
    const modifier = this.getModifier(modifierId);
    if (!modifier) {
      return;
    }

    const index = this.state.modifiers.findIndex((candidate) => candidate.id === modifierId);
    if (index === -1) {
      return;
    }

    const nodeChoices = getNodeChoices().map((choice) => ({
      value: choice.id,
      label: displayText(choice.label, `[${choice.id}] Node`),
    }));
    const nextCard = this.renderModifierCard(modifier, index, nodeChoices);
    const currentCard = Array.from(this.dialog.modifiersContainer.children).find(
      (element) => element.dataset?.modifierId === modifierId
    );

    if (currentCard) {
      currentCard.replaceWith(nextCard);
      return;
    }

    this.dialog.modifiersContainer.append(nextCard);
  }

  renderSearchablePicker({ modifier, kind, options, selectedValue, placeholder, disabled, onChoose }) {
    const uiState = this.getModifierUiState(modifier.id);
    const pickerState = uiState.pickers[kind];
    const selectedOption = options.find((option) => option.value === selectedValue) ?? null;
    const filterText = pickerState.filter.trim().toLowerCase();
    const filteredOptions = options.filter((option) =>
      displayText(option.label, option.value).toLowerCase().includes(filterText)
    );
    const selectedLabel = displayText(selectedOption?.label, placeholder);
    const selectSize = clamp(filteredOptions.length || 1, 4, 8);

    return $el("div", { className: `bulker-picker ${pickerState.open ? "is-open" : ""}`.trim() }, [
      $el("button.bulker-picker-trigger", {
        type: "button",
        title: `Choose ${placeholder.toLowerCase()}`,
        disabled,
        onmousedown: () => this.stashScrollSnapshot(),
        onclick: (event) => {
          event.stopPropagation();
          this.togglePicker(modifier.id, kind);
        },
      }, [
        getIcon("search", "bulker-picker-trigger-icon"),
        $el("span.bulker-picker-trigger-label", {
          textContent: truncate(selectedLabel, 48),
        }),
      ]),
      pickerState.open
        ? $el("div.bulker-picker-menu", {
            onmousedown: (event) => event.stopPropagation(),
            onclick: (event) => event.stopPropagation(),
          }, [
            $el("div.bulker-picker-search-wrap", {}, [
              getIcon("search", "bulker-picker-search-icon"),
              $el("input.bulker-input.bulker-picker-search", {
                type: "text",
                value: pickerState.filter,
                placeholder: `Search ${placeholder.toLowerCase()}`,
                title: `Search ${placeholder.toLowerCase()}`,
                dataset: {
                  bulkerFocusKey: `modifier:${modifier.id}:picker:${kind}`,
                },
                oninput: (event) => this.updatePickerFilter(modifier.id, kind, event.target.value),
                onkeydown: (event) => this.handlePickerKeydown(event, modifier.id, kind, filteredOptions, onChoose),
              }),
            ]),
            filteredOptions.length
              ? $el("select.bulker-picker-select", {
                  dataset: {
                    bulkerScrollKey: `modifier:${modifier.id}:picker-select:${kind}`,
                  },
                  size: String(selectSize),
                  title: `${placeholder} options`,
                  onmousedown: () => this.stashScrollSnapshot(),
                  onkeydown: (event) => this.handlePickerKeydown(event, modifier.id, kind, filteredOptions, onChoose),
                  onchange: (event) => {
                    if (event.target.value) {
                      this.choosePickerValue(modifier.id, kind, event.target.value, onChoose);
                    }
                  },
                }, filteredOptions.map((option) =>
                  $el("option", {
                    value: option.value,
                    selected: option.value === selectedValue,
                    textContent: displayText(option.label, option.value),
                  })
                ))
              : $el("div.bulker-picker-empty", { textContent: "No matches" }),
          ])
        : null,
    ].filter(Boolean));
  }

  handlePickerKeydown(event, modifierId, kind, filteredOptions, onChoose) {
    if (event.key === "Escape") {
      event.preventDefault();
      this.closePicker(modifierId, kind);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (filteredOptions[0]) {
        this.choosePickerValue(modifierId, kind, filteredOptions[0].value, onChoose);
        return;
      }
      this.closePicker(modifierId, kind);
    }
  }

  choosePickerValue(modifierId, kind, value, onChoose) {
    const pickerState = this.getModifierUiState(modifierId).pickers[kind];
    pickerState.open = false;
    pickerState.filter = "";
    this.prepareSelectionMutation();
    onChoose(value);
  }

  openPicker(modifierId, kind, initialValue = "") {
    const hadOtherOpenPicker = this.hasOpenPickerOutside(modifierId, kind);
    this.closeAllPickers({ modifierId, kind });
    const pickerState = this.getModifierUiState(modifierId).pickers[kind];
    pickerState.open = true;
    pickerState.filter = initialValue;
    if (hadOtherOpenPicker) {
      this.render();
      return;
    }

    this.renderModifierUpdate(modifierId);
  }

  togglePicker(modifierId, kind) {
    const pickerState = this.getModifierUiState(modifierId).pickers[kind];
    if (pickerState.open) {
      this.closePicker(modifierId, kind);
      return;
    }

    this.openPicker(modifierId, kind);
  }

  closePicker(modifierId, kind) {
    const pickerState = this.getModifierUiState(modifierId).pickers[kind];
    pickerState.open = false;
    pickerState.filter = "";
    this.renderModifierUpdate(modifierId);
  }

  updatePickerFilter(modifierId, kind, value) {
    this.closeAllPickers({ modifierId, kind });
    const pickerState = this.getModifierUiState(modifierId).pickers[kind];
    pickerState.open = true;
    pickerState.filter = value;
    this.renderModifierUpdate(modifierId);
  }

  renderValuesSection(modifier, selectedWidget) {
    if (!modifier.inputType) {
      return $el("div.bulker-values", {}, [
        $el("div.bulker-inline-note", { textContent: "Pick an editable input." }),
      ]);
    }

    return modifier.inputType === "combo"
      ? this.renderComboValues(modifier, selectedWidget)
      : this.renderManualValues(modifier);
  }

  renderComboValues(modifier, selectedWidget) {
    const options = selectedWidget?.options ?? [];
    const filterText = modifier.optionFilter.trim().toLowerCase();
    const selectedValueKeys = new Set(modifier.values.map((row) => getRowValueKey(modifier.inputType, row)));
    const filteredOptions = options.filter((option) => option.toLowerCase().includes(filterText));
    const availableOptions = options.filter(
      (option) => !selectedValueKeys.has(getValueKey(modifier.inputType, option))
    );
    const filteredAvailableOptions = filteredOptions.filter(
      (option) => !selectedValueKeys.has(getValueKey(modifier.inputType, option))
    );

    return $el("div.bulker-values", {}, [
      $el("div.bulker-values-toolbar", {}, [
        $el("div.bulker-search-field", {}, [
          getIcon("search", "bulker-search-icon"),
          $el("input.bulker-input", {
            type: "text",
            value: modifier.optionFilter,
            placeholder: "Search values",
            title: "Search available values",
            disabled: this.queueState.active,
            dataset: {
              bulkerFocusKey: `modifier:${modifier.id}:option-filter`,
            },
            oninput: (event) => this.updateOptionFilter(modifier.id, event.target.value),
          }),
        ]),
        $el("div.bulker-toolbar-actions", {}, [
          createIconButton({
            icon: "forward",
            title: "Add all filtered values",
            onclick: () => this.addAllFilteredOptions(modifier.id, filteredAvailableOptions),
            disabled: this.queueState.active || filteredAvailableOptions.length === 0,
          }),
          createIconButton({
            icon: "trash",
            title: "Clear selected list",
            onclick: () => this.clearSelectedList(modifier.id),
            disabled: this.queueState.active || modifier.values.length === 0,
            tone: "danger",
          }),
        ]),
      ]),
      $el("div.bulker-values-grid", {}, [
        this.renderAvailablePane(modifier, filteredAvailableOptions, availableOptions.length, filteredOptions),
        this.renderSelectedPane(modifier),
      ]),
      !options.length
        ? $el("div", {
            className: "bulker-inline-note bulker-inline-error",
            textContent: "This input does not expose option values in the current graph.",
          })
        : null,
    ].filter(Boolean));
  }

  renderManualValues(modifier) {
    const uiState = this.getModifierUiState(modifier.id);
    const placeholder =
      modifier.inputType === "number"
        ? "Enter number"
        : modifier.inputType === "boolean"
          ? "true / false"
          : "Enter value";

    return $el("div.bulker-values", {}, [
      $el("div.bulker-values-toolbar", {}, [
        $el("div.bulker-search-field", {}, [
          getIcon("add", "bulker-search-icon"),
          $el("input.bulker-input", {
            type: "text",
            value: uiState.manualDraft,
            placeholder,
            title: "Type one value",
            disabled: this.queueState.active,
            dataset: {
              bulkerFocusKey: `modifier:${modifier.id}:manual-draft`,
            },
            oninput: (event) => this.updateManualDraft(modifier.id, event.target.value),
            onkeydown: (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                this.addManualDraft(modifier.id);
              }
            },
          }),
        ]),
        $el("div.bulker-toolbar-actions", {}, [
          createIconButton({
            icon: "add",
            title: "Add typed value",
            onclick: () => this.addManualDraft(modifier.id),
            disabled: this.queueState.active || !uiState.manualDraft.trim(),
          }),
          createIconButton({
            icon: "paste",
            title: uiState.pasteOpen ? "Hide paste-many editor" : "Show paste-many editor",
            onclick: () => this.togglePasteEditor(modifier.id),
            disabled: this.queueState.active,
            active: uiState.pasteOpen,
          }),
          createIconButton({
            icon: "trash",
            title: "Clear selected list",
            onclick: () => this.clearSelectedList(modifier.id),
            disabled: this.queueState.active || modifier.values.length === 0,
            tone: "danger",
          }),
        ]),
      ]),
      uiState.pasteOpen
        ? $el("div.bulker-paste", {}, [
            $el("textarea.bulker-textarea", {
              value: uiState.pasteBuffer,
              placeholder: "Paste one value per line",
              title: "Paste many values",
              disabled: this.queueState.active,
              dataset: {
                bulkerFocusKey: `modifier:${modifier.id}:paste`,
              },
              oninput: (event) => this.updatePasteBuffer(modifier.id, event.target.value),
            }),
            createIconButton({
              icon: "forward",
              title: "Add pasted values",
              onclick: () => this.importPasteValues(modifier.id),
              disabled: this.queueState.active || !uiState.pasteBuffer.trim(),
              tone: "accent",
              className: "bulker-paste-action",
            }),
          ])
        : null,
      uiState.draftError
        ? $el("div", {
            className: "bulker-inline-note bulker-inline-error",
            textContent: uiState.draftError,
          })
        : null,
      this.renderSelectedPane(modifier),
    ].filter(Boolean));
  }

  renderAvailablePane(modifier, filteredAvailableOptions, totalOptions, filteredOptions) {
    const uiState = this.getModifierUiState(modifier.id);
    const visibleKeys = new Set(
      filteredAvailableOptions.map((option) => getValueKey(modifier.inputType, option))
    );
    const rows = [];

    for (const option of filteredOptions) {
      const valueKey = getValueKey(modifier.inputType, option);
      if (visibleKeys.has(valueKey)) {
        rows.push(
          this.renderValueRow({
            label: displayText(option, "Empty"),
            leadingIcon: "plusBox",
            title: displayText(option, "Empty"),
            disabled: this.queueState.active,
            onclick: () => this.addComboValue(modifier.id, option),
          })
        );
        continue;
      }

      if (uiState.animations.leavingAvailable.has(valueKey)) {
        rows.push(
          this.renderValueRow({
            label: displayText(option, "Empty"),
            leadingIcon: "plusBox",
            title: displayText(option, "Empty"),
            disabled: true,
            rowClassName: "is-leaving",
            shellClassName: "is-leaving-shell",
          })
        );
      }
    }

    const emptyMessage = getAvailablePaneEmptyMessage(filteredOptions, filteredAvailableOptions);

    return $el("div.bulker-value-pane", {}, [
      $el("div.bulker-pane-head", {}, [
        $el("span", { textContent: "Available" }),
        $el("span", { textContent: `${filteredAvailableOptions.length}/${totalOptions}` }),
      ]),
      rows.length
        ? $el(
            "div.bulker-value-list",
            {
              dataset: {
                bulkerScrollKey: `modifier:${modifier.id}:available-values`,
              },
            },
            rows
          )
        : $el("div.bulker-inline-note", { textContent: emptyMessage }),
    ]);
  }

  renderSelectedPane(modifier) {
    const uiState = this.getModifierUiState(modifier.id);

    return $el("div.bulker-value-pane", {}, [
      $el("div.bulker-pane-head", {}, [
        $el("span", { textContent: "Selected" }),
        $el("span", { textContent: `${modifier.values.length}` }),
      ]),
      modifier.values.length
        ? $el(
            "div.bulker-value-list",
            {
              dataset: {
                bulkerScrollKey: `modifier:${modifier.id}:selected-values`,
              },
            },
            modifier.values.map((row) => this.renderSelectedValueRow(modifier, row, uiState))
          )
        : $el("div.bulker-inline-note", { textContent: "No values yet" }),
    ]);
  }

  renderSelectedValueRow(modifier, row, uiState) {
    const label = displayValue(row.value);
    const repeat = getRowRepeat(row);
    const isEntering = uiState.animations.enteringSelected.has(row.id);
    const isBumping = uiState.animations.bumpRepeat.has(row.id);
    const selectedRowClassName = `bulker-value-row-shell bulker-selected-row ${
      isEntering ? "is-entering" : ""
    }`.trim();

    return $el(
      "div",
      {
        className: selectedRowClassName,
        title: label,
        dataset: { rowId: row.id },
        ondragover: (event) => this.handleSelectedRowDragOver(event, modifier.id, row.id),
        ondragleave: (event) => this.handleSelectedRowDragLeave(event),
        ondrop: (event) => this.handleSelectedRowDrop(event, modifier.id, row.id),
      },
      [
        $el("div.bulker-value-row.is-selected.bulker-selected-value-row", {}, [
          this.renderSelectedRowDragHandle(modifier.id, row.id),
          $el("div.bulker-value-row-main", {}, [
            $el("span.bulker-value-label", { textContent: truncate(label, 64) }),
          ]),
          this.renderRepeatStepper(modifier.id, row.id, repeat, isBumping),
          this.renderSelectedActionButton({
            icon: "trash",
            title: "Remove selected value",
            disabled: this.queueState.active,
            className: "bulker-row-trash-button",
            onclick: () => this.removeModifierValue(modifier.id, row.id),
          }),
        ]),
      ]
    );
  }

  renderSelectedRowDragHandle(modifierId, rowId) {
    return $el(
      "button.bulker-sort-handle",
      {
        ...this.getSelectedActionProps({
          title: "Drag to reorder",
          disabled: this.queueState.active,
          onclick: null,
        }),
        draggable: !this.queueState.active,
        onmousedown: (event) => {
          this.stashScrollSnapshot();
          event.stopPropagation();
        },
        ondragstart: (event) => this.startSelectedRowDrag(event, modifierId, rowId),
        ondragend: (event) => this.endSelectedRowDrag(event),
      },
      [getIcon("grip")]
    );
  }

  renderRepeatStepper(modifierId, rowId, repeat, isBumping) {
    const repeatCountClassName = `bulker-repeat-count ${isBumping ? "is-bumping" : ""}`.trim();

    return $el("div.bulker-repeat-stepper", {}, [
      this.renderRepeatButton("-", "Decrease repeat or remove value", this.queueState.active, () =>
        this.decrementModifierValueRepeat(modifierId, rowId)
      ),
      $el("span", {
        className: repeatCountClassName,
        textContent: `x${repeat}`,
      }),
      this.renderRepeatButton("+", "Increase repeat", this.queueState.active, () =>
        this.incrementModifierValueRepeat(modifierId, rowId)
      ),
    ]);
  }

  getSelectedActionProps({ title, disabled, onclick }) {
    return {
      type: "button",
      title,
      disabled,
      "aria-label": title,
      onmousedown: (event) => {
        this.stashScrollSnapshot();
        event.preventDefault();
        event.stopPropagation();
      },
      onclick: onclick
        ? (event) => {
            event.stopPropagation();
            onclick();
          }
        : null,
    };
  }

  renderRepeatButton(label, title, disabled, onclick) {
    return $el(
      "button.bulker-repeat-button",
      this.getSelectedActionProps({ title, disabled, onclick }),
      [$el("span", { textContent: label })]
    );
  }

  renderSelectedActionButton({ icon, title, disabled, className = "", onclick }) {
    return $el(
      "button",
      {
        className: `bulker-selected-action-button ${className}`.trim(),
        ...this.getSelectedActionProps({ title, disabled, onclick }),
      },
      [getIcon(icon)]
    );
  }

  renderValueRow({
    label,
    leadingIcon,
    title,
    disabled = false,
    onclick,
    trailing = null,
    rowClassName = "",
    shellClassName = "",
  }) {
    const tagName = onclick ? "button" : "div";

    return $el("div", { className: `bulker-value-row-shell ${shellClassName}`.trim() }, [
      $el(
        tagName,
        {
          ...(onclick ? { type: "button" } : {}),
          className: `bulker-value-row ${rowClassName}`.trim(),
          title,
          ...(onclick ? { disabled } : {}),
          onmousedown: onclick
            ? (event) => {
                this.stashScrollSnapshot();
                event.preventDefault();
              }
            : null,
          onclick,
        },
        [
          $el("div.bulker-value-row-main", {}, [
            getIcon(leadingIcon, "bulker-value-leading"),
            $el("span.bulker-value-label", { textContent: truncate(label, 64) }),
          ]),
        ]
      ),
      trailing,
    ].filter(Boolean));
  }

  renderPreview() {
    const totalJobs = getJobCount(this.state.modifiers);
    const preview = getCombinationPreview(this.state.modifiers, 6);
    const hiddenCount = Math.max(0, totalJobs - preview.length);

    this.dialog.previewCard.replaceChildren(
      ...[
        $el("div.bulker-side-head", {}, [
          $el("div.bulker-side-title", {}, [getIcon("queue"), $el("span", { textContent: "Preview" })]),
          $el("div.bulker-side-stat", { textContent: `${totalJobs}` }),
        ]),
        $el("div.bulker-side-meta", {
          textContent: `${getValidModifiers(this.state.modifiers).length} ready • ${formatFactorFormula(this.state.modifiers)}`,
        }),
        preview.length
          ? $el(
            "div.bulker-preview-list",
            {},
            preview.map((combination, index) =>
              $el("div.bulker-preview-row", {}, [
                $el("span.bulker-preview-index", { textContent: String(index + 1) }),
                $el("div.bulker-preview-text", {
                  title: formatCombinationSummary(combination),
                  textContent: formatCombinationSummary(combination),
                }),
              ])
            )
          )
          : $el("div.bulker-inline-note", { textContent: "No valid combinations" }),
        hiddenCount > 0
          ? $el("div.bulker-inline-note", { textContent: `+${hiddenCount}` })
          : null,
      ].filter(Boolean)
    );
  }

  getOutputNamingMetaText(enabled, includedCount, totalRuleCount) {
    if (!enabled) {
      return "Dynamic filename suffixes are disabled";
    }

    return `${includedCount}/${totalRuleCount} included • label-value`;
  }

  renderOutputNamingPreview(preview, namingModifiers) {
    if (preview.length > 0) {
      return $el(
        "div.bulker-naming-preview-list",
        {},
        preview.map((suffix, index) =>
          $el("div.bulker-preview-row", {}, [
            $el("span.bulker-preview-index", { textContent: String(index + 1) }),
            $el("div.bulker-preview-text", {
              title: suffix,
              textContent: suffix,
            }),
          ])
        )
      );
    }

    const textContent = namingModifiers.length > 0
      ? "No filename parts are enabled."
      : "Add valid modifiers to configure filename parts.";

    return $el("div.bulker-inline-note", { textContent });
  }

  renderOutputNamingBody({ namingModifiers, preview, hiddenPreviewCount }) {
    const body = [
      $el("input.bulker-input.bulker-input-compact", {
        type: "text",
        value: this.state.outputNaming?.basePrefix ?? "bulker-",
        placeholder: "Prefix",
        title: "Filename prefix",
        disabled: this.queueState.active,
        dataset: {
          bulkerFocusKey: "output-naming:base-prefix",
        },
        oninput: (event) => this.updateOutputNamingBasePrefix(event.target.value),
      }),
      this.renderOutputNamingPreview(preview, namingModifiers),
      hiddenPreviewCount > 0 ? $el("div.bulker-inline-note", { textContent: `+${hiddenPreviewCount}` }) : null,
      namingModifiers.length > 0
        ? $el(
            "div.bulker-naming-list",
            { dataset: { bulkerScrollKey: "output-naming-list" } },
            namingModifiers.map(({ modifier, rule }, index) =>
              this.renderOutputNamingRow(modifier, rule, index, namingModifiers.length)
            )
          )
        : null,
      $el("div.bulker-inline-note", {
        textContent: "Special characters are normalized into safe filename tokens.",
      }),
    ];

    return $el("div.bulker-output-naming-body", {}, body.filter(Boolean));
  }

  renderOutputNaming() {
    const namingModifiers = this.getOutputNamingModifiers();
    const includedCount = namingModifiers.filter(({ rule }) => rule.enabled).length;
    const preview = this.getOutputNamingPreviewEntries(3);
    const hiddenPreviewCount = Math.max(0, getJobCount(this.state.modifiers) - preview.length);
    const collapsed = Boolean(this.state.outputNaming?.collapsed);
    const enabled = Boolean(this.state.outputNaming?.enabled);

    this.dialog.namingCard.classList.toggle("is-collapsed", collapsed);

    this.dialog.namingCard.replaceChildren(
      ...[
        $el("div.bulker-side-head", {}, [
          $el("button.bulker-side-toggle.bulker-side-title", {
            type: "button",
            title: collapsed ? "Expand output naming" : "Collapse output naming",
            onmousedown: (event) => {
              this.stashScrollSnapshot();
              event.preventDefault();
            },
            onclick: () => this.toggleOutputNamingCollapsed(),
          }, [
            getIcon(collapsed ? "chevronRight" : "chevronDown"),
            $el("span", { textContent: "Output Names" }),
          ]),
          $el("span.bulker-preview-chip", {
            textContent: enabled ? `${includedCount}` : "off",
            title: enabled ? "Included modifiers" : "Dynamic naming disabled",
          }),
        ]),
        $el("div.bulker-side-meta", {
          textContent: this.getOutputNamingMetaText(enabled, includedCount, namingModifiers.length),
        }),
        collapsed
          ? null
          : $el("div.bulker-side-stack", {}, [
              $el("label.bulker-inline-toggle", {}, [
                $el("input", {
                  type: "checkbox",
                  checked: this.state.outputNaming?.enabled,
                  disabled: this.queueState.active,
                  onchange: (event) => this.setOutputNamingEnabled(event.target.checked),
                }),
                $el("span", { textContent: "Enable dynamic output naming" }),
              ]),
              enabled
                ? this.renderOutputNamingBody({
                    namingModifiers,
                    preview,
                    hiddenPreviewCount,
                  })
                : null,
            ].filter(Boolean)),
      ].filter(Boolean)
    );
  }

  renderOutputNamingRow(modifier, rule, index, totalRules) {
    const defaultLabel = getDefaultFilenameRuleLabel(modifier);
    const sourceLabel = getOutputNamingSourceLabel(modifier);

    return $el(
      "div",
      {
        className: "bulker-naming-rule-shell bulker-selected-row",
        dataset: { modifierId: modifier.id },
        ondragover: (event) => this.handleNamingRuleDragOver(event, modifier.id),
        ondragleave: (event) => this.handleNamingRuleDragLeave(event),
        ondrop: (event) => this.handleNamingRuleDrop(event, modifier.id),
      },
      [
        $el("div.bulker-naming-row", {}, [
          this.renderNamingRuleDragHandle(modifier.id, index, totalRules),
          $el("div.bulker-naming-row-meta", { title: sourceLabel }, [
            $el("input", {
              className: "bulker-input bulker-input-compact bulker-naming-title-input",
              type: "text",
              value: rule.label ?? "",
              placeholder: defaultLabel,
              title: `${sourceLabel}\nLabel (${defaultLabel})`,
              disabled: this.queueState.active || !rule.enabled || rule.showLabel === false,
              dataset: {
                bulkerFocusKey: `output-naming:label:${modifier.id}`,
              },
              oninput: (event) => this.updateOutputNamingRule(modifier.id, (currentRule) => ({
                ...currentRule,
                label: event.target.value,
              })),
            }),
          ]),
          $el("label", {
            className: "bulker-inline-toggle bulker-inline-toggle-compact",
            title: "Include this value in filenames",
          }, [
            $el("input", {
              type: "checkbox",
              checked: rule.enabled,
              disabled: this.queueState.active,
              onchange: (event) => this.updateOutputNamingRule(modifier.id, (currentRule) => ({
                ...currentRule,
                enabled: event.target.checked,
              })),
            }),
            $el("span", { textContent: "Use" }),
          ]),
          $el("label", {
            className: "bulker-inline-toggle bulker-inline-toggle-compact",
            title: "Show the label before the value",
          }, [
            $el("input", {
              type: "checkbox",
              checked: rule.showLabel !== false,
              disabled: this.queueState.active || !rule.enabled,
              onchange: (event) => this.updateOutputNamingRule(modifier.id, (currentRule) => ({
                ...currentRule,
                showLabel: event.target.checked,
              })),
            }),
            $el("span", { textContent: "Key" }),
          ]),
        ]),
      ]
    );
  }

  renderNamingRuleDragHandle(modifierId, index, totalRules) {
    return $el(
      "button",
      {
        className: "bulker-sort-handle bulker-sort-handle-compact",
        ...this.getSelectedActionProps({
          title: totalRules > 1 ? `Drag to reorder item ${index + 1}` : "No other items to reorder",
          disabled: this.queueState.active || totalRules <= 1,
          onclick: null,
        }),
        draggable: !this.queueState.active && totalRules > 1,
        onmousedown: (event) => {
          this.stashScrollSnapshot();
          event.stopPropagation();
        },
        ondragstart: (event) => this.startNamingRuleDrag(event, modifierId),
        ondragend: (event) => this.endNamingRuleDrag(event),
      },
      [getIcon("grip")]
    );
  }

  renderProgress() {
    const totalJobs = this.queueState.totalJobs;
    const queuedJobs = this.queueState.queuedJobs;
    const ratio = totalJobs > 0 ? Math.min(1, queuedJobs / totalJobs) : 0;

    this.dialog.progressCard.replaceChildren(
      ...[
        $el("div.bulker-side-head", {}, [
          $el("div.bulker-side-title", {}, [getIcon("play"), $el("span", { textContent: "Queue" })]),
          $el("div", { className: `bulker-side-status bulker-side-status-${this.queueState.status}` }),
        ]),
        $el("div.bulker-side-meta", {
          textContent: totalJobs ? `${queuedJobs}/${totalJobs}` : "0/0",
        }),
        $el("div.bulker-progress-bar", {}, [
          $el("div.bulker-progress-fill", { style: { width: `${ratio * 100}%` } }),
        ]),
        $el("div.bulker-progress-current", {
          textContent: this.queueState.currentSummary,
        }),
        this.queueState.active
          ? $el("div.bulker-progress-actions", {}, [
              createIconButton({
                icon: "stop",
                title: "Stop queueing",
                onclick: () => this.stopQueueing(),
                tone: "danger",
              }),
              $el("span", { textContent: "Stops future submissions only" }),
            ])
          : null,
      ].filter(Boolean)
    );
  }

  addModifier() {
    const modifier = createModifier();
    this.state.modifiers.push(modifier);
    this.getModifierUiState(modifier.id);
    this.render();
  }

  setOutputNamingEnabled(enabled) {
    this.state.outputNaming = {
      ...this.state.outputNaming,
      enabled: Boolean(enabled),
    };
    this.render();
  }

  toggleOutputNamingCollapsed() {
    this.state.outputNaming = {
      ...this.state.outputNaming,
      collapsed: !this.state.outputNaming?.collapsed,
    };
    this.render();
  }

  updateOutputNamingBasePrefix(basePrefix) {
    this.state.outputNaming = {
      ...this.state.outputNaming,
      basePrefix,
    };
    this.render();
  }

  updateOutputNamingRule(modifierId, updater) {
    this.state.outputNaming = {
      ...this.state.outputNaming,
      rules: (this.state.outputNaming?.rules ?? []).map((rule) =>
        rule.modifierId === modifierId ? createOutputNamingRule(updater({ ...rule })) : rule
      ),
    };
    this.render();
  }

  removeModifier(modifierId) {
    this.state.modifiers = this.state.modifiers.filter((modifier) => modifier.id !== modifierId);
    delete this.uiState.modifiers[modifierId];
    this.selectedRowDrag = null;
    this.namingRuleDrag = null;

    if (!this.state.modifiers.length) {
      const modifier = createModifier();
      this.state.modifiers.push(modifier);
      this.getModifierUiState(modifier.id);
    }

    this.render();
  }

  updateModifier(modifierId, updater) {
    this.state.modifiers = this.state.modifiers.map((modifier) =>
      modifier.id === modifierId ? updater({ ...modifier }) : modifier
    );
    this.renderModifierUpdate(modifierId);
  }

  resetModifierUi(modifierId) {
    const uiState = this.getModifierUiState(modifierId);
    uiState.manualDraft = "";
    uiState.draftError = "";
    uiState.pasteOpen = false;
    uiState.pasteBuffer = "";
    uiState.pickers.node = createPickerState();
    uiState.pickers.input = createPickerState();
  }

  updateModifierNode(modifierId, nodeId) {
    this.resetModifierUi(modifierId);
    this.updateModifier(modifierId, (modifier) => ({
      ...modifier,
      nodeId,
      inputName: "",
      inputLabel: "",
      inputType: "",
      widgetType: "",
      values: [],
      manualValueText: "",
      optionFilter: "",
      parseErrors: [],
    }));
  }

  updateModifierInput(modifierId, inputName) {
    const uiState = this.getModifierUiState(modifierId);
    uiState.manualDraft = "";
    uiState.draftError = "";
    uiState.pasteOpen = false;

    this.updateModifier(modifierId, (modifier) => {
      const widget = getEditableWidget(modifier.nodeId, inputName);
      if (!widget) {
        uiState.pasteBuffer = "";
        return {
          ...modifier,
          inputName: "",
          inputLabel: "",
          inputType: "",
          widgetType: "",
          values: [],
          manualValueText: "",
          optionFilter: "",
          parseErrors: [],
        };
      }

      uiState.pasteBuffer = modifier.inputName === widget.name ? modifier.manualValueText : "";

      return {
        ...modifier,
        inputName: widget.name,
        inputLabel: widget.label,
        inputType: widget.inputType,
        widgetType: widget.widgetType,
        values: modifier.inputName === widget.name ? modifier.values : [],
        manualValueText: modifier.inputName === widget.name ? modifier.manualValueText : "",
        optionFilter: "",
        parseErrors: [],
      };
    });
  }

  updateOptionFilter(modifierId, optionFilter) {
    this.updateModifier(modifierId, (modifier) => ({ ...modifier, optionFilter }));
  }

  addAllFilteredOptions(modifierId, filteredOptions) {
    this.addComboValues(modifierId, filteredOptions);
  }

  addComboValue(modifierId, option) {
    this.addComboValues(modifierId, [option]);
  }

  addComboValues(modifierId, values) {
    this.appendModifierRows(modifierId, values, { animateAvailable: true });
  }

  updateManualDraft(modifierId, manualDraft) {
    const uiState = this.getModifierUiState(modifierId);
    uiState.manualDraft = manualDraft;
    uiState.draftError = "";
    this.render();
  }

  addManualDraft(modifierId) {
    const modifier = this.getModifier(modifierId);
    if (!modifier) {
      return;
    }

    const uiState = this.getModifierUiState(modifierId);
    const parsed = parseManualValues(modifier.inputType, uiState.manualDraft);
    if (parsed.errors.length || !parsed.values.length) {
      uiState.draftError = parsed.errors[0] || "Nothing to add";
      this.render();
      return;
    }

    uiState.manualDraft = "";
    uiState.draftError = "";

    const result = this.appendModifierRows(modifierId, parsed.values, {
      duplicateMessage: "Value already selected",
    });
    if (!result.added) {
      uiState.draftError = result.message;
      this.render();
      return;
    }
  }

  togglePasteEditor(modifierId) {
    const uiState = this.getModifierUiState(modifierId);
    uiState.pasteOpen = !uiState.pasteOpen;
    uiState.draftError = "";
    this.render();
  }

  updatePasteBuffer(modifierId, pasteBuffer) {
    const uiState = this.getModifierUiState(modifierId);
    uiState.pasteBuffer = pasteBuffer;
    uiState.draftError = "";

    this.updateModifier(modifierId, (modifier) => ({
      ...modifier,
      manualValueText: pasteBuffer,
    }));
  }

  importPasteValues(modifierId) {
    const modifier = this.getModifier(modifierId);
    if (!modifier) {
      return;
    }

    const uiState = this.getModifierUiState(modifierId);
    const parsed = parseManualValues(modifier.inputType, uiState.pasteBuffer);
    if (parsed.errors.length) {
      uiState.draftError = parsed.errors[0];
      this.render();
      return;
    }

    uiState.draftError = "";
    const result = this.appendModifierRows(modifierId, parsed.values, {
      duplicateMessage: "All pasted values are already selected",
    });
    if (!result.added) {
      uiState.draftError = result.message;
      this.render();
      return;
    }
  }

  clearSelectedList(modifierId) {
    this.prepareSelectionMutation();
    this.updateModifier(modifierId, (modifier) => setModifierRows(modifier, []));
  }

  incrementModifierValueRepeat(modifierId, rowId) {
    this.prepareSelectionMutation();
    this.bumpRepeatBadge(modifierId, rowId);
    this.updateModifierRowRepeat(modifierId, rowId, (repeat) => repeat + 1);
  }

  decrementModifierValueRepeat(modifierId, rowId) {
    const modifier = this.getModifier(modifierId);
    const row = modifier?.values.find((candidate) => candidate.id === rowId);
    if (!modifier || !row) {
      return;
    }

    if (getRowRepeat(row) <= 1) {
      this.removeModifierValue(modifierId, rowId);
      return;
    }

    this.prepareSelectionMutation();
    this.bumpRepeatBadge(modifierId, rowId);
    this.updateModifierRowRepeat(modifierId, rowId, (repeat) => repeat - 1);
  }

  removeModifierValue(modifierId, rowId) {
    this.prepareSelectionMutation();
    this.updateModifier(modifierId, (modifier) =>
      setModifierRows(
        modifier,
        modifier.values.filter((row) => row.id !== rowId)
      )
    );
  }

  stopQueueing() {
    if (!this.queueState.active) {
      return;
    }

    this.queueState.stopRequested = true;
    this.queueState.status = "stopping";
    this.queueState.currentSummary = "Stopping after the current submission finishes.";
    this.renderProgress();
  }

  async startQueueing() {
    this.syncState();
    const modifiers = getValidModifiers(this.state.modifiers);
    const totalJobs = getJobCount(modifiers);
    if (!totalJobs) {
      notify("Add at least one fully valid modifier before starting.", "warn");
      return;
    }

    this.queueState = {
      active: true,
      stopRequested: false,
      queuedJobs: 0,
      totalJobs,
      status: "exporting",
      currentSummary: "Exporting the active workflow.",
    };
    this.render();

    try {
      const basePrompt = await app.graphToPrompt();
      debugLog("Base prompt exported", basePrompt);

      const result = await queueCombinations({
        basePrompt,
        modifiers,
        outputNaming: this.state.outputNaming,
        delayMs: DEFAULT_QUEUE_DELAY_MS,
        shouldStop: () => this.queueState.stopRequested,
        onProgress: ({ queuedJobs, totalJobs: progressTotal, summary, phase }) => {
          this.queueState.queuedJobs = queuedJobs;
          this.queueState.totalJobs = progressTotal;
          this.queueState.status = phase === "queued" ? "queueing" : "submitting";
          this.queueState.currentSummary =
            phase === "queued"
              ? `Queued ${queuedJobs}/${progressTotal} • ${summary}`
              : `Submitting ${queuedJobs + 1}/${progressTotal} • ${summary}`;
          this.renderProgress();
        },
      });

      this.queueState.queuedJobs = result.queuedJobs;
      this.queueState.totalJobs = result.totalJobs;
      this.queueState.status = result.stopped ? "stopped" : "done";
      this.queueState.currentSummary = result.stopped
        ? `Stopped after queueing ${result.queuedJobs}/${result.totalJobs} jobs.`
        : `Queued ${result.queuedJobs}/${result.totalJobs} jobs.`;

      notify(
        result.stopped ? `Stopped after ${result.queuedJobs} queued jobs.` : `Queued ${result.queuedJobs} jobs.`,
        result.stopped ? "warn" : "success"
      );
    } catch (error) {
      console.error("[bulker] Queueing failed", error);
      this.queueState.status = "error";
      this.queueState.currentSummary = error?.message || "Queueing failed.";
      notify("Queueing failed", "error", error?.message || String(error));
    } finally {
      this.queueState.active = false;
      this.queueState.stopRequested = false;
      this.render();
    }
  }
}

async function addToolbarButton(controller) {
  ensureStylesheet();

  try {
    if (app.menu?.settingsGroup) {
      const { ComfyButton } = await import("../../scripts/ui/components/button.js");
      const button = new ComfyButton({
        content: EXTENSION_LABEL,
        tooltip: EXTENSION_LABEL,
        action: () => controller.open(),
      });
      button.element.classList.add("bulker-toolbar-button");
      app.menu.settingsGroup.append(button);
      controller.toolbarButton = button;
      return;
    }
  } catch (error) {
    debugLog("Falling back to raw toolbar button", error);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = EXTENSION_LABEL;
  button.className = "bulker-toolbar-button";
  button.title = EXTENSION_LABEL;
  button.addEventListener("click", () => controller.open());

  if (app.menu?.settingsGroup?.element) {
    app.menu.settingsGroup.element.appendChild(button);
  } else if (app.ui?.menuContainer) {
    app.ui.menuContainer.appendChild(button);
  } else {
    document.body.appendChild(button);
  }

  controller.toolbarButton = button;
}

const controller = new BulkerController();

app.registerExtension({
  name: EXTENSION_NAME,
  async setup() {
    await addToolbarButton(controller);

    if (controller.state.ui.open) {
      setTimeout(() => controller.open(), 0);
    }
  },
});

// TODO: Add zip mode for aligned value lists.
// TODO: Add preset save/load for reusable modifier sets.
// TODO: Add queue templates and import/export config support.
