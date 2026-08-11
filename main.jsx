import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import { io } from "socket.io-client";
import {
  ShieldCheck, Video, CalendarDays, Users, LogOut, Plus,
  Mic, MicOff, Camera, CameraOff, MonitorUp, MessageSquare,
  Copy, LockKeyhole, Menu, X
} from "lucide-react";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

function api(token) {
  return axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${token}` }
  });
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("demo.admin@securemeet.local");
  const [password, setPassword] = useState("DemoPass123!");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const r = await axios.post(`${API}/api/auth/login`, { email, password });
      onLogin(r.data);
    } catch {
      setError("Login failed. Use one of the demo accounts.");
    }
  }

  return <main className="auth">
    <section className="auth-card">
      <div className="brand"><ShieldCheck size={34}/><span>AICTE SecureMeet</span></div>
      <p className="muted">Secure online meetings for institutional collaboration.</p>
      <div className="demo">DEMO MODE · SYNTHETIC DATA</div>
      <form onSubmit={submit}>
        <label>Email<input value={email} onChange={e=>setEmail(e.target.value)} /></label>
        <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} /></label>
        {error && <div className="error">{error}</div>}
        <button className="primary">Sign in</button>
      </form>
      <div className="small">Demo password: <b>DemoPass123!</b></div>
    </section>
  </main>
}

function Dashboard({ session, logout, openMeeting }) {
  const [meetings, setMeetings] = useState([]);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const client = api(session.token);

  async function load() {
    const r = await client.get("/api/meetings");
    setMeetings(r.data);
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const r = await client.post("/api/meetings", { title });
      setMeetings(x => [r.data, ...x]);
      setTitle("");
    } finally { setCreating(false); }
  }

  return <div className="app">
    <header className="topbar">
      <div className="brand"><ShieldCheck/><span>SecureMeet</span></div>
      <div className="user"><span>{session.user.name} · {session.user.role}</span><button className="icon" onClick={logout}><LogOut/></button></div>
    </header>
    <main className="dashboard">
      <section className="hero">
        <div>
          <div className="eyebrow">AICTE SECURE COLLABORATION</div>
          <h1>Good morning, {session.user.name.split(" ")[0]}.</h1>
          <p>Plan secure meetings, invite stakeholders and communicate in real time.</p>
        </div>
        <div className="secure-pill"><LockKeyhole size={16}/> Protected workspace</div>
      </section>

      <section className="grid">
        <div className="card">
          <div className="card-title"><Video/><h2>Create meeting</h2></div>
          <form onSubmit={create} className="inline-form">
            <input placeholder="Meeting title" value={title} onChange={e=>setTitle(e.target.value)}/>
            <button className="primary" disabled={creating}><Plus size={18}/> Create</button>
          </form>
        </div>
        <div className="stat"><Users/><strong>{meetings.length}</strong><span>Meetings</span></div>
        <div className="stat"><CalendarDays/><strong>Demo</strong><span>Environment</span></div>
      </section>

      <section className="card">
        <div className="section-head"><h2>Meetings</h2><span className="muted">Synthetic demo data</span></div>
        {meetings.length === 0 ? <p className="muted">Create your first demo meeting.</p> :
        <div className="meeting-list">{meetings.map(m=>
          <div className="meeting" key={m.id}>
            <div><b>{m.title}</b><span>{new Date(m.scheduledAt).toLocaleString()}</span></div>
            <button className="primary" onClick={()=>openMeeting(m)}>Join <Video size={17}/></button>
          </div>
        )}</div>}
      </section>
    </main>
  </div>
}

function MeetingRoom({ session, meeting, back }) {
  const localVideo = useRef(null);
  const localStream = useRef(null);
  const peers = useRef({});
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [remote, setRemote] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const socket = io(API, { auth: { token: session.token } });
    socketRef.current = socket;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!alive) return;
        localStream.current = stream;
        localVideo.current.srcObject = stream;
        socket.emit("meeting:join", { meetingId: meeting.id });
      } catch {
        alert("Camera/microphone permission is required for the demo meeting.");
      }
    }

    socket.on("peer:joined", async ({ peerId }) => {
      const pc = makePeer(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("peer:offer", { meetingId: meeting.id, targetId: peerId, offer });
    });

    socket.on("peer:offer", async ({ fromId, offer }) => {
      const pc = makePeer(fromId);
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("peer:answer", { targetId: fromId, answer });
    });

    socket.on("peer:answer", async ({ fromId, answer }) => {
      if (peers.current[fromId]) await peers.current[fromId].setRemoteDescription(answer);
    });

    socket.on("peer:ice", async ({ fromId, candidate }) => {
      if (peers.current[fromId] && candidate) await peers.current[fromId].addIceCandidate(candidate);
    });

    socket.on("peer:left", ({ peerId }) => {
      peers.current[peerId]?.close();
      delete peers.current[peerId];
      setRemote(x => x.filter(p => p.id !== peerId));
    });

    socket.on("meeting:chat", msg => setMessages(x => [...x, msg]));
    start();

    return () => {
      alive = false;
      Object.values(peers.current).forEach(p=>p.close());
      localStream.current?.getTracks().forEach(t=>t.stop());
      socket.disconnect();
    };
  }, [meeting.id]);

  function makePeer(id) {
    if (peers.current[id]) return peers.current[id];
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    localStream.current?.getTracks().forEach(t=>pc.addTrack(t, localStream.current));
    pc.onicecandidate = e => {
      if (e.candidate) socketRef.current.emit("peer:ice", { targetId:id, candidate:e.candidate });
    };
    pc.ontrack = e => {
      const stream = e.streams[0];
      setRemote(x => x.some(p=>p.id===id) ? x : [...x, {id, stream}]);
    };
    peers.current[id] = pc;
    return pc;
  }

  function toggle(type) {
    const tracks = localStream.current?.getTracks().filter(t=>t.kind===type) || [];
    tracks.forEach(t=>t.enabled=!t.enabled);
    if(type==="audio") setMic(x=>!x); else setCam(x=>!x);
  }

  async function share() {
    const stream = await navigator.mediaDevices.getDisplayMedia({video:true});
    const track = stream.getVideoTracks()[0];
    Object.values(peers.current).forEach(pc=>{
      const sender = pc.getSenders().find(s=>s.track?.kind==="video");
      if(sender) sender.replaceTrack(track);
    });
    track.onended = () => {
      const camTrack = localStream.current?.getVideoTracks()[0];
      Object.values(peers.current).forEach(pc=>{
        const sender = pc.getSenders().find(s=>s.track?.kind==="video");
        if(sender && camTrack) sender.replaceTrack(camTrack);
      });
    };
  }

  function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    socketRef.current.emit("meeting:chat", {meetingId:meeting.id, message:text});
    setText("");
  }

  return <div className="meeting-room">
    <header className="meeting-head">
      <div><b>{meeting.title}</b><span>Secure demo room</span></div>
      <button className="danger" onClick={back}>Leave</button>
    </header>
    <main className="meeting-main">
      <section className="videos">
        <div className="video-card local"><video ref={localVideo} autoPlay muted playsInline/><span>You</span></div>
        {remote.map(p=><RemoteVideo key={p.id} item={p}/>)}
      </section>
      <aside className="chat">
        <div className="chat-head"><MessageSquare/> Chat</div>
        <div className="messages">{messages.map(m=><div className="msg" key={m.id}><b>{m.sender}</b><span>{m.message}</span></div>)}</div>
        <form onSubmit={send} className="chat-form"><input value={text} onChange={e=>setText(e.target.value)} placeholder="Message..."/><button>Send</button></form>
      </aside>
    </main>
    <footer className="controls">
      <button className={mic?"control":"control off"} onClick={()=>toggle("audio")}>{mic?<Mic/>:<MicOff/>}</button>
      <button className={cam?"control":"control off"} onClick={()=>toggle("video")}>{cam?<Camera/>:<CameraOff/>}</button>
      <button className="control" onClick={share}><MonitorUp/></button>
      <button className="control leave" onClick={back}>Leave</button>
    </footer>
  </div>
}

function RemoteVideo({item}) {
  const ref = useRef(null);
  useEffect(()=>{ if(ref.current) ref.current.srcObject=item.stream; },[item.stream]);
  return <div className="video-card"><video ref={ref} autoPlay playsInline/><span>Participant</span></div>
}

function App() {
  const [session, setSession] = useState(()=>JSON.parse(localStorage.getItem("securemeet_session")||"null"));
  const [meeting, setMeeting] = useState(null);

  function login(data) {
    localStorage.setItem("securemeet_session", JSON.stringify(data));
    setSession(data);
  }
  function logout() {
    localStorage.removeItem("securemeet_session");
    setSession(null);
  }

  if (!session) return <Login onLogin={login}/>;
  if (meeting) return <MeetingRoom session={session} meeting={meeting} back={()=>setMeeting(null)}/>;
  return <Dashboard session={session} logout={logout} openMeeting={setMeeting}/>;
}

createRoot(document.getElementById("root")).render(<App />);
