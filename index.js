/**
 * TokenHub 国际转发节点
 * 部署在 Railway (境外)，直连国际 AI 厂商
 * 接收主节点转发请求，直接调用厂商 API
 */
import Fastify from 'fastify';

const PORT = parseInt(process.env.PORT || "3000");

// ==================== 厂商配置 ====================
const PROVIDERS = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || '',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3'],
    modelMap: {}, // 无需映射
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY || '',
    models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'llama-3.3-70b-specdec'],
    modelMap: {
      'qwen-2.5-72b': 'mixtral-8x7b-32768',
    },
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: process.env.GEMINI_API_KEY || '',
    models: ['gemini-3.6-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-pro', 'gemini-2.5-flash'],
    modelMap: {},
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    models: ['claude-sonnet-4', 'gpt-4o', 'gemini-2.0-flash', 'deepseek-chat'],
    modelMap: {
      'llama-3.3-70b': 'meta-llama/llama-3.3-70b-instruct',
      'qwen-2.5-72b': 'qwen/qwen-2.5-72b-instruct',
      'mistral-large': 'mistralai/mistral-large',
    },
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    models: ['claude-sonnet-4', 'claude-3.5-haiku'],
    anthropic: true,
    modelMap: {},
  },
  nvidia: {
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKey: process.env.NVIDIA_NIM_API_KEY || '',
    models: ['meta/llama-3.2-11b-vision-instruct', 'meta/llama-3.2-90b-vision-instruct'],
    // 映射：短名称 → NVIDIA NIM 可用模型（仅已验证的模型）
    modelMap: {
      'llama-3.1-8b': 'meta/llama-3.2-11b-vision-instruct',
      'llama-3.1-70b': 'meta/llama-3.2-11b-vision-instruct',
      'llama-3.3-70b': 'meta/llama-3.2-90b-vision-instruct',
    },
  },
  cerebras: {
    baseUrl: 'https://api.cerebras.ai/v1',
    apiKey: process.env.CEREBRAS_API_KEY || '',
    models: ['llama3.1-8b', 'gpt-oss-120b'],
    modelMap: {},
  },
  mistral: {
    baseUrl: 'https://api.mistral.ai/v1',
    apiKey: process.env.MISTRAL_API_KEY || '',
    models: ['mistral-large-latest', 'codestral-latest', 'mistral-small-latest'],
    modelMap: {
      'mistral-large': 'mistral-large-latest',
      'mistral-small': 'mistral-small-latest',
      'codestral': 'codestral-latest',
    },
  },
  github: {
    baseUrl: 'https://models.github.ai/inference/v1',
    apiKey: process.env.GITHUB_API_KEY || '',
    models: ['gpt-4o-mini'],
    modelMap: {},
  },
  huggingface: {
    baseUrl: 'https://router.huggingface.co/v1',
    apiKey: process.env.HUGGINGFACE_API_KEY || '',
    models: ['deepseek-ai/DeepSeek-V4-Flash', 'microsoft/Phi-3.5-mini-instruct'],
    modelMap: {},
  },
};

// 模型 → 厂商 映射
const MODEL_PROVIDER = {};
for (const [code, cfg] of Object.entries(PROVIDERS)) {
  for (const m of cfg.models) {
    // 跳过未配置 Key 的厂商，避免映射到不可用厂商
    if (cfg.apiKey) {
      MODEL_PROVIDER[m] = code;
    }
  }
}
// 明确指定默认厂商优先级（避免被未配置厂商抢占）
const DEFAULT_PROVIDER_PRIORITY = ['openrouter', 'nvidia', 'gemini', 'huggingface', 'mistral', 'openai', 'groq', 'anthropic', 'github'];
for (const provider of DEFAULT_PROVIDER_PRIORITY) {
  if (PROVIDERS[provider]?.apiKey) {
    // 如果模型未映射，映射到第一个可用厂商
    for (const m of PROVIDERS[provider].models) {
      if (!MODEL_PROVIDER[m]) {
        MODEL_PROVIDER[m] = provider;
      }
    }
  }
}

// ==================== Fastify Server ====================
const app = Fastify({ logger: false });

// ============ 健康检查 ============
app.get('/health', async () => ({
  status: 'ok',
  node: 'international',
  providers: Object.entries(PROVIDERS)
    .filter(([_, cfg]) => cfg.apiKey)
    .map(([code, cfg]) => `${code}(${cfg.models.length} models)`),
  time: new Date().toISOString(),
}));

