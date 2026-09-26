/* UI wiring for the Consumer Complaint Explorer. */
(function (CDC) {
  "use strict";

  var $ = function (id) {
    return document.getElementById(id);
  };

  var els = {
    form: $("filters"),
    searchTerm: $("search_term"),
    company: $("company"),
    companyOptions: $("company-options"),
    product: $("product"),
    state: $("state"),
    dateMin: $("date_received_min"),
    dateMax: $("date_received_max"),
    reset: $("reset"),
    status: $("status"),
    summary: $("summary"),
    charts: $("charts"),
    resultsSection: $("results-section"),
    resultsBody: document.querySelector("#results tbody"),
    resultsNote: $("results-note"),
    sourceBadge: $("source-badge")
  };

  function fmt(n) {
    return typeof n === "number" ? n.toLocaleString("en-US") : "—";
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function fmtUpdated(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function setStatus(msg, isError) {
    els.status.textContent = msg || "";
    els.status.classList.toggle("error", Boolean(isError));
  }

  function params() {
    return {
      search_term: els.searchTerm.value.trim(),
      company: els.company.value.trim(),
      product: els.product.value,
      state: els.state.value,
      date_received_min: els.dateMin.value,
      date_received_max: els.dateMax.value,
      size: CDC.config.DEFAULT_SIZE
    };
  }

  function renderBars(target, buckets, limit) {
    var rows = buckets.slice(0, limit || 8);
    if (!rows.length) {
      target.innerHTML = '<p class="muted">No data</p>';
      return;
    }
    var max = rows.reduce(function (m, b) {
      return Math.max(m, b.doc_count || 0);
    }, 0) || 1;

    target.innerHTML = rows
      .map(function (b) {
        var pct = Math.max(((b.doc_count || 0) / max) * 100, 1);
        return (
          '<div class="bar-row">' +
          '<span class="bar-label" title="' +
          escapeHTML(String(b.key)) +
          '">' +
          escapeHTML(String(b.key)) +
          "</span>" +
          '<span class="bar-count">' +
          fmt(b.doc_count) +
          "</span>" +
          '<span class="bar-track"><span class="bar-fill" style="width:' +
          pct.toFixed(1) +
          '%"></span></span>' +
          "</div>"
        );
      })
      .join("");
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[c];
    });
  }

  function renderSummary(data) {
    var total = (data.hits && data.hits.total && data.hits.total.value) || 0;
    $("stat-total").textContent = fmt(total);
    $("stat-companies").textContent = fmt(
      CDC.api.buckets(data.aggregations, "company").length
    );
    $("stat-products").textContent = fmt(
      CDC.api.buckets(data.aggregations, "product").length
    );
    $("stat-updated").textContent = fmtUpdated(
      data._meta && data._meta.last_updated
    );
    els.summary.hidden = false;
  }

  function renderCharts(data) {
    renderBars($("chart-product"), CDC.api.buckets(data.aggregations, "product"), 8);
    renderBars($("chart-state"), CDC.api.buckets(data.aggregations, "state"), 8);
    renderBars($("chart-issue"), CDC.api.buckets(data.aggregations, "issue"), 8);
    renderBars($("chart-timely"), CDC.api.buckets(data.aggregations, "timely"), 8);
    els.charts.hidden = false;
  }

  function renderResults(data) {
    var rows = (data.hits && data.hits.hits) || [];
    var total = (data.hits && data.hits.total && data.hits.total.value) || 0;

    els.resultsNote.textContent = rows.length
      ? "showing " + rows.length + " of " + fmt(total)
      : "";

    els.resultsBody.innerHTML = rows
      .map(function (hit) {
        var s = hit._source || {};
        return (
          "<tr>" +
          "<td>" +
          escapeHTML(String(s.complaint_id || "")) +
          "</td>" +
          "<td>" +
          escapeHTML(fmtDate(s.date_received)) +
          "</td>" +
          '<td class="wrap-cell">' +
          escapeHTML(String(s.company || "")) +
          "</td>" +
          '<td class="wrap-cell">' +
          escapeHTML(String(s.product || "")) +
          "</td>" +
          '<td class="wrap-cell">' +
          escapeHTML(String(s.issue || "")) +
          "</td>" +
          "<td>" +
          escapeHTML(String(s.state || "")) +
          "</td>" +
          "<td>" +
          escapeHTML(String(s.timely || "—")) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    els.resultsSection.hidden = false;
  }

  function run() {
    var btn = els.form.querySelector("button.primary");
    btn.disabled = true;
    setStatus("Loading…");

    CDC.api
      .search(params())
      .then(function (data) {
        renderSummary(data);
        renderCharts(data);
        renderResults(data);
        var total = (data.hits && data.hits.total && data.hits.total.value) || 0;
        setStatus(
          total === 0
            ? "No complaints matched those filters."
            : "",
          false
        );
      })
      .catch(function (err) {
        setStatus("Request failed: " + err.message, true);
      })
      .finally(function () {
        btn.disabled = false;
      });
  }

  function fillSelect(select, values) {
    values.forEach(function (v) {
      var opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });
  }

  function loadFacets() {
    CDC.api
      .facets()
      .then(function (f) {
        fillSelect(els.product, f.product || []);
        fillSelect(els.state, f.state || []);
        (f.company || []).forEach(function (c) {
          var opt = document.createElement("option");
          opt.value = c;
          els.companyOptions.appendChild(opt);
        });
      })
      .catch(function () {
        setStatus("Could not load filter values.", true);
      });
  }

  function init() {
    if (CDC.api.isMock()) {
      els.sourceBadge.hidden = false;
      els.sourceBadge.textContent = "MOCK DATA — not live";
    }

    els.form.addEventListener("submit", function (e) {
      e.preventDefault();
      run();
    });

    els.reset.addEventListener("click", function () {
      els.form.reset();
      run();
    });

    loadFacets();
    run();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window.CDC);
