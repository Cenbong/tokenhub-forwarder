# RouterA 国际转发节点

RouterA 国际转发节点 — 直连国际 AI 厂商 API

## 部署到 Koyeb（推荐）

1. 注册/登录 [Koyeb](https://app.koyeb.com/)（支持 GitHub 登录）
2. 点击 **Create App**
3. 选择 **Deploy from GitHub**
4. 授权后选择 `Cenbong/tokenhub-forwarder`
5. 自动检测 Dockerfile，无需修改配置
6. 区域建议选择 **Frankfurt (fra)** 或 **Singapore (sgp)**
7. 点击 **Create App**，等待 2-3 分钟部署完成

部署完成后 Koyeb 会分配一个域名（如 `tokenhub-forwarder-xxx.koyeb.app`），记下这个域名。

## 部署到 Fly.io

```bash
flyctl auth login
flyctl deploy
```

## 配置主服务器

部署完成后，在主服务器上设置环境变量：

```bash
# 替换为你的 Koyeb/Fly 域名
export INTERNATIONAL_FORWARDER_URL="https://your-domain.koyeb.app"
export INTERNATIONAL_FORWARDER_TOKEN="tokenhub-forwarder"
```

然后在 Docker 中重启：
```bash
docker compose restart app
```

## 本地开发

```bash
npm install
npm start
```

## API

### 健康检查
```bash
GET /health
```

### 转发请求
```bash
POST /v1/chat/completions
Authorization: Bearer <target-api-key>
X-Target-Provider: openai
Content-Type: application/json

{
  "model": "gpt-4o-mini",
  "messages": [{"role": "user", "content": "Hello"}]
}
```
