# 🛡️ AI-Driven Cybersecurity Threat Detection Dashboard

> A production-grade, microservices-based platform for real-time network intrusion detection, ML-powered threat classification, and LLM-assisted incident reporting.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🏗️ Architecture

```
[Log Simulator] → Redis (logs:raw) → [ML Service: FastAPI]
                                           ↓
                                  Isolation Forest (anomaly)
                                  Random Forest (classify)
                                           ↓
                              Redis (logs:scored) → [Node.js API]
                                                         ↓
                                                    MongoDB (persist)
                                                    Socket.io (emit)
                                                         ↓
                                                  [React Dashboard]
                                                  D3.js | Recharts
                                                  Live Alerts | PDF
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Recharts, D3.js, Zustand, React Query |
| Backend | Node.js 20, Express, Socket.io, Mongoose, JWT, bcrypt |
| ML Service | Python 3.11, FastAPI, scikit-learn, pandas, joblib |
| Message Queue | Redis 7 (Pub/Sub) |
| Database | MongoDB 7 |
| LLM | Groq API (llama-3.3-70b) |
| DevOps | Docker Compose, GitHub Actions |

## 🚀 Local Development Setup

### Prerequisites
- Docker Desktop
- Node.js 20+
- Python 3.11+

### 1. Start Infrastructure
```bash
docker-compose up -d
```

### 2. Start ML Service
```bash
cd ml-service
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env   # fill in values
uvicorn main:app --reload --port 8000
```

### 3. Start Log Simulator (separate terminal)
```bash
cd ml-service
.venv\Scripts\activate
python simulator/log_generator.py --rate 10 --attack-rate 0.15
```

### 4. Start Backend API
```bash
cd server
npm install
cp .env.example .env   # fill in values
npm run dev
```

### 5. Start Frontend
```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173

## 📊 ML Model Performance

> *To be filled after Phase 2 training*

| Model | Metric | Score |
|-------|--------|-------|
| Isolation Forest | F1 (anomaly) | TBD |
| Random Forest | F1-macro | TBD |
| Random Forest — DoS | Precision / Recall | TBD |
| Random Forest — Probe | Precision / Recall | TBD |
| Random Forest — R2L | Precision / Recall | TBD |
| Random Forest — U2R | Precision / Recall | TBD |

## 🗂️ Project Status

| Phase | Status |
|-------|--------|
| Phase 1: Foundation | 🔄 In Progress |
| Phase 2: ML Service | ⏳ Pending |
| Phase 3: Backend API | ⏳ Pending |
| Phase 4: React Frontend | ⏳ Pending |
| Phase 5: LLM Integration | ⏳ Pending |
| Phase 6: Deployment | ⏳ Pending |
