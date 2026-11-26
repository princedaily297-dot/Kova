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
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot
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
let editingProductId = null;
let pendingPhotoDataUrl = "";
let isBuyerMode = false;
let publicStoreDocId = null;
let unsubscribeStore = null;
let unsubscribeOrders = null;
let toastTimer = null;

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
  whatsappNumber: "",
  deliveryNote: "Same-day dispatch & branch pickup available.",
  products: [],
  orders: [],
  jobs: []
};

function showToast(msg, isError = false) {
  const el = document.getElementById("kova-toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle("error", Boolean(isError));
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3200);
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

function withTimeout(promise, ms = 2500) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms))
  ]);
}

function getActiveStoreId() {
  if (isBuyerMode && publicStoreDocId) return publicStoreDocId;
  if (currentUser) return currentUser.uid;
  return null;
}

async function persistStore() {
  const storeId = getActiveStoreId();
  if (!storeId) return;
  try {
    const { orders, ...storePayload } = storeData;
    await setDoc(doc(db, "stores", storeId), storePayload, { merge: true });
  } catch (err) {
    console.error("Firestore save error:", err);
  }
}

function cleanupListeners() {
  if (unsubscribeStore) {
    unsubscribeStore();
    unsubscribeStore = null;
  }
  if (unsubscribeOrders) {
    unsubscribeOrders();
    unsubscribeOrders = null;
  }
}

