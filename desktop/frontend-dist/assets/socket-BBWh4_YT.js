import{c,a as r}from"./index-B4-MLs2m.js";/**
 * @license lucide-react v0.517.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]],u=c("copy",p);/**
 * @license lucide-react v0.517.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=[["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M17 20v2",key:"1rnc9c"}],["path",{d:"M17 2v2",key:"11trls"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M2 17h2",key:"7oei6x"}],["path",{d:"M2 7h2",key:"asdhe0"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"M20 17h2",key:"1fpfkl"}],["path",{d:"M20 7h2",key:"1o8tra"}],["path",{d:"M7 20v2",key:"4gnj0m"}],["path",{d:"M7 2v2",key:"1i4yhu"}],["rect",{x:"4",y:"4",width:"16",height:"16",rx:"2",key:"1vbyd7"}],["rect",{x:"8",y:"8",width:"8",height:"8",rx:"1",key:"z9xiuo"}]],M=c("cpu",y);/**
 * @license lucide-react v0.517.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]],v=c("shield-check",k);/**
 * @license lucide-react v0.517.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=[["path",{d:"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",key:"4pj2yx"}],["path",{d:"M20 3v4",key:"1olli1"}],["path",{d:"M22 5h-4",key:"1gvqau"}],["path",{d:"M4 17v2",key:"vumght"}],["path",{d:"M5 18H3",key:"zchphs"}]],m=c("sparkles",f);let s=null,i=new Date(Date.now()-3e4).toISOString();const n=new Map,x=()=>{s||(console.log("📡 Started notification polling"),s=setInterval(async()=>{var t;try{const{data:e}=await r.get(`/agent/notifications?since=${i}`);e.serverTime&&(i=e.serverTime);for(const o of e.notifications||[]){const a=n.get(o.event);if(a)for(const h of a)try{h(o.data)}catch(d){console.error("Notification handler error:",d)}}}catch(e){((t=e.response)==null?void 0:t.status)!==401&&console.warn("Notification poll error:",e.message)}},3e3))},S=()=>{s&&(clearInterval(s),s=null,console.log("📡 Stopped notification polling"))};function l(t,e){return n.has(t)||n.set(t,new Set),n.get(t).add(e),()=>{const o=n.get(t);o&&(o.delete(e),o.size===0&&n.delete(t))}}const b=t=>l("backup:progress",t),w=t=>l("deployment:progress",t),I=t=>{let e=null;const o=setInterval(async()=>{try{const{data:a}=await r.get("/agent/status");e!==a.online&&(e=a.online,t({online:a.online,agentInfo:a.agent}))}catch{}},5e3);return()=>clearInterval(o)};export{M as C,m as S,v as a,w as b,x as c,u as d,S as e,I as f,b as s};