// ============ 模型列表 ============
app.get('/v1/models', async () => {
  const models = [];
  for (const [code, cfg] of Object.entries(PROVIDERS)) {
    for (const m of cfg.models) {
      models.push({ id: m, object: 'model', created: 1720000000, owned_by: code });
    }
  }
  return { object: 'list', data: models };
});

// ============ 主转发接口 ============
app.post('/v1/chat/completions', async (request, reply) => {
  const { model, messages, max_tokens, temperature, stream } = request.body || {};
  const auth = request.headers['authorization'] || '';

  // 从 Authorization 头提取目标厂商和验证
  // 格式: Bearer thk_xxx 或 Bearer sk-xxx — 主节点已鉴权，直接转发
  // 或者通过 X-Target-Provider 头指定厂商
  const targetProvider = request.headers['x-target-provider'] || MODEL_PROVIDER[model];

  if (!targetProvider) {
    return reply.status(400).send({
      error: { message: `未知模型: ${model}，无对应厂商配置`, type: 'invalid_request_error' },
    });
  }

  const cfg = PROVIDERS[targetProvider];
  if (!cfg) {
    return reply.status(400).send({
      error: { message: `未知厂商: ${targetProvider}`, type: 'invalid_request_error' },
    });
  }

  if (!cfg.apiKey) {
    // 尝试从请求头获取 API Key（主服务器传递）
    const requestApiKey = request.headers['x-api-key'];
    if (requestApiKey) {
      cfg.apiKey = requestApiKey;
    }
  }
  // 如果请求头有 Key，优先使用（覆盖环境变量中的旧 Key）
  if (request.headers['x-api-key']) {
    cfg.apiKey = request.headers['x-api-key'];
  }
  if (!cfg.apiKey) {
    return reply.status(502).send({
      error: { message: `厂商 ${targetProvider} API Key 未配置`, type: 'provider_error' },
    });
  }

  try {
    // 构建请求
    const mappedModel = cfg.modelMap?.[model] || model;
    const body = {
      model: mappedModel,
      messages,
      max_tokens: max_tokens || 1024,
      temperature: temperature || 0.7,
      stream: stream || false,
    };

    // Anthropic 使用不同的请求格式
    if (cfg.anthropic) {
      body.max_tokens = max_tokens || 1024;
    }

    const headers = {
      'Content-Type': 'application/json',
    };

    if (cfg.anthropic) {
      headers['x-api-key'] = cfg.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else if (targetProvider === 'gemini') {
      // Gemini 用 URL query parameter
      const resp = await fetch(
        `${cfg.baseUrl}/models/${model}:generateContent?key=${cfg.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: messages.map(m => ({
              role: m.role === 'user' ? 'user' : 'model',
              parts: [{ text: m.content }],
            })),
            generationConfig: { maxOutputTokens: max_tokens || 1024, temperature: temperature || 0.7 },
          }),
          signal: AbortSignal.timeout(60000),
        }
      );
      const data = await resp.json();
      if (!resp.ok) {
        return reply.status(resp.status).send({ error: { message: data.error?.message || 'Gemini error', type: 'provider_error' } });
      }
      // 转换为 OpenAI 格式
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return reply.send({
        id: 'gemini-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      });
    } else {
      // OpenAI 兼容格式
      headers['Authorization'] = 'Bearer ' + cfg.apiKey;
    }

    // 非 Gemini / 非流式
    if (!stream) {
      const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return reply.status(resp.status).send(data);
      }
      return reply.send(data);
    }

    // 流式响应
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    headers['Authorization'] = 'Bearer ' + cfg.apiKey;
    const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
        break;
      }
      reply.raw.write(decoder.decode(value, { stream: true }));
    }
  } catch (e) {
    return reply.status(502).send({
      error: { message: e.message || '转发失败', type: 'proxy_error' },
    });
  }
});

// ============ 启动 ============
const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    const hasKeys = Object.entries(PROVIDERS).filter(([_, c]) => c.apiKey).map(([k]) => k);
    console.log(`[TokenHub Forwarder] running on port ${PORT}`);
    console.log(`[TokenHub Forwarder] configured providers: ${hasKeys.join(', ') || 'none'}`);
    console.log(`[TokenHub Forwarder] endpoint: /v1/chat/completions`);
  } catch (e) {
    console.error('Failed to start:', e);
    process.exit(1);
  }
};

start();