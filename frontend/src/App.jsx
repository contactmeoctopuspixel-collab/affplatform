// App.jsx — AffIntel v3 — Connected to real backend
import { useState, useEffect, useCallback, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { api, createWS } from "./api.js";

// ─── FONTS ────────────────────────────────────────────────────────────────────
const lnk = document.createElement("link");
lnk.rel = "stylesheet";
lnk.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Barlow:wght@400;600;700;800;900&display=swap";
document.head.appendChild(lnk);

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#07090c;--bg2:#0d1117;--bg3:#121820;--bg4:#161e28;
  --border:#1a2535;--border2:#243040;
  --text:#cdd6e0;--text2:#5a7080;--text3:#8a9aaa;
  --green:#00ff9d;--cyan:#00cfff;--orange:#ff9f0a;--purple:#bf5af2;--red:#ff453a;
  --font-mono:'IBM Plex Mono',monospace;
  --font-body:'Barlow',sans-serif;
}
html,body,#root{height:100%;background:var(--bg);color:var(--text);font-family:var(--font-body);}
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px;}

.app{display:flex;height:100vh;overflow:hidden;}
.sidebar{width:230px;min-width:230px;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;height:100vh;overflow-y:auto;}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.content{flex:1;overflow-y:auto;padding:22px 26px;}

.logo-wrap{padding:22px 20px 18px;border-bottom:1px solid var(--border);}
.logo{font-size:17px;font-weight:900;letter-spacing:-.5px;}
.logo em{color:var(--green);font-style:normal;}
.logo-tag{font-family:var(--font-mono);font-size:9px;color:var(--text2);margin-top:4px;letter-spacing:1px;}
.nav{flex:1;padding:10px 0;}
.nav-sec{font-family:var(--font-mono);font-size:9px;color:var(--text2);letter-spacing:1.5px;padding:14px 20px 6px;text-transform:uppercase;}
.nav-item{display:flex;align-items:center;gap:9px;padding:9px 20px;cursor:pointer;font-size:13px;font-weight:600;color:var(--text2);border-left:2px solid transparent;transition:all .12s;}
.nav-item:hover{color:var(--text);background:rgba(255,255,255,.025);}
.nav-item.active{color:var(--green);border-left-color:var(--green);background:rgba(0,255,157,.04);}
.nav-badge{background:var(--green);color:var(--bg);font-family:var(--font-mono);font-size:9px;padding:1px 5px;border-radius:6px;margin-left:auto;font-weight:700;}
.sidebar-foot{padding:14px 20px;border-top:1px solid var(--border);}
.sync-row{display:flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:10px;color:var(--text2);}
.pulse{width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse 2s infinite;flex-shrink:0;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
.user-row{display:flex;align-items:center;gap:8px;margin-top:10px;}
.avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--green),var(--cyan));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--bg);flex-shrink:0;}
.user-name{font-size:12px;font-weight:700;}
.user-role{font-family:var(--font-mono);font-size:9px;color:var(--text2);}

.topbar{height:54px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 24px;gap:14px;position:sticky;top:0;z-index:20;}
.topbar-title{font-size:14px;font-weight:800;flex:1;}
.topbar-clock{font-family:var(--font-mono);font-size:11px;color:var(--text2);}
.ws-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.ws-on{background:var(--green);animation:pulse 2s infinite;}
.ws-off{background:var(--red);}

.btn{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:6px;border:1px solid var(--border2);background:transparent;color:var(--text);cursor:pointer;font-family:var(--font-body);font-size:12px;font-weight:600;transition:all .12s;white-space:nowrap;}
.btn:hover:not(:disabled){border-color:var(--green);color:var(--green);}
.btn:disabled{opacity:.4;cursor:default;}
.btn-primary{background:var(--green);color:var(--bg);border-color:var(--green);font-weight:700;}
.btn-primary:hover:not(:disabled){background:#00d980;color:var(--bg);}
.btn-danger{border-color:var(--red);color:var(--red);}
.btn-sm{padding:5px 10px;font-size:11px;}

.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px;}
.stat-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:18px 20px;position:relative;overflow:hidden;}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--ac,var(--green));}
.stat-label{font-family:var(--font-mono);font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.8px;}
.stat-val{font-size:26px;font-weight:900;margin:6px 0 5px;letter-spacing:-1px;}
.stat-sub{font-family:var(--font-mono);font-size:10px;color:var(--text2);}
.stat-up{color:var(--green)!important;}
.stat-down{color:var(--red)!important;}

.card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden;}
.card-head{padding:13px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
.card-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;font-family:var(--font-mono);color:var(--text3);}

.sp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px;}
.sp-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:18px;position:relative;overflow:hidden;}
.sp-card::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--sc,#00ff9d) 50%,transparent);}
.sp-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;}
.sp-name{font-size:14px;font-weight:800;}
.sp-meta{font-family:var(--font-mono);font-size:10px;color:var(--text2);margin-top:2px;}
.badge{font-family:var(--font-mono);font-size:9px;padding:3px 8px;border-radius:4px;font-weight:700;}
.badge-connected{background:rgba(0,255,157,.1);color:var(--green);}
.badge-pending{background:rgba(255,159,10,.1);color:var(--orange);}
.badge-error{background:rgba(255,69,58,.1);color:var(--red);}
.badge-syncing{background:rgba(0,207,255,.1);color:var(--cyan);}
.sp-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0;}
.metric{background:var(--bg3);border-radius:6px;padding:8px 10px;}
.metric-l{font-family:var(--font-mono);font-size:9px;color:var(--text2);text-transform:uppercase;}
.metric-v{font-size:15px;font-weight:700;font-family:var(--font-mono);margin-top:3px;}
.sp-actions{display:flex;gap:7px;margin-top:12px;}
.sp-last{font-family:var(--font-mono);font-size:9px;color:var(--text2);margin-top:8px;}

.tbl-wrap{overflow:auto;}
table{width:100%;border-collapse:collapse;font-size:12px;}
thead th{padding:9px 15px;text-align:left;font-family:var(--font-mono);font-size:9px;color:var(--text2);border-bottom:1px solid var(--border);text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;}
tbody tr{border-bottom:1px solid var(--border);transition:background .1s;}
tbody tr:hover{background:rgba(255,255,255,.018);}
tbody tr:last-child{border-bottom:none;}
td{padding:10px 15px;vertical-align:middle;}
.mono{font-family:var(--font-mono);}
.offer-id{font-family:var(--font-mono);color:var(--cyan);font-size:11px;}
.payout-v{font-family:var(--font-mono);font-weight:700;color:var(--green);}
.st-active{color:var(--green);font-family:var(--font-mono);font-size:10px;}
.st-paused{color:var(--orange);font-family:var(--font-mono);font-size:10px;}
.st-error{color:var(--red);font-family:var(--font-mono);font-size:10px;}
.st-action_required{color:var(--orange);font-family:var(--font-mono);font-size:10px;}
.st-expired{color:var(--text2);font-family:var(--font-mono);font-size:10px;text-decoration:line-through;}
.cat-badge{background:var(--bg3);border:1px solid var(--border2);border-radius:4px;padding:2px 7px;font-size:10px;font-family:var(--font-mono);}

.events-list{display:flex;flex-direction:column;gap:5px;max-height:400px;overflow-y:auto;padding:10px 12px;}
.ev-row{display:flex;align-items:center;gap:9px;padding:6px 10px;background:var(--bg3);border-radius:6px;font-family:var(--font-mono);font-size:11px;animation:slideIn .25s ease;}
@keyframes slideIn{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:none;}}
.ev-time{color:var(--text2);min-width:72px;}
.ev-id{color:var(--cyan);min-width:75px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ev-name{flex:1;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ev-lead{color:var(--green);font-weight:700;}
.ev-click{color:var(--text2);}

.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(5px);z-index:200;display:flex;align-items:center;justify-content:center;}
.modal{background:var(--bg2);border:1px solid var(--border2);border-radius:12px;width:520px;max-width:95vw;max-height:90vh;overflow-y:auto;padding:24px;}
.modal-title{font-size:16px;font-weight:800;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;}
.form-group{margin-bottom:13px;}
.form-label{display:block;font-family:var(--font-mono);font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;}
.form-input{width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;padding:9px 12px;color:var(--text);font-family:var(--font-body);font-size:13px;outline:none;transition:border-color .15s;}
.form-input:focus{border-color:var(--green);}
.form-input::placeholder{color:var(--text2);}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;}
select.form-input{cursor:pointer;}
option{background:var(--bg3);}

.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);}
.login-bg{position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 50% 100%,rgba(0,255,157,.06),transparent);}
.login-card{background:var(--bg2);border:1px solid var(--border2);border-radius:14px;padding:36px 40px;width:400px;max-width:95vw;position:relative;z-index:1;}
.login-logo{font-size:22px;font-weight:900;margin-bottom:4px;}
.login-logo em{color:var(--green);font-style:normal;}
.login-sub{font-family:var(--font-mono);font-size:10px;color:var(--text2);margin-bottom:26px;letter-spacing:1px;}
.login-err{background:rgba(255,69,58,.1);border:1px solid rgba(255,69,58,.3);border-radius:6px;padding:9px 12px;font-size:12px;color:var(--red);margin-bottom:14px;}
.login-hint{background:rgba(0,255,157,.04);border:1px solid rgba(0,255,157,.12);border-radius:6px;padding:9px 12px;font-family:var(--font-mono);font-size:10px;color:var(--text2);margin-top:14px;line-height:1.8;}
.login-hint strong{color:var(--green);}

