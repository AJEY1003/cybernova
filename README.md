# Transaction Echo Tracking System

A production-ready AI-powered fintech web application that detects real-time fraud money movement across multiple bank accounts using transaction echo analysis.

## Features
- **Real-Time Transaction Stream Simulator:** Generates realistic banking data including normal transactions and multi-hop fraud laundering chains.
- **Echo Tracking Engine:** Detects echo transactions (amounts matching within ±2%) occurring within 120 seconds, building transaction chains dynamically.
- **Live Fraud Graph Visualization:** Interactive network dashboard using React Flow to visualize money propagation and highlight high-risk nodes.
- **AI-Based Risk Intelligence:** Calculates confidence scores based on chain depth and transaction velocity.
- **Dark Futuristic UI:** Built with Tailwind CSS and Framer Motion for a premium, cybersecurity enterprise feel.

## Architecture
- **Backend:** Node.js, Express, Socket.io, TypeScript
- **Frontend:** React, Vite, Tailwind CSS, Framer Motion, React Flow

## Setup Instructions

Since Node.js is required to run this application, please ensure you have [Node.js](https://nodejs.org/) (v18+) installed on your machine.

### 1. Start the Backend Server

Open a terminal and navigate to the `backend` directory:
```bash
cd backend
npm install
npm run dev
```
The backend server will start on `http://localhost:4000` and will begin listening for WebSocket connections.

### 2. Start the Frontend Application

Open a new terminal and navigate to the `frontend` directory:
```bash
cd frontend
npm install
npm run dev
```
The frontend will start on `http://localhost:3000`. Open this URL in your browser.

## Usage Guide
1. Once the frontend is loaded, you will see the system is "System Online".
2. Click the **Start Simulation** button in the top right corner.
3. Watch the **Live Transaction Stream** fill with normal transactions (cyan).
4. Intermittently, the simulator will inject a **Fraud Chain** (red). The Echo Tracking engine will instantly detect the correlation (±2% amount variance within a short time window across multiple accounts).
5. The **Graph Explorer** will map out the multi-hop network in real-time, highlighting the fraudulent chains and providing a visual topology of the laundering operation.
6. The metrics dashboard will update with Active Chains, High Risk Alerts, and Flagged Accounts.

## Explanation of Echo Detection Logic
The core `EchoTracker` processes every incoming transaction and compares it against a 120-second rolling window. If it finds a transaction where `Account A -> Account B` is followed by `Account B -> Account C` with a matching amount (±2% variance), it links them into an `EchoChain`. As the chain grows in depth, the risk intelligence score increases, eventually triggering a high-risk multi-account freeze recommendation alert.
