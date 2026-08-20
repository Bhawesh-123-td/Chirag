/*
  SMART INVENTORY
  Local mode works immediately.
  Optional cloud mode uses Supabase free tier.

  To enable cloud:
  1. Create a free Supabase project.
  2. Create table:
     create table transactions (
       id uuid primary key,
       user_id uuid references auth.users not null,
       type text not null,
       date date not null,
       invoice text,
       vendor text,
       pan text,
       product text not null,
       qty numeric not null,
       price numeric not null,
       created bigint not null
     );
  3. Enable Row Level Security and add policies allowing users to
     select/insert/delete their own rows.
  4. Put your Project URL and anon key in SUPABASE_URL and SUPABASE_ANON_KEY.
*/

const KEY = "smartInventoryV2";
const SUPABASE_URL = "";       // Optional: paste your free Supabase project URL
const SUPABASE_ANON_KEY = "";  // Optional: paste your free Supabase anon key
let supabaseClient = null;
let cloudUser = null;
let transactions = JSON.parse(localStorage.getItem(KEY) || "[]");

const $ = id => document.getElementById(id);
const money = n => `Rs. ${Number(n || 0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const today = () => new Date().toISOString().slice(0,10);
$("purchaseDate").value = today();
$("saleDate").value = today();

if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  supabaseClient.auth.getSession().then(({data}) => {
    cloudUser = data.session?.user || null;
    updateCloudStatus();
    if (cloudUser) loadCloudData();
  });
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    cloudUser = session?.user || null;
    updateCloudStatus();
    if (cloudUser) loadCloudData();
  });
}

function saveLocal(){ localStorage.setItem(KEY, JSON.stringify(transactions)); }
function normalize(s){ return String(s||"").trim().toLowerCase(); }
function updateCloudStatus(){
  $("cloudStatus").textContent = cloudUser ? `Cloud: ${cloudUser.email}` : (supabaseClient ? "Cloud ready" : "Local mode");
}
async function loadCloudData(){
  if(!supabaseClient || !cloudUser) return;
  const {data,error}=await supabaseClient.from("transactions").select("*").eq("user_id",cloudUser.id).order("created",{ascending:true});
  if(error){ console.warn(error); alert("Cloud table/policies are not configured yet. Local mode is still working."); return; }
  transactions=(data||[]).map(t=>({...t,created:Number(t.created)}));
  saveLocal(); render(); updateTotals();
}
async function cloudInsert(t){
  if(!supabaseClient || !cloudUser) return;
  const {error}=await supabaseClient.from("transactions").insert([{...t,user_id:cloudUser.id}]);
  if(error) console.warn(error);
}
async function cloudDelete(id){
  if(!supabaseClient || !cloudUser) return;
  await supabaseClient.from("transactions").delete().eq("id",id).eq("user_id",cloudUser.id);
}

function calculate(){
  const products = {};
  let purchaseTotal=0, revenue=0, cogs=0;
  const ordered = [...transactions].sort((a,b)=>a.created-b.created);
  for(const t of ordered){
    const key=normalize(t.product);
    if(!products[key]) products[key]={name:t.product,purchased:0,sold:0,costValue:0,avgCost:0,stock:0};
    const p=products[key];
    if(t.type==="purchase"){
      p.purchased += Number(t.qty);
      p.costValue += Number(t.qty)*Number(t.price);
      p.stock += Number(t.qty);
      p.avgCost = p.purchased ? p.costValue/p.purchased : 0;
      purchaseTotal += Number(t.qty)*Number(t.price);
    }else{
      const unitCost=p.avgCost||0;
      t._cogs=Number(t.qty)*unitCost;
      p.sold += Number(t.qty);
      p.stock -= Number(t.qty);
      cogs += t._cogs;
      revenue += Number(t.qty)*Number(t.price);
    }
  }
  return {products,purchaseTotal,revenue,cogs,profit:revenue-cogs};
}

function fmtQty(n){ return Number(n).toLocaleString("en-IN",{maximumFractionDigits:2}); }
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

function render(){
  const data=calculate();
  $("totalPurchase").textContent=money(data.purchaseTotal);
  $("totalSales").textContent=money(data.revenue);
  $("totalCOGS").textContent=money(data.cogs);
  $("totalProfit").textContent=money(data.profit);
  $("summaryRevenue").textContent=money(data.revenue);
  $("summaryPurchases").textContent=money(data.purchaseTotal);
  $("summaryCOGS").textContent=money(data.cogs);
  $("summaryProfit").textContent=money(data.profit);

  const filter=normalize($("inventorySearch").value||"");
  const rows=Object.values(data.products).filter(p=>!filter||normalize(p.name).includes(filter));
  $("inventoryBody").innerHTML=rows.length?rows.map(p=>`
    <tr><td><strong>${esc(p.name)}</strong></td><td>${fmtQty(p.purchased)}</td><td>${fmtQty(p.sold)}</td>
    <td class="${p.stock<0?'stock-low':'stock-ok'}">${fmtQty(p.stock)}</td><td>${money(p.avgCost)}</td>
    <td>${money(Math.max(0,p.stock)*p.avgCost)}</td></tr>`).join(""):`<tr><td colspan="6" class="empty">No inventory yet.</td></tr>`;

  const purchases=transactions.filter(t=>t.type==="purchase").sort((a,b)=>b.created-a.created);
  $("purchaseHistory").innerHTML=purchases.length?purchases.map(t=>`
    <tr><td>${t.date}</td><td>${esc(t.vendor||"—")}</td><td>${esc(t.pan||"—")}</td>
    <td>${esc(t.product)}</td><td>${fmtQty(t.qty)}</td><td>${money(t.price)}</td><td>${money(t.qty*t.price)}</td>
    <td><button class="delete" onclick="removeTx('${t.id}')">Delete</button></td></tr>`
  ).join(""):`<tr><td colspan="8" class="empty">No purchases yet.</td></tr>`;

  const sales=transactions.filter(t=>t.type==="sale").sort((a,b)=>b.created-a.created);
  $("salesHistory").innerHTML=sales.length?sales.map(t=>`
    <tr><td>${t.date}</td><td>${esc(t.product)}</td><td>${fmtQty(t.qty)}</td><td>${money(t.price)}</td>
    <td>${money(t.qty*t.price)}</td><td>${money(t.qty*t.price-t._cogs)}</td>
    <td><button class="delete" onclick="removeTx('${t.id}')">Delete</button></td></tr>`
  ).join(""):`<tr><td colspan="7" class="empty">No sales yet.</td></tr>`;
}

function updateTotals(){
  const pq=Number($("purchaseQty").value||0), pp=Number($("purchasePrice").value||0);
  $("purchaseTotal").value=money(pq*pp);
  const sq=Number($("saleQty").value||0), sp=Number($("salePrice").value||0);
  $("saleTotal").value=money(sq*sp);
  const product=normalize($("saleProduct").value||"");
  if(product){
    const p=calculate().products[product];
    $("saleStockHint").textContent=p?`Available stock: ${fmtQty(p.stock)} units`:"No purchase found for this product.";
  }else $("saleStockHint").textContent="Enter a product to see available stock.";
}

["purchaseQty","purchasePrice","saleQty","salePrice","saleProduct"].forEach(id=>$(id).addEventListener("input",updateTotals));
$("inventorySearch").addEventListener("input",render);

$("purchaseForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const qty=Number($("purchaseQty").value), price=Number($("purchasePrice").value);
  if(qty<=0||price<0)return;
  const t={id:crypto.randomUUID(),type:"purchase",date:$("purchaseDate").value,
    invoice:$("purchaseInvoice").value.trim(),vendor:$("purchaseVendor").value.trim(),
    pan:$("purchasePAN").value.trim(),product:$("purchaseProduct").value.trim(),
    qty,price,created:Date.now()};
  transactions.push(t); saveLocal(); await cloudInsert(t);
  e.target.reset(); $("purchaseDate").value=today(); render(); updateTotals();
});

$("saleForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const product=$("saleProduct").value.trim(), key=normalize(product);
  const qty=Number($("saleQty").value), price=Number($("salePrice").value);
  const p=calculate().products[key];
  if(!p){alert("This product has no purchase record.");return;}
  if(qty<=0||price<0)return;
  if(qty>p.stock){alert(`Not enough stock. Available: ${fmtQty(p.stock)}.`);return;}
  const t={id:crypto.randomUUID(),type:"sale",date:$("saleDate").value,
    invoice:$("saleInvoice").value.trim(),vendor:"",pan:"",product,qty,price,created:Date.now()};
  transactions.push(t); saveLocal(); await cloudInsert(t);
  e.target.reset(); $("saleDate").value=today(); render(); updateTotals();
});

window.removeTx=async id=>{
  if(!confirm("Delete this transaction?"))return;
  transactions=transactions.filter(t=>t.id!==id); saveLocal(); await cloudDelete(id); render(); updateTotals();
};

$("clearAllBtn").addEventListener("click",async()=>{
  if(!confirm("Delete ALL purchases and sales from this browser?"))return;
  if(supabaseClient && cloudUser) await supabaseClient.from("transactions").delete().eq("user_id",cloudUser.id);
  transactions=[];saveLocal();render();updateTotals();
});

$("loginBtn").addEventListener("click",()=> $("authPanel").classList.toggle("hidden"));

$("signUpBtn").addEventListener("click",async()=>{
  if(!supabaseClient){alert("Cloud is not configured yet. Add your free Supabase URL and anon key in app.js.");return;}
  const email=$("authEmail").value.trim(), password=$("authPassword").value;
  const {error}=await supabaseClient.auth.signUp({email,password});
  alert(error?error.message:"Account created. Check your email if confirmation is enabled.");
});
$("signInBtn").addEventListener("click",async()=>{
  if(!supabaseClient){alert("Cloud is not configured yet. Add your free Supabase URL and anon key in app.js.");return;}
  const {error}=await supabaseClient.auth.signInWithPassword({email:$("authEmail").value.trim(),password:$("authPassword").value});
  if(error) alert(error.message);
});
$("signOutBtn").addEventListener("click",async()=>{
  if(supabaseClient) await supabaseClient.auth.signOut();
});

function downloadBlob(content,name,type){
  const blob=new Blob([content],{type}), url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
$("backupBtn").addEventListener("click",()=>{
  downloadBlob(JSON.stringify({exportedAt:new Date().toISOString(),transactions},null,2),"inventory-backup.json","application/json");
});
$("csvBtn").addEventListener("click",()=>{
  const headers=["Type","Date","Invoice","Vendor","PAN No","Product","Quantity","Unit Price","Total"];
  const lines=[headers,...transactions.map(t=>[t.type,t.date,t.invoice||"",t.vendor||"",t.pan||"",t.product,t.qty,t.price,(Number(t.qty)*Number(t.price)).toFixed(2)])]
    .map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  downloadBlob(lines,"inventory-transactions.csv","text/csv;charset=utf-8");
});
$("pdfBtn").addEventListener("click",()=>{
  if(!window.jspdf){alert("PDF library could not load. Reopen the app while connected to the internet.");return;}
  const {jsPDF}=window.jspdf, doc=new jsPDF();
  const d=calculate();
  doc.setFontSize(18);doc.text("SMART INVENTORY REPORT",14,18);
  doc.setFontSize(10);doc.text(`Generated: ${new Date().toLocaleString()}`,14,26);
  doc.text(`Purchases: ${money(d.purchaseTotal)}`,14,38);
  doc.text(`Sales Revenue: ${money(d.revenue)}`,14,46);
  doc.text(`COGS: ${money(d.cogs)}`,14,54);
  doc.text(`Profit: ${money(d.profit)}`,14,62);
  let y=75;doc.setFontSize(9);
  doc.text("Product",14,y);doc.text("Stock",80,y);doc.text("Avg Cost",115,y);doc.text("Stock Value",155,y);y+=7;
  Object.values(d.products).forEach(p=>{
    if(y>280){doc.addPage();y=20;}
    doc.text(String(p.name).slice(0,30),14,y);doc.text(fmtQty(p.stock),80,y);
    doc.text(money(p.avgCost),115,y);doc.text(money(Math.max(0,p.stock)*p.avgCost),155,y);y+=6;
  });
  doc.save("inventory-report.pdf");
});

const creatorBtn = $("creatorBtn");
const backToAppBtn = $("backToAppBtn");
const appPage = $("appPage");
const creatorPage = $("creatorPage");
creatorBtn.addEventListener("click",()=>{
  appPage.classList.add("hidden");
  creatorPage.classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
});
backToAppBtn.addEventListener("click",()=>{
  creatorPage.classList.add("hidden");
  appPage.classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
});

render(); updateTotals(); updateCloudStatus();
