function toKey(valueType, value) {
  if (valueType === "number") {
    return `number:${Number(value)}`;
  }

  if (valueType === "boolean") {
    return `boolean:${Boolean(value)}`;
  }

  return `text:${String(value)}`;
}

export function dedupeValues(valueType, values) {
  const seen = new Set();
  const uniqueValues = [];

  for (const value of values ?? []) {
    const key = toKey(valueType, value);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueValues.push(value);
  }

  return uniqueValues;
}

export function parseManualValues(valueType, rawText) {
  const lines = String(rawText ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const errors = [];
  const values = [];

  for (const line of lines) {
    if (valueType === "number") {
      const value = Number(line);
      if (!Number.isFinite(value)) {
        errors.push(`Invalid number: ${line}`);
        continue;
      }

      values.push(value);
      continue;
    }

    if (valueType === "boolean") {
      const normalized = line.toLowerCase();
      if (["true", "1", "yes", "on"].includes(normalized)) {
        values.push(true);
        continue;
      }

      if (["false", "0", "no", "off"].includes(normalized)) {
        values.push(false);
        continue;
      }

      errors.push(`Invalid boolean: ${line}`);
      continue;
    }

    values.push(line);
  }

  return {
    values: dedupeValues(valueType, values),
    errors,
  };
}

export function formatValue(value) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

export function valuesToText(values) {
  return (values ?? []).map((value) => formatValue(value)).join("\n");
}
