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
  setDoc,
  collection,
  query,
  where,
  getDocs
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
let pendingPhotoDataUrl = "";
let isBuyerMode = false;
let publicStoreDocId = null;

let storeData = {
  ownerName: "Store Owner",
  storeName: "Kova Prime Mart",
  slug: "kova-prime-mart",
  branches: ["Ota Express", "Ikeja Flagship", "Lekki Hub"],
  bankDetails: {
    bankName: "",
    accountNumber: "",
    accountName: ""
  },
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

function withTimeout(promise, ms = 2500) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms))
  ]);
}

function getTargetStoreRef() {
  if (isBuyerMode && publicStoreDocId) {
    return doc(db, "stores", publicStoreDocId);
  }
  if (currentUser) {
    return doc(db, "stores", currentUser.uid);
  }
  return null;
}

async function persistStore() {
  const ref = getTargetStoreRef();
  if (!ref) return;
  try {
    await setDoc(ref, storeData, { merge: true });
  } catch (err) {
    console.error("Firestore save error:", err);
  }
}

// =========================================================
// 1. INSTANT ORBITAL EXIT (NEVER STUCK)
// =========================================================
const orbitalScreen = document.getElementById("orbital-screen");
const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");

let orbitalDismissed = false;

async function checkPublicStoreParam() {
  const params = new URLSearchParams(window.location.search);
  const storeSlug = params.get("store");
  if (!storeSlug) return false;

  try {
    const q = query(collection(db, "stores"), where("slug", "==", storeSlug));
    const snap = await withTimeout(getDocs(q), 2500);
    if (snap && !snap.empty) {
      const firstDoc = snap.docs[0];
      publicStoreDocId = firstDoc.id;
      storeData = { ...storeData, ...firstDoc.data() };
      isBuyerMode = true;
      return true;
    }
  } catch (err) {
    console.error("Failed to load public storefront:", err);
  }
  return false;
}

function dismissOrbital() {
  if (orbitalDismissed) return;
  orbitalDismissed = true;
  orbitalScreen.classList.add("fade-out");

  // Transition immediately so the screen never stalls on network calls
  setTimeout(() => {
    orbitalScreen.classList.add("hidden");
    if (currentUser) {
      openWorkspace(false);
    } else {
      authScreen.classList.remove("hidden");
    }
  }, 280);

  // Resolve public store link or existing session in background
  (async () => {
    const foundPublic = await checkPublicStoreParam();
    if (foundPublic) {
      authScreen.classList.add("hidden");
      openWorkspace(true);
    } else if (currentUser) {
      authScreen.classList.add("hidden");
      openWorkspace(false);
    }
  })();
}

orbitalScreen.addEventListener("click", dismissOrbital);
orbitalScreen.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    dismissOrbital();
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user && !isBuyerMode) {
    try {
      const snap = await withTimeout(getDoc(doc(db, "stores", user.uid)), 3000);
      if (snap && snap.exists()) {
        storeData = { ...storeData, ...snap.data() };
      }
    } catch (err) {
      console.error("Failed to load store:", err);
    }
    if (orbitalDismissed && !authScreen.classList.contains("hidden")) {
      openWorkspace(false);
    }
  }
});

// =========================================================
// 2. AUTHENTICATION (SIGN UP & SIGN IN)
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
      bankDetails: { bankName: "", accountNumber: "", accountName: "" },
      products: [],
      orders: [],
      jobs: []
    };

    await setDoc(doc(db, "stores", cred.user.uid), storeData);
    openWorkspace(false);
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
    openWorkspace(false);
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById("demo-access-btn")?.addEventListener("click", () => {
  openWorkspace(false);
});

document.getElementById("signout-btn").addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch {}
  currentUser = null;
  appShell.classList.add("hidden");
  authScreen.classList.remove("hidden");
});

document.getElementById("exit-buyer-mode-btn").addEventListener("click", () => {
  window.history.replaceState({}, "", window.location.pathname);
  isBuyerMode = false;
  publicStoreDocId = null;
  appShell.classList.add("hidden");
  authScreen.classList.remove("hidden");
});

document.getElementById("account-pill-btn").addEventListener("click", () => {
  if (!isBuyerMode) switchCategory("business");
});

function openWorkspace(buyerView) {
  isBuyerMode = Boolean(buyerView);
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");

  document.getElementById("header-store-name").textContent = storeData.storeName;
  document.getElementById("header-store-slug").textContent = `kova.shop/${storeData.slug}`;
  document.getElementById("account-pill-btn").textContent = isBuyerMode ? "Shopper" : storeData.ownerName;

  document.getElementById("buyer-banner").classList.toggle("hidden", !isBuyerMode);
  document.getElementById("merchant-nav").classList.toggle("hidden", isBuyerMode);

  if (isBuyerMode) {
    switchCategory("market");
  } else {
    switchCategory("blast");
    syncBranchSelectors();
    hydrateBankInputs();
    renderBusinessPro();
    renderHiring();
  }

  renderMarketplace();
}

// =========================================================
// 3. CATEGORY NAVIGATION & STORE LINK SHARING
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

document.getElementById("share-store-btn").addEventListener("click", async () => {
  const link = `${window.location.origin}${window.location.pathname}?store=${storeData.slug}`;
  try {
    await navigator.clipboard.writeText(link);
    alert(`Public storefront link copied:\n${link}`);
  } catch {
    alert(`Share this storefront link:\n${link}`);
  }
});

// =========================================================
// 4. PRODUCT PHOTO COMPRESSION + SOCIAL BLAST & SHORTCUTS
// =========================================================
const photoInput = document.getElementById("prod-photo");
const photoPreview = document.getElementById("prod-photo-preview");

