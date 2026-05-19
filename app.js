/* ========================================
   InventoryPro - app.js
   Frontend logic — calls Java REST backend
   BASE_URL points to your Java servlet/Spring Boot server
   ======================================== */

const BASE_URL = "http://localhost:8080/inventory/api"; // Change if needed
const LOW_STOCK_DEFAULT = 10;

let products = [];
let modalAction = null; // { type: 'add'|'sell', id }

/* =====================
   AUTH
   ===================== */
function doLogin() {
  const user = document.getElementById("loginUser").value.trim();
  const pass = document.getElementById("loginPass").value.trim();
  const err  = document.getElementById("loginError");

  if (!user || !pass) { err.textContent = "Please enter username and password."; return; }

  // Call Java backend for auth
  fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user, password: pass })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      sessionStorage.setItem("token", data.token || "loggedin");
      document.getElementById("loginScreen").classList.add("hidden");
      document.getElementById("appScreen").classList.remove("hidden");
      loadProducts();
    } else {
      err.textContent = data.message || "Invalid credentials.";
    }
  })
  .catch(() => {
    // DEMO MODE: bypass backend if not running
    if (user === "admin" && pass === "admin123") {
      sessionStorage.setItem("token", "demo");
      document.getElementById("loginScreen").classList.add("hidden");
      document.getElementById("appScreen").classList.remove("hidden");
      loadDemoData();
    } else {
      err.textContent = "Cannot connect to server. Use admin / admin123 for demo.";
    }
  });
}

function doLogout() {
  sessionStorage.removeItem("token");
  document.getElementById("appScreen").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("loginUser").value = "";
  document.getElementById("loginPass").value = "";
}

/* =====================
   NAVIGATION
   ===================== */
function showSection(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  event.currentTarget && event.currentTarget.classList.add("active");
  if (id === "alerts") renderAlerts();
}

/* =====================
   DATA LOADING
   ===================== */
function loadProducts() {
  const token = sessionStorage.getItem("token");
  fetch(`${BASE_URL}/products`, {
    headers: { "Authorization": "Bearer " + token }
  })
  .then(r => r.json())
  .then(data => {
    products = data;
    refreshUI();
  })
  .catch(() => loadDemoData());
}

function loadDemoData() {
  products = [
    { id: 1, name: "Samsung TV 32\"", category: "Electronics", quantity: 15, price: 18999, threshold: 5 },
    { id: 2, name: "Office Chair",    category: "Furniture",    quantity: 3,  price: 4500,  threshold: 5 },
    { id: 3, name: "A4 Paper Ream",   category: "Stationery",   quantity: 8,  price: 350,   threshold: 10 },
    { id: 4, name: "Laptop Stand",    category: "Electronics",  quantity: 0,  price: 1299,  threshold: 5 },
    { id: 5, name: "Wireless Mouse",  category: "Electronics",  quantity: 22, price: 799,   threshold: 10 },
    { id: 6, name: "Notebook Pack",   category: "Stationery",   quantity: 50, price: 199,   threshold: 15 },
  ];
  refreshUI();
}

function refreshUI() {
  renderDashboard();
  renderProductsTable();
  updateAlertBadge();
}

/* =====================
   DASHBOARD
   ===================== */
function renderDashboard() {
  const total    = products.length;
  const inStock  = products.filter(p => p.quantity > 0).length;
  const lowStock = products.filter(p => p.quantity > 0 && p.quantity <= (p.threshold || LOW_STOCK_DEFAULT)).length;
  const outOfStock = products.filter(p => p.quantity === 0).length;
  const totalVal = products.reduce((s, p) => s + p.price * p.quantity, 0);

  document.getElementById("totalProducts").textContent = total;
  document.getElementById("inStock").textContent = inStock;
  document.getElementById("lowStockCount").textContent = lowStock + outOfStock;
  document.getElementById("totalValue").textContent = "₹" + totalVal.toLocaleString("en-IN");

  const tbody = document.getElementById("dashboardBody");
  tbody.innerHTML = products.slice(0, 6).map(p => `
    <tr>
      <td><code>#${p.id}</code></td>
      <td><strong>${p.name}</strong></td>
      <td>${p.category}</td>
      <td>${p.quantity}</td>
      <td>₹${p.price.toLocaleString("en-IN")}</td>
      <td>${statusBadge(p)}</td>
    </tr>
  `).join("");
}

