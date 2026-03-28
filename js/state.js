function makeModifierId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `bulker-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function makeModifierValueId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `bulker-value-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function createModifierValueRow(partial = {}) {
  const isObjectLike = partial != null && typeof partial === "object" && !Array.isArray(partial);
  const value = isObjectLike && "value" in partial ? partial.value : partial;
  const rawRepeat = isObjectLike && "repeat" in partial ? Number(partial.repeat) : 1;

  return {
    id: isObjectLike && partial.id ? String(partial.id) : makeModifierValueId(),
    value,
    repeat: Number.isFinite(rawRepeat) ? Math.max(1, Math.round(rawRepeat)) : 1,
  };
}

export function createModifierValueRows(values) {
  return Array.isArray(values) ? values.map((value) => createModifierValueRow(value)) : [];
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
    values: createModifierValueRows(partial.values),
    manualValueText: partial.manualValueText ?? "",
    optionFilter: partial.optionFilter ?? "",
    parseErrors: Array.isArray(partial.parseErrors) ? [...partial.parseErrors] : [],
    valid: Boolean(partial.valid),
    invalidReason: partial.invalidReason ?? "",
  };
}

export function createOutputNamingRule(partial = {}) {
  return {
    modifierId: partial.modifierId != null ? String(partial.modifierId) : "",
    enabled: partial.enabled !== false,
    showLabel: partial.showLabel !== false,
    label: partial.label ?? "",
  };
}

export function createOutputNaming(partial = {}) {
  return {
    enabled: Boolean(partial.enabled),
    collapsed: Boolean(partial.collapsed),
    basePrefix: String(partial.basePrefix ?? "bulker-"),
    rules: Array.isArray(partial.rules)
      ? partial.rules.map((rule) => createOutputNamingRule(rule))
      : [],
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
    outputNaming: createOutputNaming(partial.outputNaming),
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
      values: createModifierValueRows(modifier.values).map((row) => ({
        id: row.id,
        value: row.value,
        repeat: row.repeat,
      })),
      manualValueText: modifier.manualValueText ?? "",
      optionFilter: modifier.optionFilter ?? "",
    })),
    ui: {
      open: Boolean(state.ui?.open),
    },
    outputNaming: {
      enabled: Boolean(state.outputNaming?.enabled),
      collapsed: Boolean(state.outputNaming?.collapsed),
      basePrefix: String(state.outputNaming?.basePrefix ?? "bulker-"),
      rules: (state.outputNaming?.rules ?? []).map((rule) => {
        const nextRule = createOutputNamingRule(rule);
        return {
          modifierId: nextRule.modifierId,
          enabled: nextRule.enabled,
          showLabel: nextRule.showLabel,
          label: nextRule.label,
        };
      }),
    },
  };
}
