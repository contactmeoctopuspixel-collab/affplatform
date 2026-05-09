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
  --text:#e2e8f0;--text2:#8892b0;--text3:#a8b2d0;
  --green:#00ff9d;--cyan:#00cfff;--orange:#ff9f0a;--purple:#bf5af2;--red:#ff453a;
  --green-dim:rgba(0,255,157,.12);--cyan-dim:rgba(0,207,255,.1);--orange-dim:rgba(255,159,10,.1);--purple-dim:rgba(191,90,242,.1);
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

/* Notification Panel */
.notif-bell{position:relative;}
.notif-count{position:absolute;top:-4px;right:-4px;background:var(--red);color:#fff;font-family:var(--font-mono);font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px;min-width:16px;text-align:center;line-height:1.4;border:2px solid var(--bg2);}
.notif-panel{position:absolute;top:44px;right:0;width:360px;max-height:480px;background:var(--bg2);border:1px solid var(--border2);border-radius:12px;box-shadow:0 12px 48px rgba(0,0,0,.6);z-index:100;overflow:hidden;animation:slideIn .2s ease;}
.notif-head{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;}
.notif-list{max-height:400px;overflow-y:auto;padding:0;}
.notif-empty{padding:30px;text-align:center;font-size:11px;color:var(--text2);}
.notif-item{display:flex;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);transition:background .1s;}
.notif-item:hover{background:rgba(255,255,255,.018);}
.notif-item:last-child{border-bottom:none;}
.notif-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px;}
.notif-body{flex:1;min-width:0;}
.notif-title{font-size:12px;font-weight:700;margin-bottom:2px;}
.notif-time{font-family:var(--font-mono);font-size:9px;color:var(--text2);margin-top:2px;}

/* Stat card hover */
.stat-card{transition:transform .2s,box-shadow .2s!important;}
.stat-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.3);}

/* ── CHAT ────────────────────────────────────────────────────────────────────── */
.chat-layout{display:flex;background:var(--bg2)!important;}
.chat-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}
.chat-bubble{
  width: fit-content;
  min-width: 50px;
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 13.5px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-wrap: break-word;
}
.chat-bubble.mine{align-self:flex-end;background:rgba(0,255,157,.12);border:1px solid rgba(0,255,157,.2);border-bottom-right-radius:3px;}
.chat-bubble.theirs{align-self:flex-start;background:var(--bg3);border:1px solid var(--border);border-bottom-left-radius:3px;}
.chat-meta{font-family:var(--font-mono);font-size:9px;color:var(--text2);margin-bottom:3px; opacity: 0.75;}
.chat-input-row{display:flex;gap:10px;padding:12px;border-top:1px solid var(--border);background:var(--bg2);}
.chat-input{flex:1;background:var(--bg3);border:1px solid var(--border2);border-radius:10px;padding:10px 14px;color:var(--text);font-family:var(--font-body);font-size:13px;outline:none;resize:none;transition: border-color .2s;}
.chat-input:focus{border-color:var(--green);}

