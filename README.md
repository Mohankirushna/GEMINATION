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

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS 4, Lucide Icons, Motion
- **Visualization**: D3.js, Recharts
- **Backend Services**: Firebase (Auth, Firestore, Storage)
- **AI**: Google Gemini API

## Run Locally

**Prerequisites:** Node.js (v18+)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create environment file:
   ```bash
   cp .env.example .env.local
   ```

3. Configure environment variables in `.env.local`:
   - **Firebase Configuration** (required for backend services):
     - Get your Firebase config from [Firebase Console](https://console.firebase.google.com/)
     - Fill in all `VITE_FIREBASE_*` values
   - **Gemini API Key** (optional, for AI features):
     - Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
     - Add it to `VITE_GEMINI_API_KEY`

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open your browser to `http://localhost:3000`

## Project Structure

```
src/
├── components/      # Reusable UI components
├── pages/           # Application pages (Landing, Dashboards)
├── services/        # API integrations (Firebase, Gemini)
├── lib/             # Utility functions
├── types.ts         # TypeScript type definitions
└── App.tsx          # Main application with routing
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - TypeScript type checking

## Environment Variables

See `.env.example` for all required and optional environment variables.

## License

MIT
