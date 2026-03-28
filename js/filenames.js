import { formatValue } from "./values.js";

const COMBINING_MARKS_REGEX = /[\u0300-\u036f]/g;
const REPLACEMENTS = [
  [/%+/g, " percent "],
  [/&+/g, " and "],
  [/\++/g, " plus "],
  [/#+/g, " number "],
  [/@+/g, " at "],
];

export function getDefaultFilenameRuleLabel(modifier) {
  const inputName = String(modifier?.inputName ?? "").trim();
  if (inputName) {
    return inputName;
  }

  const inputLabel = String(modifier?.inputLabel ?? "").trim();
  if (inputLabel) {
    return inputLabel;
  }

  return `modifier-${String(modifier?.nodeId ?? "value")}`;
}

export function sanitizeFilenameSegment(value, fallback = "value") {
  let text = String(formatValue(value ?? ""));
  if (typeof text.normalize === "function") {
    text = text.normalize("NFKD");
  }

  text = text.replace(COMBINING_MARKS_REGEX, "");

  for (const [pattern, replacement] of REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  const sanitized = text
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/[-_.]{2,}/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .toLowerCase();

  return sanitized || fallback;
}

export function buildFilenameToken({ label, value, showLabel = true }) {
  const valueToken = sanitizeFilenameSegment(value, "value");
  if (!showLabel) {
    return valueToken;
  }

  const labelToken = sanitizeFilenameSegment(label, "value");
  return `${labelToken}-${valueToken}`;
}

export function buildCombinationFilenameSuffix({ combination, outputNaming, modifiers }) {
  if (!outputNaming?.enabled) {
    return "";
  }

  const entriesByModifierId = new Map(
    (combination ?? []).map((entry) => [String(entry?.modifierId ?? ""), entry])
  );
  const modifiersById = new Map((modifiers ?? []).map((modifier) => [String(modifier.id), modifier]));
  const tokens = [];

  for (const rule of outputNaming.rules ?? []) {
    if (!rule?.enabled) {
      continue;
    }

    const modifierId = String(rule.modifierId ?? "");
    const entry = entriesByModifierId.get(modifierId);
    if (!entry) {
      continue;
    }

    const modifier = modifiersById.get(modifierId);
    const label = String(rule.label ?? "").trim() || getDefaultFilenameRuleLabel(modifier ?? entry);
    const token = buildFilenameToken({
      label,
      value: entry.value,
      showLabel: rule.showLabel !== false,
    });

    if (token) {
      tokens.push(token);
    }
  }

  return tokens.join("-");
}

export function getOutputNamingBasePrefix(outputNaming, fallback = "bulker-") {
  if (outputNaming && Object.prototype.hasOwnProperty.call(outputNaming, "basePrefix")) {
    return String(outputNaming.basePrefix ?? "").trim();
  }

  const normalizedFallback = String(fallback ?? "").trim();
  return normalizedFallback;
}

export function appendFilenameSuffix(filenamePrefix, suffix) {
  const normalizedPrefix = String(filenamePrefix ?? "")
    .trim()
    .replace(/\\/g, "/");

  if (!suffix) {
    return normalizedPrefix;
  }

  return normalizedPrefix ? `${normalizedPrefix}${suffix}` : suffix;
}
