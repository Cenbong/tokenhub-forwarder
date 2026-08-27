# TokenHub 国际转发节点

部署在 Railway，直连国际 AI 厂商 API，接收主节点转发请求。

## 环境变量

| 变量 | 说明 | 必填 |
|:---|:---|:---:|
| `OPENAI_API_KEY` | OpenAI API Key | ✅ |
| `GROQ_API_KEY` | Groq API Key | |
| `GEMINI_API_KEY` | Gemini API Key | ✅ |
| `OPENROUTER_API_KEY` | OpenRouter API Key | ✅ |
| `NVIDIA_NIM_API_KEY` | NVIDIA NIM API Key | |
| `ANTHROPIC_API_KEY` | Anthropic API Key | |
| `CEREBRAS_API_KEY` | Cerebras API Key | |
| `MISTRAL_API_KEY` | Mistral API Key | |
| `GITHUB_API_KEY` | GitHub Models API Key | |
| `HUGGINGFACE_API_KEY` | HuggingFace API Key | |

## API

- `POST /v1/chat/completions` — 标准 OpenAI 格式，`X-Target-Provider` 头指定厂商
- `GET /v1/models` — 可用模型列表
- `GET /health` — 健康检查

## 部署

```bash
railway login
railway init
railway up
railway domain
```