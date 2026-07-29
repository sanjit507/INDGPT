# 🇮🇳 INDGPT — Intelligent Conversational AI Web Platform

**INDGPT** is a full-stack conversational AI platform built with **FastAPI**, **LangGraph**, **Google Gemini AI**, and SQLite persistence. It features user authentication (JWT), session memory, guest & authenticated chat modes, real-time response streaming, and interactive chat history management.

---

## 🌟 Key Features

- 🔐 **User Authentication**: Secure Signup, Login, and JWT Token Authentication powered by `passlib[bcrypt]` & `python-jose`.
- 💬 **Dual Chat Modes**:
  - **Authenticated Users**: Persistent thread checkpoints stored safely in SQLite database (`auth_chatbot`).
  - **Guest Users**: In-memory ephemeral chat sessions (`guest_chatbot`).
- ⚡ **FastAPI High-Performance Backend**: Async REST API endpoints for user auth, conversation management, and AI streaming.
- 🎨 **Modern Responsive UI**: Custom frontend interface with dark mode styling, markdown rendering, and live typewriter response effect.
- 🛡️ **Security Built-In**: Pre-configured `.gitignore` protecting `.env` API keys and sensitive credentials.
- ☁️ **Render Cloud Deployment Ready**: Includes `render.yaml` Blueprint and `Procfile` for 1-click Render hosting.

---

## 📁 Repository Structure

```text
indgpt/
├── frontend/                 # Web UI (HTML, CSS, JS)
│   ├── chat.html             # Main chatbot interface
│   ├── index.html            # Landing / Login page
│   └── static/               # Stylesheets and Javascript assets
├── routes/                   # FastAPI REST API Routers
│   ├── auth_routes.py        # Signup and login endpoints
│   └── chat_routes.py        # Chat interaction & thread management
├── auth.py                   # Password hashing & JWT helpers
├── chat_engine.py            # LangGraph state graph & Gemini LLM engine
├── database.py               # SQLite database setup & connection pool
├── main.py                   # FastAPI app initialization & static mounts
├── models.py                 # Pydantic data schemas
├── requirements.txt          # Python package dependencies
├── render.yaml               # Render Blueprint deployment definition
├── Procfile                  # Startup process command for Render
├── .env.example              # Environment variables template
├── .gitignore                # Excludes secrets (.env) and local database files from Git
└── README.md                 # Project documentation
```

---

## 🛠️ Tech Stack

- **Backend:** FastAPI, Uvicorn
- **AI / Agent Framework:** LangGraph, LangChain Core, Google Gemini API (`ChatGoogleGenerativeAI`)
- **Database & Persistence:** SQLite (`SqliteSaver` & `MemorySaver`)
- **Authentication:** Passlib (Bcrypt), Python-Jose (JWT)
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (Fetch API)
- **Hosting:** Render (render.com)

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Python **3.10** or higher
- A **Google Gemini API Key** (Get one free at [Google AI Studio](https://aistudio.google.com/))

### 2. Set Up Virtual Environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Open `.env` and fill in your keys:

```env
GOOGLE_API_KEY=your_actual_gemini_api_key_here
JWT_SECRET=your_random_secret_jwt_key
```

> ⚠️ **SECURITY WARNING**: Never commit your `.env` file to GitHub! `.gitignore` is configured to keep your API keys and secrets safe.

### 5. Run the Application

Start the FastAPI development server:

```bash
uvicorn main:app --reload --port 8000
```

Open `http://localhost:8000` in your browser to access **INDGPT**.

---

## 🌐 Deploying to Render (Render.com)

### Option 1: Automatic Blueprint Deployment (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com/) and select **New +** -> **Blueprint**.
2. Connect your GitHub repository (`sanjit507/INDGPT`).
3. Render will auto-detect `render.yaml`.
4. Enter your `GOOGLE_API_KEY` under Environment Variables.
5. Click **Apply**. Render will deploy your live FastAPI + Frontend web application!

### Option 2: Manual Web Service Setup

1. On [Render Dashboard](https://dashboard.render.com/), click **New +** -> **Web Service**.
2. Connect repository `sanjit507/INDGPT`.
3. Set configuration:
   - **Name**: `indgpt`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Under **Advanced** -> **Environment Variables**:
   - `GOOGLE_API_KEY`: *your API key*
   - `JWT_SECRET`: *a secure random string*
5. Click **Create Web Service**.

---

## 📜 License

This project is licensed under the MIT License.
