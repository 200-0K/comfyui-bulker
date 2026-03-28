import { app } from "../../scripts/app.js";

const UNSUPPORTED_WIDGET_TYPES = new Set([
  "button",
  "converted-widget",
  "converted",
  "hidden",
  "ttNhidden",
]);
const UNSUPPORTED_WIDGET_NAMES = new Set(["control_after_generate"]);

const TEXT_WIDGET_TYPES = new Set(["customtext", "text", "string"]);
const NUMBER_WIDGET_TYPES = new Set(["number", "slider"]);

export function getNodeById(nodeId) {
  if (nodeId == null || nodeId === "") {
    return null;
  }

  const numericId = Number(nodeId);
  return app.graph?.getNodeById?.(numericId) ?? app.graph?._nodes_by_id?.[numericId] ?? null;
}

export function getNodeLabel(node) {
  const title = String(
    node?.title || node?.constructor?.title || node?.comfyClass || node?.type || "Node"
  );
  return `[${node.id}] ${title}`;
}

export function getNodeChoices() {
  const nodes = Array.isArray(app.graph?._nodes) ? [...app.graph._nodes] : [];
  return nodes
    .sort((left, right) => Number(left.id) - Number(right.id))
    .map((node) => ({
      id: String(node.id),
      label: getNodeLabel(node),
      node,
    }));
}

export function getWidgetType(widget) {
  if (!widget || !widget.name) {
    return null;
  }

  if (UNSUPPORTED_WIDGET_NAMES.has(widget.name)) {
    return null;
  }

  if (UNSUPPORTED_WIDGET_TYPES.has(widget.type)) {
    return null;
  }

  if (widget.type === "combo" || widget.options?.values != null) {
    return "combo";
  }

  if (
    widget.type === "toggle" ||
    typeof widget.value === "boolean" ||
    (widget.options && ("on" in widget.options || "off" in widget.options))
  ) {
    return "boolean";
  }

  if (NUMBER_WIDGET_TYPES.has(widget.type) || typeof widget.value === "number") {
    return "number";
  }

  if (TEXT_WIDGET_TYPES.has(widget.type) || typeof widget.value === "string") {
    return "text";
  }

  return null;
}

export function getWidgetOptions(widget) {
  if (!widget?.options || widget.options.values == null) {
    return [];
  }

  const rawValues = typeof widget.options.values === "function"
    ? widget.options.values()
    : widget.options.values;

  return Array.isArray(rawValues) ? rawValues.map((value) => String(value)) : [];
}

export function getEditableWidgets(node) {
  if (!Array.isArray(node?.widgets)) {
    return [];
  }

  return node.widgets
    .map((widget, widgetIndex) => {
      const inputType = getWidgetType(widget);
      if (!inputType) {
        return null;
      }

      return {
        name: widget.name,
        label: widget.label || widget.name,
        inputType,
        widgetType: widget.type || inputType,
        widgetIndex,
        options: inputType === "combo" ? getWidgetOptions(widget) : [],
      };
    })
    .filter(Boolean);
}

export function getEditableWidget(nodeId, inputName) {
  const node = getNodeById(nodeId);
  if (!node) {
    return null;
  }

  return getEditableWidgets(node).find((widget) => widget.name === inputName) ?? null;
}

export function getWidgetIndex(nodeId, inputName) {
  const widget = getEditableWidget(nodeId, inputName);
  return widget ? widget.widgetIndex : -1;
}

export function validateModifier(modifier) {
  const nextModifier = { ...modifier, valid: false, invalidReason: "" };
  const node = getNodeById(nextModifier.nodeId);

  if (!node) {
    nextModifier.invalidReason = nextModifier.nodeId ? "Node no longer exists" : "Select a node";
    return nextModifier;
  }

  nextModifier.nodeId = String(node.id);
  nextModifier.nodeLabel = getNodeLabel(node);

  const widget = getEditableWidget(nextModifier.nodeId, nextModifier.inputName);
  if (!widget) {
    nextModifier.invalidReason = nextModifier.inputName
      ? UNSUPPORTED_WIDGET_NAMES.has(nextModifier.inputName)
        ? "Input is UI-only and cannot be queued"
        : "Input is missing or unsupported"
      : "Select an input";
    return nextModifier;
  }

  nextModifier.inputName = widget.name;
  nextModifier.inputLabel = widget.label;
  nextModifier.inputType = widget.inputType;
  nextModifier.widgetType = widget.widgetType;

  if (!Array.isArray(nextModifier.values) || nextModifier.values.length === 0) {
    nextModifier.invalidReason = "Add at least one value";
    return nextModifier;
  }

  nextModifier.valid = true;
  return nextModifier;
}
