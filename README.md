# News Summarizer

Turn lengthy news articles into clear, 5-bullet AI summaries. Search a topic or paste any article link and get the key takeaways in seconds — with a local history of everything you've summarized.

Built with **Next.js 16** (frontend), **FastAPI** (backend), **NewsAPI** (news search), **Groq** (LLM inference), and **SQLite** (history).

## Features

- 🔍 **Topic search** — "artificial intelligence" → latest articles via NewsAPI
- 🔗 **Paste a link** — summarize any article URL directly (fetches and extracts the page text)
- ✨ **AI summaries** — exactly 5 bullet points via Groq's API
- 📚 **Local history** — saved summaries stored in SQLite, viewable and deletable in the UI
- 📋 **Copy button** — one click to copy the summary

## Architecture

```
Browser ──> Next.js app (localhost:3000)
                 │
                 ▼
          FastAPI backend (localhost:8001)
           ├── NewsAPI   (GET /api/news)
           ├── Groq API  (POST /api/summarize)
           └── SQLite    (backend/news.db)
```

## Prerequisites

- **Node.js 20+**
- **Python 3.11+**
- A free **NewsAPI** key → <https://newsapi.org/register>
- A free **Groq** key → <https://console.groq.com/keys>

## Getting Started

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env             # Windows: copy .env.example .env
# then edit .env and paste your real API keys

uvicorn main:app --port 8001
```

The API is now running at <http://localhost:8001>.

### 2. Frontend

In a second terminal, from the project root:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Configuration

`backend/.env`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEWSAPI_API_KEY` | ✅ | — | Key for <https://newsapi.org> (search) |
| `GROQ_API_KEY` | ✅ | — | Key for <https://console.groq.com/keys> (summarization) |
| `GROQ_MODEL` | ❌ | `openai/gpt-oss-120b` | Groq model to use |

The backend reads keys **server-side only** — they are never sent to the browser.

## API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/news?q=...` | Search NewsAPI, returns up to 10 articles |
| `POST` | `/api/summarize` | `{url, title?, source?}` → fetch page, return 5-bullet summary, save to history |
| `GET` | `/api/summaries` | Last 20 saved summaries |
| `DELETE` | `/api/summaries/{id}` | Delete one saved summary |

## Key hygiene & security

- **Never commit your `.env`.** It's gitignored — verify before every push:
  ```bash
  git check-ignore backend/.env   # should print the path
  ```
  Only `backend/.env.example` (placeholders) belongs in the repo.
- **If a real key ever lands in git, treat it as burned:** revoke it immediately at [console.groq.com/keys](https://console.groq.com/keys) or your NewsAPI account, generate a new one, and update your local `.env`. Rotating beats trying to scrub history.
- **Keys stay server-side.** All external calls are made by the FastAPI backend; the frontend only talks to `localhost:8001`.
- **CORS is locked to `http://localhost:3000`.** If you deploy the backend, update `allow_origins` in `backend/main.py` — don't use `["*"]` with real keys.
- `backend/news.db` is local data and gitignored; it's recreated automatically.

## Project Structure

```
app/                 Next.js frontend (single page UI)
backend/
  main.py            FastAPI app — news search, summarize, history
  requirements.txt   Python dependencies
  .env.example       Config template (copy to .env)
  news.db            SQLite database (gitignored, auto-created)
```

## Notes

- No license is attached yet — this is a public reference repo, all rights reserved.
- Contributions via PRs are welcome.
