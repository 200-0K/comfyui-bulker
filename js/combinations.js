import { formatValue } from "./values.js";

export function getValidModifiers(modifiers) {
  return (modifiers ?? []).filter((modifier) => modifier.valid && modifier.values?.length);
}

export function getJobCount(modifiers) {
  const validModifiers = getValidModifiers(modifiers);
  if (!validModifiers.length) {
    return 0;
  }

  return validModifiers.reduce((total, modifier) => total * modifier.values.length, 1);
}

export function* iterateCombinations(modifiers, index = 0, current = []) {
  if (index >= modifiers.length) {
    yield [...current];
    return;
  }

  const modifier = modifiers[index];
  for (const value of modifier.values) {
    current.push({
      modifierId: modifier.id,
      nodeId: modifier.nodeId,
      nodeLabel: modifier.nodeLabel,
      inputName: modifier.inputName,
      inputLabel: modifier.inputLabel,
      inputType: modifier.inputType,
      value,
    });
    yield* iterateCombinations(modifiers, index + 1, current);
    current.pop();
  }
}

export function getCombinationPreview(modifiers, limit = 5) {
  const preview = [];

  for (const combination of iterateCombinations(getValidModifiers(modifiers))) {
    preview.push(combination);
    if (preview.length >= limit) {
      break;
    }
  }

  return preview;
}

export function formatCombinationSummary(combination) {
  return combination
    .map((entry) => `[${entry.nodeId}.${entry.inputName}=${formatValue(entry.value)}]`)
    .join(" + ");
}