/* ── AI SUGGESTIONS ──────────────────────────────────────────────────────────── */
.suggest-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-top:12px;}
.suggest-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;position:relative;overflow:hidden;}
.suggest-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;}
.suggest-hot::before{background:linear-gradient(90deg,var(--red),var(--orange));}
.suggest-rising::before{background:linear-gradient(90deg,var(--cyan),var(--green));}
.suggest-untapped::before{background:linear-gradient(90deg,var(--purple),var(--cyan));}
.suggest-label{font-family:var(--font-mono);font-size:9px;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;}
.suggest-name{font-size:13px;font-weight:700;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.suggest-reason{font-size:11px;color:var(--text3);line-height:1.5;}
.suggest-metrics{display:flex;gap:10px;margin-top:10px;font-family:var(--font-mono);font-size:10px;}
.suggest-metric{background:var(--bg3);border-radius:5px;padding:4px 8px;color:var(--text2);}
.suggest-metric strong{color:var(--text);}

/* ── CHAT ─ explicit backgrounds ────────────────────────────────────────────── */
.chat-wrap{background:var(--bg2)!important;}
.chat-messages{background:var(--bg);}

/* ── HAMBURGER / MOBILE NAV DROPDOWN ─────────────────────────────────────────── */
.hamburger{display:none;background:none;border:1px solid var(--border);border-radius:6px;cursor:pointer;padding:5px 9px;color:var(--text);font-size:20px;line-height:1;flex-shrink:0;}

/* LEFT SIDE DRAWER */
.drawer-backdrop{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:299;backdrop-filter:blur(2px);}
.drawer-backdrop.open{display:block;}
.sidebar-drawer{
  position:fixed;left:0;top:0;bottom:0;width:270px;
  background:var(--bg2);border-right:1px solid var(--border2);
  z-index:300;display:flex;flex-direction:column;
  transform:translateX(-100%);transition:transform .25s ease;
  box-shadow:12px 0 40px rgba(0,0,0,.5);
}
.sidebar-drawer.open{transform:translateX(0);}
.drawer-head{padding:16px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
.drawer-logo{font-size:16px;font-weight:900;}.drawer-logo em{color:var(--green);font-style:normal;}
.drawer-close{background:none;border:none;color:var(--text2);font-size:20px;cursor:pointer;padding:4px;}
/* 2-column horizontal grid of nav items inside drawer */
.drawer-nav-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;padding:12px;}
.drawer-nav-btn{
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:6px;padding:16px 8px;border-radius:10px;cursor:pointer;
  font-size:11px;font-weight:700;color:var(--text2);
  background:var(--bg3);border:1px solid var(--border);transition:all .12s;
}
.drawer-nav-btn .nav-icon{font-size:26px;line-height:1;}
.drawer-nav-btn:hover{color:var(--text);background:var(--bg4);border-color:var(--border2);}
.drawer-nav-btn.active{color:var(--green);background:rgba(0,255,157,.08);border-color:rgba(0,255,157,.25);}
.drawer-nav-btn.active .nav-icon{filter:drop-shadow(0 0 6px var(--green));}
.drawer-user{padding:12px 14px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px;margin-top:auto;}


/* ── MOBILE RESPONSIVE ──────────────────────────────────────────────────────── */
@media(max-width:768px){
  /* Layout: sidebar becomes bottom nav */
  .app{flex-direction:column;}
  .sidebar{
    width:100%;min-width:unset;height:auto;
    border-right:none;border-top:1px solid var(--border);
    flex-direction:row;align-items:center;
    position:fixed;bottom:0;left:0;right:0;z-index:100;
    order:2;overflow-x:auto;overflow-y:hidden;
    background:var(--bg2);
  }
  .main{order:1;padding-bottom:72px;}
  .content{padding:14px 14px;}

  /* Hide sidebar logo + footer on mobile (shown in drawer instead) */
  .logo-wrap{display:none;}
  .sidebar-foot{display:none;}

  /* Show hamburger */
  .hamburger{display:flex;align-items:center;justify-content:center;}

  /* Nav: horizontal bottom bar */
  .nav{display:flex;flex-direction:row;padding:0;flex:1;overflow-x:auto;overflow-y:hidden;}
  .nav-sec{display:none;}
  .nav-item{
    flex-direction:column;gap:4px;padding:10px 12px;min-width:64px;
    font-size:10px;font-weight:600;
    border-left:none;border-top:2px solid transparent;
    justify-content:center;align-items:center;
    white-space:nowrap;
  }
  .nav-item .nav-icon{font-size:20px;line-height:1;}
  .nav-item.active{border-top-color:var(--green);border-left-color:transparent;color:var(--green);}
  .nav-item.active .nav-icon{filter:drop-shadow(0 0 4px var(--green));}
  .nav-badge{margin-left:0;margin-top:2px;font-size:8px;padding:1px 4px;}

  /* Topbar */
  .topbar{padding:0 12px;height:50px;gap:10px;}
  .topbar-clock{display:none;}
  .topbar-title{font-size:13px;}

  /* Stats grid: 2 columns */
  .stats-grid{grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;}
  .stat-val{font-size:20px;}
  .stat-card{padding:13px 14px;}

  /* Charts: 1 column */
  .grid-2{grid-template-columns:1fr;gap:12px;}
  .grid-3{grid-template-columns:1fr;gap:12px;}

  /* Sponsor cards: 1 column */
  .sp-grid{grid-template-columns:1fr;}

  /* Tables: scroll horizontally, smaller text */
  .tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  table{font-size:11px;min-width:480px;}
  thead th{padding:7px 10px;font-size:8px;}
  td{padding:8px 10px;}

  /* Modal full width */
  .modal{width:95vw;padding:18px;}
  .form-row{grid-template-columns:1fr;}

  /* Search input full width */
  .search-input{width:100%;}

  /* Sec title wrapping */
  .sec-title{flex-wrap:wrap;gap:8px;}

  /* Toast bottom offset for nav */
  .toast{bottom:80px;right:12px;left:12px;max-width:unset;}

  /* Card head wrapping */
  .card-head{flex-wrap:wrap;gap:6px;}

  /* Sponsor breakdown grid */
  div[style*="repeat(auto-fill,minmax(200px"]{
    grid-template-columns:repeat(2,1fr)!important;
    gap:10px!important;
  }

  /* Chat full height on mobile */
  .chat-wrap{height:calc(100vh - 180px);}
  .suggest-grid{grid-template-columns:1fr;}
}

@media(max-width:400px){
  .stats-grid{grid-template-columns:1fr 1fr;gap:8px;}
  .content{padding:10px 10px;}
  .nav-item{padding:8px 8px;min-width:56px;}
  .nav-item .nav-icon{font-size:18px;}
}
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
  const [email, setEmail] = useState("");
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
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardPage() {
  const [data,        setData]        = useState(null);
  const [subData,     setSubData]     = useState(null);
  const [geoData,     setGeoData]     = useState(null);
  const [subSyncing,  setSubSyncing]  = useState(false);
  const [subSyncMsg,  setSubSyncMsg]  = useState("");
  const [subSyncInfo, setSubSyncInfo] = useState(null);
  const [err,         setErr]         = useState("");
  const [lastUpdate,  setLastUpdate]  = useState(null);
  const [pulse,       setPulse]       = useState(false);
  const [dateFrom,    setDateFrom]    = useState(() => new Date().toISOString().slice(0,10));
  const [dateTo,      setDateTo]      = useState(() => new Date().toISOString().slice(0,10));
  const [periodLabel, setPeriodLabel] = useState("Today");
  const [activePreset, setActivePreset] = useState("today");
  const [filterSponsor, setFilterSponsor] = useState("");
  const [sponsors,    setSponsors]    = useState([]);

  const PRESETS = [
    { id:"today",     label:"Today",        days:0 },
    { id:"yesterday", label:"Yesterday",    days:1, yesterday:true },
    { id:"7d",        label:"Last 7 Days",  days:6 },
    { id:"mtd",       label:"MTD",          month:true },
    { id:"custom",    label:"Custom Range", custom:true },
  ];

  const applyPreset = (p) => {
    const today = new Date();
    const fmt = d => d.toISOString().slice(0,10);
    if (p.yesterday) {
      const y = new Date(); y.setDate(y.getDate()-1);
      setDateFrom(fmt(y)); setDateTo(fmt(y));
      setPeriodLabel("Yesterday");
    } else if (p.month) {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(fmt(start)); setDateTo(fmt(today));
      setPeriodLabel("Month to Date");
    } else if (p.custom) {
      return;
    } else {
      const from = new Date(); from.setDate(from.getDate() - p.days);
      setDateFrom(fmt(from)); setDateTo(fmt(today));
      setPeriodLabel(p.label);
    }
    setActivePreset(p.id);
  };

  const load = useCallback(async () => {
    try {
      // Calculate previous period for trend comparison
      const rangeMs = new Date(dateTo).getTime() - new Date(dateFrom).getTime();
      const prevTo = new Date(new Date(dateFrom).getTime() - 1).toISOString().slice(0, 10);
      const prevFrom = new Date(new Date(dateFrom).getTime() - rangeMs).toISOString().slice(0, 10);

      const [d, sub, syncInfo, sp, geo, prevDash] = await Promise.all([
        api.dashboard(dateFrom, dateTo),
        api.subAffiliates(dateFrom, dateTo).catch(() => null),
        api.convSyncStatus().catch(() => null),
        api.getSponsors().catch(() => ({ sponsors: [] })),
        api.geoDistribution(dateFrom, dateTo).catch(() => null),
        api.dashboard(prevFrom, prevTo).catch(() => null),
      ]);

      setData(d);
      setSponsors(sp.sponsors || []);
      if (sub) setSubData(sub);
      if (geo) setGeoData(geo);
      if (syncInfo) setSubSyncInfo(syncInfo);

      // Calculate trends
      if (d && prevDash) {
        const cur = d.kpis;
        const prev = prevDash.kpis;
        d.trends = {
          revenue: prev.totalRevenue > 0 ? ((cur.totalRevenue - prev.totalRevenue) / prev.totalRevenue * 100) : 0,
          clicks:  prev.totalClicks  > 0 ? ((cur.totalClicks  - prev.totalClicks)  / prev.totalClicks  * 100) : 0,
          leads:   prev.totalLeads   > 0 ? ((cur.totalLeads   - prev.totalLeads)   / prev.totalLeads   * 100) : 0,
          sponsors: 0,
        };
      }

      setLastUpdate(new Date());
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    } catch (e) { setErr(e.message); }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  // Listen to WebSocket for live updates
  useEffect(() => {
    const handler = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "dashboard_refresh" || msg.type === "sponsor_updated") {
          load();
        }
      } catch {}
    };
    window.addEventListener("affplatform_ws", handler);
    return () => window.removeEventListener("affplatform_ws", handler);
  }, [load]);

  if (err)   return <div className="err-box">⚠ {err} — Is the backend running?</div>;
  if (!data) return <div className="loader">⟳ Loading dashboard…</div>;

  const { kpis, weeklyChart, topOffers, sponsorBreakdown, trends, dateRange } = data;

  const chart = weeklyChart.map(r => ({
    day:     r.date?.slice(5) || r.date,
    revenue: +Number(r.revenue).toFixed(2),
    clicks:  r.clicks,
    leads:   r.leads,
  }));

  return (
    <>
      {/* ── TOP BAR: Title + Time + Live ───────────────────────────────────── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span className="topbar-title" style={{fontSize:16,fontWeight:800,position:"static"}}>Overview Dashboard</span>
          <span style={{width:7,height:7,borderRadius:"50%",background:"var(--green)",display:"inline-block",animation:"pulse 2s infinite"}}/>
          <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)"}}>LIVE</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)"}}>
            {lastUpdate?.toLocaleDateString()} - {lastUpdate?.toLocaleTimeString() || "—"}
          </span>
        </div>
      </div>

      {/* ── TIME RANGE TOGGLES ────────────────────────────────────────────── */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {PRESETS.map(p => (
          <button key={p.id}
            className="btn btn-sm"
            style={activePreset === p.id ? {background:"var(--green)",color:"var(--bg)",borderColor:"var(--green)",fontWeight:700} : {}}
            onClick={() => applyPreset(p)}
          >{p.label}</button>
        ))}
        <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)",marginLeft:4}}>
          {dateFrom} ~ {dateTo}
        </span>
        {/* Sponsor filter */}
        <select className="form-input" style={{width:180,marginLeft:"auto",padding:"5px 10px",fontSize:11}}
          value={filterSponsor} onChange={e => setFilterSponsor(e.target.value)}>
          <option value="">All Sponsors</option>
          {sponsors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn btn-sm btn-primary" onClick={load}>Apply Filters</button>
      </div>

      {/* ── KPI CARDS with Trends ─────────────────────────────────────────── */}
      <div className="stats-grid mb-6">
        {[
          { label:"Total Revenue",   value:`$${Number(kpis.totalRevenue).toLocaleString("en",{minimumFractionDigits:3})}`, trend:trends?.revenue, color:"var(--green)",  fmt:"currency" },
          { label:"Total Clicks",    value:Number(kpis.totalClicks).toLocaleString(),                                       trend:trends?.clicks,  color:"var(--cyan)",   fmt:"number"  },
          { label:"Total Leads",     value:Number(kpis.totalLeads).toLocaleString(),                                        trend:trends?.leads,   color:"var(--purple)", fmt:"number"  },
          { label:"Active Sponsors", value:`${kpis.connectedApis}/${kpis.totalSponsors}`,                                  trend:0,               color:"var(--orange)", fmt:"static"  },
        ].map((c,i) => {
          const isUp = (c.trend || 0) >= 0;
          const trendColor = c.trend === 0 ? "var(--text2)" : isUp ? "var(--green)" : "var(--red)";
          return (
            <div key={i} className="stat-card" style={{"--ac":c.color,transition:"transform .2s",transform:pulse?"scale(1.01)":"scale(1)"}}>
              <div className="stat-label">{c.label}</div>
              <div className="stat-val" style={{color:c.color}}>{c.value}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5}}>
                <span style={{fontSize:13,color:trendColor,fontWeight:700}}>
                  {c.trend !== undefined && c.trend !== null ? (
                    <>{isUp ? "▲" : "▼"} {Math.abs(c.trend).toFixed(1)}%</>
                  ) : "—"}
                </span>
                <span style={{fontFamily:"var(--font-mono)",fontSize:9,color:"var(--text2)"}}>
                  Updated {lastUpdate?.toLocaleTimeString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CHARTS ROW ────────────────────────────────────────────────────── */}
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

      {/* ── GEOGRAPHIC DISTRIBUTION — WORLD MAP ──────────────────────────── */}
      {geoData?.geo?.length > 0 && (
        <div className="card mb-6">
          <div className="card-head">
            <span className="card-title">Geographic Distribution</span>
            <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)"}}>
              {geoData.geo.reduce((s,g)=>s+g.conversions,0)} conversions
            </span>
          </div>
          <div style={{padding:"8px 12px"}}>
            <svg viewBox="0 0 800 380" style={{width:"100%",height:"auto",display:"block"}}>
              {/* Ocean bg — deep navy */}
              <rect width="800" height="380" fill="#080c14"/>
              {/* All world continents — dark charcoal gray */}
              <g fill="#141a26" stroke="#1e2a3a" strokeWidth="0.7" strokeLinejoin="round">
                {/* North America */}
                <path d="M60,155 L70,130 L85,105 L100,85 L120,70 L145,58 L175,52 L205,55 L235,65 L258,80 L265,100 L260,120 L252,140 L240,158 L225,170 L210,180 L195,188 L175,195 L155,198 L135,196 L115,190 L95,180 L80,170Z"/>
                {/* Canada (northern part) */}
                <path d="M60,155 L70,130 L85,105 L100,85 L120,70 L145,58 L175,52 L205,55 L235,65 L258,80 L265,100 L260,120 L252,135 L240,130 L220,125 L200,122 L180,120 L160,122 L140,128 L120,135 L100,140 L85,145Z"/>
                {/* Greenland */}
                <path d="M280,50 L300,42 L325,45 L340,55 L342,70 L335,82 L318,88 L298,85 L282,72 L278,60Z"/>
                {/* South America */}
                <path d="M215,205 L228,195 L242,192 L255,198 L268,210 L278,230 L285,255 L288,280 L285,310 L278,338 L268,355 L255,365 L242,368 L230,362 L220,348 L213,325 L208,295 L205,265 L207,235Z"/>
                {/* Europe (detailed) */}
                <path d="M388,130 L392,115 L400,100 L412,88 L428,80 L445,78 L462,82 L478,90 L490,102 L498,118 L500,135 L498,148 L492,158 L482,165 L468,170 L452,172 L438,170 L422,165 L408,155 L398,145Z"/>
                {/* UK */}
                <path d="M370,108 L378,100 L388,103 L394,112 L392,122 L385,130 L376,128 L370,120Z"/>
                {/* Scandinavia */}
                <path d="M448,55 L455,52 L462,58 L466,70 L462,82 L455,80 L450,72 L448,62Z"/>
                {/* Africa (detailed) */}
                <path d="M395,180 L408,172 L422,170 L438,172 L452,178 L462,190 L470,210 L475,235 L476,260 L473,285 L468,308 L460,328 L448,342 L435,348 L420,345 L408,335 L398,315 L392,290 L387,260 L385,230 L388,205Z"/>
                {/* Madagascar */}
                <path d="M480,320 L488,315 L492,322 L490,335 L485,340 L480,335Z"/>
                {/* Asia (detailed) */}
                <path d="M508,125 L520,105 L540,90 L565,78 L595,70 L630,65 L665,68 L700,75 L732,88 L755,105 L768,125 L775,148 L778,168 L775,185 L768,198 L755,208 L738,215 L718,218 L695,216 L670,212 L645,205 L620,195 L598,185 L580,172 L562,158 L548,142L535,132Z"/>
                {/* India */}
                <path d="M618,165 L628,158 L640,162 L648,172 L650,188 L645,205 L638,215 L628,218 L618,212 L612,200 L608,185Z"/>
                {/* Middle East / Arabian Peninsula */}
                <path d="M505,168 L515,162 L528,160 L540,165 L548,175 L550,190 L545,205 L535,212 L522,215 L512,210 L505,200 L502,185Z"/>
                {/* Southeast Asia */}
                <path d="M688,185 L698,178 L710,180 L718,190 L720,205 L715,218 L705,222 L695,218 L688,208 L685,195Z"/>
                {/* Japan */}
                <path d="M785,90 L792,85 L798,92 L800,108 L796,120 L790,126 L784,120 L780,108Z"/>
                {/* Indonesia / Archipelago */}
                <path d="M700,265 L712,260 L725,262 L735,268 L730,275 L718,278 L705,275Z"/>
                <path d="M740,270 L750,266 L762,268 L770,275 L765,282 L752,284 L740,280Z"/>
                {/* Philippines */}
                <path d="M730,218 L736,212 L742,216 L744,228 L740,238 L734,240 L728,232Z"/>
                {/* Australia */}
                <path d="M715,278 L730,272 L748,270 L765,274 L778,282 L785,295 L786,312 L780,328 L768,338 L752,342 L735,340 L722,332 L714,318 L710,300Z"/>
                {/* New Zealand */}
                <path d="M795,335 L800,330 L802,340 L800,348 L795,350 L792,345Z"/>
              </g>
              {/* Active country fills — neon cyan with glow */}
              {geoData.geo.map(g => {
                const shape = {
                  MA: { d:"M340,258 L350,254 L365,255 L375,260 L378,272 L372,282 L362,286 L350,284 L342,278 Z", cx:358, cy:270 },
                  FR: { d:"M418,132 L425,126 L438,124 L448,128 L454,138 L455,150 L450,160 L442,164 L432,163 L424,158 L418,148 Z", cx:436, cy:144 },
                  BE: { d:"M436,113 L442,110 L448,112 L450,118 L448,124 L442,126 L438,124 L435,120 Z", cx:443, cy:118 },
                  NL: { d:"M438,102 L444,98 L450,100 L452,106 L450,110 L444,112 L440,110 L438,106 Z", cx:445, cy:105 },
                  DZ: { d:"M360,268 L375,262 L390,260 L408,262 L420,268 L425,278 L422,290 L415,298 L402,302 L388,300 L375,295 L365,288 L360,280 Z", cx:392, cy:280 },
                  TN: { d:"M408,258 L415,254 L422,256 L426,262 L424,270 L418,274 L412,272 L408,266 Z", cx:416, cy:264 },
                  AE: { d:"M548,222 L555,218 L562,220 L565,226 L562,234 L556,236 L550,234 L548,228 Z", cx:556, cy:227 },
                  SA: { d:"M515,218 L528,212 L542,214 L552,220 L556,232 L552,242 L542,248 L530,250 L520,246 L512,238 L508,228 Z", cx:532, cy:230 },
                }[g.code];
                if (!shape) return null;
                return (
                  <g key={g.code}>
                    <path d={shape.d} fill="#00e5ff" fillOpacity="0.08" stroke="#00e5ff" strokeWidth="3" strokeOpacity="0.15"/>
                    <path d={shape.d} fill="#00e5ff" fillOpacity="0.18" stroke="#00e5ff" strokeWidth="1.2" strokeOpacity="0.5"/>
                    <path d={shape.d} fill="#00e5ff" fillOpacity="0.25" stroke="#00e5ff" strokeWidth="0.6"/>
                    <text x={shape.cx} y={shape.cy + 4} textAnchor="middle" fill="#e2e8f0" fontSize="8" fontFamily="IBM Plex Mono,monospace" fontWeight="700">{g.name}</text>
                  </g>
                );
              })}
              {/* Attribution */}
              <text x="790" y="372" textAnchor="end" fill="#2a3a4a" fontSize="7" fontFamily="IBM Plex Mono,monospace">●</text>
            </svg>
          </div>
        </div>
      )}

      {/* ── REVENUE BY SPONSOR — HORIZONTAL CARDS ─────────────────────────── */}
      <div className="mb-6">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div className="sec-title" style={{marginBottom:0}}>Revenue by Sponsor (Live)</div>
          {sponsorBreakdown && <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)"}}>
            {sponsorBreakdown.filter(s => s.revenue > 0).length || 0} active
          </span>}
        </div>
        {(sponsorBreakdown || []).length > 0 ? (
          <div style={{display:"flex",gap:14,overflowX:"auto",paddingBottom:8,scrollbarWidth:"thin"}}>
            {sponsorBreakdown.map(sp => {
              const maxRev = Math.max(...sponsorBreakdown.map(s => s.revenue || 0), 1);
              const pct = ((sp.revenue || 0) / maxRev * 100).toFixed(0);
              return (
                <div key={sp.id} style={{
                  minWidth:200,background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:10,
                  padding:"14px 16px",flexShrink:0,position:"relative",overflow:"hidden"
                }}>
                  {/* Status dot top-right */}
                  <span style={{
                    position:"absolute",top:10,right:10,width:7,height:7,borderRadius:"50%",
                    background:sp.status==="connected"?"#00e5ff":"var(--text2)",
                    boxShadow:sp.status==="connected"?"0 0 6px #00e5ff":"none"
                  }}/>
                  {/* Name */}
                  <div style={{fontFamily:"var(--font-mono)",fontSize:9,color:"var(--text2)",marginBottom:6,letterSpacing:.5}}>{sp.name}</div>
                  {/* Revenue */}
                  <div style={{fontSize:22,fontWeight:900,color:"#00e5ff",fontFamily:"IBM Plex Mono,monospace",letterSpacing:-1,marginBottom:6}}>
                    ${Number(sp.revenue).toFixed(2)}
                  </div>
                  {/* Clicks + Leads */}
                  <div style={{fontFamily:"var(--font-mono)",fontSize:9,color:"var(--text2)",marginBottom:12}}>
                    {Number(sp.clicks).toLocaleString()} clicks · {sp.leads} leads
                  </div>
                  {/* Progress bar */}
                  <div style={{height:3,background:"var(--bg3)",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#00e5ff,transparent)",borderRadius:2,transition:"width .8s ease"}}/>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card" style={{padding:"20px",textAlign:"center",fontFamily:"var(--font-mono)",fontSize:11,color:"var(--text2)"}}>
            No sponsor data yet — sync your sponsors
          </div>
        )}
      </div>

      {/* ── SUB-AFFILIATE LEADERBOARD ─────────────────────────────────────── */}
      <div className="card mb-6">
        <div className="card-head">
          <span className="card-title">🏆 Sub-Affiliate Leaderboard</span>
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            {subSyncInfo?.lastSync && (
              <span style={{fontSize:10,color:"var(--text2)",fontFamily:"var(--font-mono)"}}>
                Last sync: {new Date(subSyncInfo.lastSync).toLocaleTimeString()}
                {subSyncInfo.lastSaved > 0 && <> · +{subSyncInfo.lastSaved} new</>}
              </span>
            )}
            {subSyncMsg && <span style={{fontSize:11,color: subSyncMsg.startsWith("✓") ? "var(--green)" : "var(--orange)",fontFamily:"var(--font-mono)"}}>{subSyncMsg}</span>}
            <button className="btn btn-sm" disabled={subSyncing} style={{fontSize:10}}
              onClick={async () => {
                setSubSyncing(true); setSubSyncMsg("");
                try {
                  const r = await api.convSyncNow();
                  setSubSyncMsg(r.lastSaved > 0 ? `✓ +${r.lastSaved} new conversions` : "✓ Up to date");
                  if (r.lastSaved > 0) load();
                  else setSubSyncInfo(r);
                } catch(e) { setSubSyncMsg("Error: " + e.message); }
                finally { setSubSyncing(false); }
              }}>
              {subSyncing ? "⟳ Syncing..." : "⟳ Sync Now"}
            </button>
          </div>
        </div>
        {subData?.sub_affiliates?.length > 0 ? (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{width:36}}></th>
                  <th>Sub-Affiliate</th>
                  <th>ID</th>
                  <th>Opens</th>
                  <th>Clicks</th>
                  <th>Leads</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {subData.sub_affiliates.map((s, i) => {
                  const trophies = ["🥇", "🥈", "🥉"];
                  const maxLeads = subData.sub_affiliates[0]?.leads || 1;
                  const barPct = (s.leads / maxLeads * 100).toFixed(0);
                  return (
                    <tr key={s.id}>
                      <td style={{fontSize:18,textAlign:"center"}}>{trophies[i] || `#${i+1}`}</td>
                      <td style={{fontWeight:700,fontSize:13}}>{s.name}</td>
                      <td><span className="offer-id">{s.id}</span></td>
                      <td className="mono">{s.opens || 0}</td>
                      <td className="mono">{s.clicks || 0}</td>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span className="mono" style={{color:"var(--cyan)",fontWeight:700,minWidth:28}}>{s.leads}</span>
                          <div style={{flex:1,height:4,background:"var(--bg3)",borderRadius:2,overflow:"hidden",minWidth:50}}>
                            <div style={{height:"100%",width:`${barPct}%`,background: trophies[i] ? `linear-gradient(90deg, #ffd700, #ffed4a)` : "var(--cyan)",borderRadius:2,transition:"width .6s ease"}}/>
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
          <div style={{padding:"20px",textAlign:"center"}}>
            <div style={{fontSize:13,color:"var(--text2)",marginBottom:8}}>
              No conversions found for this period.
            </div>
            <div style={{fontSize:11,color:"var(--text2)",fontFamily:"var(--font-mono)"}}>
              Auto-sync runs every 15 min · Click "Sync Now" to fetch immediately
            </div>
          </div>
        )}
      </div>

      {/* ── TOP OFFERS ────────────────────────────────────────────────────── */}
      <div className="card" style={{marginBottom:16}}>
        <div className="card-head">
          <span className="card-title">Top Offers by Revenue (Live)</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)"}}>{periodLabel}</span>
            <button className="btn btn-sm" style={{fontSize:10}} onClick={load}>⟳ Refresh now</button>
          </div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>ID</th><th>Offer</th><th>Sponsor</th><th>Payout</th><th>Leads</th><th>Revenue</th></tr></thead>
            <tbody>
              {topOffers?.length > 0 ? topOffers.map(o => (
                <tr key={o.id}>
                  <td><span className="offer-id">{o.external_id || o.id}</span></td>
                  <td style={{fontWeight:600,fontSize:12}}>{o.name}</td>
                  <td style={{fontFamily:"var(--font-mono)",fontSize:11,color:o.sponsor_color||"var(--text2)"}}>{o.sponsor_name}</td>
                  <td><span className="payout-v">${o.payout}</span></td>
                  <td className="mono" style={{color:"var(--cyan)",fontWeight:700}}>{o.leads}</td>
                  <td className="mono" style={{color:"var(--green)",fontWeight:700}}>${Number(o.est_revenue).toFixed(0)}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} style={{textAlign:"center",padding:"20px",fontFamily:"var(--font-mono)",fontSize:11,color:"var(--text2)"}}>No offers with conversions in this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
  const [detailOffer, setDetailOffer] = useState(null);
  const [detailForm, setDetailForm] = useState({});
  const [detailSaving, setDetailSaving] = useState(false);

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
            <thead><tr><th>ID</th><th>Name</th><th>Sponsor</th><th>Category</th><th>Payout</th><th>Clicks</th><th>Leads</th><th>CR</th><th>Est. Rev</th><th>Status</th><th></th></tr></thead>
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
                    <button className="btn btn-sm" style={{fontSize:10,color:"var(--cyan)",borderColor:"rgba(0,207,255,.3)"}}
                      onClick={()=>{ setDetailOffer(o); setDetailForm({
                        tracking_url: o.tracking_url||"",
                        creatives:    o.creatives||"",
                        from_name:    o.from_name||"",
                        subject:      o.subject||"",
                        notes:        o.notes||"",
                      }); }}>
                      ≡ Details
                    </button>
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

      {/* ── Details Modal ─────────────────────────────────────────────────── */}
      {detailOffer && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDetailOffer(null)}>
          <div className="modal" style={{width:620,maxHeight:"90vh",overflowY:"auto"}}>
            <div className="modal-title">
              <div>
                <div style={{fontSize:13,fontWeight:900}}>{detailOffer.name}</div>
                <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)",fontWeight:400,marginTop:3}}>
                  ID: {detailOffer.external_id || detailOffer.id} · {detailOffer.sponsor_name} · <span className="payout-v">${detailOffer.payout}</span>
                </div>
              </div>
              <button className="btn btn-sm" onClick={()=>setDetailOffer(null)}>✕</button>
            </div>

            {/* Tracking URL */}
            <div className="form-group">
              <label className="form-label">Tracking URL</label>
              <div style={{display:"flex",gap:8}}>
                <input className="form-input" style={{fontFamily:"var(--font-mono)",fontSize:11}}
                  placeholder="https://tracking.example.com/click?offer=..."
                  value={detailForm.tracking_url}
                  onChange={e=>setDetailForm(p=>({...p,tracking_url:e.target.value}))}/>
                {detailForm.tracking_url && (
                  <button className="btn btn-sm" style={{flexShrink:0}} onClick={()=>{navigator.clipboard.writeText(detailForm.tracking_url);toast("✓ Copied","ok");}}>⎘</button>
                )}
              </div>
            </div>

            {/* From + Subject */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">From (Email Sender)</label>
                <input className="form-input" placeholder="ex: John Smith"
                  value={detailForm.from_name}
                  onChange={e=>setDetailForm(p=>({...p,from_name:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input className="form-input" placeholder="ex: Your storage is almost full"
                  value={detailForm.subject}
                  onChange={e=>setDetailForm(p=>({...p,subject:e.target.value}))}/>
              </div>
            </div>

            {/* Creatives */}
            <div className="form-group">
              <label className="form-label">Creatives (URLs — 1 per line)</label>
              <textarea className="form-input" rows={4}
                style={{fontFamily:"var(--font-mono)",fontSize:11,resize:"vertical"}}
                placeholder={"https://cdn.example.com/banner1.jpg\nhttps://cdn.example.com/banner2.jpg"}
                value={detailForm.creatives}
                onChange={e=>setDetailForm(p=>({...p,creatives:e.target.value}))}/>
              {/* Preview creative links */}
              {detailForm.creatives && (
                <div style={{marginTop:6,display:"flex",flexWrap:"wrap",gap:6}}>
                  {detailForm.creatives.split("\n").filter(u=>u.trim()).map((u,i)=>(
                    <a key={i} href={u.trim()} target="_blank" rel="noreferrer"
                       style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--cyan)",
                               background:"rgba(0,207,255,.08)",border:"1px solid rgba(0,207,255,.2)",
                               borderRadius:4,padding:"2px 8px",textDecoration:"none"}}>
                      ↗ Creative {i+1}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} style={{resize:"vertical"}}
                placeholder="Remarques, restrictions geo, cap journalier..."
                value={detailForm.notes}
                onChange={e=>setDetailForm(p=>({...p,notes:e.target.value}))}/>
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={()=>setDetailOffer(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={detailSaving}
                onClick={async()=>{
                  setDetailSaving(true);
                  try {
                    await api.updateOffer(detailOffer.id, detailForm);
                    toast("✓ Offer details saved","ok");
                    load();
                    setDetailOffer(null);
                  } catch(e){ toast(e.message,"err"); }
                  finally { setDetailSaving(false); }
                }}>
                {detailSaving ? "⟳ Saving…" : "✓ Save"}
              </button>
            </div>
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

// ─── CHAT PAGE ────────────────────────────────────────────────────────────────
function ChatPage({ user, wsRef, initialTarget, onTargetUsed }) {
  const [messages,  setMessages]  = useState([]);
  const [text,      setText]      = useState("");
  const [sending,   setSending]   = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [targetId,  setTargetId]  = useState(initialTarget || "global");
  const [users,     setUsers]     = useState([]);
  const [typingMap, setTypingMap] = useState({});
  const [unread,    setUnread]    = useState({});
  const [notif,     setNotif]     = useState(null);
  const bottomRef    = useRef(null);
  const typingTimer  = useRef({});
  const targetIdRef  = useRef(initialTarget || "global");
  useEffect(() => { targetIdRef.current = targetId; }, [targetId]);

  // If a new initialTarget arrives (from notification click), navigate to it
  useEffect(() => {
    if (initialTarget) {
      setTargetId(initialTarget);
      onTargetUsed?.();
    }
  }, [initialTarget]);

  // ── Load history ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, r] = await Promise.all([
        api.getUsers(),
        api.chatHistory(100, targetId),
      ]);
      if (uRes?.users) setUsers(uRes.users.filter(u => u.id !== user.id));
      if (r?.messages) setMessages(r.messages);
    } catch (e) { console.error("Chat load error:", e); }
    finally { setLoading(false); }
  }, [targetId, user.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── WebSocket listener ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const msg = e.detail;
      if (!msg) return;

      // ① New chat message
      if (msg.type === "chat_message" && msg.msg) {
        const m = msg.msg;
        // Strict privacy: if message is private and not meant for me (and I'm not the sender), ignore completely.
        if (m.to && m.to !== user.id && m.userId !== user.id) return;

        const cur = targetIdRef.current;
        const isGlobal   = !m.to;
        const inGlobal   = cur === "global" && isGlobal;
        const inPrivate  = cur !== "global" && (
          (m.userId === cur      && m.to === user.id) ||
          (m.userId === user.id  && m.to === cur)
        );

        if (inGlobal || inPrivate) {
          setMessages(p => {
            if (p.find(x => (x.id && x.id === m.id) || (x._id && x._id === m._id))) return p;
            return [...p, m];
          });
          setTypingMap(p => { const n = {...p}; delete n[m.userId]; return n; });
        } else if (m.userId !== user.id) {
          const contactKey = m.to ? m.userId : "global";
          setUnread(p => ({ ...p, [contactKey]: (p[contactKey] || 0) + 1 }));
          setNotif({ name: m.userName, text: m.text, contactKey });
          setTimeout(() => setNotif(null), 4000);
        }
      }

      // ② Typing indicator
      if (msg.type === "typing" && msg.userId !== user.id) {
        const cur = targetIdRef.current;
        // Ignore private typing if it's meant for someone else
        if (msg.to && msg.to !== user.id) return;

        const relevant = msg.to
          ? (cur === msg.userId)
          : cur === "global";
        if (relevant) {
          setTypingMap(p => ({ ...p, [msg.userId]: msg.userName }));
          clearTimeout(typingTimer.current[msg.userId]);
          typingTimer.current[msg.userId] = setTimeout(() => {
            setTypingMap(p => { const n = {...p}; delete n[msg.userId]; return n; });
          }, 3000);
        }
      }
    };
    window.addEventListener("affplatform_ws", handler);
    return () => window.removeEventListener("affplatform_ws", handler);
  }, [user.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ── Send typing event ─────────────────────────────────────────────────────────
  const typingSentAt = useRef(0);
  const handleTextChange = (e) => {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
    // Throttle: send at most 1 typing event per 2s
    const now = Date.now();
    if (now - typingSentAt.current > 2000) {
      typingSentAt.current = now;
      wsRef.current?.send({
        type: "typing",
        userId: user.id,
        userName: user.name,
        to: targetId === "global" ? null : targetId,
      });
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────────
  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    const tempId = Date.now() + "-temp";
    const tempMsg = {
      id: tempId,
      userId: user.id,
      userName: user.name,
      text: t,
      created_at: new Date().toISOString(),
      to: targetId === "global" ? null : targetId,
    };
    setMessages(prev => [...prev, tempMsg]);
    setText("");
    try {
      const res = await api.chatSend(t, targetId === "global" ? null : targetId);
      // Replace temp message with real server message
      if (res?.msg) {
        setMessages(prev => prev.map(m => m.id === tempId ? res.msg : m));
      }
    } catch (e) {
      alert("Failed to send: " + e.message);
      setText(t);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally { setSending(false); }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const fmt = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const currentTargetName = targetId === "global" ? "Global Team" : (users.find(u => u.id === targetId)?.name || "User");
  const typingNames = Object.values(typingMap);

  const goTo = (id) => {
    setTargetId(id);
    setUnread(p => ({ ...p, [id]: 0 }));
  };

  return (
    <div style={{ height: "calc(100vh - 120px)", display: "flex", overflow: "hidden", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>

      {/* ── NOTIFICATION BANNER ──────────────────────────────────────────────── */}
      {notif && (
        <div onClick={() => { goTo(notif.contactKey); setNotif(null); }} style={{
          position: "absolute", top: 70, right: 20, zIndex: 999,
          background: "linear-gradient(135deg, rgba(0,255,157,0.12), rgba(0,207,255,0.08))",
          border: "1px solid rgba(0,255,157,0.3)", borderRadius: 12,
          padding: "12px 18px", minWidth: 260, maxWidth: 340, cursor: "pointer",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)", backdropFilter: "blur(10px)",
          animation: "slideIn .3s ease"
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--green)", marginBottom: 4 }}>
            📩 {notif.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {notif.text}
          </div>
        </div>
      )}

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────────── */}
      <div style={{ width: 230, background: "var(--bg2)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "16px 20px 8px", fontSize: 10, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 1 }}>Channels</div>
        
        {/* Global Team */}
        <div onClick={() => goTo("global")} style={{
          padding: "11px 20px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between",
          background: targetId === "global" ? "rgba(0,255,157,0.08)" : "transparent",
          color: targetId === "global" ? "var(--green)" : "var(--text)",
          borderLeft: targetId === "global" ? "3px solid var(--green)" : "3px solid transparent",
          fontWeight: targetId === "global" ? 700 : 400,
        }}>
          <span>🌍 Global Team</span>
          {(unread["global"] || 0) > 0 && <span style={{ background: "var(--green)", color: "var(--bg)", borderRadius: 10, fontSize: 9, fontWeight: 700, padding: "2px 6px" }}>{unread["global"]}</span>}
        </div>

        <div style={{ padding: "14px 20px 6px", fontSize: 10, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 1 }}>Direct Messages</div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {users.map(u => (
            <div key={u.id} onClick={() => goTo(u.id)} style={{
              padding: "11px 20px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between",
              background: targetId === u.id ? "rgba(0,255,157,0.08)" : "transparent",
              color: targetId === u.id ? "var(--green)" : "var(--text)",
              borderLeft: targetId === u.id ? "3px solid var(--green)" : "3px solid transparent",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,var(--green),var(--cyan))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--bg)", flexShrink: 0 }}>
                  {u.name[0]}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{u.name}</div>
                  {typingMap[u.id] && <div style={{ fontSize: 10, color: "var(--green)", fontStyle: "italic" }}>typing...</div>}
                </div>
              </div>
              {(unread[u.id] || 0) > 0 && <span style={{ background: "var(--green)", color: "var(--bg)", borderRadius: 10, fontSize: 9, fontWeight: 700, padding: "2px 6px", flexShrink: 0 }}>{unread[u.id]}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN CHAT AREA ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Header */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg2)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,var(--green),var(--cyan))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "var(--bg)" }}>
              {targetId === "global" ? "🌍" : currentTargetName[0]}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{currentTargetName}</div>
              {typingNames.length > 0 && (
                <div style={{ fontSize: 11, color: "var(--green)", fontStyle: "italic" }}>
                  {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing...
                </div>
              )}
            </div>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text2)" }}>{messages.length} msgs</span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 4 }}>
          {loading ? (
            <div style={{ margin: "auto", opacity: 0.5 }}>⟳ Loading…</div>
          ) : messages.length === 0 ? (
            <div style={{ margin: "auto", textAlign: "center", opacity: 0.4 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🛰️</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>Start the conversation</div>
            </div>
          ) : messages.map((m, idx) => {
            const isMine = m.userId === user.id;
            const prevMsg = messages[idx - 1];
            const isSameUser = prevMsg && prevMsg.userId === m.userId;
            return (
              <div key={m.id || m._id || idx} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", marginTop: isSameUser ? 2 : 10 }}>
                {!isMine && !isSameUser && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--cyan)", marginLeft: 4, marginBottom: 3 }}>{m.userName}</div>
                )}
                <div style={{
                  maxWidth: "70%", padding: "10px 16px",
                  borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  fontSize: 14, lineHeight: 1.5, wordBreak: "break-word",
                  background: isMine ? "linear-gradient(135deg, rgba(0,255,157,0.2), rgba(0,207,255,0.12))" : "var(--bg3)",
                  border: isMine ? "1px solid rgba(0,255,157,0.25)" : "1px solid var(--border)",
                  color: "var(--text)",
                }}>
                  {m.text}
                </div>
                <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 3, marginLeft: 4, marginRight: 4 }}>{fmt(m.created_at)}</div>
              </div>
            );
          })}

          {/* Typing dots */}
          {typingNames.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
              <div style={{ display: "flex", gap: 3, padding: "8px 14px", background: "var(--bg3)", borderRadius: "14px 14px 14px 4px", border: "1px solid var(--border)" }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text2)", animation: `pulse 1.2s ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--bg2)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              className="chat-input"
              rows={1}
              placeholder={`Message ${currentTargetName}…`}
              style={{ flex: 1, borderRadius: 12, minHeight: 44, maxHeight: 120, paddingRight: 16 }}
              value={text}
              onChange={handleTextChange}
              onKeyDown={onKey}
            />
            <button className="btn btn-primary" style={{ borderRadius: 12, height: 44, padding: "0 22px", flexShrink: 0 }} onClick={send} disabled={!text.trim() || sending}>
              {sending ? "…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI SUGGESTIONS PAGE ───────────────────────────────────────────────────────
function AISuggestPage({ toast }) {
  const today = new Date().toISOString().slice(0, 10);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [period,  setPeriod]  = useState("30d");
  const [from,    setFrom]    = useState("");
  const [to,      setTo]      = useState(today);

  const load = async (p, f, t) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (p === "custom" && f && t) { params.set("from", f); params.set("to", t); }
      else params.set("period", p || "30d");
      const r = await fetch(`/api/ai/offer-suggestions?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("affplatform_token")}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) { toast(e.message, "err"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(period, from, to); }, []);

  const PERIODS = [
    { id:"today", label:"Today" },
    { id:"7d",    label:"7 Days" },
    { id:"mtd",   label:"Month to Date" },
    { id:"30d",   label:"30 Days" },
    { id:"custom",label:"Custom" },
  ];

  const tiers = [
    { key:"hot",      label:"🔥 Hot — Push Now",     cls:"suggest-hot",      color:"#ff453a" },
    { key:"rising",   label:"📈 Rising — Scale Up",   cls:"suggest-rising",   color:"#00cfff" },
    { key:"untapped", label:"💡 Untapped Potential",   cls:"suggest-untapped", color:"#bf5af2" },
  ];

  return (
    <>
      {/* Period selector */}
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:16}}>
        <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text2)",textTransform:"uppercase",letterSpacing:.8}}>Period:</span>
        {PERIODS.map(p=>(
          <button key={p.id}
            className={`btn btn-sm${period===p.id?" btn-primary":""}`}
            onClick={()=>{ setPeriod(p.id); if(p.id!=="custom") load(p.id); }}
          >{p.label}</button>
        ))}
        {period === "custom" && (
          <>
            <input type="date" className="form-input" style={{width:130,padding:"4px 8px",fontSize:11}} value={from} onChange={e=>setFrom(e.target.value)} max={to}/>
            <span style={{color:"var(--text2)",fontSize:11}}>→</span>
            <input type="date" className="form-input" style={{width:130,padding:"4px 8px",fontSize:11}} value={to} onChange={e=>setTo(e.target.value)} max={today}/>
            <button className="btn btn-sm btn-primary" onClick={()=>load("custom",from,to)} disabled={!from||!to}>Apply</button>
          </>
        )}
        <button className="btn btn-sm" onClick={()=>load(period,from,to)} disabled={loading} style={{marginLeft:"auto"}}>
          {loading ? "⟳" : "↺ Refresh"}
        </button>
      </div>

      {data && (
        <div style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--text2)",marginBottom:16,display:"flex",gap:16,flexWrap:"wrap"}}>
          <span>📊 {data.total} offers analyzed</span>
          <span>🔄 {data.totalConversions} conversions in range</span>
          <span>📅 {data.fromDate} → {data.toDate}</span>
        </div>
      )}

      {loading && <div className="loader">⟳ Scoring offers from real data…</div>}

      {!loading && data && tiers.map(({ key, label, cls, color }) => {
        const items = data[key] || [];
        if (!items.length) return null;
        return (
          <div key={key} style={{marginBottom:28}}>
            <div style={{fontSize:13,fontWeight:800,marginBottom:8,color}}>{label}</div>
            <div className="suggest-grid">
              {items.map(o => (
                <div key={o.id || o._id} className={`suggest-card ${cls}`}>
                  <div className="suggest-label" style={{color}}>{o._tier?.toUpperCase()}</div>
                  <div className="suggest-name" title={o.name}>{o.name}</div>
                  <div className="suggest-reason">{o._reason}</div>
                  <div className="suggest-metrics">
                    <span className="suggest-metric">Leads <strong>{o._leads}</strong></span>
                    <span className="suggest-metric">Rev <strong>${(o._revenue||0).toFixed(2)}</strong></span>
                    <span className="suggest-metric">Last 7d <strong>{o._recent}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {!loading && data && (data.hot?.length + data.rising?.length + data.untapped?.length) === 0 && (
        <div className="loader" style={{height:200,flexDirection:"column",gap:8}}>
          <span style={{fontSize:28}}>📭</span>
          <span style={{color:"var(--text2)"}}>No offers with conversions in this period</span>
          <span style={{fontSize:11,color:"var(--text2)"}}>Try a wider date range or sync conversions first</span>
        </div>
      )}
    </>
  );
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
                    {u.id !== user.id && (
                      <button className="btn btn-danger btn-sm" style={{padding:"2px 8px",fontSize:10}} onClick={async()=>{
                        if(!confirm(`Delete ${u.email}?`)) return;
                        try { await api.deleteUser(u.id); toast("User deleted","ok"); setUsers(p=>p.filter(x=>x.id!==u.id)); }
                        catch(e) { toast(e.message,"err"); }
                      }}>✕</button>
                    )}
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
  const VALID_PAGES = ["dashboard","sponsors","offers","tracking","ai","suggest","chat","settings"];
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
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [popNotifs,   setPopNotifs]   = useState([]); // clickable popup notifications
  const [chatTarget,  setChatTarget]  = useState(null); // open specific chat on nav
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

      // 1. Live event (click/lead)
      if (msg.type === "new_event") {
        setLiveEvents(p => [msg.event, ...p.slice(0, 29)]);
      }

      // 2. Sponsor stats updated (from auto-sync) — refresh dashboard
      if (msg.type === "sponsor_updated" || msg.type === "dashboard_refresh") {
        setSponsorStats(p => ({ ...p, ...(msg.sponsorId ? {[msg.sponsorId]: msg.data} : {}) }));
        window.dispatchEvent(new CustomEvent("affplatform_ws", { detail: msg }));
      }

      // 3. New lead detected!
      if (msg.type === "new_lead") {
        const isMailer = !!msg.mailerName;
        const title = isMailer ? `💰 New Lead — ${msg.mailerName}` : `💰 New Lead — ${msg.sponsorName || ""}`;
        const body = isMailer ? `ID: ${msg.mailerId} · +$${Number(msg.revenue || 0).toFixed(2)}` : `${msg.count || 1} lead${(msg.count||1) > 1 ? "s" : ""} · +$${Number(msg.revenue||0).toFixed(2)}`;
        const notif = { id: Date.now(), title, body, color: msg.sponsorColor || "#00ff9d", time: new Date().toLocaleTimeString(), sponsorId: msg.sponsorId };
        setNotifications(p => [notif, ...p.slice(0, 49)]);
        setUnreadCount(p => p + 1);
        sendNotification(notif.title, notif.body, notif.color);
      }

      // 4. Chat + Typing — dispatch to ChatPage
      if (msg.type === "chat_message" || msg.type === "typing") {
        window.dispatchEvent(new CustomEvent("affplatform_ws", { detail: msg }));
      }

      // 5. Popup notification for messages
      if (msg.type === "chat_message" && msg.msg && msg.msg.userId !== user.id) {
        const m = msg.msg;
        // Skip if this is a private message meant for someone else
        if (m.to && m.to !== user.id) return;

        const notifId = Date.now();
        const popItem = {
          id: notifId,
          kind: "msg",
          title: `📩 ${m.userName}`,
          body: m.text,
          contactKey: m.to ? m.userId : "global",
          time: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),
        };
        setPopNotifs(p => [popItem, ...p].slice(0, 5));
        setTimeout(() => setPopNotifs(p => p.filter(x => x.id !== notifId)), 6000);
        sendNotification(popItem.title, m.text);
      }

      // 6. Popup notification for leads
      if (msg.type === "new_lead") {
        const notifId = Date.now();
        const isMailer = !!msg.mailerName;
        const popItem = {
          id: notifId,
          kind: "lead",
          title: `💰 New Lead!`,
          body: isMailer
            ? `Mailer: ${msg.mailerName} · ID: ${msg.mailerId} · +$${Number(msg.revenue||0).toFixed(2)}`
            : `${msg.sponsorName || ""} · +$${Number(msg.revenue||0).toFixed(2)}`,
          time: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),
        };
        setPopNotifs(p => [popItem, ...p].slice(0, 5));
        setTimeout(() => setPopNotifs(p => p.filter(x => x.id !== notifId)), 8000);
      }

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
    { id:"dashboard", label:"Home",      icon:"▦" },
    { id:"sponsors",  label:"Sponsors",  icon:"⬡" },
    { id:"offers",    label:"Offers",    icon:"≡" },
    { id:"tracking",  label:"Live",      icon:"◈" },
    { id:"suggest",   label:"AI Picks",  icon:"✦" },
    { id:"chat",      label:"Chat",      icon:"💬" },
    { id:"settings",  label:"Settings",  icon:"◎" },
  ];
  const titles = {
    dashboard:"Overview Dashboard", sponsors:"Sponsor Management",
    offers:"Offers & IDs", tracking:"Live Tracking",
    ai:"AI Offer Finder", suggest:"AI Offer Suggestions",
    chat:"Team Chat", settings:"Settings & API Keys",
  };

  const goTo = (id) => {
    setPage(id); setDrawerOpen(false);
    window.history.pushState({}, "", "/" + id);
  };

  return (
    <>
      <style>{CSS}</style>
      {/* Mobile: left side drawer with 2-col horizontal grid */}
      <div className={`drawer-backdrop${drawerOpen?" open":""}`} onClick={()=>setDrawerOpen(false)}/>
      <div className={`sidebar-drawer${drawerOpen?" open":""}`}>
        <div className="drawer-head">
          <div className="drawer-logo"><em>Aff</em>Intel</div>
          <button className="drawer-close" onClick={()=>setDrawerOpen(false)}>✕</button>
        </div>
        <div className="drawer-nav-grid">
          {nav.map(n=>(
            <button key={n.id} className={`drawer-nav-btn${page===n.id?" active":""}`} onClick={()=>goTo(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </div>
        <div className="drawer-user">
          <div className="avatar">{user.name[0]}</div>
          <div><div className="user-name">{user.name}</div><div className="user-role">{user.role.toUpperCase()}</div></div>
        </div>
      </div>
      <div className="app">
        {/* Desktop sidebar */}
        <aside className="sidebar">
          <div className="logo-wrap"><div className="logo"><em>Aff</em>Intel</div><div className="logo-tag">AFFILIATE PLATFORM v3</div></div>
          <nav className="nav">
            <div className="nav-sec">Navigation</div>
            {nav.map(n=>(
              <div key={n.id} className={`nav-item${page===n.id?" active":""}`} onClick={()=>goTo(n.id)}>
                <span className="nav-icon">{n.icon}</span>
                <span>{n.label}</span>
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
            <button className="hamburger" onClick={()=>setDrawerOpen(p=>!p)} aria-label="Menu">☰</button>
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
            {page==="suggest"   && <AISuggestPage toast={showToast}/>}
            {page==="chat"      && <ChatPage      user={user} wsRef={wsRef} initialTarget={chatTarget} onTargetUsed={()=>setChatTarget(null)}/>}
            {page==="settings"  && <SettingsPage  user={user} toast={showToast} onLogout={logout}/>}
          </div>
        </div>
      </div>
      {toast && <Toast key={toast.key} msg={toast.msg} type={toast.type} onClose={()=>setToastMsg(null)}/>}

      {/* ── GLOBAL POPUP NOTIFICATIONS ────────────────────────────────── */}
      <div style={{position:"fixed",top:70,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:10,pointerEvents:"none"}}>
        {popNotifs.map(n => (
          <div key={n.id}
            onClick={() => {
              if (n.kind === "msg") {
                setChatTarget(n.contactKey);
                setPage("chat");
                window.history.pushState({}, "", "/chat");
              }
              setPopNotifs(p => p.filter(x => x.id !== n.id));
            }}
            style={{
              pointerEvents:"all", cursor: n.kind==="msg" ? "pointer" : "default",
              position: "relative",
              background: n.kind==="msg"
                ? "linear-gradient(135deg,rgba(0,20,15,0.95),rgba(0,30,40,0.95))"
                : "linear-gradient(135deg,rgba(30,20,0,0.95),rgba(30,10,0,0.95))",
              border: `1px solid ${n.kind==="msg" ? "rgba(0,255,157,0.4)" : "rgba(255,159,10,0.5)"}`,
              borderRadius:14, padding:"14px 18px", minWidth:290, maxWidth:370,
              boxShadow:`0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${n.kind==="msg" ? "rgba(0,255,157,0.1)" : "rgba(255,159,10,0.1)"}`,
              backdropFilter:"blur(20px)",
              animation:"slideIn .3s ease",
            }}
          >
            {/* Header row */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontWeight:700,fontSize:14,color: n.kind==="msg" ? "#00ff9d" : "#ff9f0a"}}>
                {n.title}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>{n.time}</span>
                <span
                  onClick={e=>{e.stopPropagation();setPopNotifs(p=>p.filter(x=>x.id!==n.id));}}
                  style={{cursor:"pointer",color:"rgba(255,255,255,0.4)",fontSize:14,lineHeight:1}}
                >✕</span>
              </div>
            </div>
            {/* Message body — always visible */}
            <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",lineHeight:1.5,wordBreak:"break-word",whiteSpace:"pre-wrap"}}>
              {n.body}
            </div>
            {n.kind==="msg" && (
              <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:8,fontStyle:"italic"}}>
                Tap to open conversation →
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
