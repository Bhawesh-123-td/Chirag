const KEY = "smartInventoryV1";
let transactions = JSON.parse(localStorage.getItem(KEY) || "[]");

const $ = id => document.getElementById(id);
const money = n => `Rs. ${Number(n || 0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const today = () => new Date().toISOString().slice(0,10);
$("purchaseDate").value = today();
$("saleDate").value = today();

function save(){ localStorage.setItem(KEY, JSON.stringify(transactions)); render(); }
function normalize(s){ return s.trim().toLowerCase(); }

function calculate(){
  const products = {};
  let purchaseTotal=0, revenue=0, cogs=0;

  const ordered = [...transactions].sort((a,b)=>a.created-b.created);
  for(const t of ordered){
    const key=normalize(t.product);
    if(!products[key]) products[key]={name:t.product,purchased:0,sold:0,costValue:0,avgCost:0,stock:0};
    const p=products[key];
    if(t.type==="purchase"){
      p.purchased += t.qty;
      p.costValue += t.qty*t.price;
      p.stock += t.qty;
      p.avgCost = p.purchased ? p.costValue/p.purchased : 0;
      purchaseTotal += t.qty*t.price;
    }else{
      const unitCost=p.avgCost || 0;
      const saleCogs=t.qty*unitCost;
      t._cogs=saleCogs;
      p.sold += t.qty;
      p.stock -= t.qty;
      cogs += saleCogs;
      revenue += t.qty*t.price;
    }
  }
  return {products,purchaseTotal,revenue,cogs,profit:revenue-cogs};
}

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
    <tr>
      <td><strong>${esc(p.name)}</strong></td><td>${fmtQty(p.purchased)}</td><td>${fmtQty(p.sold)}</td>
      <td class="${p.stock<0?'stock-low':'stock-ok'}">${fmtQty(p.stock)}</td>
      <td>${money(p.avgCost)}</td><td>${money(Math.max(0,p.stock)*p.avgCost)}</td>
    </tr>`).join(""):`<tr><td colspan="6" class="empty">No inventory yet.</td></tr>`;

  const purchases=transactions.filter(t=>t.type==="purchase").sort((a,b)=>b.created-a.created);
  $("purchaseHistory").innerHTML=purchases.length?purchases.map(t=>`
    <tr><td>${t.date}</td><td>${esc(t.product)}</td><td>${fmtQty(t.qty)}</td><td>${money(t.price)}</td>
    <td>${money(t.qty*t.price)}</td><td><button class="delete" onclick="removeTx('${t.id}')">Delete</button></td></tr>`
  ).join(""):`<tr><td colspan="6" class="empty">No purchases yet.</td></tr>`;

  const sales=transactions.filter(t=>t.type==="sale").sort((a,b)=>b.created-a.created);
  $("salesHistory").innerHTML=sales.length?sales.map(t=>`
    <tr><td>${t.date}</td><td>${esc(t.product)}</td><td>${fmtQty(t.qty)}</td><td>${money(t.price)}</td>
    <td>${money(t.qty*t.price)}</td><td>${money(t.qty*t.price-t._cogs)}</td>
    <td><button class="delete" onclick="removeTx('${t.id}')">Delete</button></td></tr>`
  ).join(""):`<tr><td colspan="7" class="empty">No sales yet.</td></tr>`;
}

function fmtQty(n){ return Number(n).toLocaleString("en-IN",{maximumFractionDigits:2}); }
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

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

$("purchaseForm").addEventListener("submit",e=>{
  e.preventDefault();
  const qty=Number($("purchaseQty").value), price=Number($("purchasePrice").value);
  if(qty<=0||price<0)return;
  transactions.push({id:crypto.randomUUID(),type:"purchase",date:$("purchaseDate").value,invoice:$("purchaseInvoice").value.trim(),product:$("purchaseProduct").value.trim(),qty,price,created:Date.now()});
  e.target.reset(); $("purchaseDate").value=today(); save(); updateTotals();
});

$("saleForm").addEventListener("submit",e=>{
  e.preventDefault();
  const product=$("saleProduct").value.trim(), key=normalize(product);
  const qty=Number($("saleQty").value), price=Number($("salePrice").value);
  const p=calculate().products[key];
  if(!p){alert("This product has no purchase record.");return;}
  if(qty<=0||price<0)return;
  if(qty>p.stock){alert(`Not enough stock. Available: ${fmtQty(p.stock)}.`);return;}
  transactions.push({id:crypto.randomUUID(),type:"sale",date:$("saleDate").value,invoice:$("saleInvoice").value.trim(),product,qty,price,created:Date.now()});
  e.target.reset(); $("saleDate").value=today(); save(); updateTotals();
});

window.removeTx=id=>{
  if(!confirm("Delete this transaction?"))return;
  transactions=transactions.filter(t=>t.id!==id); save(); updateTotals();
};

$("clearAllBtn").addEventListener("click",()=>{
  if(confirm("Delete ALL purchases and sales from this browser?")){
    transactions=[];save();updateTotals();
  }
});

render(); updateTotals();
