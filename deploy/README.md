# Deploy (Oracle ARM64 VM)

1. Install Docker Engine + compose plugin on the VM.
2. `docker build -t storehand:latest .` (from repo root; arm64 native on Ampere).
3. `cp deploy/customers/example.env deploy/customers/c1.env` and fill it in.
4. `docker compose -f deploy/compose.yml --profile c1 up -d`
5. Health: `curl localhost:3101/healthz`

Hard cap: 4 customers (slots c1..c4). Each slot: own env, `/data` and `/workspace` volumes, 2 GB RAM, one browser (`MAX_SCREENS=1`), non-root uid 10001.
Provisioning automation is not built yet (see STATUS).
