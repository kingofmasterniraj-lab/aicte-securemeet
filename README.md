# AICTE SecureMeet

A responsive, security-focused online meeting platform prototype for AICTE-style institutional meetings.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Realtime signaling: Socket.IO
- Meetings: WebRTC
- Authentication: JWT + bcrypt
- Validation/security: Helmet, CORS, rate limiting
- Database: MongoDB (optional for demo/local prototype)

## Features

- Responsive phone/tablet/laptop UI
- Demo mode with synthetic accounts
- JWT authentication
- Role-based dashboard
- Meeting creation and joining
- WebRTC camera/microphone
- Screen sharing
- In-meeting chat
- Participant list
- Host controls
- Secure API defaults
- Audit-friendly architecture

> Demo mode contains only synthetic data. Do not use real AICTE credentials or confidential data.

## Run locally

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

Default demo login:

- Email: `demo.admin@securemeet.local`
- Password: `DemoPass123!`

Other demo users:
- `demo.hod@securemeet.local`
- `demo.faculty@securemeet.local`
- `demo.institute@securemeet.local`

All use `DemoPass123!`.

## Environment

Backend `.env`:

```env
PORT=5000
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_URL=http://localhost:5173
MONGODB_URI=
```

If `MONGODB_URI` is empty, the application uses an in-memory demo store. This is useful for demonstrations but is not production persistence.

## Production notes

1. Use a strong randomly generated JWT secret.
2. Configure HTTPS.
3. Use a managed MongoDB instance.
4. Add TURN servers for reliable WebRTC across restrictive networks.
5. Put recordings in private object storage and issue short-lived signed URLs.
6. Add enterprise identity integration/SSO before real deployment.
7. Do not store real credentials in source code or `.env` committed to Git.
8. Perform an independent security assessment before handling confidential meetings.

## Suggested deployment

Frontend -> Vercel
Backend -> Render/Fly.io/another Node host
Database -> MongoDB Atlas
TURN -> coturn or managed TURN service

See `docs/architecture.md` and `docs/security.md`.
