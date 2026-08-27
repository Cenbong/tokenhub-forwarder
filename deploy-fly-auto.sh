#!/bin/bash
# 自动部署 tokenhub-forwarder 到 Fly.io
set -e

FLY_API_TOKEN="${1:-$FLY_API_TOKEN}"
APP_NAME="tokenhub-forwarder"

if [ -z "$FLY_API_TOKEN" ]; then
  echo "错误: 需要 FLY_API_TOKEN"
  echo "用法: $0 <fly-api-token>"
  exit 1
fi

ORG_SLUG="personal"

echo "=== 创建应用 ==="
curl -s -X POST "https://api.fly.io/graphql" \
  -H "Authorization: Bearer $FLY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"mutation { createApp(input: {name: \\\"$APP_NAME\\\", organizationId: \\\"personal\\\"}) { app { id name } } }\"}"

echo ""
echo "=== 设置密钥 ==="
# 注意: 这里需要替换成实际的 API Key
flyctl secrets set \
  OPENAI_API_KEY="sk-proj-***" \
  GEMINI_API_KEY="AIzaSy***" \
  OPENROUTER_API_KEY="sk-or-***" \
  -a "$APP_NAME" \
  -t "$FLY_API_TOKEN"

echo ""
echo "=== 部署 ==="
flyctl deploy --remote-only -a "$APP_NAME" -t "$FLY_API_TOKEN"

echo ""
echo "=== 获取域名 ==="
flyctl info -a "$APP_NAME" -t "$FLY_API_TOKEN" | grep Hostname