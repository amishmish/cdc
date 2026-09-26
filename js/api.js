/* Data layer. Swaps between local fixtures and a CORS proxy via
   CDC.config.DATA_SOURCE, so nothing above this file needs to change. */
(function (CDC) {
  "use strict";

  var TIMEOUT_MS = 20000;

  function buildQuery(params) {
    var skip = { frm: 1, _: 1 };
    var qs = Object.keys(params || {})
      .filter(function (key) {
        var v = params[key];
        return !skip[key] && v !== "" && v !== null && v !== undefined;
      })
      .map(function (key) {
        return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
      })
      .join("&");
    return qs ? "?" + qs : "";
  }

  function getJSON(url) {
    var controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, TIMEOUT_MS);

    var opts = { headers: { Accept: "application/json" } };
    if (controller) opts.signal = controller.signal;

    return fetch(url, opts)
      .then(function (res) {
        if (!res.ok) {
          throw new Error("Upstream returned HTTP " + res.status);
        }
        return res.json();
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  /* Pull a bucket list out of an Elasticsearch single-level aggregation.
     Tolerates missing keys and differing nesting between endpoints. */
  function buckets(aggregations, name) {
    var agg = (aggregations || {})[name];
    if (!agg) return [];
    var inner = agg[name] || agg;
    if (Array.isArray(inner.buckets)) return inner.buckets;
    if (Array.isArray(agg.buckets)) return agg.buckets;
    return [];
  }

  CDC.api = {
    isMock: function () {
      return CDC.config.DATA_SOURCE === "mock";
    },

    search: function (params) {
      if (CDC.api.isMock()) return CDC.mock.search(params);
      return getJSON(CDC.config.PROXY_URL + buildQuery(params));
    },

    facets: function () {
      if (CDC.api.isMock()) return CDC.mock.facets();
      return getJSON(CDC.config.PROXY_URL + "/facets");
    },

    buckets: buckets
  };
})(window.CDC);
