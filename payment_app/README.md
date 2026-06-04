# 💸 Payment App — Simulated UPI Interface

Simulates a real UPI payment application. Used to demonstrate the MuleShield honey trap flow — when a controller sends money to a honey trap account, MuleShield captures their device fingerprint and hardware details.

## Setup

```bash
cd payment_app
npm install
npm run dev
# Runs at http://localhost:3001
```

Requires the MuleShield backend running at `http://localhost:8000`.

## Features

- Login as different user personas (including a controller persona)
- Send UPI payments to real users or honey trap accounts
- **Simulate Controller Attack** — click a 🍯 honey trap button to auto-fill the receiver with an active honey trap UPI
- Device fingerprint (WebGL, canvas hash, JA3, screen, CPU, battery) is captured automatically and sent with every payment
- After sending to a honey trap, shows full controller intelligence: device FP, JA3, IP, ISP, WebGL renderer, screen resolution, CPU cores, battery level, emulator flags, signal breakdown

## Users (Login)

| Name | UPI | Role |
|------|-----|------|
| Ravi Kumar | 9800000001@paytm | Controller (demo) |
| Priya Sharma | 9123456002@paytm | Regular user |
| Suresh Patel | 9876543003@ybl | Regular user |
| Deepa Nair | 9012345004@okaxis | Regular user |
| Kiran Reddy | 9234567005@ibl | Regular user |

## Vite Proxy

All `/api/*` requests are proxied to `http://localhost:8000` — no CORS issues.
