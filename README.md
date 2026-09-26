# cdc

Static frontend for exploring the [CFPB Consumer Complaint Database](https://www.consumerfinance.gov/data-research/consumer-complaints/).

Live at **https://mihir-kale.github.io/cdc/**

## Status

Scaffold. Runs entirely on local fixture data (`MOCK DATA` badge in the header) so
the UI can be built and reviewed before any backend exists. The data layer is
already isolated behind a single switch — see [Going live](#going-live).

## Why there is a proxy in the plan

The CFPB endpoint is not callable from a browser. Its WAF returns **403 for any
request carrying an `Origin` header**, and browsers always send that on
cross-origin `fetch`:

```bash
curl -o /dev/null -w '%{http_code}\n' "$UPSTREAM?size=1"                                  # 200
curl -o /dev/null -w '%{http_code}\n' -H 'Origin: https://mihir-kale.github.io' \
     "$UPSTREAM?size=1"                                                                    # 403
```

So the browser needs something in front of the API. Undecided between a
Cloudflare Worker and a scheduled GitHub Actions snapshot.

## Layout

```
index.html          page shell
.nojekyll           disables Jekyll processing on Pages
css/styles.css      all styling; light + dark via prefers-color-scheme
js/config.js        DATA_SOURCE switch, proxy URL, page size
js/api.js           data layer: mock or proxy, aggregation helper
js/mock.js          deterministic fixtures shaped like the real response
js/app.js           form wiring and rendering
```

No build step, no dependencies. Plain `<script>` tags on a `window.CDC`
namespace, so `index.html` also works when opened directly from disk.

## Running locally

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Upstream API notes

Verified against the live API on 2026-09-26. Base URL:

```
https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/
```

The dataset held 18,023,390 complaints and is written daily. Responses are
Elasticsearch-shaped JSON that include aggregations for `product`, `state`,
`company`, `issue`, `timely`, `submitted_via`, `tags`, `company_response`, and
`company_public_response` — the charts are free from any single response.

**Parameters.** `search_term` with `field` (`complaint_what_happened`,
`company_public_response`, `all`); `size` (max 100); `sort`; `no_aggs`;
`no_highlight`; `format=csv` for export. Filters: `company`, `product`, `state`,
`zip_code`, `issue`, `tags`, `timely`, `has_narrative`, `consumer_disputed`,
`date_received_min` / `date_received_max`, `company_received_min` / `_max`.

Three things that will bite:

1. **Filter values must match exactly.** `company=Equifax` returns 0 hits;
   `company=EQUIFAX, INC.` returns 4,781,010. Drive pickers from the aggregation
   buckets, never from free-text input. The mock reproduces this on purpose.
2. **`frm` is ignored on its own** past page one. Deep pagination needs
   `search_after`, built by joining the two values in `_meta.break_points[page]`
   with `_` and echoing it back.
3. **`_suggest_company` and `_suggest_zip` are effectively dead** — they return
   the CFPB HTML page for every parameter tried, including the documented
   `text=`. Do not build on them.

For bulk analysis, skip the API entirely: `https://files.consumerfinance.gov/ccdb/complaints.csv.zip`
is a 348 MB CSV of the same data, refreshed daily.

## Going live

1. Stand up a proxy that forwards to the upstream and returns
   `Access-Control-Allow-Origin: *`. A Worker is roughly twenty lines.
2. In `js/config.js`, set `DATA_SOURCE: "proxy"` and `PROXY_URL` to its URL.
3. Have it also serve `/facets` (see `CDC.api.facets` for the shape) so filter
   dropdowns stay populated, and cache responses at the edge — the upstream is
   slow, typically 1–3s, and has no published rate limit.

Nothing above `js/api.js` needs to change.

## Data license

CFPB complaint data is [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
