import os
import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# load from the backend folder regardless of where uvicorn was launched
load_dotenv(Path(__file__).parent / ".env")

NEWSAPI_KEY = os.getenv("NEWSAPI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

DB_PATH = Path(__file__).parent / "news.db"

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@contextmanager
def get_db():
    # sqlite3's `with conn` only manages transactions, never closes — this does
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


with get_db() as conn:
    conn.execute(
        """CREATE TABLE IF NOT EXISTS summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            source TEXT,
            summary TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )"""
    )


@app.get("/api/news")
async def news(q: str):
    if not q.strip():
        raise HTTPException(400, "Query required")
    if not NEWSAPI_KEY:
        raise HTTPException(500, "NEWSAPI_API_KEY not set in backend/.env")

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(
            "https://newsapi.org/v2/everything",
            params={"q": q, "language": "en", "sortBy": "publishedAt", "pageSize": 10},
            headers={"X-Api-Key": NEWSAPI_KEY},
        )
    try:
        data = res.json()
    except ValueError:
        raise HTTPException(502, "NewsAPI returned an invalid response")
    if data.get("status") != "ok":
        raise HTTPException(502, data.get("message", "NewsAPI error"))

    articles = [
        {
            "title": a.get("title"),
            "description": a.get("description"),
            "url": a.get("url"),
            "source": (a.get("source") or {}).get("name"),
            "publishedAt": a.get("publishedAt"),
        }
        for a in data.get("articles", [])
        if a.get("title")
    ]
    return {"articles": articles}


class SummarizeRequest(BaseModel):
    url: str
    title: str | None = None
    source: str | None = None
    description: str | None = None


async def fetch_page(url: str) -> tuple[str, str]:
    """Return (text, title) from a URL; empty strings on failure."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            res = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            res.raise_for_status()
    except Exception:
        return "", ""
    html = res.text
    m = re.search(r"<title[^>]*>([\s\S]*?)</title>", html, flags=re.I)
    title = re.sub(r"\s+", " ", m.group(1)).strip() if m else ""
    text = re.sub(r"<(script|style)[^>]*>[\s\S]*?</\1>", " ", html, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-z#0-9]+;", " ", text, flags=re.I)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:12000], title[:200]


@app.post("/api/summarize")
async def summarize(req: SummarizeRequest):
    if not GROQ_API_KEY:
        raise HTTPException(500, "GROQ_API_KEY not set in backend/.env")

    text, page_title = await fetch_page(req.url)
    text = text or req.description or ""
    if not text:
        raise HTTPException(502, "Could not extract article text")

    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": GROQ_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a news summarizer. Summarize the text the user provides as exactly 5 bullet points, each line starting with '• '. Output only the bullet points, no preamble or questions.",
                    },
                    {"role": "user", "content": text},
                ],
                "temperature": 0.3,
            },
        )
    if res.status_code != 200:
        raise HTTPException(502, f"Groq error: {res.text[:200]}")

    summary = res.json()["choices"][0]["message"]["content"]
    title = req.title or page_title or req.url

    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO summaries (title, url, source, summary) VALUES (?, ?, ?, ?)",
            (title, req.url, req.source, summary),
        )
    return {"summary": summary, "title": title, "id": cur.lastrowid}


@app.get("/api/summaries")
def list_summaries():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM summaries ORDER BY id DESC LIMIT 20"
        ).fetchall()
    return {"summaries": [dict(r) for r in rows]}


@app.delete("/api/summaries/{summary_id}")
def delete_summary(summary_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM summaries WHERE id = ?", (summary_id,))
    return {"ok": True}
