function makeModifierId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `bulker-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function createModifier(partial = {}) {
  return {
    id: partial.id ?? makeModifierId(),
    nodeId: partial.nodeId != null ? String(partial.nodeId) : "",
    nodeLabel: partial.nodeLabel ?? "",
    inputName: partial.inputName ?? "",
    inputLabel: partial.inputLabel ?? "",
    inputType: partial.inputType ?? "",
    widgetType: partial.widgetType ?? "",
    values: Array.isArray(partial.values) ? [...partial.values] : [],
    manualValueText: partial.manualValueText ?? "",
    optionFilter: partial.optionFilter ?? "",
    parseErrors: Array.isArray(partial.parseErrors) ? [...partial.parseErrors] : [],
    valid: Boolean(partial.valid),
    invalidReason: partial.invalidReason ?? "",
  };
}

export function createState(partial = {}) {
  return {
    modifiers: Array.isArray(partial.modifiers)
      ? partial.modifiers.map((modifier) => createModifier(modifier))
      : [],
    ui: {
      open: Boolean(partial.ui?.open),
    },
  };
}

export function serializeState(state) {
  return {
    modifiers: (state.modifiers ?? []).map((modifier) => ({
      id: modifier.id,
      nodeId: modifier.nodeId,
      nodeLabel: modifier.nodeLabel,
      inputName: modifier.inputName,
      inputLabel: modifier.inputLabel,
      inputType: modifier.inputType,
      widgetType: modifier.widgetType,
      values: Array.isArray(modifier.values) ? [...modifier.values] : [],
      manualValueText: modifier.manualValueText ?? "",
      optionFilter: modifier.optionFilter ?? "",
    })),
    ui: {
      open: Boolean(state.ui?.open),
    },
  };
}