photoInput.addEventListener("change", () => {
  const file = photoInput.files?.[0];
  if (!file) {
    pendingPhotoDataUrl = "";
    photoPreview.classList.add("hidden");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxDim = 640;
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      pendingPhotoDataUrl = canvas.toDataURL("image/jpeg", 0.72);
      photoPreview.src = pendingPhotoDataUrl;
      photoPreview.classList.remove("hidden");
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

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
  const finalCaption = caption || `${title} is now live at ${storeData.storeName}!`;
  const storeLink = `${window.location.origin}${window.location.pathname}?store=${storeData.slug}`;

  const newProduct = {
    id: "p_" + Date.now(),
    title,
    price,
    category,
    branch,
    stock,
    photo: pendingPhotoDataUrl,
    caption: finalCaption,
    channels: selectedChannels
  };

  storeData.products.unshift(newProduct);
  await persistStore();
  renderMarketplace();
  renderBusinessPro();

  const feedback = document.getElementById("blast-feedback");
  feedback.classList.remove("hidden");
  feedback.innerHTML = `<strong>Blasted!</strong> "${title}" (${naira(price)}) added to ${branch} for <strong>${selectedChannels.join(", ")}</strong>.`;

  const postText = `${title} — ${naira(price)}\n${finalCaption}\nOrder here: ${storeLink}`;
  document.getElementById("social-post-preview").textContent = postText;
  document.getElementById("whatsapp-share-link").href =
    `https://wa.me/?text=${encodeURIComponent(postText)}`;
  document.getElementById("social-shortcuts").classList.remove("hidden");

  e.target.reset();
  document.getElementById("prod-stock").value = "20";
  pendingPhotoDataUrl = "";
  photoPreview.classList.add("hidden");
});

document.getElementById("copy-social-btn").addEventListener("click", async () => {
  const text = document.getElementById("social-post-preview").textContent || "";
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    document.getElementById("copy-social-btn").textContent = "Copied ✓";
    setTimeout(() => {
      document.getElementById("copy-social-btn").textContent = "Copy for TikTok / IG";
    }, 1800);
  } catch {
    alert("Copy the caption text above.");
  }
});

// =========================================================
// 5. MARKETPLACE & MANUAL ACCOUNT CHECKOUT
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
    grid.innerHTML = `<p class="subtext">No items available yet.</p>`;
    return;
  }

  grid.innerHTML = items
    .map(
      (p) => `
      <article class="product-card">
        <div>
          ${p.photo ? `<img src="${p.photo}" alt="${p.title}" class="prod-img" />` : ""}
          <div class="prod-tag">${p.category} • ${p.branch}</div>
          <h3 class="prod-title">${p.title}</h3>
          <p class="prod-caption">${p.caption || ""}</p>
          <div class="prod-channels">Channels: ${(p.channels || []).join(" · ")}</div>
        </div>
        <div>
          <div class="prod-price-row">
            <span class="prod-price">${naira(p.price)}</span>
            <span class="prod-stock">${p.stock} left</span>
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

  const bank = storeData.bankDetails || {};
  document.getElementById("checkout-bank-info").innerHTML =
    bank.accountNumber
      ? `<strong>Transfer To:</strong><br/>Bank: <strong>${bank.bankName || "Not set"}</strong><br/>Account No: <strong>${bank.accountNumber}</strong><br/>Account Name: <strong>${bank.accountName || storeData.storeName}</strong>`
      : `<strong>Manual Account:</strong> Store owner has not added bank details yet in Business Pro.`;

  checkoutModal.classList.remove("hidden");
};

document.getElementById("close-checkout-btn").addEventListener("click", () => {
  checkoutModal.classList.add("hidden");
  activeCheckoutProductId = null;
});

document.getElementById("confirm-order-btn").addEventListener("click", async () => {
  const item = storeData.products.find((p) => p.id === activeCheckoutProductId);
  if (!item || item.stock <= 0) return;

  const buyer = document.getElementById("buyer-name").value.trim() || "Buyer";
  const note = document.getElementById("buyer-note").value.trim() || item.branch;

  item.stock -= 1;
  storeData.orders.unshift({
    id: "ORD-" + String(Date.now()).slice(-5),
    productTitle: item.title,
    amount: item.price,
    buyer,
    note,
    status: "Awaiting Verification"
  });

  await persistStore();
  renderMarketplace();
  if (!isBuyerMode) renderBusinessPro();

  checkoutMsg.textContent = `Order recorded! ${storeData.storeName} will verify your transfer shortly.`;
  document.getElementById("buyer-name").value = "";
  document.getElementById("buyer-note").value = "";
});

// =========================================================
// 6. BUSINESS PRO (MANUAL ACCOUNT SETUP, BRANCHES, KPIs & BACKUP)
// =========================================================
function hydrateBankInputs() {
  const bank = storeData.bankDetails || {};
  document.getElementById("bank-name").value = bank.bankName || "";
  document.getElementById("bank-number").value = bank.accountNumber || "";
  document.getElementById("bank-holder").value = bank.accountName || "";
}

document.getElementById("bank-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  storeData.bankDetails = {
    bankName: document.getElementById("bank-name").value.trim(),
    accountNumber: document.getElementById("bank-number").value.trim(),
    accountName: document.getElementById("bank-holder").value.trim()
  };
  await persistStore();
  document.getElementById("bank-msg").textContent = "Manual account details saved.";
});

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
    ledger.innerHTML = `<p class="subtext">No orders yet.</p>`;
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
  a.download = `${storeData.slug || "kova"}-backup.json`;
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
