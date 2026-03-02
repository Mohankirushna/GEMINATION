<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SurakshaFlow - Unified Cyber-Financial Intelligence Platform

A real-time intelligence platform that fuses Security Operations Center (SOC) signals with Anti-Money Laundering (AML) monitoring to detect and disrupt money mule networks and financial scams.

## Features

- **Unified Risk Monitoring**: Real-time fusion of cyber and financial signals
- **AI-Powered Alert Analysis**: Gemini AI provides intelligent explanations and recommendations
- **Network Graph Visualization**: Interactive D3.js visualization of transaction networks
- **Financial Institution Dashboard**: Comprehensive monitoring and alert management
- **User Security Dashboard**: Personal risk monitoring and transaction history
- **Digital Twin Simulation**: "What-if" freeze scenarios to find optimal intervention points
- **STR Report Generation**: Auto-generate Suspicious Transaction Reports
- **SMS Scam Detection**: Gemini AI-powered SMS scam detection for end users
- **Structured Logging**: Request-level logging with timing for all API calls

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite (port 3000)
- **Backend**: Python FastAPI, Uvicorn (port 8000)
- **Styling**: Tailwind CSS 4, Lucide Icons, Motion
- **Visualization**: D3.js, Recharts
- **Database**: Firebase (Auth, Firestore, Storage)
- **AI**: Google Gemini API

## Architecture

```
┌─────────────────┐       /api proxy        ┌──────────────────┐
│  React Frontend │ ──────────────────────── │  FastAPI Backend  │
│  localhost:3000  │                          │  localhost:8000   │
└─────────────────┘                          └──────────────────┘
        │                                            │
        │                                   ┌────────┴────────┐
        │                                   │  Risk Engines   │
        ▼                                   │  • Cyber        │
   Firebase Auth                            │  • Financial    │
   Firebase Firestore                       │  • Graph (NX)   │
   Gemini AI (client)                       │  • Unified      │
                                            └─────────────────┘
```

## Run Locally

### Prerequisites

- Node.js (v18+)
- Python (3.10+)
- pip

### 1. Backend Setup

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Firebase and Gemini API credentials

# Start the backend server (port 8000)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be available at `http://localhost:8000`. Health check: `http://localhost:8000/api/health`

### 2. Frontend Setup

```bash
# From the project root directory
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Firebase and Gemini API keys

# Start the frontend dev server (port 3000)
npm run dev
```

The app will be available at `http://localhost:3000`

### 3. Access the Application

| Page           | URL                                       | Description                             |
| -------------- | ----------------------------------------- | --------------------------------------- |
| Landing Page   | `http://localhost:3000/`                  | Home page with role selection           |
| Bank Dashboard | `http://localhost:3000/bank`              | Financial institution intelligence hub  |
| Live Alerts    | `http://localhost:3000/bank/alerts`       | Real-time alert feed                    |
| Network Graph  | `http://localhost:3000/bank/graph`        | D3.js transaction network visualization |
| User Dashboard | `http://localhost:3000/user`              | Personal risk monitoring                |
| Transactions   | `http://localhost:3000/user/transactions` | User transaction history                |

## API Endpoints

| Method | Endpoint                                | Description                            |
| ------ | --------------------------------------- | -------------------------------------- |
| GET    | `/api/health`                           | Health check                           |
| GET    | `/api/dashboard/bank/summary`           | Bank dashboard summary stats           |
| GET    | `/api/dashboard/bank/alerts`            | List alerts (filterable)               |
| GET    | `/api/dashboard/bank/alert/{id}`        | Single alert detail                    |
| POST   | `/api/dashboard/bank/alert/{id}/action` | Act on alert (freeze/monitor/escalate) |
| GET    | `/api/dashboard/user/{uid}/risk`        | User risk score breakdown              |
| GET    | `/api/dashboard/user/{uid}/events`      | User cyber + financial events          |
| GET    | `/api/graph/network`                    | Full transaction graph                 |
| GET    | `/api/graph/cluster/{id}`               | Subgraph around account                |
| POST   | `/api/gemini/explain`                   | AI explanation for alert               |
| POST   | `/api/gemini/analyze-sms`               | SMS scam detection                     |
| POST   | `/api/str/generate/{id}`                | Generate STR report PDF                |
| GET    | `/api/str/download/{id}`                | Download STR report                    |
| POST   | `/api/simulation/digital-twin`          | Run digital twin simulation            |
| POST   | `/api/demo/seed`                        | Re-seed demo data                      |
| POST   | `/api/demo/run-scenario`                | Load attack chain scenario             |

## Project Structure

```
suraksha-flow/
├── src/                     # React frontend
│   ├── components/          # Reusable UI components
│   ├── pages/               # Application pages (Landing, Dashboards)
│   ├── services/            # API client, Firebase, Gemini
│   ├── contexts/            # React contexts (Auth)
│   ├── lib/                 # Utility functions
│   ├── types.ts             # TypeScript type definitions
│   └── App.tsx              # Main application with routing
├── backend/                 # Python FastAPI backend
│   ├── app/
│   │   ├── main.py          # FastAPI app + all endpoints
│   │   ├── config.py        # Environment config + Firebase init
│   │   ├── models/          # Pydantic schemas
│   │   ├── data_generator/  # Demo scenario data
│   │   ├── risk_engine/     # Cyber, Financial, Graph, Unified scoring
│   │   └── services/        # Gemini AI, Digital Twin, STR generator
│   ├── requirements.txt
│   └── .env
├── vite.config.ts           # Vite config (proxy /api → :8000)
├── package.json
└── README.md
```

## Environment Variables

### Frontend (`.env.local`)

| Variable                            | Required | Description                         |
| ----------------------------------- | -------- | ----------------------------------- |
| `VITE_FIREBASE_API_KEY`             | Yes      | Firebase API key                    |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Yes      | Firebase auth domain                |
| `VITE_FIREBASE_PROJECT_ID`          | Yes      | Firebase project ID                 |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Yes      | Firebase storage bucket             |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes      | Firebase sender ID                  |
| `VITE_FIREBASE_APP_ID`              | Yes      | Firebase app ID                     |
| `VITE_GEMINI_API_KEY`               | Optional | Gemini API key (for client-side AI) |

### Backend (`backend/.env`)

| Variable                        | Required | Description                           |
| ------------------------------- | -------- | ------------------------------------- |
| `PORT`                          | No       | Server port (default: 8000)           |
| `HOST`                          | No       | Server host (default: 0.0.0.0)        |
| `GEMINI_API_KEY`                | Optional | Gemini API key for AI features        |
| `FIREBASE_PROJECT_ID`           | Optional | Firebase project ID                   |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Optional | Path to service account JSON          |
| `ENABLE_GEMINI`                 | No       | Enable Gemini AI (default: true)      |
| `ENABLE_DIGITAL_TWIN`           | No       | Enable simulations (default: true)    |
| `ENABLE_GRAPH_ANALYTICS`        | No       | Enable graph features (default: true) |

## Available Scripts

- `npm run dev` — Start frontend dev server on port 3000
- `npm run build` — Build frontend for production
- `npm run preview` — Preview production build
- `npm run lint` — TypeScript type checking

## License

MIT
