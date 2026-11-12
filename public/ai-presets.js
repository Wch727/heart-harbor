const providers = [
  ["国内接口", [
    ["DeepSeek", "https://api.deepseek.com", [
      ["DeepSeek Flash（站点默认）", "deepseek-flash"],
      ["DeepSeek V4 Pro", "deepseek-v4-pro"]
    ]],
    ["月之暗面", "https://api.moonshot.cn/v1", [
      ["Kimi K3.1 Pro", "kimi-k3.1-pro"],
      ["Kimi K3.1 Pro Highspeed", "kimi-k3.1-pro-highspeed"]
    ]],
    ["阿里云百炼", "https://dashscope.aliyuncs.com/compatible-mode/v1", [
      ["Qwen3.8 Flash", "qwen3.8-flash"],
      ["Qwen3.8 Max", "qwen3.8-max"]
    ]],
    ["火山方舟", "https://ark.cn-beijing.volces.com/api/v3", [
      ["豆包 Seed 2.1 Lite", "doubao-seed-2-1-lite-260915"],
      ["豆包 Seed 2.1 Pro", "doubao-seed-2-1-pro-260915"]
    ]],
    ["小米", "https://api.xiaomimimo.com/v1", [
      ["MiMo V2.6 Flash", "mimo-v2.6-flash"],
      ["MiMo V2.6 Pro", "mimo-v2.6-pro"]
    ]],
    ["智谱", "https://open.bigmodel.cn/api/paas/v4", [
      ["GLM-5.3", "glm-5.3"],
      ["GLM-5.2", "glm-5.2"]
    ]],
    ["MiniMax", "https://api.minimax.io/v1", [["MiniMax M3.1 Flash", "MiniMax-M3.1-Flash"]]],
    ["百度千帆", "https://qianfan.baidubce.com/v2", [
      ["文心 5.5 Flash（预览）", "ernie-5.5-flash-preview"]
    ]]
  ]],
  ["海外接口", [
    ["OpenAI", "https://api.openai.com/v1", [
      ["GPT-6 Luna", "gpt-6-luna"],
      ["GPT-6.1 Terra", "gpt-6.1-terra"],
      ["GPT-6.1 Sol", "gpt-6.1-sol"],
      ["GPT-6 Astra", "gpt-6-astra"]
    ]],
    ["Anthropic", "https://api.anthropic.com/v1", [
      ["Claude Haiku 5.5", "claude-haiku-5-5"],
      ["Claude Sonnet 5.5", "claude-sonnet-5-5"],
      ["Claude Opus 5.5", "claude-opus-5-5"]
    ]],
    ["Google", "https://generativelanguage.googleapis.com/v1beta/openai", [
      ["Gemini 3.8 Flash", "gemini-3.8-flash"],
      ["Gemini 3.5 Flash-Lite", "gemini-3.5-flash-lite"]
    ]],
    ["xAI", "https://api.x.ai/v1", [["Grok 4.7", "grok-4.7"]]],
    ["Mistral", "https://api.mistral.ai/v1", [["Mistral Large 4", "mistral-large-4"]]]
  ]],
  ["聚合接口", [
    ["OpenRouter", "https://openrouter.ai/api/v1", [["Claude Opus 5.5", "anthropic/claude-opus-5.5"]]]
  ]]
];

export function bindAiPresets(select, { baseUrlInput, modelInput, keyInput, onSelect }) {
  const presets = new Map();
  for (const [region, entries] of providers) {
    const group = document.createElement("optgroup");
    group.label = region;
    for (const [provider, baseUrl, models] of entries) {
      for (const [label, model] of models) {
        const id = `${provider}:${model}`;
        presets.set(id, { baseUrl, model, label });
        group.append(new Option(`${provider} · ${label}`, id));
      }
    }
    select.append(group);
  }

  select.addEventListener("change", () => {
    const preset = presets.get(select.value);
    if (!preset) return;
    const endpointChanged = baseUrlInput.value.trim().replace(/\/+$/, "") !== preset.baseUrl;
    if (endpointChanged) keyInput.value = "";
    baseUrlInput.value = preset.baseUrl;
    modelInput.value = preset.model;
    onSelect(preset, endpointChanged);
    select.value = "";
  });
}
