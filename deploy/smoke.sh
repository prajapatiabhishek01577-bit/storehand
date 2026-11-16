#!/bin/sh
# Smoke test against a running botd: onboarding creates 3 Bots with routines; approvals list works.
set -eu
B=${1:-http://localhost:3000}
curl -sf -X POST "$B/api/onboarding" -H 'content-type: application/json' -d '{
  "businessName":"Test Bakery","location":"Austin, TX","sells":"bread and cakes",
  "bestSellers":["Sourdough"],"seasonality":"year-round",
  "suppliers":[{"name":"Mill Co","items":[{"item":"Flour 25kg","price":"$30"}]}],
  "priceLimits":[{"item":"Flour 25kg","maxPrice":"$28"}],
  "socials":[{"platform":"instagram","handle":"@testbakery"}]}' > /tmp/onb.json
grep -q '"Social"' /tmp/onb.json && grep -q '"Inbox"' /tmp/onb.json && grep -q '"SEO"' /tmp/onb.json
# Idempotent: second run must not duplicate Bots or routines.
curl -sf -X POST "$B/api/onboarding" -H 'content-type: application/json' -d '{"businessName":"Test Bakery","sells":"bread"}' >/dev/null
n=$(curl -sf "$B/api/bots" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')
[ "$n" -eq 4 ] || { echo "expected 4 bots, got $n"; exit 1; }
inbox=$(curl -sf "$B/api/bots" | python3 -c 'import json,sys; print([b["id"] for b in json.load(sys.stdin) if b["name"]=="Inbox"][0])')
r=$(curl -sf "$B/api/bots/$inbox/routines" | grep -o '"name"' | wc -l)
[ "$r" -eq 2 ] || { echo "expected 2 routines, got $r"; exit 1; }
curl -sf "$B/api/approvals" | grep -q '^\['
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/onboarding" -H 'content-type: application/json' -d '{"sells":"x"}')
[ "$code" = 400 ] || { echo "expected 400, got $code"; exit 1; }
echo "smoke ok"
