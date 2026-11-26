const STORAGE_KEY = "kova_os_vault_v1";

const defaultData = {
  user: null, // { ownerName, contact, storeName }
  branches: ["Ota Express", "Ikeja Flagship", "Lekki Hub"],
  products: [
    {
      id: "p1",
      title: "UltraBass Wireless Earbuds",
      price: 24500,
      category: "Electronics",
      branch: "Ota Express",
      stock: 18,
      caption: "Crystal-clear sound with 36-hour battery backup. Order now on Kova!",
      channels: ["Kova Store", "WhatsApp", "TikTok", "Instagram"]
    },
    {
      id: "p2",
      title: "Signature Linen Two-Piece Set",
      price: 38000,
      category: "Fashion",
      branch: "Ikeja Flagship",
      stock: 10,
      caption: "Breathable tailored fit ready for same-day dispatch.",
      channels: ["Kova Store", "Instagram", "TikTok"]
    }
  ],
  orders: [],
  jobs: [
    { id: "j1", title: "TikTok Live Commerce Host", branch: "Ota Express", applied: false },
    { id: "j2", title: "Branch Operations Lead", branch: "Ikeja Flagship", applied: false }
  ]
};

let db = loadVault();
let activeCheckoutProductId = null;

function cloneDefault() {
  return JSON.parse(JSON.stringify(defaultData));
}

function loadVault() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...cloneDefault(), ...JSON.parse(raw) } : cloneDefault();
  } catch {
    return cloneDefault();
  }
}

function saveVault() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Ignore storage restriction errors
  }
}

function naira(val) {
  return "₦" + Number(val || 0).toLocaleString("en-NG");
}

function slugify(str) {
  return (
    String(str || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "store"
  );
}

// =========================================================
// 1. ORBITAL SPLASH SCREEN -> TAP ANYWHERE TO LEAVE
// =========================================================
const orbitalScreen = document.getElementById("orbital-screen");
const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");

function enterFromOrbital() {
  orbitalScreen.classList.add("fade-out");
  setTimeout(() => {
    orbitalScreen.classList.add("hidden");
    if (db.user && db.user.storeName) {
      openWorkspace();
    } else {
      authScreen.classList.remove("hidden");
    }
  }, 420);
}

orbitalScreen.addEventListener("click", enterFromOrbital);
orbitalScreen.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") enterFromOrbital();
});

// =========================================================
// 2. AUTHENTICATION & ACCOUNT CREATION
// =========================================================
const showSignupBtn = document.getElementById("show-signup-btn");
const showSigninBtn = document.getElementById("show-signin-btn");
const signupForm = document.getElementById("signup-form");
const signinForm = document.getElementById("signin-form");

showSignupBtn.addEventListener("click", () => {
  showSignupBtn.classList.add("active");
  showSigninBtn.classList.remove("active");
  signupForm.classList.remove("hidden");
  signinForm.classList.add("hidden");
});

showSigninBtn.addEventListener("click", () => {
  showSigninBtn.classList.add("active");
  showSignupBtn.classList.remove("active");
  signinForm.classList.remove("hidden");
  signupForm.classList.add("hidden");
});

signupForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const ownerName = document.getElementById("reg-name").value.trim();
  const contact = document.getElementById("reg-email").value.trim();
  const storeName = document.getElementById("reg-store").value.trim();
  const primaryBranch = document.getElementById("reg-branch").value.trim();

  db.user = { ownerName, contact, storeName };
  if (primaryBranch && !db.branches.includes(primaryBranch)) {
    db.branches.unshift(primaryBranch);
  }
  saveVault();
  openWorkspace();
});

signinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const contact = document.getElementById("login-email").value.trim();
  if (!db.user) {
    db.user = { ownerName: "Store Owner", contact, storeName: "Kova Prime Mart" };
    saveVault();
  }
  openWorkspace();
});

document.getElementById("demo-access-btn").addEventListener("click", () => {
  if (!db.user) {
    db.user = {
      ownerName: "Demo Founder",
      contact: "founder@kova.shop",
      storeName: "Kova Prime Mart"
    };
    saveVault();
  }
  openWorkspace();
});

document.getElementById("signout-btn").addEventListener("click", () => {
  appShell.classList.add("hidden");
  authScreen.classList.remove("hidden");
});

document.getElementById("account-pill-btn").addEventListener("click", () => {
  switchCategory("business");
});

function openWorkspace() {
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");

  const storeName = db.user?.storeName || "Kova Prime Mart";
  document.getElementById("header-store-name").textContent = storeName;
  document.getElementById("header-store-slug").textContent = `kova.shop/${slugify(storeName)}`;
  document.getElementById("account-pill-btn").textContent = db.user?.ownerName || "Account";

  syncBranchSelectors();
  renderMarketplace();
  renderBusinessPro();
  renderHiring();
}

