# syntax=docker/dockerfile:1
# Storehand: one container per customer. Built for linux/arm64 (Oracle Ampere) and amd64.
# Build: docker build -t storehand:latest .

FROM rust:1-bookworm AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY server server
COPY web web
RUN cargo build --release --locked --bin botd --bin botctl

# voxl: the live view of the Bot's screen. Optional (WITH_VOXL=0 skips it; screens still work, no live view).
FROM rust:1-bookworm AS voxl
ARG WITH_VOXL=1
ARG VOXL_VERSION=0.3.5
RUN mkdir -p /out/bin && if [ "$WITH_VOXL" = "1" ]; then \
      apt-get update -qq && apt-get install -y -qq --no-install-recommends clang pkg-config libx264-dev libyuv-dev libopus-dev >/dev/null && \
      cargo install -q --locked --version "$VOXL_VERSION" voxl-server --no-default-features --root /out; \
    fi

FROM debian:bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
      ca-certificates curl git tini tzdata \
      xvfb openbox x11-utils dbus-x11 at-spi2-core fonts-noto-core fonts-noto-color-emoji \
      chromium libx264-164 libopus0 libyuv0 \
      nodejs npm \
    && rm -rf /var/lib/apt/lists/*
# Agent harness CLIs and the browser tool. Logins/keys come from the customer's .env at runtime.
ARG CLAUDE_CODE_VERSION=latest
ARG AGENT_BROWSER_VERSION=0.43.0
RUN npm install -g --omit=dev "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" "agent-browser@${AGENT_BROWSER_VERSION}" \
    && npm cache clean --force

COPY --from=build /src/target/release/botd /src/target/release/botctl /usr/local/bin/
COPY --from=voxl /out/bin/ /usr/local/bin/

# Non-root user. DATA_DIR and WORKSPACE_DIR are per-customer volumes.
RUN useradd --create-home --uid 10001 --shell /bin/bash storehand \
    && mkdir -p /data /workspace && chown storehand:storehand /data /workspace
USER storehand
WORKDIR /home/storehand

ENV HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/data \
    WORKSPACE_DIR=/workspace \
    DEFAULT_HARNESS=claude \
    PRIMARY_BOT_NAME=Storehand \
    SCREENS=on \
    MAX_SCREENS=1 \
    SCREEN_IDLE_MINUTES=5 \
    AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium \
    AGENT_BROWSER_EXTRA_ARGS="--no-sandbox --disable-dev-shm-usage"

VOLUME ["/data", "/workspace"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -fsS http://127.0.0.1:3000/healthz || exit 1
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["botd"]
