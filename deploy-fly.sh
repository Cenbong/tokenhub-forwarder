#!/bin/bash
# TokenHub 国际转发节点 - Fly.io 部署脚本
# 用法: bash deploy-fly.sh

set -e

echo "========================================="
echo "TokenHub 国际转发节点 - Fly.io 部署"
echo "========================================="

# 1. 登录 Fly.io
echo ""
echo "[1/5] 登录 Fly.io..."
fly auth login

# 2. 创建应用
echo ""
echo "[2/5] 创建 Fly.io 应用..."
fly launch --name tokenhub-forwarder --no-deploy --region hkg 2>/dev/null || true

# 3. 设置环境变量
echo ""
echo "[3/5] 设置环境变量..."
echo "请从主服务器 .env 或 /opt/tokenhub/.env 中获取以下 Key:"
echo ""
echo "  OPENAI_API_KEY=sk-..."
echo "  GROQ_API_KEY=gsk_..."
echo "  GEMINI_API_KEY=AIzaSy..."
echo "  OPENROUTER_API_KEY=sk-or-..."
echo "  NVIDIA_NIM_API_KEY=nvapi-..."
echo ""

fly secrets set \
  OPENAI_API_KEY="" \
  GROQ_API_KEY="" \
  GEMINI_API_KEY="" \
  OPENROUTER_API_KEY="" \
  NVIDIA_NIM_API_KEY=""

# 4. 部署
echo ""
echo "[4/5] 部署到 Fly.io..."
fly deploy

# 5. 获取域名
echo ""
echo "[5/5] 获取域名..."
fly info | grep Hostname

echo ""
echo "========================================="
echo "部署完成！"
echo "将以下地址配置到主服务器:"
echo "  INTERNATIONAL_FORWARDER_URL=https://tokenhub-forwarder.fly.dev"
echo "  INTERNATIONAL_FORWARDER_TOKEN=tokenhub-forwarder-2026"
echo ""
echo "然后重启主服务器:"
echo "  ssh root@43.249.28.144 'cd /opt/tokenhub && docker compose restart app'"
echo "========================================="