// =========================================================
// 3. CATEGORY NAVIGATION
// =========================================================
function switchCategory(viewName) {
  document.querySelectorAll(".cat-pill").forEach((pill) => {
    pill.classList.toggle("active", pill.dataset.view === viewName);
  });
  document.querySelectorAll(".view-section").forEach((sec) => {
    sec.classList.toggle("active", sec.id === "view-" + viewName);
  });
}

document.querySelectorAll(".cat-pill").forEach((pill) => {
  pill.addEventListener("click", () => switchCategory(pill.dataset.view));
});

// =========================================================
// 4. UPLOAD ONCE & BLAST TO ALL SOCIALS
// =========================================================
document.getElementById("product-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("prod-title").value.trim();
  const price = Number(document.getElementById("prod-price").value);
  const category = document.getElementById("prod-cat").value;
  const branch = document.getElementById("prod-branch").value;
  const stock = Number(document.getElementById("prod-stock").value);
  const caption = document.getElementById("prod-caption").value.trim();
  const channels = [...document.querySelectorAll('input[name="channel"]:checked')].map((el) => el.value);

  if (!title || !price) return;

  const storeName = db.user?.storeName || "Kova Store";
  const selectedChannels = channels.length ? channels : ["Kova Store"];
  const finalCaption = caption || `${title} is now live at ${storeName}!`;

  db.products.unshift({
    id: "p_" + Date.now(),
    title,
    price,
    category,
    branch,
    stock,
    caption: finalCaption,
    channels: selectedChannels
  });

  saveVault();
  renderMarketplace();
  renderBusinessPro();

  const feedback = document.getElementById("blast-feedback");
  feedback.classList.remove("hidden");
  feedback.innerHTML = `<strong>Blasted live!</strong> "${title}" (${naira(price)}) synced to <strong>${selectedChannels.join(", ")}</strong> under ${branch}.`;

  e.target.reset();
  document.getElementById("prod-stock").value = "20";
});

// =========================================================
// 5. SLEEK MARKETPLACE & ESCROW CHECKOUT
// =========================================================
const marketSearch = document.getElementById("market-search");
const marketFilterCat = document.getElementById("market-filter-cat");

marketSearch.addEventListener("input", renderMarketplace);
marketFilterCat.addEventListener("change", renderMarketplace);

function renderMarketplace() {
  const q = marketSearch.value.toLowerCase().trim();
  const cat = marketFilterCat.value;
  const grid = document.getElementById("marketplace-grid");

  const items = db.products.filter((p) => {
    const matchCat = cat === "All" || p.category === cat;
    const matchQ =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.branch.toLowerCase().includes(q) ||
      p.caption.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  if (!items.length) {
    grid.innerHTML = `<p class="subtext">No items match your filter.</p>`;
    return;
  }

  grid.innerHTML = items
    .map(
      (p) => `
      <article class="product-card">
        <div>
          <div class="prod-tag">${p.category} • ${p.branch}</div>
          <h3 class="prod-title">${p.title}</h3>
          <p class="prod-caption">${p.caption}</p>
          <div class="prod-channels">Live on: ${p.channels.join(" · ")}</div>
        </div>
        <div>
          <div class="prod-price-row">
            <span class="prod-price">${naira(p.price)}</span>
            <span class="prod-stock">${p.stock} in stock</span>
          </div>
          <button type="button" class="btn-glow" onclick="openCheckout('${p.id}')" ${p.stock <= 0 ? "disabled" : ""}>
            ${p.stock > 0 ? "Order with Escrow" : "Sold Out"}
          </button>
        </div>
      </article>
    `
    )
    .join("");
}

const checkoutModal = document.getElementById("checkout-modal");
const checkoutMsg = document.getElementById("checkout-msg");

window.openCheckout = function (productId) {
  const item = db.products.find((p) => p.id === productId);
  if (!item || item.stock <= 0) return;

  activeCheckoutProductId = productId;
  checkoutMsg.textContent = "";
  document.getElementById("checkout-item-info").innerHTML = `
    <strong>${item.title}</strong>
    <div class="subtext" style="margin:4px 0;">Branch: ${item.branch}</div>
    <div class="prod-price">${naira(item.price)}</div>
  `;
  checkoutModal.classList.remove("hidden");
};

document.getElementById("close-checkout-btn").addEventListener("click", () => {
  checkoutModal.classList.add("hidden");
  activeCheckoutProductId = null;
});

document.getElementById("copy-link-btn").addEventListener("click", async () => {
  const item = db.products.find((p) => p.id === activeCheckoutProductId);
  if (!item) return;
  const link = `https://kova.shop/${slugify(db.user?.storeName)}/pay/${item.id}`;
  try {
    await navigator.clipboard.writeText(link);
    checkoutMsg.textContent = `Copied link: ${link}`;
  } catch {
    checkoutMsg.textContent = `Checkout link: ${link}`;
  }
});

document.getElementById("confirm-order-btn").addEventListener("click", () => {
  const item = db.products.find((p) => p.id === activeCheckoutProductId);
  if (!item || item.stock <= 0) return;

  const buyer = document.getElementById("buyer-name").value.trim() || "Verified Buyer";
  const note = document.getElementById("buyer-note").value.trim() || item.branch;

  item.stock -= 1;
  db.orders.unshift({
    id: "ORD-" + String(Date.now()).slice(-5),
    productTitle: item.title,
    amount: item.price,
    buyer,
    note,
    status: "In Escrow"
  });

  saveVault();
  renderMarketplace();
  renderBusinessPro();

  checkoutMsg.textContent = `Escrow order confirmed for ${buyer}!`;
  document.getElementById("buyer-name").value = "";
  document.getElementById("buyer-note").value = "";
});

// =========================================================
// 6. BUSINESS PRO (KPIs, BRANCHES, ESCROW LEDGER, EXPORT)
// =========================================================
function syncBranchSelectors() {
  const optionsHtml = db.branches.map((b) => `<option value="${b}">${b}</option>`).join("");
  document.getElementById("prod-branch").innerHTML = optionsHtml;
  document.getElementById("transfer-dest").innerHTML = optionsHtml;
  document.getElementById("transfer-item").innerHTML = db.products
    .map((p) => `<option value="${p.id}">${p.title} (${p.branch})</option>`)
    .join("");
}

document.getElementById("add-branch-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("new-branch-name");
  const name = input.value.trim();
  if (!name || db.branches.includes(name)) return;

  db.branches.push(name);
  saveVault();
  syncBranchSelectors();
  document.getElementById("branch-msg").textContent = `Added branch "${name}".`;
  input.value = "";
});

document.getElementById("transfer-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const itemId = document.getElementById("transfer-item").value;
  const dest = document.getElementById("transfer-dest").value;
  const product = db.products.find((p) => p.id === itemId);
  if (!product) return;

  product.branch = dest;
  saveVault();
  syncBranchSelectors();
  renderMarketplace();
  document.getElementById("branch-msg").textContent = `Reassigned "${product.title}" to ${dest}.`;
});

