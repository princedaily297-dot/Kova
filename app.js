import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDRXPgC5kSBT04mDyT1BEEyJMDEro5gDLo",
  authDomain: "kova-cloud.firebaseapp.com",
  projectId: "kova-cloud",
  storageBucket: "kova-cloud.firebasestorage.app",
  messagingSenderId: "917204630845",
  appId: "1:917204630845:web:3a5582637f06607ff9d954"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let activeCheckoutProductId = null;

let storeData = {
  ownerName: "Store Owner",
  storeName: "Kova Prime Mart",
  slug: "kova-prime-mart",
  branches: ["Ota Express", "Ikeja Flagship", "Lekki Hub"],
  products: [],
  orders: [],
  jobs: []
};

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

async function persistStore() {
  if (!currentUser) return;
  await setDoc(doc(db, "stores", currentUser.uid), storeData, { merge: true });
}

// =========================================================
// 1. ORBITAL SPLASH SCREEN -> TAP ANYWHERE TO LEAVE
// =========================================================
const orbitalScreen = document.getElementById("orbital-screen");
const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");

let orbitalDismissed = false;

function dismissOrbital() {
  if (orbitalDismissed) return;
  orbitalDismissed = true;
  orbitalScreen.classList.add("fade-out");

  setTimeout(() => {
    orbitalScreen.classList.add("hidden");
    if (currentUser) {
      openWorkspace();
    } else {
      authScreen.classList.remove("hidden");
    }
  }, 420);
}

orbitalScreen.addEventListener("click", dismissOrbital);
orbitalScreen.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") dismissOrbital();
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    try {
      const snap = await getDoc(doc(db, "stores", user.uid));
      if (snap.exists()) {
        storeData = { ...storeData, ...snap.data() };
      }
    } catch (err) {
      console.error("Failed to load store from Firestore:", err);
    }
    if (orbitalDismissed) {
      openWorkspace();
    }
  }
});

// =========================================================
// 2. FIREBASE SIGN UP & SIGN IN
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

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const ownerName = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const storeName = document.getElementById("reg-store").value.trim();
  const primaryBranch = document.getElementById("reg-branch").value.trim() || "Ota Express";
  const password = prompt("Create a password (at least 6 characters):");

  if (!password || password.length < 6) {
    alert("Password must be at least 6 characters.");
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    currentUser = cred.user;
    const branches = storeData.branches.includes(primaryBranch)
      ? storeData.branches
      : [primaryBranch, ...storeData.branches];

    storeData = {
      ownerName,
      storeName,
      slug: `${slugify(storeName)}-${cred.user.uid.slice(0, 5)}`,
      branches,
      products: storeData.products || [],
      orders: storeData.orders || [],
      jobs: storeData.jobs || []
    };

    await setDoc(doc(db, "stores", cred.user.uid), storeData);
    openWorkspace();
  } catch (err) {
    alert(err.message);
  }
});

signinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = prompt("Enter your password:");
  if (!password) return;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    currentUser = cred.user;
    const snap = await getDoc(doc(db, "stores", cred.user.uid));
    if (snap.exists()) {
      storeData = { ...storeData, ...snap.data() };
    }
    openWorkspace();
  } catch (err) {
    alert(err.message);
  }
});

const demoBtn = document.getElementById("demo-access-btn");
if (demoBtn) {
  demoBtn.addEventListener("click", () => {
    openWorkspace();
  });
}

document.getElementById("signout-btn").addEventListener("click", async () => {
  await signOut(auth);
  currentUser = null;
  appShell.classList.add("hidden");
  authScreen.classList.remove("hidden");
});

document.getElementById("account-pill-btn").addEventListener("click", () => {
  switchCategory("business");
});

