"use client";

import { useEffect, useRef, useState } from "react";

const BACKEND = "http://localhost:8001";
const isUrl = (s) => /^https?:\/\/|^[a-z0-9-]+\.[a-z]{2,}/i.test(s.trim());
const EXAMPLES = ["artificial intelligence", "climate change", "space exploration"];

export default function Home() {
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(""); // "", "search", or the URL being summarized
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(false);
  const summaryRef = useRef(null);
  const articlesRef = useRef(null);

  useEffect(() => {
    loadHistory();
  }, []);

  // bring the result into view — it renders below the fold on most screens
  useEffect(() => {
    if (summary) summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [summary]);

  useEffect(() => {
    if (articles.length) articlesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [articles]);

  async function loadHistory() {
    try {
      const res = await fetch(`${BACKEND}/api/summaries`);
      const data = await res.json();
      setHistory(data.summaries || []);
    } catch {
      // backend offline — history stays empty
    }
  }

  async function runSearch(input) {
    setBusy("search");
    setStatus("Searching...");
    setSummary(null);
    setArticles([]);
    try {
      const res = await fetch(
        `${BACKEND}/api/news?q=${encodeURIComponent(input)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Search failed");
      setArticles(data.articles);
      setStatus(data.articles.length ? "" : "No articles found.");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setBusy("");
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    const input = query.trim();
    if (!input) return;
    // one input, two modes: paste a link → summarize it; type a topic → search
    if (isUrl(input)) {
      summarize(input, null, null);
      return;
    }
    runSearch(input);
  }

  function tryExample(q) {
    setQuery(q);
    runSearch(q);
  }

  async function summarize(url, title, source, description) {
    setBusy(url);
    setStatus(title ? `Summarizing "${title}"...` : "Summarizing...");
    setSummary(null);
    try {
      const res = await fetch(`${BACKEND}/api/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, title, source, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Summarize failed");
      setSummary({
        title: data.title || title || url,
        text: data.summary,
        url,
        source,
      });
      setStatus("");
      loadHistory();
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setBusy("");
    }
  }

  async function deleteSummary(id) {
    await fetch(`${BACKEND}/api/summaries/${id}`, { method: "DELETE" });
    loadHistory();
  }

  function clearAll() {
    setQuery("");
    setArticles([]);
    setSummary(null);
    setStatus("");
  }

  function copySummary() {
    navigator.clipboard.writeText(summary.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const summarizing = busy !== "" && busy !== "search";

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <span className="hero-badge">✦ AI-Powered News Summarizer</span>

          <h1 className="hero-title">
            <span className="line">Every Story,</span>
            <span className="line accent">Summarized in Seconds.</span>
          </h1>

          <p className="hero-desc">
            Turn lengthy news articles into clear, concise summaries with AI.
            Just paste a link or explore a topic to get the insights that matter.
          </p>

          <form className="hero-search" onSubmit={handleSearch}>
            <svg
              className="search-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              placeholder="Paste a news link or enter a topic..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              required
              autoFocus
            />
            {(query || summary || articles.length > 0) && (
              <button
                type="button"
                className="clear-x"
                onClick={clearAll}
                title="Clear"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              className="summarize-btn"
              disabled={busy !== ""}
            >
              {busy === "search" ? (
                <>
                  <span className="btn-spinner" />
                  Searching...
                </>
              ) : busy ? (
                "Summarizing..."
              ) : (
                "Summarize →"
              )}
            </button>
          </form>

          <p className="hero-sub">
            Get the key takeaways without reading the entire article.
          </p>

          {!articles.length && !summary && !busy && (
            <div className="examples">
              <span>Try:</span>
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  className="example-chip"
                  onClick={() => tryExample(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {status && (
            <div
              className={status.startsWith("Error") ? "status error" : "status"}
            >
              {busy && <span className="spinner" />} {status}
            </div>
          )}
        </div>
      </section>

      <main className="container">
        {summarizing && !summary && (
          <div className="summary skeleton-card" aria-hidden="true">
            <div className="skeleton-header" />
            <div className="skeleton-line w85" />
            <div className="skeleton-line w95" />
            <div className="skeleton-line w75" />
            <div className="skeleton-line w90" />
            <div className="skeleton-line w60" />
          </div>
        )}

        {summary && (
          <div className="summary" ref={summaryRef}>
            <div className="summary-header">
              <span className="summary-label">✨ AI Summary</span>
              <span className="date">{summary.source || ""}</span>
            </div>
            <h2>{summary.title}</h2>
            <ul className="summary-points">
              {summary.text
                .split("\n")
                .map((line) => line.replace(/^[•\-\*]\s*/, ""))
                .filter(Boolean)
                .map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
            </ul>
            <div className="summary-actions">
              <a href={summary.url} target="_blank" rel="noopener noreferrer">
                Read full article →
              </a>
              <button className="copy-btn" onClick={copySummary}>
                {copied ? "✓ Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        <ul className="articles" ref={articlesRef}>
          {articles.map((a) => (
            <li key={a.url} className="article">
              <div>
                <span className="badge">
                  {a.source}
                  {a.publishedAt && (
                    <span className="date">
                      {" "}
                      · {new Date(a.publishedAt).toLocaleDateString()}
                    </span>
                  )}
                </span>
                <h3>{a.title}</h3>
                {a.description && <p>{a.description}</p>}
              </div>
              <button
                onClick={() => summarize(a.url, a.title, a.source, a.description)}
                disabled={busy !== ""}
              >
                {busy === a.url ? "Summarizing..." : "Summarize"}
              </button>
            </li>
          ))}
        </ul>

        {history.length > 0 && (
          <section className="history">
            <h2>History</h2>
            <ul>
              {history.map((h) => (
                <li
                  key={h.id}
                  className="history-item"
                  onClick={() => {
                    setSummary({
                      title: h.title,
                      text: h.summary,
                      url: h.url,
                      source: h.source,
                    });
                    setStatus("");
                  }}
                >
                  <div>
                    <span className="badge">{h.source || "Link"}</span>
                    <h3>{h.title}</h3>
                    <span className="date">{h.created_at?.slice(0, 16)}</span>
                  </div>
                  <button
                    className="delete-btn"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSummary(h.id);
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
