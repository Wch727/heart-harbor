const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");
const { createInterface } = require("node:readline");

const labelMap = new Map([
  ["恐惧", "anxiety"],
  ["悲伤", "low"],
  ["高兴", "positive"],
  ["喜好", "positive"]
]);

let worker = null;

function selectEmotion({ label, score, second }) {
  if (!Number.isFinite(score) || !Number.isFinite(second) || score < 0.65 || score - second < 0.15) {
    return null;
  }
  return labelMap.get(label) || null;
}

function startEmotionClassifier(modelDir, launch = spawn) {
  const files = ["config.json", "vocab.txt", "pytorch_model.bin"];
  if (worker || process.env.COMPANION_EMOTION_DISABLED === "1" ||
      !files.every((name) => existsSync(path.join(modelDir, name)))) return;

  const child = launch(process.env.COMPANION_EMOTION_PYTHON || "python", [
    "-u", path.join(__dirname, "emotion-worker.py"), modelDir
  ], {
    stdio: ["pipe", "pipe", "ignore"],
    env: { ...process.env, HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1", PYTHONIOENCODING: "utf-8" },
    windowsHide: true
  });
  const state = { child, ready: false, nextId: 0, pending: new Map() };
  worker = state;
  const lines = createInterface({ input: child.stdout });

  function unavailable() {
    if (worker !== state) return;
    worker = null;
    lines.close();
    for (const complete of state.pending.values()) complete(null);
    state.pending.clear();
    console.warn("Local emotion classifier unavailable; using rules.");
  }

  child.once("error", unavailable);
  child.once("exit", unavailable);
  child.stdin.on("error", unavailable);
  lines.on("line", (line) => {
    let result;
    try {
      result = JSON.parse(line);
    } catch {
      return;
    }
    if (!result || typeof result !== "object") return;
    if (result.ready && worker === state) {
      state.ready = true;
      console.log("Local StructBERT emotion classifier ready.");
      return;
    }
    const complete = state.pending.get(result.id);
    state.pending.delete(result.id);
    complete?.(selectEmotion(result));
  });
}

function classifyEmotion(text) {
  const state = worker;
  if (!state?.ready || state.pending.size >= 8) return Promise.resolve(null);
  return new Promise((resolve) => {
    const id = ++state.nextId;
    const timer = setTimeout(() => resolve(null), 250);
    state.pending.set(id, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
    state.child.stdin.write(`${JSON.stringify({ id, text })}\n`);
  });
}

module.exports = { classifyEmotion, selectEmotion, startEmotionClassifier };