.sec-title{font-family:var(--font-mono);font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.mb-4{margin-bottom:16px;}
.mb-6{margin-bottom:24px;}
.gap-y{display:flex;flex-direction:column;gap:14px;}
.prog-bar{height:3px;background:var(--bg3);border-radius:2px;overflow:hidden;}
.prog-fill{height:100%;border-radius:2px;transition:width .6s ease;}
.search-wrap{position:relative;}
.search-icon{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--text2);font-size:12px;pointer-events:none;}
.search-input{background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:7px 10px 7px 28px;color:var(--text);font-family:var(--font-body);font-size:12px;outline:none;width:200px;}
.search-input:focus{border-color:var(--green);}
.err-box{background:rgba(255,69,58,.08);border:1px solid rgba(255,69,58,.2);border-radius:8px;padding:12px 16px;color:var(--red);font-size:12px;margin-bottom:16px;}
.loader{display:flex;align-items:center;justify-content:center;height:120px;font-family:var(--font-mono);font-size:12px;color:var(--text2);}
.toast{position:fixed;bottom:24px;right:24px;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:12px 18px;font-size:12px;z-index:999;animation:slideIn .3s ease;max-width:340px;}
.toast-ok{border-left:3px solid var(--green);color:var(--green);}
.toast-err{border-left:3px solid var(--red);color:var(--red);}
.api-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;}
.api-card-name{font-size:14px;font-weight:800;margin-bottom:3px;}
.api-card-url{font-family:var(--font-mono);font-size:10px;color:var(--text2);margin-bottom:14px;word-break:break-all;}
.api-key-row{display:flex;gap:8px;}
.api-key-inp{flex:1;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;padding:8px 10px;color:var(--text);font-family:var(--font-mono);font-size:11px;outline:none;}
.api-key-inp:focus{border-color:var(--green);}
.test-result{margin-top:8px;font-family:var(--font-mono);font-size:10px;padding:6px 10px;border-radius:5px;}
.test-ok{background:rgba(0,255,157,.08);color:var(--green);}
.test-fail{background:rgba(255,69,58,.08);color:var(--red);}
.test-loading{background:rgba(0,207,255,.08);color:var(--cyan);}
`;

// ─── DESKTOP NOTIFICATIONS ───────────────────────────────────────────────────
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function sendNotification(title, body, color = "#00ff9d") {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const n = new Notification(title, {
    body,
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%2300ff9d'/><text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' font-family='monospace' font-weight='bold' font-size='16' fill='%23080c10'>A</text></svg>",
    badge: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%2300ff9d'/></svg>",
    tag: "affplatform-lead",
    requireInteraction: false,
  });
  setTimeout(() => n.close(), 6000);
}

// ─── CHART TOOLTIP ────────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:"#0d1117",border:"1px solid #1a2535",borderRadius:8,padding:"9px 13px",fontFamily:"IBM Plex Mono,monospace",fontSize:11}}>
      <div style={{color:"#5a7080",marginBottom:5}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color,marginBottom:2}}>{p.name}: <strong>{p.name==="revenue"?`$${Number(p.value).toFixed(2)}`:Number(p.value).toLocaleString()}</strong></div>
      ))}
    </div>
  );
};

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return <div className={`toast toast-${type}`}>{msg}</div>;
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("admin@affplatform.com");
  const [pass,  setPass]  = useState("");
  const [err,   setErr]   = useState("");
  const [busy,  setBusy]  = useState(false);

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const { token, user } = await api.login(email, pass);
      localStorage.setItem("affplatform_token", token);
      onLogin(user);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap" style={{position:"relative"}}>
      <div className="login-bg"/>
      <div className="login-card">
        <div className="login-logo"><em>Aff</em>Intel</div>
        <div className="login-sub">AFFILIATE INTELLIGENCE PLATFORM v3</div>
        {err && <div className="login-err">⚠ {err}</div>}
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <input className="form-input" type="password" placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>
        <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",marginTop:4}} onClick={submit} disabled={busy}>
          {busy ? "Authenticating…" : "Sign In →"}
        </button>
        <div className="login-hint">
          <strong>admin:</strong> admin@affplatform.com / admin123<br/>
          <strong>team:</strong>  team@affplatform.com / team123
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardPage() {
  const [data,       setData]       = useState(null);
  const [subData,    setSubData]    = useState(null);
  const [subImporting, setSubImporting] = useState(false);
  const [subImportMsg, setSubImportMsg] = useState("");
  const [err,        setErr]        = useState("");
  const [lastUpdate, setLastUpdate] = useState(null);
  const [pulse,      setPulse]      = useState(false);
  const [showCal,    setShowCal]    = useState(false);
  const [dateFrom,   setDateFrom]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0,10);
  });
  const [dateTo,     setDateTo]     = useState(() => new Date().toISOString().slice(0,10));
  const [selecting,  setSelecting]  = useState("from"); // "from" | "to"
  const [calMonth,   setCalMonth]   = useState(() => new Date());

  const PRESETS = [
    { label:"Today",         days:0  },
    { label:"Yesterday",     days:1, yesterday:true },
    { label:"Last 7 Days",   days:6  },
    { label:"Last 30 Days",  days:29 },
    { label:"This Month",    month:true },
    { label:"Last Month",    lastMonth:true },
  ];

  const applyPreset = (p) => {
    const today = new Date();
    const fmt = d => d.toISOString().slice(0,10);
    if (p.yesterday) {
      const y = new Date(); y.setDate(y.getDate()-1);
      setDateFrom(fmt(y)); setDateTo(fmt(y));
    } else if (p.month) {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(fmt(start)); setDateTo(fmt(today));
    } else if (p.lastMonth) {
      const start = new Date(today.getFullYear(), today.getMonth()-1, 1);
      const end   = new Date(today.getFullYear(), today.getMonth(), 0);
      setDateFrom(fmt(start)); setDateTo(fmt(end));
    } else {
      const from = new Date(); from.setDate(from.getDate() - p.days);
      setDateFrom(fmt(from)); setDateTo(fmt(today));
    }
    setShowCal(false);
  };

  const load = useCallback(async () => {
    try {
      const [d, sub] = await Promise.all([
        api.dashboard(dateFrom, dateTo),
        api.subAffiliates(dateFrom, dateTo).catch(() => null),
      ]);
      setData(d);
      if (sub) setSubData(sub);
      setLastUpdate(new Date());
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    } catch (e) { setErr(e.message); }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  // Close calendar on outside click
  useEffect(() => {
    if (!showCal) return;
    const close = (e) => { setShowCal(false); };
    // Small delay so the toggle click doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener("click", close);
    }, 50);
    return () => { clearTimeout(timer); document.removeEventListener("click", close); };
  }, [showCal]);

  // Listen to WebSocket for live updates
  useEffect(() => {
    const handler = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "dashboard_refresh" || msg.type === "sponsor_updated") {
          load(); // refresh charts when sponsor synced
        }
      } catch {}
    };
    window.addEventListener("affplatform_ws", handler);
    return () => window.removeEventListener("affplatform_ws", handler);
  }, [load]);

  if (err)   return <div className="err-box">⚠ {err} — Is the backend running?</div>;
  if (!data) return <div className="loader">⟳ Loading dashboard…</div>;

  const { kpis, weeklyChart, topOffers } = data;

  // Format chart data
  const chart = weeklyChart.map(r => ({
    day:     r.date?.slice(5) || r.date,
    revenue: +Number(r.revenue).toFixed(2),
    clicks:  r.clicks,
    leads:   r.leads,
  }));

  // Live revenue sparkline — last 7 points animated
  const maxRev = Math.max(...chart.map(c => c.revenue), 1);

  return (
    <>
      {/* Date Range Picker */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,position:"relative"}}>
        <button onClick={(e)=>{e.stopPropagation();setShowCal(p=>!p);}} style={{
          display:"flex",alignItems:"center",gap:8,background:"var(--bg2)",
          border:"1px solid var(--border2)",borderRadius:8,padding:"8px 14px",
          cursor:"pointer",color:"var(--text)",fontFamily:"var(--font-mono)",fontSize:11
        }}>
          📅 {dateFrom} → {dateTo}
          <span style={{color:"var(--text2)",fontSize:10}}>
            ({Math.round((new Date(dateTo)-new Date(dateFrom))/86400000)+1} days)
          </span>
        </button>
        <button className="btn btn-sm" onClick={(e)=>{e.stopPropagation();load();}}>⟳ Apply</button>

        {/* Calendar Dropdown */}
        {showCal && (
          <div onClick={e=>e.stopPropagation()} style={{
            position:"absolute",top:44,left:0,zIndex:50,
            background:"var(--bg2)",border:"1px solid var(--border2)",
            borderRadius:12,padding:20,display:"flex",gap:20,
            boxShadow:"0 8px 32px rgba(0,0,0,.6)",minWidth:520
          }}>
            {/* Presets */}
            <div style={{display:"flex",flexDirection:"column",gap:4,minWidth:110}}>
              <div style={{fontFamily:"var(--font-mono)",fontSize:9,color:"var(--text2)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Presets</div>
              {PRESETS.map(p=>(
                <button key={p.label} onClick={()=>applyPreset(p)} style={{
                  background:"transparent",border:"none",color:"var(--text3)",
                  textAlign:"left",cursor:"pointer",padding:"5px 8px",borderRadius:5,
                  fontFamily:"var(--font-body)",fontSize:12,transition:"all .1s"
                }} onMouseEnter={e=>e.target.style.background="var(--bg3)"}
                   onMouseLeave={e=>e.target.style.background="transparent"}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Mini Calendar */}
            <div>
              {/* Month nav */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <button onClick={()=>{const d=new Date(calMonth);d.setMonth(d.getMonth()-1);setCalMonth(d);}} style={{background:"none",border:"none",color:"var(--text2)",cursor:"pointer",fontSize:16}}>‹</button>
                <span style={{fontFamily:"var(--font-mono)",fontSize:11,fontWeight:700}}>
                  {calMonth.toLocaleDateString("en",{month:"long",year:"numeric"}).toUpperCase()}
                </span>
                <button onClick={()=>{const d=new Date(calMonth);d.setMonth(d.getMonth()+1);setCalMonth(d);}} style={{background:"none",border:"none",color:"var(--text2)",cursor:"pointer",fontSize:16}}>›</button>
              </div>
              {/* Days header */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
                {["Mo","Tu","We","Th","Fr","Sa","Su"].map(d=>(
                  <div key={d} style={{textAlign:"center",fontFamily:"var(--font-mono)",fontSize:9,color:"var(--text2)",padding:"2px 0"}}>{d}</div>
                ))}
              </div>
              {/* Calendar days */}
              {(()=>{
                const year  = calMonth.getFullYear();
                const month = calMonth.getMonth();
                const first = new Date(year, month, 1);
                const startDow = (first.getDay()+6)%7; // Mon=0
                const daysInMonth = new Date(year, month+1, 0).getDate();
                const cells = [];
                for (let i=0; i<startDow; i++) cells.push(null);
                for (let d=1; d<=daysInMonth; d++) cells.push(d);
                return (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
                    {cells.map((d,i)=>{
                      if (!d) return <div key={`e${i}`}/>;
                      const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                      const isFrom  = dateStr === dateFrom;
                      const isTo    = dateStr === dateTo;
                      const inRange = dateStr >= dateFrom && dateStr <= dateTo;
                      const isToday = dateStr === new Date().toISOString().slice(0,10);
                      return (
                        <div key={d} onClick={()=>{
                          if (selecting==="from") { setDateFrom(dateStr); if(dateStr>dateTo) setDateTo(dateStr); setSelecting("to"); }
                          else { if(dateStr<dateFrom) { setDateFrom(dateStr); } else { setDateTo(dateStr); setShowCal(false); setSelecting("from"); } }
                        }} style={{
                          textAlign:"center",padding:"5px 0",borderRadius:5,cursor:"pointer",
                          fontFamily:"var(--font-mono)",fontSize:11,
                          background: isFrom||isTo ? "var(--green)" : inRange ? "rgba(0,255,157,.1)" : "transparent",
                          color: isFrom||isTo ? "var(--bg)" : isToday ? "var(--green)" : "var(--text)",
                          fontWeight: isFrom||isTo||isToday ? 700 : 400,
                          outline: isToday && !isFrom && !isTo ? "1px solid rgba(0,255,157,.3)" : "none",
                        }}>
                          {d}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <div style={{marginTop:12,fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)",textAlign:"center"}}>
                {selecting==="from" ? "🟢 Select start date" : "🔵 Select end date"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="stats-grid mb-6">
        {[
          { label:"Total Revenue",   value:`$${Number(kpis.totalRevenue).toLocaleString("en",{minimumFractionDigits:2})}`, color:"var(--green)"  },
          { label:"Total Clicks",    value:Number(kpis.totalClicks).toLocaleString(),                                       color:"var(--cyan)"   },
          { label:"Total Leads",     value:Number(kpis.totalLeads).toLocaleString(),                                        color:"var(--purple)" },
          { label:"Active Sponsors", value:`${kpis.connectedApis}/${kpis.totalSponsors}`,                                  color:"var(--orange)" },
        ].map((c,i) => (
          <div key={i} className="stat-card" style={{"--ac":c.color,transition:"transform .2s",transform:pulse?"scale(1.01)":"scale(1)"}}>
            <div className="stat-label">{c.label}</div>
            <div className="stat-val" style={{color:c.color}}>{c.value}</div>
            {lastUpdate && <div style={{fontFamily:"var(--font-mono)",fontSize:9,color:"var(--text2)",marginTop:4}}>
              Updated {lastUpdate.toLocaleTimeString()}
            </div>}
          </div>
        ))}
      </div>

      {/* Live indicator */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <span style={{width:7,height:7,borderRadius:"50%",background:"var(--green)",display:"inline-block",animation:"pulse 2s infinite"}}/>
        <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)"}}>
          LIVE — auto-refreshes every 2 min · last: {lastUpdate?.toLocaleTimeString() || "—"}
        </span>
        <button className="btn btn-sm" style={{marginLeft:"auto",fontSize:10}} onClick={load}>⟳ Refresh now</button>
      </div>

      {/* Top Offers — just below LIVE bar, date-filtered */}
      {topOffers?.length > 0 && (
        <div className="card" style={{marginBottom:16}}>
          <div className="card-head">
            <span className="card-title">Top Offers by Revenue</span>
            <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)"}}>période sélectionnée</span>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>ID</th><th>Offer</th><th>Sponsor</th><th>Payout</th><th>Leads</th><th>Revenue</th></tr></thead>
              <tbody>
                {topOffers.map(o => (
                  <tr key={o.id}>
                    <td><span className="offer-id">{o.external_id || o.id}</span></td>
                    <td style={{fontWeight:600,fontSize:12}}>{o.name}</td>
                    <td style={{fontFamily:"var(--font-mono)",fontSize:11,color:o.sponsor_color||"var(--text2)"}}>{o.sponsor_name}</td>
                    <td><span className="payout-v">${o.payout}</span></td>
                    <td className="mono" style={{color:"var(--cyan)",fontWeight:700}}>{o.period_leads_display ?? o.period_leads}</td>
                    <td className="mono" style={{color:"var(--green)",fontWeight:700}}>${Number(o.period_revenue).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-head">
            <span className="card-title">Weekly Revenue</span>
            <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--green)"}}>
              ${chart.reduce((a,c)=>a+c.revenue,0).toFixed(2)} total
            </span>
          </div>
          <div style={{padding:"14px 16px 8px"}}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00ff9d" stopOpacity={.3}/>
                    <stop offset="95%" stopColor="#00ff9d" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2535"/>
                <XAxis dataKey="day" tick={{fontSize:9,fill:"#5a7080",fontFamily:"IBM Plex Mono"}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:9,fill:"#5a7080",fontFamily:"IBM Plex Mono"}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`}/>
                <Tooltip content={<ChartTip/>}/>
                <Area type="monotone" dataKey="revenue" stroke="#00ff9d" strokeWidth={2} fill="url(#rg)" dot={false} isAnimationActive={true} animationDuration={800}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <span className="card-title">Clicks & Leads</span>
            <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)"}}>
              {chart.reduce((a,c)=>a+c.clicks,0).toLocaleString()} clicks · {chart.reduce((a,c)=>a+c.leads,0)} leads
            </span>
          </div>
          <div style={{padding:"14px 16px 8px"}}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chart} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2535"/>
                <XAxis dataKey="day" tick={{fontSize:9,fill:"#5a7080",fontFamily:"IBM Plex Mono"}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:9,fill:"#5a7080",fontFamily:"IBM Plex Mono"}} axisLine={false} tickLine={false}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="clicks" fill="#00cfff" opacity={.75} radius={[3,3,0,0]} isAnimationActive={true} animationDuration={800}/>
                <Bar dataKey="leads"  fill="#bf5af2" opacity={.85} radius={[3,3,0,0]} isAnimationActive={true} animationDuration={800}/>
                <Legend wrapperStyle={{fontSize:10,fontFamily:"IBM Plex Mono",color:"#5a7080"}}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Revenue by Sponsor (Live) */}
      {(data.sponsorBreakdown || []).filter(sp => sp.revenue > 0 || sp.clicks > 0).length > 0 && (
        <>
          <div className="sec-title">Revenue by Sponsor (Live)</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12,marginBottom:22}}>
            {(data.sponsorBreakdown || []).map(sp => (
              <div key={sp.id} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 16px",opacity:sp.status==="pending"?.5:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontSize:12,fontWeight:700}}>{sp.name}</span>
                  <span style={{width:7,height:7,borderRadius:"50%",background:sp.color,display:"inline-block",boxShadow:sp.status==="connected"?`0 0 6px ${sp.color}55`:"none"}}/>
                </div>
                <div style={{fontFamily:"var(--font-mono)",fontSize:20,fontWeight:700,color:sp.revenue>0?sp.color:"var(--text2)"}}>
                  {sp.revenue > 0 ? `$${Number(sp.revenue).toFixed(2)}` : sp.status==="pending" ? "No key" : "$0.00"}
                </div>
                <div style={{display:"flex",gap:12,marginTop:5}}>
                  <span style={{fontSize:10,color:"var(--text2)",fontFamily:"var(--font-mono)"}}>{Number(sp.clicks).toLocaleString()} clicks</span>
                  <span style={{fontSize:10,color:"var(--text2)",fontFamily:"var(--font-mono)"}}>{sp.leads} leads</span>
                </div>
                <div style={{marginTop:8,height:3,background:"var(--bg3)",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:kpis.totalRevenue>0?`${(sp.revenue/kpis.totalRevenue*100).toFixed(1)}%`:"0%",background:sp.color,borderRadius:2,transition:"width .8s ease"}}/>
                </div>
              </div>
            ))}
          </div>
        </>
      )}


      {/* Sub-Affiliate Leaderboard — always visible */}
      <>
        <div className="sec-title" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span>Sub-Affiliate Leaderboard</span>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {subImportMsg && <span style={{fontSize:11,color:"var(--green)",fontFamily:"var(--font-mono)"}}>{subImportMsg}</span>}
            <button className="btn btn-sm" disabled={subImporting} style={{fontSize:11}}
              onClick={async () => {
                setSubImporting(true); setSubImportMsg("");
                try {
                  const r = await api.importConversions(dateFrom, dateTo);
                  setSubImportMsg(r.imported > 0 ? `✓ ${r.imported} imported` : r.errors?.[0] || "No new data");
                  if (r.imported > 0) load();
                } catch(e) { setSubImportMsg("Error: " + e.message); }
                finally { setSubImporting(false); }
              }}>
              {subImporting ? "⟳ Importing..." : "⟳ Import from Everflow"}
            </button>
          </div>
        </div>
        <div className="card">
          {subData?.sub_affiliates?.length > 0 ? (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr><th>#</th><th>Sub-Affiliate</th><th>ID</th><th>Leads</th><th>Revenue</th></tr>
                </thead>
                <tbody>
                  {subData.sub_affiliates.map((s, i) => {
                    const maxLeads = subData.sub_affiliates[0]?.leads || 1;
                    const pct = maxLeads > 0 ? (s.leads / maxLeads * 100).toFixed(0) : 0;
                    const medals = ["🥇","🥈","🥉"];
                    return (
                      <tr key={s.id}>
                        <td style={{fontFamily:"var(--font-mono)",fontSize:14,width:32}}>{medals[i] || i+1}</td>
                        <td style={{fontWeight:700,fontSize:13}}>{s.name}</td>
                        <td><span className="offer-id">{s.id}</span></td>
                        <td>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span className="mono" style={{color:"var(--cyan)",fontWeight:700,minWidth:30}}>{s.leads}</span>
                            <div style={{flex:1,height:4,background:"var(--bg3)",borderRadius:2,overflow:"hidden",minWidth:60}}>
                              <div style={{height:"100%",width:`${pct}%`,background:"var(--cyan)",borderRadius:2,transition:"width .6s ease"}}/>
                            </div>
                          </div>
                        </td>
                        <td className="mono" style={{color:"var(--green)",fontWeight:700}}>${Number(s.revenue).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {subData?.total_in_db > 0 && (
                <div style={{padding:"8px 16px",fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)"}}>
                  {subData.total_conversions} conversions in this period · {subData.total_in_db} total in DB
                </div>
              )}
            </div>
          ) : (
            <div style={{padding:"28px 20px",textAlign:"center"}}>
              <div style={{fontSize:13,color:"var(--text2)",marginBottom:12}}>
                Aucune donnée pour cette période
              </div>
              <div style={{fontSize:11,color:"var(--text3)",fontFamily:"var(--font-mono)",marginBottom:16}}>
                Clique "Import from Everflow" pour importer l'historique
              </div>
              <div style={{background:"var(--bg3)",borderRadius:8,padding:"10px 14px",marginBottom:12,textAlign:"left"}}>
                <div style={{fontSize:10,color:"var(--text2)",marginBottom:6}}>OU configure le Postback dans Everflow (temps réel) :</div>
                <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--cyan)",wordBreak:"break-all",userSelect:"all"}}>
                  {window.location.origin}/api/postback?sub3={"{sub3}"}&revenue={"{payout}"}&offer_id={"{network_offer_id}"}&transaction_id={"{transaction_id}"}
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    </>
  );
}

// ─── SPONSORS PAGE ────────────────────────────────────────────────────────────
function SponsorsPage({ toast }) {
  const [sponsors, setSponsors] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [cfgSp,    setCfgSp]    = useState(null);
  const [manualSp, setManualSp] = useState(null);
  const [manualForm, setManualForm] = useState({ revenue: "", clicks: "", leads: "" });
  const [newKey,   setNewKey]   = useState("");
  const [testRes,  setTestRes]  = useState({});
  const [form,     setForm]     = useState({ name:"", base_url:"", platform:"everflow", color:"#00ff9d", api_key:"" });

  const load = useCallback(async () => {
    try { const r = await api.getSponsors(); setSponsors(r.sponsors); } 
    catch(e) { toast(e.message, "err"); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const sync = async (id) => {
    setSponsors(p=>p.map(s=>s.id===id?{...s,status:"syncing"}:s));
    try {
      await api.syncSponsor(id);
      toast("Sync complete ✓", "ok");
    } catch(e) {
      toast(e.message, "err");
    }
    load();
  };

  const testApi = async (sp) => {
    setTestRes(p=>({...p,[sp.id]:"loading"}));
    try {
      const r = await api.testSponsor(sp.id);
      setTestRes(p=>({...p,[sp.id]: r.ok ? "ok" : { msg: r.message, hint: r.hint }}));
    } catch(e) {
      setTestRes(p=>({...p,[sp.id]:{ msg: e.message }}));
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this sponsor?")) return;
    try { await api.deleteSponsor(id); toast("Sponsor deleted", "ok"); load(); }
    catch(e) { toast(e.message, "err"); }
  };

  const addSponsor = async () => {
    try { await api.createSponsor(form); toast("Sponsor added ✓", "ok"); setModal(false); load(); }
    catch(e) { toast(e.message, "err"); }
  };

  const saveKey = async (id) => {
    try { await api.updateSponsor(id, { api_key: newKey }); toast("API key saved ✓", "ok"); setCfgSp(null); load(); }
    catch(e) { toast(e.message, "err"); }
  };

  const sf = (k,v) => setForm(p=>({...p,[k]:v}));

  if (loading) return <div className="loader">⟳ Loading sponsors…</div>;

  return (
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div className="sec-title" style={{marginBottom:0}}>Sponsors ({sponsors.length})</div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}>＋ Add Sponsor</button>
      </div>
      <div className="sp-grid">
        {sponsors.map(sp=>(
          <div className="sp-card" key={sp.id} style={{"--sc":sp.color}}>
            <div className="sp-top">
              <div><div className="sp-name">{sp.name}</div><div className="sp-meta">{sp.id} · {sp.platform}</div></div>
              <span className={`badge badge-${sp.status}`}>{sp.status.toUpperCase()}</span>
            </div>
            <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)",wordBreak:"break-all",marginBottom:12}}>{sp.base_url}</div>
            <div className="sp-metrics">
              <div className="metric"><div className="metric-l">Revenue</div><div className="metric-v" style={{color:sp.color}}>${Number(sp.revenue).toLocaleString()}</div></div>
              <div className="metric"><div className="metric-l">Clicks</div><div className="metric-v">{Number(sp.clicks).toLocaleString()}</div></div>
              <div className="metric"><div className="metric-l">Leads</div><div className="metric-v">{sp.leads}</div></div>
            </div>
            {testRes[sp.id] && (
              <div className={`test-result ${testRes[sp.id]==="loading"?"test-loading":testRes[sp.id]==="ok"?"test-ok":"test-fail"} mb-4`}>
                {testRes[sp.id]==="loading" ? "⟳ Testing API connection…" :
                 testRes[sp.id]==="ok" ? "✓ API Connected successfully!" :
                 <span>✕ {testRes[sp.id]?.msg || "Unknown error"}{testRes[sp.id]?.hint && <><br/><span style={{fontSize:10,opacity:.8}}>💡 {testRes[sp.id].hint}</span></>}</span>}
              </div>
            )}
            <div className="sp-actions">
              <a href={sp.base_url} target="_blank" rel="noreferrer" className="btn btn-sm">↗ Open</a>
              <button className="btn btn-sm" onClick={()=>sync(sp.id)} disabled={sp.status==="syncing"}>⟳ Sync</button>
              <button className="btn btn-sm" onClick={()=>testApi(sp)}>⚡ Test</button>
              <button className="btn btn-sm" onClick={()=>{setCfgSp(sp);setNewKey("");}}>🔑 Key</button>
              {sp.platform==="adsurf" && <button className="btn btn-sm" style={{color:"var(--orange)",borderColor:"var(--orange)"}} onClick={()=>{setManualSp(sp);setManualForm({revenue:sp.revenue||"",clicks:sp.clicks||"",leads:sp.leads||""});}}>✏ Manual</button>}
              <button className="btn btn-sm btn-danger" style={{marginLeft:"auto"}} onClick={()=>remove(sp.id)}>✕</button>
            </div>
            <div className="sp-last">
              {sp.hasKey ? "🔑 Key configured" : "⚠ No API key"} · {sp.last_sync ? "synced " + new Date(sp.last_sync).toLocaleTimeString() : "never synced"}
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <div className="modal-title">Add Sponsor <button className="btn btn-sm" onClick={()=>setModal(false)}>✕</button></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Name</label><input className="form-input" placeholder="MyAffNet" value={form.name} onChange={e=>sf("name",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Platform</label>
                <select className="form-input" value={form.platform} onChange={e=>sf("platform",e.target.value)}>
                  {["everflow","bizaglo","sphinxads","adsurf","custom"].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Dashboard URL</label><input className="form-input" placeholder="https://…" value={form.base_url} onChange={e=>sf("base_url",e.target.value)}/></div>
            <div className="form-group"><label className="form-label">API Key (optional)</label><input className="form-input" type="password" placeholder="sk-…" value={form.api_key} onChange={e=>sf("api_key",e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Color</label><input className="form-input" type="color" value={form.color} onChange={e=>sf("color",e.target.value)} style={{height:40,padding:4}}/></div>
            <div className="modal-actions"><button className="btn" onClick={()=>setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={addSponsor}>Add</button></div>
          </div>
        </div>
      )}

      {/* Manual Update Modal */}
      {manualSp && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setManualSp(null)}>
          <div className="modal">
            <div className="modal-title">✏ Manual Update — {manualSp.name} <button className="btn btn-sm" onClick={()=>setManualSp(null)}>✕</button></div>
            <div style={{background:"rgba(255,159,10,.08)",border:"1px solid rgba(255,159,10,.2)",borderRadius:6,padding:"9px 12px",fontFamily:"var(--font-mono)",fontSize:10,color:"var(--orange)",marginBottom:14}}>
              ⚠ AdSurf n'a pas d'API publique — mettez à jour les stats manuellement depuis votre dashboard AdSurf.
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Revenue ($)</label><input className="form-input" type="number" placeholder="0.00" value={manualForm.revenue} onChange={e=>setManualForm(p=>({...p,revenue:e.target.value}))}/></div>
              <div className="form-group"><label className="form-label">Clicks</label><input className="form-input" type="number" placeholder="0" value={manualForm.clicks} onChange={e=>setManualForm(p=>({...p,clicks:e.target.value}))}/></div>
            </div>
            <div className="form-group"><label className="form-label">Leads / Conversions</label><input className="form-input" type="number" placeholder="0" value={manualForm.leads} onChange={e=>setManualForm(p=>({...p,leads:e.target.value}))}/></div>
            <div className="modal-actions">
              <button className="btn" onClick={()=>setManualSp(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={async()=>{
                try { await api.manualUpdate(manualSp.id, manualForm); toast("Stats updated ✓","ok"); setManualSp(null); load(); }
                catch(e){ toast(e.message,"err"); }
              }}>Save Stats</button>
            </div>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      {cfgSp && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setCfgSp(null)}>
          <div className="modal">
            <div className="modal-title">🔑 API Key — {cfgSp.name} <button className="btn btn-sm" onClick={()=>setCfgSp(null)}>✕</button></div>
            <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)",marginBottom:14}}>{cfgSp.base_url}</div>
            {cfgSp.hasKey && <div style={{background:"rgba(0,255,157,.06)",border:"1px solid rgba(0,255,157,.15)",borderRadius:6,padding:"8px 12px",fontFamily:"var(--font-mono)",fontSize:10,color:"var(--green)",marginBottom:12}}>✓ Key already saved — paste a new one to replace</div>}
            <div className="form-group"><label className="form-label">New API Key</label><input className="form-input" type="password" placeholder="Paste key…" value={newKey} onChange={e=>setNewKey(e.target.value)}/></div>
            <div className="modal-actions"><button className="btn" onClick={()=>setCfgSp(null)}>Cancel</button><button className="btn btn-primary" onClick={()=>saveKey(cfgSp.id)} disabled={!newKey}>Save Key</button></div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── OFFERS PAGE ──────────────────────────────────────────────────────────────
function OffersPage({ toast }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddOffer, setShowAddOffer] = useState(false);
  const [addForm, setAddForm] = useState({ sponsor_id:"", name:"", payout:"", category:"General", external_id:"", status:"active" });
  const [filterSp, setFilterSp] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sponsors, setSponsors] = useState([]);

  const load = useCallback(async () => {
    try {
      const [oRes, sRes] = await Promise.all([api.getOffers(), api.getSponsors()]);
      setOffers(oRes.offers); setSponsors(sRes.sponsors);
    } catch(e) { toast(e.message, "err"); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const filtered = offers.filter(o =>
    (!filterSp || o.sponsor_id === filterSp) &&
    (!filterStatus || o.status === filterStatus) &&
    (!search || o.name.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search))
  );

  if (loading) return <div className="loader">⟳ Loading offers…</div>;

  return (
    <>
      <div style={{display:"flex",gap:10,marginBottom:18,alignItems:"center",flexWrap:"wrap"}}>
        <div className="sec-title" style={{marginBottom:0,flex:1}}>
          Offers ({filtered.length}) · Est: <span style={{color:"var(--green)"}}>${filtered.reduce((a,o)=>a+o.est_revenue,0).toFixed(0)}</span>
        </div>
        <button className="btn btn-sm" style={{color:"var(--orange)",borderColor:"rgba(255,159,10,.4)"}} onClick={()=>setShowAddOffer(true)}>＋ Add Offer</button>
        <button className="btn btn-sm" style={{color:"var(--cyan)",borderColor:"rgba(0,207,255,.3)"}} onClick={async()=>{
          try {
            toast("⟳ Importing offers from all sponsors…","ok");
            const r = await api.syncOffers();
            toast(`✓ ${r.totalImported} new · ${r.totalUpdated} updated`,"ok");
            load();
          } catch(e){ toast(e.message,"err"); }
        }}>⟳ Import from Sponsors</button>
        <div className="search-wrap"><span className="search-icon">⌕</span><input className="search-input" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <select className="form-input" style={{width:150,padding:"7px 10px",fontSize:12}} value={filterSp} onChange={e=>setFilterSp(e.target.value)}>
          <option value="">All Sponsors</option>
          {sponsors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="form-input" style={{width:150,padding:"7px 10px",fontSize:12}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="action_required">Action Required</option>
          <option value="paused">Paused</option>
          <option value="expired">Expired</option>
        </select>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Sponsor</th><th>Category</th><th>Payout</th><th>Clicks</th><th>Leads</th><th>CR</th><th>Est. Rev</th><th>Status</th><th>Apply</th></tr></thead>
            <tbody>
              {filtered.map(o=>(
                <tr key={o.id}>
                  <td><span className="offer-id">{o.id}</span></td>
                  <td style={{fontWeight:600}}>{o.name}</td>
                  <td style={{fontFamily:"var(--font-mono)",fontSize:11,color:o.sponsor_color}}>{o.sponsor_name}</td>
                  <td><span className="cat-badge">{o.category}</span></td>
                  <td><span className="payout-v">${o.payout}</span></td>
                  <td className="mono">{Number(o.clicks).toLocaleString()}</td>
                  <td className="mono">{o.leads}</td>
                  <td className="mono" style={{color:"var(--cyan)"}}>{o.cr}</td>
                  <td className="mono" style={{color:"var(--green)",fontWeight:700}}>${o.est_revenue}</td>
                  <td><span className={`st-${o.status}`}>● {o.status}</span></td>
                  <td>
                    <a href={sponsors.find(s=>s.id===o.sponsor_id)?.base_url || "#"} target="_blank" rel="noreferrer"
                       style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--orange)",textDecoration:"none",
                               border:"1px solid rgba(255,159,10,.3)",borderRadius:4,padding:"2px 7px",whiteSpace:"nowrap"}}>
                      ↗ Apply
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Offer Modal */}
      {showAddOffer && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowAddOffer(false)}>
          <div className="modal" style={{width:580}}>
            <div className="modal-title">＋ Add Offer <button className="btn btn-sm" onClick={()=>setShowAddOffer(false)}>✕</button></div>

            {/* Tabs */}
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              {["single","bulk"].map(t=>(
                <button key={t} className="btn btn-sm" onClick={()=>setAddForm(p=>({...p,_tab:t}))}
                  style={addForm._tab===t||(!addForm._tab&&t==="single")?{background:"var(--green)",color:"var(--bg)",borderColor:"var(--green)"}:{}}>
                  {t==="single"?"Single Offer":"Bulk Paste"}
                </button>
              ))}
            </div>

            {(addForm._tab||"single")==="single" ? (<>
              {/* Single offer form */}
              <div style={{background:"rgba(255,159,10,.06)",border:"1px solid rgba(255,159,10,.15)",borderRadius:6,padding:"8px 12px",fontSize:11,color:"var(--orange)",marginBottom:12}}>
                💡 Fin tjib ID: Everflow dashboard → Offers → Manage → copy ID (ex: 104361)
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Sponsor</label>
                  <select className="form-input" value={addForm.sponsor_id} onChange={e=>setAddForm(p=>({...p,sponsor_id:e.target.value}))}>
                    <option value="">-- Select --</option>
                    {sponsors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Offer ID</label>
                  <input className="form-input" placeholder="104361" value={addForm.external_id} onChange={e=>setAddForm(p=>({...p,external_id:e.target.value}))}/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Offer Name</label>
                <input className="form-input" placeholder="ZA - SS - AV Scanner 2026" value={addForm.name} onChange={e=>setAddForm(p=>({...p,name:e.target.value}))}/>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Payout ($)</label>
                  <input className="form-input" type="number" placeholder="0.00" value={addForm.payout} onChange={e=>setAddForm(p=>({...p,payout:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={addForm.status} onChange={e=>setAddForm(p=>({...p,status:e.target.value}))}>
                    <option value="active">Active</option>
                    <option value="action_required">Action Required</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={addForm.category} onChange={e=>setAddForm(p=>({...p,category:e.target.value}))}>
                  {["General","Cloud Storage","Security","Finance","Software","eCommerce","Hosting","Health","Energy","Insurance","VPN","Mainstream"].map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button className="btn" onClick={()=>setShowAddOffer(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={async()=>{
                  if (!addForm.sponsor_id) { toast("Select a sponsor","err"); return; }
                  if (!addForm.name) { toast("Name required","err"); return; }
                  try {
                    await api.createOffer({ sponsor_id:addForm.sponsor_id, name:addForm.name, payout:parseFloat(addForm.payout)||0, category:addForm.category||"General", status:addForm.status||"active", external_id:addForm.external_id||"" });
                    toast("✓ Added: "+addForm.name,"ok");
                    setShowAddOffer(false);
                    setAddForm({ sponsor_id:"", name:"", payout:"", category:"General", external_id:"", status:"active" });
                    load();
                  } catch(e){ toast("Error: "+e.message,"err"); }
                }}>Add Offer</button>
              </div>
            </>) : (<>
              {/* Bulk paste */}
              <div style={{background:"rgba(0,207,255,.06)",border:"1px solid rgba(0,207,255,.15)",borderRadius:6,padding:"10px 14px",fontSize:11,color:"var(--cyan)",marginBottom:14,lineHeight:1.8}}>
                <strong>Format (one offer per line):</strong><br/>
                <span style={{fontFamily:"var(--font-mono)",background:"rgba(0,0,0,.3)",padding:"2px 8px",borderRadius:4,display:"inline-block",marginTop:4}}>
                  OfferID | Offer Name | Payout
                </span><br/>
                <span style={{color:"var(--text2)",marginTop:4,display:"block"}}>
                  Example: <span style={{fontFamily:"var(--font-mono)",color:"var(--text)"}}>104361 | ZA - SS - AV Scanner 2026 | 50</span>
                </span>
                <span style={{color:"var(--text2)"}}>Status and Sponsor apply to all lines.</span>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Sponsor</label>
                  <select className="form-input" value={addForm.sponsor_id} onChange={e=>setAddForm(p=>({...p,sponsor_id:e.target.value}))}>
                    <option value="">-- Select --</option>
                    {sponsors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status (all offers)</label>
                  <select className="form-input" value={addForm._bulkStatus||"action_required"} onChange={e=>setAddForm(p=>({...p,_bulkStatus:e.target.value}))}>
                    <option value="action_required">⚠ Action Required</option>
                    <option value="active">● Active</option>
                    <option value="paused">⏸ Paused</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" style={{display:"flex",justifyContent:"space-between"}}>
                  <span>Paste Offers (one per line)</span>
                  <span style={{color:"var(--green)",fontFamily:"var(--font-mono)",fontSize:10}}>
                    {(addForm._bulk||"").split("\n").filter(l=>l.trim()).length} offers ready
                  </span>
                </label>
                <textarea className="form-input" rows={9} style={{resize:"vertical",fontFamily:"var(--font-mono)",fontSize:11,lineHeight:1.7}}
                  placeholder={"104361 | ZA - SS - AV Scanner 2026 | 50\n104362 | US - Norton 360 | 35\n104363 | UK - McAfee Total | 45"}
                  value={addForm._bulk||""} onChange={e=>setAddForm(p=>({...p,_bulk:e.target.value}))}/>
              </div>
              <div className="modal-actions">
                <button className="btn" onClick={()=>setShowAddOffer(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={async()=>{
                  if (!addForm.sponsor_id) { toast("Select a sponsor","err"); return; }
                  const lines = (addForm._bulk||"").split("\n").map(l=>l.trim()).filter(Boolean);
                  if (!lines.length) { toast("Paste at least one offer","err"); return; }
                  const bulkStatus = addForm._bulkStatus || "action_required";
                  let ok=0, fail=0;
                  for (const line of lines) {
                    const parts = line.split("|").map(p=>p.trim());
                    const [ext_id, name, payout] = parts;
                    if (!name) { fail++; continue; }
                    try {
                      await api.createOffer({ sponsor_id:addForm.sponsor_id, name, payout:parseFloat(payout)||0, external_id:ext_id||"", status:bulkStatus, category:"General" });
                      ok++;
                    } catch { fail++; }
                  }
                  toast(`✓ ${ok} offers added${fail?`, ${fail} failed`:""}`, ok>0?"ok":"err");
                  if (ok>0) { setShowAddOffer(false); setAddForm({ sponsor_id:"", name:"", payout:"", category:"General", external_id:"", status:"active" }); load(); }
                }} disabled={!(addForm._bulk||"").trim()}>
                  Import {(addForm._bulk||"").split("\n").filter(l=>l.trim()).length} Offers
                </button>
              </div>
            </>)}
          </div>
        </div>
      )}
    </>
  );
}

// ─── TRACKING PAGE ────────────────────────────────────────────────────────────
function TrackingPage({ liveEvents, wsConnected }) {
  const [todayStats, setTodayStats] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0,10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load today's real stats from API
      const [dash, evs] = await Promise.all([
        api.dashboard(today, today),
        api.events(50),
      ]);
      setTodayStats(dash);
      setRecentEvents(evs.events || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  // Build hourly chart from weeklyChart (today's performance data)
  const hourlyData = todayStats?.weeklyChart?.length > 0
    ? todayStats.weeklyChart.map(d => ({
        day: d.date?.slice(5) || d.date,
        clicks: d.clicks, leads: d.leads, revenue: d.revenue,
      }))
    : [];

  // Combine live WS events + recent DB events (deduplicated)
  const allEvents = [...liveEvents];
  for (const e of recentEvents) {
    if (!allEvents.find(x => x.id === e.id)) allEvents.push(e);
  }
  allEvents.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,flexWrap:"wrap"}}>
        <div className="sec-title" style={{marginBottom:0,flex:1}}>Live Tracking</div>
        <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:wsConnected?"var(--green)":"var(--orange)"}}>
          {wsConnected ? "● WS LIVE" : "○ WS RECONNECTING"}
        </span>
        <button className="btn btn-sm" onClick={load} disabled={loading}>⟳ Refresh</button>
      </div>

      {/* Today Stats */}
      {todayStats && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
          {[
            { label:"Today Clicks",  val:Number(todayStats.kpis?.totalClicks||0).toLocaleString(),                        color:"var(--cyan)"   },
            { label:"Today Leads",   val:Number(todayStats.kpis?.totalLeads||0).toLocaleString(),                         color:"var(--green)"  },
            { label:"Today Revenue", val:`$${Number(todayStats.kpis?.totalRevenue||0).toFixed(2)}`,                       color:"var(--green)"  },
            { label:"Active Offers", val:Number(todayStats.kpis?.activeOffers||0).toLocaleString(),                       color:"var(--orange)" },
          ].map((c,i) => (
            <div key={i} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 16px",borderTop:`2px solid ${c.color}`}}>
              <div style={{fontFamily:"var(--font-mono)",fontSize:9,color:"var(--text2)",textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>{c.label}</div>
              <div style={{fontSize:22,fontWeight:900,color:c.color,fontFamily:"var(--font-mono)"}}>{c.val}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid-2 mb-6">
        {/* Live Events Feed */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Event Feed</span>
            <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)"}}>
              {allEvents.length} events
            </span>
          </div>
          <div className="events-list">
            {allEvents.length === 0 && (
              <div style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--text2)",padding:"20px",textAlign:"center"}}>
                {loading ? "⟳ Loading events…" : "No events yet today"}
              </div>
            )}
            {allEvents.slice(0,30).map((e,i) => (
              <div className="ev-row" key={e.id||i}>
                <span className="ev-time">{new Date(e.created_at).toTimeString().slice(0,8)}</span>
                <span className="ev-id" style={{fontSize:10}}>{e.offer_id?.split("-").pop()||"—"}</span>
                <span className="ev-name">
                  {(e.offer_name||"Unknown").slice(0,28)}{(e.offer_name||"").length>28?"…":""}
                  {" · "}<span style={{color:e.sponsor_color||"var(--text2)"}}>{e.sponsor_name}</span>
                </span>
                <span className={e.event_type==="lead"?"ev-lead":"ev-click"}>
                  {e.event_type==="lead" ? `+$${Number(e.revenue||0).toFixed(2)}` : "click"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Chart */}
        <div className="card">
          <div className="card-head"><span className="card-title">Daily Performance</span></div>
          <div style={{padding:"14px 16px 8px"}}>
            {hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2535"/>
                  <XAxis dataKey="day" tick={{fontSize:9,fill:"#5a7080",fontFamily:"IBM Plex Mono"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:9,fill:"#5a7080",fontFamily:"IBM Plex Mono"}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Line type="monotone" dataKey="clicks"  stroke="#00cfff" strokeWidth={2} dot={false}/>
                  <Line type="monotone" dataKey="leads"   stroke="#bf5af2" strokeWidth={2} dot={false}/>
                  <Line type="monotone" dataKey="revenue" stroke="#00ff9d" strokeWidth={2} dot={false}/>
                  <Legend wrapperStyle={{fontSize:10,fontFamily:"IBM Plex Mono",color:"#5a7080"}}/>
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:220,fontFamily:"var(--font-mono)",fontSize:11,color:"var(--text2)"}}>
                {loading ? "⟳ Loading chart…" : "No data for today yet"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sponsor breakdown today */}
      {todayStats?.sponsorBreakdown?.filter(s=>s.clicks>0||s.revenue>0).length > 0 && (
        <>
          <div className="sec-title">Today by Sponsor</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
            {todayStats.sponsorBreakdown.map(sp=>(
              <div key={sp.id} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontSize:12,fontWeight:700}}>{sp.name}</span>
                  <span style={{width:7,height:7,borderRadius:"50%",background:sp.color,display:"inline-block"}}/>
                </div>
                <div style={{fontFamily:"var(--font-mono)",fontSize:18,fontWeight:700,color:sp.revenue>0?sp.color:"var(--text2)"}}>
                  ${Number(sp.revenue||0).toFixed(2)}
                </div>
                <div style={{display:"flex",gap:12,marginTop:5}}>
                  <span style={{fontSize:10,color:"var(--text2)",fontFamily:"var(--font-mono)"}}>{sp.clicks||0} clicks</span>
                  <span style={{fontSize:10,color:"var(--text2)",fontFamily:"var(--font-mono)"}}>{sp.leads||0} leads</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ─── BROWSER IMPORT FUNCTION ─────────────────────────────────────────────────
async function importAllOffersFromBrowser(sponsorId, sponsorName, apiKey, toast) {
  const token = localStorage.getItem("affplatform_token");

  try {
    toast("⟳ Fetching all offers from " + sponsorName + "…", "ok");

    // Backend uses stored API key from DB — no need to pass it
    const res = await fetch("/api/ai/fetch-offers-proxy", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ sponsor_id: sponsorId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      toast("Error: " + (err.error || res.status), "err");
      return;
    }

    const data = await res.json();
    const rows = data?.rows || [];

    if (!rows.length) {
      toast("No offers found — check API key", "err");
      return;
    }

    // Parse offers
    const allOffers = rows.map(row => {
      const col = row.columns?.[0];
      if (!col?.id) return null;
      const cv  = row.reporting?.cv || 0;
      const rev = row.reporting?.revenue || 0;
      return {
        external_id: String(col.id),
        name:        col.label || ("Offer " + col.id),
        clicks:      row.reporting?.total_click || 0,
        leads:       cv,
        payout:      cv > 0 ? +(rev / cv).toFixed(2) : 0,
        status:      "active",
      };
    }).filter(Boolean);

    // Save to DB in batches of 200
    toast("⟳ Saving " + allOffers.length + " unique offers…", "ok");
    let totalImported = 0, totalUpdated = 0;

    for (let i = 0; i < allOffers.length; i += 200) {
      const batch = allOffers.slice(i, i + 200);
      const r = await fetch("/api/ai/bulk-import", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ sponsor_id: sponsorId, offers: batch }),
      });
      const result = await r.json();
      totalImported += result.imported || 0;
      totalUpdated  += result.updated  || 0;
    }

    // Cleanup expired offers (not in latest import)
    const activeIds = allOffers.map(o => o.external_id);
    await fetch("/api/ai/cleanup-offers", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ sponsor_id: sponsorId, active_ids: activeIds }),
    });

    toast("✓ " + sponsorName + ": " + totalImported + " new + " + totalUpdated + " updated (" + allOffers.length + " active)", "ok");

  } catch (e) {
    toast("Error: " + e.message, "err");
  }
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
function SettingsPage({ user, toast, onLogout }) {
  const [sponsors, setSponsors] = useState([]);
  const [keys, setKeys] = useState({});
  const [testRes, setTestRes] = useState({});
  const [invite, setInvite] = useState({ email:"", name:"", password:"", role:"viewer" });
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.getSponsors().then(r=>setSponsors(r.sponsors)).catch(()=>{});
    if (user.role==="admin")
      api.getUsers().then(r=>setUsers(r.users)).catch(()=>{});
  }, [user.role]);

  const saveKey = async (id) => {
    if (!keys[id]) return;
    try { await api.updateSponsor(id, {api_key: keys[id]}); toast("Key saved ✓", "ok"); }
    catch(e) { toast(e.message, "err"); }
  };

  const testConn = async (sp) => {
    setTestRes(p=>({...p,[sp.id]:"loading"}));
    try {
      const r = await api.testSponsor(sp.id);
      setTestRes(p=>({...p,[sp.id]:r.ok?"ok":"fail:"+r.message}));
    } catch(e) { setTestRes(p=>({...p,[sp.id]:"fail:"+e.message})); }
  };

  const doInvite = async () => {
    try { await api.inviteUser(invite); toast("User invited ✓","ok"); api.getUsers().then(r=>setUsers(r.users)); }
    catch(e) { toast(e.message,"err"); }
  };

  return (
    <>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        <div className="sec-title" style={{marginBottom:0}}>API Integrations</div>
        <button className="btn btn-danger btn-sm" onClick={onLogout}>⏻ Logout ({user.email})</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(310px,1fr))",gap:14,marginBottom:28}}>
        {sponsors.map(sp=>(
          <div className="api-card" key={sp.id} style={{borderLeft:`2px solid ${sp.color||"var(--green)"}`}}>
            <div className="api-card-name">{sp.name}</div>
            <div className="api-card-url">{sp.base_url}</div>
            <div style={{fontFamily:"var(--font-mono)",fontSize:9,color:"var(--text2)",textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>API Key</div>
            <div className="api-key-row">
              <input className="api-key-inp" type="password" placeholder={sp.hasKey?"••••••••[saved]":"Paste key…"} value={keys[sp.id]||""} onChange={e=>setKeys(p=>({...p,[sp.id]:e.target.value}))} data-spid={sp.id}/>
              <button className="btn btn-sm" onClick={()=>saveKey(sp.id)} disabled={!keys[sp.id]}>Save</button>
              <button className="btn btn-sm" onClick={()=>testConn(sp)}>Test</button>
              <a href={sp.base_url} target="_blank" rel="noreferrer" className="btn btn-sm">↗</a>
            </div>
            {testRes[sp.id] && (
              <div className={`test-result ${testRes[sp.id]==="loading"?"test-loading":testRes[sp.id]==="ok"?"test-ok":"test-fail"}`}>
                {testRes[sp.id]==="loading"?"⟳ Testing…":testRes[sp.id]==="ok"?"✓ Connection OK!":"✕ "+testRes[sp.id].replace("fail:","")}
              </div>
            )}
            <div style={{marginTop:8,display:"flex",gap:8}}>
              <span className={`badge badge-${sp.status}`}>{sp.status}</span>
              <span style={{fontFamily:"var(--font-mono)",fontSize:9,color:"var(--text2)"}}>{sp.platform} · {sp.hasKey?"🔑 key set":"⚠ no key"}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Import ALL offers including Action Required */}
      <div className="sec-title" style={{marginTop:8}}>Import All Offers (including Action Required)</div>
      <div className="card" style={{marginBottom:24}}>
        <div style={{padding:16}}>
          <div style={{background:"rgba(0,255,157,.06)",border:"1px solid rgba(0,255,157,.15)",borderRadius:6,padding:"9px 12px",fontSize:11,color:"var(--green)",marginBottom:14,lineHeight:1.8}}>
            💡 <strong>3 steps</strong> bax tjib kol offers (including Action Required):<br/>
            1️⃣ Fto7 Everflow dashboard f tab jdid<br/>
            2️⃣ Copy o paste had script f Console dyalu<br/>
            3️⃣ Kolchi kayimport automatiquement ✅
          </div>

          {/* Script to copy */}
          {sponsors.filter(s=>s.hasKey).map(sp=>(
            <div key={sp.id} style={{marginBottom:16,padding:12,background:"var(--bg3)",borderRadius:8,border:"1px solid var(--border)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontWeight:700,fontSize:13}}>{sp.name}</span>
                <button className="btn btn-sm btn-primary" onClick={async()=>{
                  const script = `(async()=>{
const token="${localStorage.getItem("affplatform_token")}";
const spId="${sp.id}";
const offers=[];let page=1;
while(true){
  const r=await fetch("https://api.eflow.team/v1/affiliates/offers?page="+page+"&page_size=100&relationship=all",{headers:{"X-Eflow-API-Key":document.cookie.match(/api_key=([^;]+)/)?.[1]||prompt("Paste API key:")||"","Accept":"application/json"}});
  const d=await r.json();
  if(!d.offers?.length)break;
  d.offers.forEach(o=>offers.push({external_id:String(o.network_offer_id||o.id),name:o.name||o.offer_name,payout:o.default_goal_name?0:0,status:"active"}));
  if(d.offers.length<100)break;page++;
}
const res=await fetch("http://localhost:4000/api/ai/bulk-import",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({sponsor_id:spId,offers})});
const result=await res.json();
alert("✓ "+result.imported+" new + "+result.updated+" updated ("+offers.length+" total)");
})();`;
                  await navigator.clipboard.writeText(script);
                  toast("✓ Script copied! Paste f Everflow Console", "ok");
                }}>📋 Copy Script</button>
              </div>
              <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)",lineHeight:1.6}}>
                → Fto7 <a href={sp.base_url} target="_blank" rel="noreferrer" style={{color:"var(--cyan)"}}>{sp.base_url}</a><br/>
                → F12 → Console → Paste script → Enter
              </div>
            </div>
          ))}

          <div style={{marginTop:4,padding:"10px 12px",background:"rgba(0,207,255,.05)",borderRadius:6,border:"1px solid rgba(0,207,255,.1)",fontSize:11,color:"var(--cyan)"}}>
            💡 Wela: Import from Sponsors button f AI Finder kayjib offers lli 3andhom activity (238)
          </div>
        </div>
      </div>

      {user.role === "admin" && (
        <>
          <div className="sec-title">Team Management</div>
          <div className="grid-2">
            <div className="card">
              <div className="card-head"><span className="card-title">Invite Member</span></div>
              <div style={{padding:16}}>
                <div className="form-group"><label className="form-label">Name</label><input className="form-input" placeholder="John" value={invite.name} onChange={e=>setInvite(p=>({...p,name:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" placeholder="john@example.com" value={invite.email} onChange={e=>setInvite(p=>({...p,email:e.target.value}))}/></div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" placeholder="••••••" value={invite.password} onChange={e=>setInvite(p=>({...p,password:e.target.value}))}/></div>
                  <div className="form-group"><label className="form-label">Role</label>
                    <select className="form-input" value={invite.role} onChange={e=>setInvite(p=>({...p,role:e.target.value}))}>
                      <option value="viewer">viewer</option><option value="editor">editor</option><option value="admin">admin</option>
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={doInvite}>Send Invite</button>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><span className="card-title">Team Members ({users.length})</span></div>
              <div style={{padding:"10px 0"}}>
                {users.map(u=>(
                  <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 16px",borderBottom:"1px solid var(--border)"}}>
                    <div className="avatar" style={{width:24,height:24,fontSize:10}}>{u.name[0]}</div>
                    <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{u.name}</div><div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)"}}>{u.email}</div></div>
                    <span className="badge" style={{background:"var(--bg3)"}}>{u.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="sec-title" style={{marginTop:24}}>VPS Deployment</div>
          <div className="card">
            <div style={{padding:20,fontFamily:"var(--font-mono)",fontSize:11,lineHeight:1.9}}>
              <div style={{color:"var(--text2)",marginBottom:10,fontSize:9,textTransform:"uppercase",letterSpacing:.8}}>Commands (run on VPS)</div>
              {[
                "# 1. Clone project",
                "git clone https://github.com/yourname/affplatform.git && cd affplatform",
                "",
                "# 2. Backend setup",
                "cd backend && npm install",
                "cp .env.example .env   # Edit with your secrets",
                "npm run seed           # Initialize database",
                "npm start              # Or: pm2 start src/server.js --name affbackend",
                "",
                "# 3. Frontend setup",
                "cd ../frontend && npm install",
                "cp .env.example .env   # Set VITE_API_URL=https://yourserver.com/api",
                "npm run build          # Output: dist/",
                "",
                "# 4. Serve frontend (nginx or)",
                "npm install -g serve && serve -s dist -l 3000",
              ].map((cmd,i)=>cmd===""?<br key={i}/>:(
                <div key={i} style={{background:cmd.startsWith("#")?"transparent":"var(--bg3)",borderRadius:4,padding:cmd.startsWith("#")?"2px 0":"5px 10px",marginBottom:3,color:cmd.startsWith("#")?"var(--text2)":"var(--green)"}}>{cmd}</div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}


// ─── AI PAGE ──────────────────────────────────────────────────────────────────
function AIPage({ toast }) {
  const [data,    setData]    = useState(null);
  const [scaling, setScaling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [target,  setTarget]  = useState("1000");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rec, sc] = await Promise.all([
        api.aiRecommendations(10),
        api.aiScaling(parseFloat(target) || 1000),
      ]);
      setData(rec);
      setScaling(sc);
    } catch (e) { toast(e.message, "err"); }
    finally { setLoading(false); }
  }, [target]);

  useEffect(() => { load(); }, []);

  const syncOffers = async () => {
    setSyncing(true);
    try {
      const r = await api.syncOffers();
      toast(`✓ ${r.totalImported} new offers imported`, "ok");
      load();
    } catch (e) { toast(e.message, "err"); }
    finally { setSyncing(false); }
  };

  const recColors = ["var(--green)","var(--cyan)","var(--orange)","var(--purple)","var(--red)"];

  return (
    <>
      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:18,flexWrap:"wrap"}}>
        <div className="sec-title" style={{marginBottom:0,flex:1}}>🤖 AI Offer Finder</div>
        <button className="btn btn-sm" onClick={syncOffers} disabled={syncing}>
          {syncing ? "⟳ Importing…" : "📋 Import Offers from Sponsors"}
        </button>
        <button className="btn btn-primary btn-sm" onClick={load} disabled={loading}>
          {loading ? "⟳ Analyzing…" : "⚡ Refresh Analysis"}
        </button>
      </div>

      {/* Insights */}
      {data?.insights && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:12,marginBottom:22}}>
          {[
            { label:"Total Offers",   value:data.insights.totalOffers,          sub:"across all sponsors",  color:"var(--cyan)"   },
            { label:"Strong Buys",    value:data.insights.strongBuys,           sub:"high-performance",     color:"var(--green)"  },
            { label:"Avg Payout",     value:`$${data.insights.avgPayout}`,       sub:"per conversion",       color:"var(--orange)" },
            data.insights.bestVertical && { label:"Best Vertical", value:data.insights.bestVertical.name, sub:`avg score ${data.insights.bestVertical.avgScore}`, color:"var(--purple)" },
            data.insights.topOffer    && { label:"🏆 Top Offer",   value:data.insights.topOffer.name,     sub:`Score ${data.insights.topOffer.score} · $${data.insights.topOffer.payout}`, color:"var(--green)", small:true },
          ].filter(Boolean).map((item,i) => (
            <div key={i} style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 16px",borderTop:`2px solid ${item.color}`}}>
              <div style={{fontFamily:"var(--font-mono)",fontSize:9,color:"var(--text2)",textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>{item.label}</div>
              <div style={{fontSize:item.small?13:22,fontWeight:900,color:item.color,fontFamily:"var(--font-mono)",letterSpacing:-0.5,marginBottom:4}}>{item.value}</div>
              <div style={{fontSize:10,color:"var(--text3)"}}>{item.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Auto-scaling plan */}
      {scaling?.plan?.length > 0 && (
        <div className="card mb-6">
          <div className="card-head">
            <span className="card-title">⚡ Auto-Scaling Plan</span>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)"}}>Target $</span>
              <input style={{width:80,background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:5,padding:"4px 8px",color:"var(--text)",fontFamily:"var(--font-mono)",fontSize:11,outline:"none"}}
                value={target} onChange={e=>setTarget(e.target.value)} onBlur={load}/>
              <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)"}}>Total budget: <strong style={{color:"var(--green)"}}>${scaling.total_budget}</strong></span>
            </div>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Offer</th><th>Sponsor</th><th>Payout</th><th>Score</th><th>Budget</th><th>Exp. Leads</th><th>Exp. Revenue</th></tr></thead>
              <tbody>
                {scaling.plan.map((p,i) => (
                  <tr key={i}>
                    <td style={{fontWeight:600,fontSize:12}}>{p.offer}</td>
                    <td style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--text2)"}}>{p.sponsor}</td>
                    <td><span className="payout-v">${p.payout}</span></td>
                    <td><span style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--green)"}}>{p.score}</span></td>
                    <td className="mono">${p.suggested_budget}</td>
                    <td className="mono">{p.expected_leads}</td>
                    <td className="mono" style={{color:"var(--green)",fontWeight:700}}>${p.expected_revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="sec-title">AI Recommendations</div>
      {loading && <div className="loader">⟳ Analyzing offers…</div>}
      {!loading && data?.recommendations?.length === 0 && (
        <div style={{background:"rgba(255,159,10,.08)",border:"1px solid rgba(255,159,10,.2)",borderRadius:8,padding:"12px 16px",color:"var(--orange)",fontSize:12,marginBottom:16}}>
          ⚠ No offers found. Click "Import Offers from Sponsors" to get started.
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
        {(data?.recommendations || []).map((o, i) => {
          const ac = recColors[i % recColors.length];
          const bgMap = {"STRONG BUY":"rgba(0,255,157,.08)","BUY":"rgba(0,207,255,.08)","WATCH":"rgba(255,159,10,.08)","LOW PRIORITY":"rgba(255,69,58,.06)"};
          const clrMap = {"STRONG BUY":"var(--green)","BUY":"var(--cyan)","WATCH":"var(--orange)","LOW PRIORITY":"var(--red)"};
          const recColor = clrMap[o.recommendation] || "var(--green)";
          const recBg    = bgMap[o.recommendation]  || "rgba(0,255,157,.08)";
          return (
            <div key={o.id} style={{background:"var(--bg2)",border:`1px solid var(--border)`,borderRadius:10,padding:16,borderLeft:`3px solid ${ac}`,position:"relative"}}>
              {/* Score badge */}
              <div style={{position:"absolute",top:12,right:12,background:recBg,color:recColor,fontFamily:"var(--font-mono)",fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:5,border:`1px solid ${recColor}33`}}>
                {o.recommendation}
              </div>
              {/* Score number */}
              <div style={{position:"absolute",top:36,right:14,fontFamily:"var(--font-mono)",fontSize:20,fontWeight:900,color:ac,opacity:.15}}>{o.score}</div>

              <div style={{fontSize:13,fontWeight:700,marginBottom:4,paddingRight:90}}>{o.name}</div>
              <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:o.sponsor_color||"var(--text2)",marginBottom:8}}>
                {o.sponsor_name} · <span style={{color:"var(--text2)"}}>ID: {o.external_id}</span>
              </div>
              <div style={{fontSize:10,color:"var(--text3)",marginBottom:10,lineHeight:1.6}}>
                {o.reasons.join(" · ")}
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[
                  {label:"Payout", val:`$${o.payout}`, color:"var(--green)"},
                  {label:"CR",     val:o.cr,            color:"var(--cyan)"},
                  {label:"Leads",  val:o.leads,         color:"var(--text)"},
                  {label:"Rev",    val:`$${o.est_revenue}`, color:"var(--green)"},
                ].map((m,j) => (
                  <div key={j} style={{background:"var(--bg3)",borderRadius:5,padding:"3px 8px",fontFamily:"var(--font-mono)",fontSize:10}}>
                    {m.label} <strong style={{color:m.color}}>{m.val}</strong>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const VALID_PAGES = ["dashboard","sponsors","offers","tracking","ai","settings"];
  function pageFromPath() {
    const p = window.location.pathname.replace(/^\//, "").split("/")[0];
    return VALID_PAGES.includes(p) ? p : "dashboard";
  }

  const [user,        setUser]        = useState(null);
  const [page,        setPage]        = useState(pageFromPath);
  const [time,        setTime]        = useState(new Date());
  const [liveEvents,  setLiveEvents]  = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [toast,       setToastMsg]    = useState(null);
  const wsRef = useRef(null);

  // URL popstate (browser back/forward)
  useEffect(() => {
    const onPop = () => setPage(pageFromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Check existing token
  useEffect(() => {
    const token = localStorage.getItem("affplatform_token");
    if (token) {
      api.me().then(r => setUser(r.user)).catch(() => localStorage.removeItem("affplatform_token"));
    }
  }, []);

  // Clock
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const [notifications, setNotifications] = useState([]);
  const [showNotifs,    setShowNotifs]    = useState(false);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [sponsorStats,  setSponsorStats]  = useState({});

  // Request desktop notification permission on login
  useEffect(() => { if (user) requestNotificationPermission(); }, [user]);

  // WebSocket
  useEffect(() => {
    if (!user) return;
    wsRef.current = createWS((msg) => {
      if (msg.type === "connected") { setWsConnected(true); return; }

      // Live event (click/lead)
      if (msg.type === "new_event") {
        setLiveEvents(p => [msg.event, ...p.slice(0, 29)]);
      }

      // Sponsor stats updated (from auto-sync) — refresh dashboard
      if (msg.type === "sponsor_updated" || msg.type === "dashboard_refresh") {
        setSponsorStats(p => ({ ...p, ...(msg.sponsorId ? {[msg.sponsorId]: msg.data} : {}) }));
        // Dispatch custom event so DashboardPage can listen
        window.dispatchEvent(new CustomEvent("affplatform_ws", { detail: msg }));
      }

      // New lead detected!
      if (msg.type === "new_lead") {
        const notif = {
          id: Date.now(),
          title: `💰 New Lead — ${msg.sponsorName}`,
          body: `${msg.count} lead${msg.count > 1 ? "s" : ""} · +$${Number(msg.revenue).toFixed(2)}`,
          color: msg.sponsorColor || "#00ff9d",
          time: new Date().toLocaleTimeString(),
          sponsorId: msg.sponsorId,
        };
        setNotifications(p => [notif, ...p.slice(0, 49)]);
        setUnreadCount(p => p + 1);
        // Desktop notification
        sendNotification(notif.title, notif.body, notif.color);
      }

      // Offers synced
      if (msg.type === "offers_synced") {
        showToast(`📋 ${msg.totalImported} new offers imported`, "ok");
      }
    });
    return () => { wsRef.current?.close(); setWsConnected(false); };
  }, [user]);

  const showToast = useCallback((msg, type = "ok") => {
    setToastMsg({ msg, type, key: Date.now() });
  }, []);

  const logout = () => {
    localStorage.removeItem("affplatform_token");
    wsRef.current?.close();
    setUser(null); setLiveEvents([]); setWsConnected(false);
  };

  if (!user) return (
    <>
      <style>{CSS}</style>
      <LoginPage onLogin={setUser}/>
    </>
  );

  const nav = [
    { id:"dashboard", label:"Dashboard", icon:"▦" },
    { id:"sponsors",  label:"Sponsors",  icon:"⬡" },
    { id:"offers",    label:"Offers",    icon:"≡" },
    { id:"tracking",  label:"Tracking",  icon:"◈" },
    { id:"ai",        label:"AI Finder",  icon:"✦" },
    { id:"settings",  label:"Settings",  icon:"◎" },
  ];
  const titles = { dashboard:"Overview Dashboard", sponsors:"Sponsor Management", offers:"Offers & IDs", tracking:"Live Tracking", ai:"AI Offer Finder", settings:"Settings & API Keys" };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="logo-wrap"><div className="logo"><em>Aff</em>Intel</div><div className="logo-tag">AFFILIATE PLATFORM v3</div></div>
          <nav className="nav">
            <div className="nav-sec">Navigation</div>
            {nav.map(n=>(
              <div key={n.id} className={`nav-item${page===n.id?" active":""}`} onClick={()=>{ setPage(n.id); window.history.pushState({}, "", "/" + n.id); }}>
                <span style={{width:18,textAlign:"center"}}>{n.icon}</span>{n.label}
                {n.id==="tracking" && liveEvents.length>0 && <span className="nav-badge">{liveEvents.length}</span>}
              </div>
            ))}
          </nav>
          <div className="sidebar-foot">
            <div className="sync-row"><span className="pulse"/>{wsConnected ? "WS connected" : "WS offline"}</div>
            <div className="user-row">
              <div className="avatar">{user.name[0]}</div>
              <div><div className="user-name">{user.name}</div><div className="user-role">{user.role.toUpperCase()}</div></div>
            </div>
          </div>
        </aside>
        <div className="main">
          <div className="topbar">
            <div className="topbar-title">{titles[page]}</div>
            <span className={`ws-dot ${wsConnected?"ws-on":"ws-off"}`} title={wsConnected?"WebSocket live":"WebSocket offline"}/>
            <div className="topbar-clock">{time.toLocaleDateString()} · {time.toLocaleTimeString()}</div>
            {/* Notification Bell */}
            <div className="notif-bell" style={{position:"relative"}} onClick={()=>{setShowNotifs(p=>!p);setUnreadCount(0);}}>
              <button className="btn btn-sm" style={{fontSize:16,padding:"5px 10px"}}>🔔</button>
              {unreadCount > 0 && <span className="notif-count">{unreadCount}</span>}
              {showNotifs && (
                <div className="notif-panel" onClick={e=>e.stopPropagation()}>
                  <div className="notif-head">
                    Notifications ({notifications.length})
                    <button className="btn btn-sm" style={{fontSize:10}} onClick={()=>{setNotifications([]);setShowNotifs(false);}}>Clear</button>
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0
                      ? <div className="notif-empty">No notifications yet</div>
                      : notifications.map(n => (
                        <div className="notif-item" key={n.id}>
                          <div className="notif-dot" style={{background:n.color}}/>
                          <div className="notif-body">
                            <div className="notif-title">{n.title}</div>
                            <div style={{fontSize:11,color:"var(--text3)",marginBottom:2}}>{n.body}</div>
                            <div className="notif-time">{n.time}</div>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="content">
            {page==="dashboard" && <DashboardPage/>}
            {page==="sponsors"  && <SponsorsPage  toast={showToast}/>}
            {page==="offers"    && <OffersPage    toast={showToast}/>}
            {page==="tracking"  && <TrackingPage  liveEvents={liveEvents} wsConnected={wsConnected}/>}
            {page==="ai"        && <AIPage        toast={showToast}/>}
        {page==="settings"  && <SettingsPage  user={user} toast={showToast} onLogout={logout}/>}
          </div>
        </div>
      </div>
      {toast && <Toast key={toast.key} msg={toast.msg} type={toast.type} onClose={()=>setToastMsg(null)}/>}
    </>
  );
}
