/* Global config for the Consumer Complaint Explorer frontend. */
window.CDC = window.CDC || {};

CDC.config = {
  /* "mock" serves local fixture data. "proxy" calls PROXY_URL. */
  DATA_SOURCE: "mock",

  /* Cloudflare Worker (or any CORS proxy) in front of the CFPB API.
     Fill this in and set DATA_SOURCE to "proxy" to go live. */
  PROXY_URL: "https://cdc-proxy.YOUR_SUBDOMAIN.workers.dev",

  /* Upstream CFPB search endpoint, used only for documentation/reference. */
  UPSTREAM_URL:
    "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/",

  /* Caps enforced by the upstream API. */
  MAX_SIZE: 100,
  DEFAULT_SIZE: 25
};
