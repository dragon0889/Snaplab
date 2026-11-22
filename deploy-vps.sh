#!/usr/bin/env bash
# Deploys SnapLab on a VPS with Docker Compose + Caddy (automatic HTTPS).
# Usage: ./deploy-vps.sh        (run from the project folder, next to docker-compose.yml)
set -euo pipefail
cd "$(dirname "$0")"

fail() { echo "LỖI: $*" >&2; exit 1; }

command -v docker >/dev/null || fail "Chưa cài Docker."
docker compose version >/dev/null 2>&1 || fail "Chưa cài Docker Compose v2 (lệnh 'docker compose')."
[ -f .env ] || fail "Chưa có file .env. Chạy: cp .env.example .env rồi điền DOMAIN và BETA_ACCESS_CODE."

get_env() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^"//' -e 's/"$//'; }
[ -n "$(get_env DOMAIN)" ] || fail "DOMAIN trong .env đang trống."
[ -n "$(get_env BETA_ACCESS_CODE)" ] || fail "BETA_ACCESS_CODE trong .env đang trống."
[ "$(get_env BETA_ACCESS_CODE | wc -c)" -ge 9 ] || fail "BETA_ACCESS_CODE nên dài từ 8 ký tự trở lên."
chmod 600 .env

echo "==> Dựng image và khởi động..."
docker compose build --pull
docker compose up -d --remove-orphans

echo "==> Chờ ứng dụng sẵn sàng..."
for i in $(seq 1 30); do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q app)" 2>/dev/null || echo starting)"
  [ "$status" = "healthy" ] && break
  sleep 2
done
[ "${status:-}" = "healthy" ] || { docker compose logs --tail=50 app; fail "Ứng dụng chưa healthy sau 60 giây."; }

docker image prune -f >/dev/null
echo "==> Xong. Mở https://$(get_env DOMAIN) (Caddy có thể cần vài chục giây để lấy chứng chỉ lần đầu)."