/* =====================
   PRODUCTS TABLE
   ===================== */
function renderProductsTable(list) {
  const data = list || products;
  const tbody = document.getElementById("productsBody");
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">No products found.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(p => `
    <tr>
      <td><code>#${p.id}</code></td>
      <td><strong>${p.name}</strong></td>
      <td>${p.category}</td>
      <td style="font-family:'JetBrains Mono',monospace">${p.quantity}</td>
      <td>₹${p.price.toLocaleString("en-IN")}</td>
      <td>${statusBadge(p)}</td>
      <td>
        <button class="action-btn btn-edit"   onclick="editProduct(${p.id})">✏️ Edit</button>
        <button class="action-btn btn-add"    onclick="openModal('add',${p.id})">➕ Restock</button>
        <button class="action-btn btn-sell"   onclick="openModal('sell',${p.id})">🛒 Sell</button>
        <button class="action-btn btn-delete" onclick="deleteProduct(${p.id})">🗑️ Delete</button>
      </td>
    </tr>
  `).join("");
}

function filterProducts() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q)
  );
  renderProductsTable(filtered);
}

/* =====================
   ALERTS
   ===================== */
function renderAlerts() {
  const alerts = products.filter(p => p.quantity <= (p.threshold || LOW_STOCK_DEFAULT));
  const container = document.getElementById("alertList");
  if (alerts.length === 0) {
    container.innerHTML = `<div class="no-alerts">✅ All products are well stocked!</div>`;
    return;
  }
  container.innerHTML = alerts.map(p => `
    <div class="alert-card ${p.quantity === 0 ? 'out-of-stock' : ''}">
      <div class="alert-info">
        <strong>${p.name}</strong>
        <span>${p.category} · Quantity: <b>${p.quantity}</b> · Threshold: ${p.threshold || LOW_STOCK_DEFAULT}</span>
      </div>
      <div>
        <span class="status-badge ${p.quantity === 0 ? 'status-out' : 'status-low'}">
          ${p.quantity === 0 ? '🔴 Out of Stock' : '⚠️ Low Stock'}
        </span>
        <button class="action-btn btn-add" style="margin-left:8px" onclick="openModal('add',${p.id})">➕ Restock</button>
      </div>
    </div>
  `).join("");
}

function updateAlertBadge() {
  const count = products.filter(p => p.quantity <= (p.threshold || LOW_STOCK_DEFAULT)).length;
  const badge = document.getElementById("alertBadge");
  badge.textContent = count;
  count > 0 ? badge.classList.remove("hidden") : badge.classList.add("hidden");
}

/* =====================
   ADD / EDIT PRODUCT
   ===================== */
function saveProduct() {
  const id       = document.getElementById("editId").value;
  const name     = document.getElementById("prodName").value.trim();
  const category = document.getElementById("prodCategory").value;
  const qty      = parseInt(document.getElementById("prodQty").value);
  const price    = parseFloat(document.getElementById("prodPrice").value);
  const threshold= parseInt(document.getElementById("prodThreshold").value) || LOW_STOCK_DEFAULT;
  const msgEl    = document.getElementById("formMsg");

  if (!name || !category || isNaN(qty) || isNaN(price)) {
    msgEl.textContent = "⚠️ Please fill all required fields.";
    msgEl.className = "form-msg msg-error";
    return;
  }

  const product = { name, category, quantity: qty, price, threshold };
  const isEdit  = !!id;

  const url     = isEdit ? `${BASE_URL}/products/${id}` : `${BASE_URL}/products`;
  const method  = isEdit ? "PUT" : "POST";

  fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + sessionStorage.getItem("token")
    },
    body: JSON.stringify(product)
  })
  .then(r => r.json())
  .then(saved => {
    if (isEdit) {
      const idx = products.findIndex(p => p.id == id);
      products[idx] = { ...product, id: parseInt(id) };
    } else {
      products.push({ ...product, id: saved.id || Date.now() });
    }
    msgEl.textContent = isEdit ? "✅ Product updated!" : "✅ Product added!";
    msgEl.className = "form-msg msg-success";
    clearForm();
    refreshUI();
  })
  .catch(() => {
    // Demo mode: local update
    if (isEdit) {
      const idx = products.findIndex(p => p.id == id);
      products[idx] = { ...product, id: parseInt(id) };
    } else {
      products.push({ ...product, id: products.length + 1 });
    }
    msgEl.textContent = isEdit ? "✅ Product updated! (demo)" : "✅ Product added! (demo)";
    msgEl.className = "form-msg msg-success";
    refreshUI();
  });
}

function editProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  document.getElementById("editId").value        = p.id;
  document.getElementById("prodName").value      = p.name;
  document.getElementById("prodCategory").value  = p.category;
  document.getElementById("prodQty").value       = p.quantity;
  document.getElementById("prodPrice").value     = p.price;
  document.getElementById("prodThreshold").value = p.threshold;
  document.getElementById("formTitle").textContent = "Edit Product";
  showSection("addProduct");
}

function clearForm() {
  ["editId","prodName","prodQty","prodPrice","prodThreshold"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("prodCategory").value = "";
  document.getElementById("formTitle").textContent = "Add New Product";
  document.getElementById("formMsg").textContent = "";
}

/* =====================
   DELETE
   ===================== */
function deleteProduct(id) {
  if (!confirm("Delete this product? This cannot be undone.")) return;

  fetch(`${BASE_URL}/products/${id}`, {
    method: "DELETE",
    headers: { "Authorization": "Bearer " + sessionStorage.getItem("token") }
  })
  .then(() => { products = products.filter(p => p.id !== id); refreshUI(); })
  .catch(() => { products = products.filter(p => p.id !== id); refreshUI(); });
}

/* =====================
   MODAL: ADD STOCK / SELL
   ===================== */
function openModal(type, id) {
  modalAction = { type, id };
  const p = products.find(x => x.id === id);
  document.getElementById("modalTitle").textContent =
    type === "add" ? `➕ Restock: ${p.name}` : `🛒 Sell: ${p.name}`;
  document.getElementById("modalLabel").textContent =
    type === "add" ? `Add how many units? (Current: ${p.quantity})` : `Sell how many units? (Current: ${p.quantity})`;
  document.getElementById("modalQty").value = "";
  document.getElementById("modal").classList.remove("hidden");
}

function confirmModal() {
  const qty = parseInt(document.getElementById("modalQty").value);
  if (isNaN(qty) || qty <= 0) { alert("Enter a valid quantity > 0"); return; }

  const { type, id } = modalAction;
  const p = products.find(x => x.id === id);

  if (type === "sell" && qty > p.quantity) {
    alert(`Only ${p.quantity} units available!`); return;
  }

  const newQty = type === "add" ? p.quantity + qty : p.quantity - qty;

  fetch(`${BASE_URL}/products/${id}/stock`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + sessionStorage.getItem("token")
    },
    body: JSON.stringify({ quantity: newQty })
  })
  .then(() => { p.quantity = newQty; refreshUI(); closeModal(); })
  .catch(() => { p.quantity = newQty; refreshUI(); closeModal(); });
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  modalAction = null;
}

/* =====================
   HELPERS
   ===================== */
function statusBadge(p) {
  if (p.quantity === 0)
    return `<span class="status-badge status-out">Out of Stock</span>`;
  if (p.quantity <= (p.threshold || LOW_STOCK_DEFAULT))
    return `<span class="status-badge status-low">Low Stock</span>`;
  return `<span class="status-badge status-ok">In Stock</span>`;
}

// Press Enter to login
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && !document.getElementById("loginScreen").classList.contains("hidden")) doLogin();
});