function openWorkspace() {
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");

  document.getElementById("header-store-name").textContent = storeData.storeName;
  document.getElementById("header-store-slug").textContent = `kova.shop/${storeData.slug}`;
  document.getElementById("account-pill-btn").textContent = storeData.ownerName;

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
// 4. UPLOAD ONCE & BLAST TO ALL SOCIALS (FIRESTORE)
// =========================================================
document.getElementById("product-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("prod-title").value.trim();
  const price = Number(document.getElementById("prod-price").value);
  const category = document.getElementById("prod-cat").value;
  const branch = document.getElementById("prod-branch").value;
  const stock = Number(document.getElementById("prod-stock").value);
  const caption = document.getElementById("prod-caption").value.trim();
  const channels = [...document.querySelectorAll('input[name="channel"]:checked')].map((el) => el.value);

  if (!title || !price) return;

  const selectedChannels = channels.length ? channels : ["Kova Store"];
  const newProduct = {
    id: "p_" + Date.now(),
    title,
    price,
    category,
    branch,
    stock,
    caption: caption || `${title} is now live at ${storeData.storeName}!`,
    channels: selectedChannels
  };

  storeData.products.unshift(newProduct);
  await persistStore();
  renderMarketplace();
  renderBusinessPro();

  const feedback = document.getElementById("blast-feedback");
  feedback.classList.remove("hidden");
  feedback.innerHTML = `<strong>Blasted & Saved to Firebase!</strong> "${title}" (${naira(price)}) synced to <strong>${selectedChannels.join(", ")}</strong>.`;

  e.target.reset();
  document.getElementById("prod-stock").value = "20";
});

// =========================================================
// 5. MARKETPLACE & ESCROW ORDERS
// =========================================================
const marketSearch = document.getElementById("market-search");
const marketFilterCat = document.getElementById("market-filter-cat");

marketSearch.addEventListener("input", renderMarketplace);
marketFilterCat.addEventListener("change", renderMarketplace);

