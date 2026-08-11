# Architecture

```text
Browser
  |
 HTTPS
  v
React/Vite
  |
 REST + Socket.IO
  v
Express API
  |------ JWT/RBAC
  |------ Meeting API
  |------ Audit hooks
  |
  +---- MongoDB
  |
  +---- Socket.IO signaling
             |
             v
          WebRTC
        audio/video
```

## Components

### Frontend
Responsive React application. The same application serves phone and laptop users.

### Backend
Express API provides authentication and meeting metadata. Socket.IO provides signaling only; media is peer-to-peer through WebRTC.

### Database
MongoDB stores users and meeting metadata in production.

### Media
WebRTC carries camera/microphone streams. A TURN server should be configured for production reliability.

## Trust boundaries

- Browser -> API: HTTPS + JWT
- Browser -> signaling: authenticated Socket.IO connection
- Browser -> peer: WebRTC DTLS-SRTP
- API -> database: TLS-enabled database connection

Never treat client-side role checks as authorization. The server must enforce authorization for every protected operation.