function bindRealtimeStore(storeId, buyerView) {
  cleanupListeners();

  unsubscribeStore = onSnapshot(doc(db, "stores", storeId), (snap) => {
    if (!snap.exists()) return;
    const incoming = snap.data();
    storeData = {
      ...storeData,
      ...incoming,
      bankDetails: incoming.bankDetails || storeData.bankDetails,
      products: incoming.products || [],
      jobs: incoming.jobs || [],
      branches: incoming.branches || ["Ota Express"]
    };

    document.getElementById("header-store-name").textContent = storeData.storeName;
    document.getElementById("header-store-slug").textContent = `kova.shop/${storeData.slug}`;
    renderMarketplace();
    updateStorePolicyBanner();

    if (!buyerView) {
      syncBranchSelectors();
      hydrateBankInputs();
      renderBusinessPro();
      renderHiring();
    }
  });

  if (!buyerView) {
    unsubscribeOrders = onSnapshot(collection(db, "stores", storeId, "orders"), (snap) => {
      const liveOrders = snap.docs
        .map((d) => ({ docId: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      storeData.orders = liveOrders;
      renderBusinessPro();
    });
  }
}

// =========================================================
// 1. INSTANT ORBITAL EXIT & PUBLIC STORE CHECK
// =========================================================
const orbitalScreen = document.getElementById("orbital-screen");
const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");

let orbitalDismissed = false;

async function checkPublicStoreParam() {
  const params = new URLSearchParams(window.location.search);
  const storeSlug = params.get("store");
  const focusItem = params.get("item");
  if (!storeSlug) return false;

  try {
    const q = query(collection(db, "stores"), where("slug", "==", storeSlug));
    const snap = await withTimeout(getDocs(q), 2800);
    if (snap && !snap.empty) {
      const firstDoc = snap.docs[0];
      publicStoreDocId = firstDoc.id;
      storeData = { ...storeData, ...firstDoc.data() };
      isBuyerMode = true;
      if (focusItem) {
        setTimeout(() => window.openCheckout(focusItem), 350);
      }
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

  setTimeout(() => {
    orbitalScreen.classList.add("hidden");
    if (currentUser) {
      openWorkspace(false);
    } else {
      authScreen.classList.remove("hidden");
    }
  }, 260);

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
  const password = document.getElementById("reg-password").value;
  const storeName = document.getElementById("reg-store").value.trim();
  const primaryBranch = document.getElementById("reg-branch").value.trim() || "Ota Express";

  if (!password || password.length < 6) {
    showToast("Password must be at least 6 characters.", true);
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
      whatsappNumber: "",
      deliveryNote: "Same-day dispatch & branch pickup available.",
      products: [],
      orders: [],
      jobs: []
    };

    const { orders, ...storePayload } = storeData;
    await setDoc(doc(db, "stores", cred.user.uid), storePayload);
    showToast("Store launched!");
    openWorkspace(false);
  } catch (err) {
    showToast(err.message, true);
  }
});

signinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  if (!password) return;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    currentUser = cred.user;
    const snap = await getDoc(doc(db, "stores", cred.user.uid));
    if (snap.exists()) {
      storeData = { ...storeData, ...snap.data() };
    }
    showToast("Welcome back!");
    openWorkspace(false);
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById("demo-access-btn")?.addEventListener("click", () => {
  openWorkspace(false);
  showToast("Opened Demo Store");
});

document.getElementById("signout-btn").addEventListener("click", async () => {
  cleanupListeners();
  try {
    await signOut(auth);
  } catch {}
  currentUser = null;
  appShell.classList.add("hidden");
  authScreen.classList.remove("hidden");
  showToast("Signed out");
});

document.getElementById("exit-buyer-mode-btn").addEventListener("click", () => {
  cleanupListeners();
  window.history.replaceState({}, "", window.location.pathname);
  isBuyerMode = false;
  publicStoreDocId = null;
  appShell.classList.add("hidden");
  authScreen.classList.remove("hidden");
});

document.getElementById("account-pill-btn").addEventListener("click", () => {
  if (!isBuyerMode) switchCategory("business");
});

function updateStorePolicyBanner() {
  const card = document.getElementById("store-policy-card");
  if (!isBuyerMode) {
    card.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden");
  document.getElementById("policy-store-title").textContent = `${storeData.storeName} • Official Store`;
  document.getElementById("policy-store-note").textContent =
    storeData.deliveryNote || "Fast dispatch & branch pickup available.";

  const waBtn = document.getElementById("store-whatsapp-contact");
  const cleanWa = String(storeData.whatsappNumber || "").replace(/[^0-9]/g, "");
  if (cleanWa) {
    waBtn.href = `https://wa.me/${cleanWa}?text=${encodeURIComponent(`Hello ${storeData.storeName}, I'm browsing your Kova store!`)}`;
    waBtn.classList.remove("hidden");
  } else {
    waBtn.classList.add("hidden");
  }
}

function openWorkspace(buyerView) {
  isBuyerMode = Boolean(buyerView);
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");

  document.getElementById("header-store-name").textContent = storeData.storeName;
  document.getElementById("header-store-slug").textContent = `kova.shop/${storeData.slug}`;
  document.getElementById("account-pill-btn").textContent = isBuyerMode ? "Shopper" : storeData.ownerName;

  document.getElementById("buyer-banner").classList.toggle("hidden", !isBuyerMode);
  document.getElementById("merchant-nav").classList.toggle("hidden", isBuyerMode);

  const activeId = getActiveStoreId();
  if (activeId) {
    bindRealtimeStore(activeId, isBuyerMode);
  }

  updateStorePolicyBanner();

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
    showToast("Public storefront link copied!");
  } catch {
    prompt("Copy your public storefront link:", link);
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
  const productId = "p_" + Date.now();
  const itemLink = `${window.location.origin}${window.location.pathname}?store=${storeData.slug}&item=${productId}`;

  const newProduct = {
    id: productId,
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
  showToast(`"${title}" published!`);

  const feedback = document.getElementById("blast-feedback");
  feedback.classList.remove("hidden");
  feedback.innerHTML = `<strong>Blasted!</strong> "${title}" (${naira(price)}) added to ${branch} for <strong>${selectedChannels.join(", ")}</strong>.`;

  const postText = `${title} — ${naira(price)}\n${finalCaption}\nOrder direct: ${itemLink}`;
  document.getElementById("social-post-preview").textContent = postText;
  document.getElementById("whatsapp-share-link").href = `https://wa.me/?text=${encodeURIComponent(postText)}`;
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
    showToast("Social post copied!");
  } catch {
    showToast("Copy the post text above.", true);
  }
});

// =========================================================
// 5. MARKETPLACE, EDIT/DELETE & MANUAL ACCOUNT CHECKOUT
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
          <div class="card-btn-row">
            <button type="button" class="btn-glow" onclick="window.openCheckout('${p.id}')" ${p.stock <= 0 ? "disabled" : ""}>
              ${p.stock > 0 ? "Order Now" : "Sold Out"}
            </button>
            <button type="button" class="btn-secondary" title="Copy Item Link" onclick="window.copyItemLink('${p.id}')">Link</button>
          </div>
          ${
            !isBuyerMode
              ? `<div class="merchant-card-tools">
                  <button type="button" class="btn-ghost sm" onclick="window.openEditProduct('${p.id}')">Edit</button>
                  <button type="button" class="btn-danger sm" onclick="window.deleteProduct('${p.id}')">Delete</button>
                </div>`
              : ""
          }
        </div>
      </article>
    `
    )
    .join("");
}

window.copyItemLink = async function (productId) {
  const link = `${window.location.origin}${window.location.pathname}?store=${storeData.slug}&item=${productId}`;
  try {
    await navigator.clipboard.writeText(link);
    showToast("Direct item link copied!");
  } catch {
    prompt("Copy item link:", link);
  }
};

const editModal = document.getElementById("edit-product-modal");

window.openEditProduct = function (productId) {
  const item = storeData.products.find((p) => p.id === productId);
  if (!item) return;
  editingProductId = productId;
  document.getElementById("edit-prod-title").value = item.title;
  document.getElementById("ed
