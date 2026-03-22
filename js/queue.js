import { api } from "../../scripts/api.js";
import { formatCombinationSummary, getJobCount, iterateCombinations } from "./combinations.js";
import { getWidgetIndex } from "./graph.js";

export const DEFAULT_QUEUE_DELAY_MS = 250;

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPromptGraph(payload) {
  if (payload?.output) {
    return payload.output;
  }

  if (payload?.prompt) {
    return payload.prompt;
  }

  return payload;
}

function ensureQueuePayload(basePrompt) {
  const hasEnvelope = Boolean(
    basePrompt?.output || basePrompt?.prompt || basePrompt?.workflow || basePrompt?.extra_data
  );

  if (!hasEnvelope) {
    const prompt = cloneValue(basePrompt);
    return {
      prompt,
      output: prompt,
    };
  }

  const payload = cloneValue(basePrompt);
  const promptGraph = getPromptGraph(payload);
  payload.prompt = payload.prompt ?? promptGraph;
  payload.output = payload.output ?? promptGraph;

  if (payload.workflow) {
    payload.extra_data = {
      ...(payload.extra_data ?? {}),
      extra_pnginfo: {
        ...(payload.extra_data?.extra_pnginfo ?? {}),
        workflow: payload.workflow,
      },
    };
  }

  return payload;
}

function setWorkflowValue(workflow, assignment) {
  if (!Array.isArray(workflow?.nodes)) {
    return;
  }

  const workflowNode = workflow.nodes.find((node) => String(node.id) === String(assignment.nodeId));
  if (!workflowNode) {
    return;
  }

  const widgetIndex = getWidgetIndex(assignment.nodeId, assignment.inputName);
  if (widgetIndex < 0) {
    return;
  }

  if (!Array.isArray(workflowNode.widgets_values)) {
    workflowNode.widgets_values = [];
  }

  while (workflowNode.widgets_values.length <= widgetIndex) {
    workflowNode.widgets_values.push(null);
  }

  workflowNode.widgets_values[widgetIndex] = assignment.value;
}

function applyCombination(payload, combination) {
  const promptGraph = getPromptGraph(payload);

  for (const assignment of combination) {
    const promptNode = promptGraph?.[String(assignment.nodeId)];
    if (!promptNode) {
      throw new Error(`Node ${assignment.nodeId} was not found in the exported prompt`);
    }

    if (!promptNode.inputs || !(assignment.inputName in promptNode.inputs)) {
      throw new Error(
        `Input ${assignment.inputName} was not found on node ${assignment.nodeId} in the exported prompt`
      );
    }

    promptNode.inputs[assignment.inputName] = assignment.value;
    setWorkflowValue(payload.workflow, assignment);
  }

  if (payload.workflow) {
    payload.extra_data = {
      ...(payload.extra_data ?? {}),
      extra_pnginfo: {
        ...(payload.extra_data?.extra_pnginfo ?? {}),
        workflow: payload.workflow,
      },
    };
  }

  return payload;
}

export async function queueCombinations({
  basePrompt,
  modifiers,
  delayMs = DEFAULT_QUEUE_DELAY_MS,
  shouldStop,
  onProgress,
}) {
  const totalJobs = getJobCount(modifiers);
  let queuedJobs = 0;

  for (const combination of iterateCombinations(modifiers)) {
    if (shouldStop?.()) {
      return { queuedJobs, totalJobs, stopped: true };
    }

    const summary = formatCombinationSummary(combination);
    onProgress?.({ queuedJobs, totalJobs, summary, phase: "queueing" });

    const payload = applyCombination(ensureQueuePayload(basePrompt), combination);
    await api.queuePrompt(0, payload);
    queuedJobs += 1;

    onProgress?.({ queuedJobs, totalJobs, summary, phase: "queued" });

    if (shouldStop?.()) {
      return { queuedJobs, totalJobs, stopped: true };
    }

    if (queuedJobs < totalJobs && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return { queuedJobs, totalJobs, stopped: false };
}
