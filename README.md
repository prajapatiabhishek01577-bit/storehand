# storehand

AI staff for small shops. Storehand gives a shop owner three Bots (Social, Inbox, SEO) that run on their own computer, remember the business, and always ask before spending money, placing an order, or messaging a new supplier.

Storehand is a fork of [SuperBot](https://github.com/davidondrej/superbot) (MIT). See `LICENSE`.

## Layout

- `server/` Rust server (`botd`) and CLI (`botctl`).
- `web/` the in-container chat app served by `botd`.
- `web/site/` the public site for Cloudflare Pages: landing, login, onboarding, dashboard.
- `deploy/` Dockerfile, compose template, one container per customer.

## Run locally

```sh
cp .env.example .env   # fill in
cargo build --release
set -a; . ./.env; set +a; ./target/release/botd
```

## Run with Docker (one container per customer)

See `deploy/README.md`.