function renderMarketplace() {
  const q = marketSearch.value.toLowerCase().trim();
  const cat = marketFilterCat.value;
  const grid = document.getElementById("marketplace-grid");

  const items = (storeData.products || []).filter((p) => {
    const matchCat = cat === "All" || p.category === cat;
    const matchQ =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.branch.toLowerCase().includes(q) ||
      (p.caption || "").toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  if (!items.length) {
    grid.innerHTML = `<p class="subtext">No items in your store catalog yet.</p>`;
    return;
  }

  grid.innerHTML = items
    .map(
      (p) => `
      <article class="product-card">
        <div>
          <div class="prod-tag">${p.category} • ${p.branch}</div>
          <h3 class="prod-title">${p.title}</h3>
          <p class="prod-caption">${p.caption || ""}</p>
          <div class="prod-channels">Live on: ${(p.channels || []).join(" · ")}</div>
        </div>
        <div>
          <div class="prod-price-row">
            <span class="prod-price">${naira(p.price)}</span>
            <span class="prod-stock">${p.stock} in stock</span>
          </div>
          <button type="button" class="btn-glow" onclick="window.openCheckout('${p.id}')" ${p.stock <= 0 ? "disabled" : ""}>
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
  const item = storeData.products.find((p) => p.id === productId);
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
  const item = storeData.products.find((p) => p.id === activeCheckoutProductId);
  if (!item) return;
  const link = `${window.location.origin}${window.location.pathname}?store=${storeData.slug}&item=${item.id}`;
  try {
    await navigator.clipboard.writeText(link);
    checkoutMsg.textContent = `Copied link: ${link}`;
  } catch {
    checkoutMsg.textContent = `Checkout link: ${link}`;
  }
});

document.getElementById("confirm-order-btn").addEventListener("click", async () => {
  const item = storeData.products.find((p) => p.id === activeCheckoutProductId);
  if (!item || item.stock <= 0) return;

  const buyer = document.getElementById("buyer-name").value.trim() || "Verified Buyer";
  const note = document.getElementById("buyer-note").value.trim() || item.branch;

  item.stock -= 1;
  storeData.orders.unshift({
    id: "ORD-" + String(Date.now()).slice(-5),
    productTitle: item.title,
    amount: item.price,
    buyer,
    note,
    status: "In Escrow"
  });

  await persistStore();
  renderMarketplace();
  renderBusinessPro();

  checkoutMsg.textContent = `Escrow order saved to Firebase for ${buyer}!`;
  document.getElementById("buyer-name").value = "";
  document.getElementById("buyer-note").value = "";
});

// =========================================================
// 6. BUSINESS PRO (BRANCHES, KPIs, LEDGER & BACKUP)
// =========================================================
function syncBranchSelectors() {
  const optionsHtml = (storeData.branches || []).map((b) => `<option value="${b}">${b}</option>`).join("");
  document.getElementById("prod-branch").innerHTML = optionsHtml;
  document.getElementById("transfer-dest").innerHTML = optionsHtml;
  document.getElementById("transfer-item").innerHTML = (storeData.products || [])
    .map((p) => `<option value="${p.id}">${p.title} (${p.branch})</option>`)
    .join("");
}

document.getElementById("add-branch-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("new-branch-name");
  const name = input.value.trim();
  if (!name || storeData.branches.includes(name)) return;

  storeData.branches.push(name);
  await persistStore();
  syncBranchSelectors();
  document.getElementById("branch-msg").textContent = `Added branch "${name}".`;
  input.value = "";
});

document.getElementById("transfer-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const itemId = document.getElementById("transfer-item").value;
  const dest = document.getElementById("transfer-dest").value;
  const product = storeData.products.find((p) => p.id === itemId);
  if (!product) return;

  product.branch = dest;
  await persistStore();
  syncBranchSelectors();
  renderMarketplace();
  document.getElementById("branch-msg").textContent = `Moved "${product.title}" to ${dest}.`;
});

function renderBusinessPro() {
  syncBranchSelectors();

  const totalRevenue = (storeData.orders || []).reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const totalUnits = (storeData.products || []).reduce((sum, p) => sum + Number(p.stock || 0), 0);

  document.getElementById("kpi-revenue").textContent = naira(totalRevenue);
  document.getElementById("kpi-skus").textContent = (storeData.products || []).length;
  document.getElementById("kpi-units").textContent = totalUnits;
  document.getElementById("kpi-orders").textContent = (storeData.orders || []).length;

  const ledger = document.getElementById("orders-ledger");
  if (!storeData.orders?.length) {
    ledger.innerHTML = `<p class="subtext">No escrow orders yet.</p>`;
    return;
  }

  ledger.innerHTML = storeData.orders
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
  const blob = new Blob([JSON.stringify(storeData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${storeData.slug || "kova"}-firebase-backup.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// =========================================================
// 7. KOVA TALENT / HIRING HUB
// =========================================================
document.getElementById("job-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("job-title").value.trim();
  const branch = document.getElementById("job-branch").value.trim();
  if (!title || !branch) return;

  storeData.jobs.unshift({ id: "j_" + Date.now(), title, branch, applied: false });
  await persistStore();
  renderHiring();
  e.target.reset();
});

function renderHiring() {
  const list = document.getElementById("jobs-container");
  if (!storeData.jobs?.length) {
    list.innerHTML = `<p class="subtext">No open roles posted yet.</p>`;
    return;
  }

  list.innerHTML = storeData.jobs
    .map(
      (j) => `
      <div class="list-row">
        <div>
          <strong>${j.title}</strong>
          <div class="subtext" style="margin:2px 0 0;">${storeData.storeName} • ${j.branch}</div>
        </div>
        <button type="button" class="btn-secondary" onclick="window.toggleApplyJob('${j.id}')">
          ${j.applied ? "Applied ✓" : "1-Click Apply"}
        </button>
      </div>
    `
    )
    .join("");
}

window.toggleApplyJob = async function (jobId) {
  const job = storeData.jobs.find((j) => j.id === jobId);
  if (!job) return;
  job.applied = true;
  await persistStore();
  renderHiring();
};
                            