function renderBusinessPro() {
  syncBranchSelectors();

  const totalRevenue = db.orders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const totalUnits = db.products.reduce((sum, p) => sum + Number(p.stock || 0), 0);

  document.getElementById("kpi-revenue").textContent = naira(totalRevenue);
  document.getElementById("kpi-skus").textContent = db.products.length;
  document.getElementById("kpi-units").textContent = totalUnits;
  document.getElementById("kpi-orders").textContent = db.orders.length;

  const ledger = document.getElementById("orders-ledger");
  if (!db.orders.length) {
    ledger.innerHTML = `<p class="subtext">No escrow orders yet. Orders placed in the Marketplace appear here.</p>`;
    return;
  }

  ledger.innerHTML = db.orders
    .map(
      (o) => `
      <div class="list-row">
        <div>
          <strong>${o.id} • ${o.productTitle}</strong>
          <div class="subtext" style="margin:2px 0 0;">${o.buyer} (${o.note})</div>
        </div>
        <div style="text-align:right;">
          <div class="prod-price" style="font-size:0.9rem;">${naira(o.amount)}</div>
          <span class="badge-live">${o.status}</span>
        </div>
      </div>
    `
    )
    .join("");
}

document.getElementById("export-data-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(db.user?.storeName || "kova")}-backup.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// =========================================================
// 7. KOVA TALENT / HIRING HUB
// =========================================================
document.getElementById("job-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("job-title").value.trim();
  const branch = document.getElementById("job-branch").value.trim();
  if (!title || !branch) return;

  db.jobs.unshift({ id: "j_" + Date.now(), title, branch, applied: false });
  saveVault();
  renderHiring();
  e.target.reset();
});

function renderHiring() {
  const list = document.getElementById("jobs-container");
  const storeName = db.user?.storeName || "Kova Prime Mart";

  list.innerHTML = db.jobs
    .map(
      (j) => `
      <div class="list-row">
        <div>
          <strong>${j.title}</strong>
          <div class="subtext" style="margin:2px 0 0;">${storeName} • ${j.branch}</div>
        </div>
        <button type="button" class="btn-secondary" onclick="toggleApplyJob('${j.id}')">
          ${j.applied ? "Applied ✓" : "1-Click Apply"}
        </button>
      </div>
    `
    )
    .join("");
}

window.toggleApplyJob = function (jobId) {
  const job = db.jobs.find((j) => j.id === jobId);
  if (!job) return;
  job.applied = true;
  saveVault();
  renderHiring();
};
