"use strict";(()=>{var a={};a.id=9790,a.ids=[9790],a.modules={21572:a=>{a.exports=require("nodemailer")},56575:a=>{a.exports=require("imapflow")},75600:a=>{a.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},81654:(a,b,c)=>{function d(a){return String(a??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}c.d(b,{Ez:()=>h,Mr:()=>g});let e=`
    <!-- Safety reminder -->
    <div style="margin-top:20px;border-left:3px solid #f87171;padding:14px 16px;background:rgba(248,113,113,0.06);border-radius:0 8px 8px 0;">
      <div style="font-size:13px;font-weight:700;color:#f87171;margin-bottom:10px;">🛡️ 黑貓的守護提醒（社交安全）</div>
      <div style="font-size:12px;color:#c9bfe8;line-height:1.9;">
        在你們開始了解彼此之前，請務必閱讀以下安全指引，保護好自己：
        <ul style="margin:8px 0 0 0;padding-left:18px;">
          <li><strong style="color:#f0ebd8;">保護個人隱私：</strong>在建立足夠信任前，請勿向對方透露過多敏感資訊（如屋企地址、公司具體位置、身份證號碼或銀行資料）。</li>
          <li style="margin-top:6px;"><strong style="color:#f0ebd8;">初次見面安排：</strong>若決定見面，請務必約在人多、明亮的公眾場合（如餐廳或咖啡廳），切勿前往對方的私人住所或偏僻地方。</li>
          <li style="margin-top:6px;"><strong style="color:#f0ebd8;">告知親友：</strong>出發前將約會的時間、地點及對方基本資料告知身邊信任的朋友或家人。</li>
          <li style="margin-top:6px;"><strong style="color:#f0ebd8;">保持清醒：</strong>注意飲品安全，確保飲品不曾離開你的視線範圍。</li>
          <li style="margin-top:6px;"><strong style="color:#f0ebd8;">金錢往來：</strong>若對方向你提出借錢、投資或任何金錢要求，請提高警覺。</li>
        </ul>
      </div>
    </div>`,f=`
    <!-- Disclaimer -->
    <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:14px 16px;margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;color:#a89cc8;margin-bottom:8px;">⚠️ 免責聲明</div>
      <div style="font-size:11px;color:#6b5fa5;line-height:1.85;">本配對結果由系統根據問卷答案演算得出，僅供參考，不代表任何對任何人士的推薦或保證。Black Cat Under The Moon 平台及其運營者對於配對雙方在線下互動所發生的任何事件、損失或糾紛概不負責。參加者須自行評估風險，謹慎行事，並對自身安全負責。</div>
    </div>`;function g({receiver:a,partner:b,score:c}){let g=[];return(a.email||b.email)&&g.push(`<tr>
      <td style="padding:4px 12px 4px 0;font-size:13px;color:#8880a8;">你的 Email：<span style="color:#7dd8e4;font-weight:700;">${d(a.email||"—")}</span></td>
      <td style="padding:4px 0;font-size:13px;color:#8880a8;">對方 Email：<span style="color:#7dd8e4;font-weight:700;">${d(b.email||"—")}</span></td>
    </tr>`),(a.ig_username||b.ig_username)&&g.push(`<tr>
      <td style="padding:4px 12px 4px 0;font-size:13px;color:#8880a8;">你的 IG：<span style="color:#7dd8e4;font-weight:700;">${d(a.ig_username||"—")}</span></td>
      <td style="padding:4px 0;font-size:13px;color:#8880a8;">對方 IG：<span style="color:#7dd8e4;font-weight:700;">${d(b.ig_username||"—")}</span></td>
    </tr>`),`
<div style="background:#07060e;padding:24px 16px;font-family:'Noto Sans TC','Microsoft JhengHei',sans-serif;color:#f0ebd8;">
<div style="max-width:600px;margin:0 auto;background:#12111d;border:2px solid #7c5cfc;border-radius:12px;padding:28px 24px;">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:20px;">
    <div style="font-size:11px;letter-spacing:0.2em;color:#a89cc8;text-transform:uppercase;margin-bottom:6px;">🐈‍⬛ Black Cat Under The Moon</div>
    <h2 style="margin:0 0 6px;font-size:22px;color:#ffe066;letter-spacing:0.05em;">🌙 靈魂配對通知</h2>
    <div style="font-size:13px;color:#a89cc8;">靈貓為你尋找最合拍的靈魂伴侶</div>
  </div>

  <div style="border-top:1px solid rgba(124,92,252,.25);margin-bottom:20px;"></div>

  <!-- Match box -->
  <div style="background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:18px 20px;margin-bottom:20px;">
    <div style="font-size:14px;margin-bottom:8px;">恭喜 <strong style="color:#ffe066;">${d(a.name)}</strong> 成功配對：</div>
    <div style="font-size:34px;color:#00e5ff;font-weight:900;letter-spacing:1px;margin-bottom:10px;">${d(b.name)}</div>
    <div style="display:inline-block;padding:5px 14px;border:1px solid #ff6b9d;border-radius:3px;color:#ff6b9d;font-size:14px;font-weight:700;margin-bottom:14px;">同步率 ${c}/100 ・ ${c>=90?"極高同步":c>=80?"超高同步":c>=65?"高度契合":c>=50?"值得了解":"有潛力"}</div>
    ${g.length?`<table width="100%" cellpadding="0" cellspacing="0" border="0">${g.join("")}</table>`:""}
  </div>

  <!-- Attachment notice -->
  <div style="background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.2);border-radius:8px;padding:14px 18px;margin-bottom:20px;text-align:center;">
    <div style="font-size:22px;margin-bottom:6px;">📎</div>
    <div style="font-size:14px;color:#f0ebd8;font-weight:700;margin-bottom:6px;">你的專屬配對卡片已附上</div>
    <div style="font-size:13px;color:#a89cc8;line-height:1.75;">請下載並在瀏覽器中打開附件 <strong style="color:#00e5ff;">配對卡.html</strong>，<br>查看完整配對分析、靈魂雷達圖及相容度解說。</div>
  </div>

  ${e}

  ${f}

  <div style="border-top:1px solid rgba(124,92,252,.2);margin-bottom:16px;"></div>

  <!-- Footer -->
  <div style="text-align:center;font-size:11px;color:#46435a;line-height:1.9;">
    <div>Black Cat Under The Moon &nbsp;\xb7&nbsp; blcatunderthemoon@gmail.com</div>
    <div>此郵件由系統自動發送，請勿直接回覆。</div>
  </div>

</div>
</div>`.trim()}function h({receiver:a,partner:b,score:c}){return[`嗨 ${a.name}，`,"","你的靈魂配對結果出爐了！",`靈魂同步率：${c}/100`,"",`配對對象：${b.name}`,b.ig_username?`Instagram：@${b.ig_username}`:"",b.email?`Email：${b.email}`:"","","\uD83D\uDCCE 請下載並在瀏覽器中打開附件的配對卡片（.html 檔案），查看完整配對分析及靈魂雷達圖。","","\uD83D\uDEE1️ 黑貓的守護提醒（社交安全）","在建立足夠信任前，請勿分享敏感個人資料。","初次見面請在公眾場合，並預先告知親友。","注意飲品安全，提防金錢要求。","","⚠️ 免責聲明","本配對結果僅供參考。平台對線下互動所發生之任何事件概不負責，參加者須自行評估風險。","","Black Cat Under The Moon","此郵件由系統自動發送，請勿直接回覆。"].filter(a=>void 0!==a).join("\n")}},84580:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.r(b),c.d(b,{config:()=>o,default:()=>n,handler:()=>m});var e=c(29046),f=c(8667),g=c(33480),h=c(86435),i=c(90508),j=c(58112),k=c(18766),l=a([i]);i=(l.then?(await l)():l)[0];let n=(0,h.M)(i,"default"),o=(0,h.M)(i,"config"),p=new g.PagesAPIRouteModule({definition:{kind:f.A.PAGES_API,page:"/api/dashboard/create-gmail-drafts",pathname:"/api/dashboard/create-gmail-drafts",bundlePath:"",filename:""},userland:i,distDir:".next",relativeProjectDir:""});async function m(a,b,c){let d=await p.prepare(a,b,{srcPage:"/api/dashboard/create-gmail-drafts"});if(!d){b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve());return}let{query:f,params:g,prerenderManifest:h,routerServerContext:i}=d;try{let c=a.method||"GET",d=(0,j.getTracer)(),e=d.getActiveScopeSpan(),l=p.instrumentationOnRequestError.bind(p),m=async e=>p.render(a,b,{query:{...f,...g},params:g,allowedRevalidateHeaderKeys:[],multiZoneDraftMode:!1,trustHostHeader:!1,previewProps:h.preview,propagateError:!1,dev:p.isDev,page:"/api/dashboard/create-gmail-drafts",internalRevalidate:null==i?void 0:i.revalidate,onError:(...b)=>l(a,...b)}).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let f=d.getRootSpanAttributes();if(!f)return;if(f.get("next.span_type")!==k.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${f.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let g=f.get("next.route");if(g){let a=`${c} ${g}`;e.setAttributes({"next.route":g,"http.route":g,"next.span_name":a}),e.updateName(a)}else e.updateName(`${c} ${a.url}`)});e?await m(e):await d.withPropagatedContext(a.headers,()=>d.trace(k.BaseServerSpan.handleRequest,{spanName:`${c} ${a.url}`,kind:j.SpanKind.SERVER,attributes:{"http.method":c,"http.target":a.url}},m))}catch(a){if(p.isDev)throw a;(0,e.sendError)(b,500,"Internal Server Error")}finally{null==c.waitUntil||c.waitUntil.call(c,Promise.resolve())}}d()}catch(a){d(a)}})},90508:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.r(b),c.d(b,{default:()=>o});var e=c(21572),f=c.n(e),g=c(56575),h=c(93721),i=c(81654),j=c(58288),k=c(79898),l=a([h,k]);[h,k]=l.then?(await l)():l;let p=(0,h.createClient)(process.env.SUPABASE_URL||"https://axlkrmcgtubuaavlbvgh.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_ANON_KEY||"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4bGtybWNndHVidWFhdmxidmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjQxMTgsImV4cCI6MjA5MTI0MDExOH0.oaDYixsSlAkPBpLw-ZRquX8RgOa6F0OHUXVUEW6APKY",{auth:{persistSession:!1}});async function m({from:a,to:b,subject:c,html:d,text:e,attachments:g}){let h=f().createTransport({streamTransport:!0,newline:"unix"}),i=await h.sendMail({from:a,to:b,subject:c,html:d,text:e,...g?{attachments:g}:{}}),j=[];for await(let a of i.message)j.push(a);return Buffer.concat(j)}async function n(a){let b=await a.listTree(),c=a=>{for(let b of a){if(b.specialUse&&b.specialUse.toLowerCase().includes("drafts"))return b.path;if(b.folders?.length){let a=c(b.folders);if(a)return a}}return null};return c(b.folders||[])||"[Gmail]/Drafts"}async function o(a,b){if("POST"!==a.method)return b.status(405).json({error:"Method not allowed. Use POST."});if(!process.env.GMAIL_USER||!process.env.GMAIL_APP_PASSWORD)return b.status(503).json({error:"Gmail not configured.",hint:"Add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local and restart."});let c=("string"==typeof a.body?JSON.parse(a.body||"{}"):a.body||{}).pairs;if(!Array.isArray(c)||0===c.length)return b.status(400).json({error:"pairs must be a non-empty array."});for(let a of c){let c=Number(a.userAId),d=Number(a.userBId);if(!c||!d||c===d||!Number.isInteger(c)||!Number.isInteger(d))return b.status(400).json({error:`Invalid pair: ${JSON.stringify(a)}`})}let d=[...new Set(c.flatMap(a=>[Number(a.userAId),Number(a.userBId)]))],{data:e,error:f}=await p.from("responses").select("*").in("id",d);if(f)return b.status(500).json({error:f.message});let h=Object.fromEntries((e||[]).map(a=>[Number(a.id),a])),l=new g.ImapFlow({host:"imap.gmail.com",port:993,secure:!0,auth:{user:process.env.GMAIL_USER,pass:process.env.GMAIL_APP_PASSWORD},logger:!1});try{await l.connect();let a=await n(l),d=[],e=[];for(let b of c){let c=Number(b.userAId),f=Number(b.userBId),g=h[c],n=h[f];if(!g||!n){d.push({userAId:c,userBId:f,error:"User not found"});continue}let o=(0,j.c)(g,n),p=Math.max(0,Math.min(100,Math.round(o.finalScore||Number(b.match_score)||0))),q=[];for(let[b,c]of[[g,n],[n,g]]){if(console.log("[draft-debug] receiver:",{id:b.id,name:b.name,email:b.email,ig:b.ig_username}),console.log("[draft-debug] partner :",{id:c.id,name:c.name,email:c.email,ig:c.ig_username}),!b.email){q.push({to:b.id,skipped:!0,reason:"No email address"});continue}try{let d=(0,k.buildMatchCardHtml)({user:b,target:c,score:p,breakdown:o.dimensionScores||{},intelligence:o}),e=String(b.name).replace(/[^\w\u4e00-\u9fff]/g,"_"),f=String(c.name).replace(/[^\w\u4e00-\u9fff]/g,"_"),g=await m({from:`"Black Cat Under The Moon" <${process.env.GMAIL_USER}>`,to:b.email,subject:`你與 ${c.name} 配對成功 ✨ | Black Cat Under The Moon`,html:(0,i.Mr)({receiver:b,partner:c,score:p}),text:(0,i.Ez)({receiver:b,partner:c,score:p}),attachments:[{filename:`配對卡_${e}_x_${f}.html`,content:d,contentType:"text/html; charset=utf-8"}]});await l.append(a,g,["\\Draft","\\Seen"]),q.push({to:b.id,saved:!0})}catch(a){q.push({to:b.id,saved:!1,error:a.message})}}let[r,s]=c<=f?[c,f]:[f,c];e.push({user_a_id:r,user_b_id:s,match_score:p,notes:"Gmail 草稿已建立"}),d.push({userAId:c,userBId:f,score:p,draftsCreated:q})}return await l.logout(),e.length>0&&await p.from("email_drafts").upsert(e,{onConflict:"user_a_id,user_b_id",ignoreDuplicates:!1}),b.status(200).json({success:!0,results:d})}catch(a){try{await l.logout()}catch(a){}return console.error("[create-gmail-drafts]",a),b.status(500).json({error:a.message||"Internal server error"})}}d()}catch(a){d(a)}})},93721:a=>{a.exports=import("@supabase/supabase-js")}};var b=require("../../../webpack-api-runtime.js");b.C(a);var c=b.X(0,[7169,8288,9898],()=>b(b.s=84580));module.exports=c})();