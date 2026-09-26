/* Deterministic fixture data shaped like the real CFPB search response.
   Used only while CDC.config.DATA_SOURCE === "mock". */
(function (CDC) {
  "use strict";

  var COMPANIES = [
    "EQUIFAX, INC.",
    "TRANSUNION INTERMEDIATE HOLDINGS, INC.",
    "Experian Information Solutions Inc.",
    "BANK OF AMERICA, NATIONAL ASSOCIATION",
    "JPMORGAN CHASE & CO.",
    "WELLS FARGO BANK, NATIONAL ASSOCIATION",
    "CITIZENS BANK, N.A.",
    "NAVY FEDERAL CREDIT UNION"
  ];

  var PRODUCTS = [
    { name: "Credit reporting or other personal consumer reports", weight: 34 },
    { name: "Credit reporting, credit repair services, or other personal consumer reports", weight: 8 },
    { name: "Debt collection", weight: 22 },
    { name: "Mortgage", weight: 12 },
    { name: "Checking or savings account", weight: 10 },
    { name: "Credit card", weight: 8 },
    { name: "Money transfer, virtual currency, or money service", weight: 6 }
  ];

  var ISSUES = {
    "Credit reporting or other personal consumer reports": [
      "Information inaccurate or not reported to company",
      "Credit monitoring",
      "Identity theft / Fraud / Embezzlement"
    ],
    "Credit reporting, credit repair services, or other personal consumer reports": [
      "Credit repair services",
      "Information inaccurate or not reported to company"
    ],
    "Debt collection": [
      "Debt collector not contacting me",
      "False or misleading representation",
      "FDCPA violations"
    ],
    "Mortgage": [
      "Application, originator, mortgage broker",
      "Loan modification, foreclosure, payoff",
      "Escrow account"
    ],
    "Checking or savings account": [
      "Account issue not in records",
      "Deposit related",
      "Bank account, personal checkbook or statement issue"
    ],
    "Credit card": [
      "Billing disputes",
      "Credit card debt",
      "Fees"
    ],
    "Money transfer, virtual currency, or money service": [
      "Money transfer issues",
      "Problem with virtual currency"
    ]
  };

  var STATES = [
    "TX", "FL", "CA", "GA", "NY", "IL", "PA", "OH", "NC", "MI",
    "NJ", "VA", "WA", "AZ", "MA", "TN", "IN", "MO", "MD", "WI"
  ];

  var TIMELY = ["Yes", "No", "Not applicable"];
  var SUBMITTED_VIA = ["Web", "Phone", "Letter", "Fax"];
  var RESPONSES = ["Disputed", "Closed without relief", "Closed with relief", "Untimely response"];

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rand, arr) {
    return arr[Math.floor(rand() * arr.length)];
  }

  function weightedProduct(rand) {
    var total = PRODUCTS.reduce(function (sum, p) {
      return sum + p.weight;
    }, 0);
    var roll = rand() * total;
    for (var i = 0; i < PRODUCTS.length; i++) {
      roll -= PRODUCTS[i].weight;
      if (roll <= 0) return PRODUCTS[i].name;
    }
    return PRODUCTS[0].name;
  }

  var NOW = Date.UTC(2026, 8, 26);
  var THREE_YEARS = 1000 * 60 * 60 * 24 * 1095;

  function buildCorpus() {
    var rand = mulberry32(20260926);
    var rows = [];
    for (var i = 0; i < 750; i++) {
      var product = weightedProduct(rand);
      rows.push({
        complaint_id: String(9000000 + i),
        date_received: new Date(NOW - Math.floor(rand() * THREE_YEARS)).toISOString(),
        company: pick(rand, COMPANIES),
        product: product,
        sub_product: null,
        issue: pick(rand, ISSUES[product]),
        sub_issue: null,
        state: pick(rand, STATES),
        zip_code: String(10000 + Math.floor(rand() * 89999)),
        submitted_via: pick(rand, SUBMITTED_VIA),
        timely: pick(rand, TIMELY),
        company_response: pick(rand, RESPONSES),
        company_public_response: null,
        tags: rand() < 0.08 ? "Servicemember" : null
      });
    }
    return rows;
  }

  var CORPUS = buildCorpus();

  function toBuckets(rows, field, limit) {
    var counts = Object.create(null);
    rows.forEach(function (row) {
      var key = row[field];
      if (key === null || key === undefined) return;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.keys(counts)
      .map(function (key) {
        return { key: key, doc_count: counts[key] };
      })
      .sort(function (a, b) {
        return b.doc_count - a.doc_count;
      })
      .slice(0, limit);
  }

  function nest(field, buckets) {
    var out = { doc_count: 0 };
    out[field] = {
      doc_count: buckets.reduce(function (s, b) {
        return s + b.doc_count;
      }, 0),
      buckets: buckets
    };
    return out;
  }

  function inRange(iso, min, max) {
    var t = Date.parse(iso);
    if (min && t < Date.parse(min)) return false;
    if (max && t > Date.parse(max) + 86399999) return false;
    return true;
  }

  CDC.mock = {
    companies: COMPANIES.slice(),

    /* Mirrors the real endpoint: exact-match filters, ES-shaped response. */
    search: function (params) {
      params = params || {};

      var rows = CORPUS.filter(function (row) {
        if (params.company && row.company !== params.company) return false;
        if (params.product && row.product !== params.product) return false;
        if (params.state && row.state !== params.state) return false;
        if (!inRange(row.date_received, params.date_received_min, params.date_received_max)) {
          return false;
        }
        if (params.search_term) {
          var haystack = [row.issue, row.product, row.company, row.state]
            .join(" ")
            .toLowerCase();
          if (haystack.indexOf(params.search_term.toLowerCase()) === -1) return false;
        }
        return true;
      });

      var size = Math.min(Number(params.size) || 25, CDC.config.MAX_SIZE);
      var frm = Number(params.frm) || 0;
      var page = rows.slice(frm, frm + size);

      return Promise.resolve({
        took: 12,
        timed_out: false,
        _meta: {
          license: "CC0",
          last_updated: "2026-09-26T12:00:00-05:00",
          last_indexed: "2026-09-26T12:00:00-05:00",
          total_record_count: 18023390,
          is_data_stale: false,
          has_data_issue: false,
          break_points: {}
        },
        hits: {
          total: { value: rows.length, relation: "eq" },
          max_score: null,
          hits: page.map(function (row) {
            return {
              _index: "complaint-public-v2",
              _id: row.complaint_id,
              _score: null,
              _source: row
            };
          })
        },
        aggregations: {
          company: nest("company", toBuckets(rows, "company", 10)),
          product: nest("product", toBuckets(rows, "product", 10)),
          state: nest("state", toBuckets(rows, "state", 10)),
          issue: nest("issue", toBuckets(rows, "issue", 10)),
          timely: nest("timely", toBuckets(rows, "timely", 10)),
          submitted_via: nest("submitted_via", toBuckets(rows, "submitted_via", 10)),
          company_response: nest("company_response", toBuckets(rows, "company_response", 10)),
          company_public_response: nest("company_public_response", []),
          tags: nest("tags", toBuckets(rows, "tags", 10))
        }
      });
    },

    /* Facet values for the filter dropdowns, in the real API's exact format. */
    facets: function () {
      return Promise.resolve({
        product: toBuckets(CORPUS, "product", 20).map(function (b) {
          return b.key;
        }),
        state: toBuckets(CORPUS, "state", 60).map(function (b) {
          return b.key;
        }),
        company: COMPANIES.slice()
      });
    }
  };
})(window.CDC);
