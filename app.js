const STORAGE_KEY = "kova_state_v2";

const defaultState = {
  storeName: "Kova Prime Mart",
  branch: "Ota Express",
  ordersCount: 0,
  products: [
    {
      id: "p1",
      title: "Fast-Charge Powerbank 20,000mAh",
      price: 28500,
      category: "Electronics",
      stock: 12,
      branch: "Ota Express",
      caption: "Reliable backup power for creators and daily commuters.",
      channels: ["Kova Store", "WhatsApp", "TikTok"]
    },
    {
      id: "p2",
      title: "Organic Cold-Pressed Honey (750ml)",
      price: 9500,
      category: "Groceries",
      stock: 24,
      branch: "Ikeja Flagship",
      caption: "Pure raw honey stocked fresh this week.",
      channels: ["Kova Store", "WhatsApp"]
    }
  ],
  jobs: [
    {
      id: "j1",
      title: "TikTok Live Commerce Host",
      location: "Ota Express",
      applied: false
    },
    {
      id: "j2",
      title: "Dispatch Rider",
      location: "Lekki Hub",
      applied: false
    }
  ]
};

let state = loadState();
let pendingOrderProductId = null;

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...cloneDefaultState(), ...JSON.parse(saved) } : cloneDefaultState();
  } catch {
    return cloneDefaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors in restricted browser modes
  }
}

function formatNaira(amount) {
  return "₦" + Number(amount).toLocaleString("en-NG");
}

function slugify(name) {
  return (
    String(name || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "store"
  );
}

// Tab switching
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// Store setup sync
const storeNameInput = document.getElementById("store-name-input");
const branchSelect = document.getElementById("branch-select");
const storeSlugLabel = document.getElementById("store-slug-label");

storeNameInput.value = state.storeName;
branchSelect.value = state.branch;
storeSlugLabel.textContent = `kova.shop/${slugify(state.storeName)}`;

storeNameInput.addEventListener("input", () => {
  state.storeName = storeNameInput.value;
  storeSlugLabel.textContent = `kova.shop/${slugify(state.storeName)}`;
  saveState();
  renderMarketplace();
  renderJobs();
});

branchSelect.addEventListener("change", () => {
  state.branch = branchSelect.value;
  saveState();
});

// Product upload + social blast
const shareBox = document.getElementById("share-box");
const shareTextEl = document.getElementById("share-text");

document.getElementById("product-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("product-title").value.trim();
  const price = Number(document.getElementById("product-price").value);
  const category = document.getElementById("product-category").value;
  const stock = Number(document.getElementById("product-stock").value);
  const caption = document.getElementById("product-caption").value.trim();
  const channels = [...document.querySelectorAll('input[name="channel"]:checked')].map((c) => c.value);

  if (!title || !price) return;

  const activeStore = state.storeName.trim() || "Kova Store";
  const finalCaption = caption || `${title} available now at ${activeStore}.`;
  const selectedChannels = channels.length ? channels : ["Kova Store"];

  const newProduct = {
    id: "p_" + Date.now(),
    title,
    price,
    category,
    stock,
    branch: state.branch,
    caption: finalCaption,
    channels: selectedChannels
  };

  state.products.unshift(newProduct);
  saveState();
  renderMarketplace();
  renderTransferOptions();

  document.getElementById("blast-log").textContent =
    `Published "${title}" to ${selectedChannels.join(", ")} (${state.branch}).`;

  shareTextEl.textContent =
    `${title} — ${formatNaira(price)}\n${finalCaption}\nShop: https://kova.shop/${slugify(activeStore)}`;
  shareBox.classList.remove("hidden");

  e.target.reset();
  document.getElementById("product-stock").value = "15";
});

document.getElementById("copy-share-btn").addEventListener("click", async () => {
  const text = shareTextEl.textContent || "";
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    document.getElementById("copy-share-btn").textContent = "Copied ✓";
    setTimeout(() => {
      document.getElementById("copy-share-btn").textContent = "Copy Post";
    }, 1800);
  } catch {
    alert("Select and copy the caption text above.");
  }
});

// Multi-branch product assignment
function renderTransferOptions() {
  const select = document.getElementById("transfer-product");
  select.innerHTML = state.products
    .map((p) => `<option value="${p.id}">${p.title} (${p.branch})</option>`)
    .join("");
}

document.getElementById("transfer-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const productId = document.getElementById("transfer-product").value;
  const targetBranch = document.getElementById("transfer-target-branch").value;
  const item = state.products.find((p) => p.id === productId);
  if (!item) return;

  item.branch = targetBranch;
  saveState();
  renderMarketplace();
  renderTransferOptions();
  document.getElementById("transfer-log").textContent =
    `Moved "${item.title}" to ${targetBranch}.`;
});

// Marketplace render & escrow checkout modal
const searchInput = document.getElementById("market-search");
const categorySelect = document.getElementById("market-category");
const checkoutModal = document.getElementById("checkout-modal");
const checkoutSummary = document.getElementById("checkout-summary");
const checkoutStatus = document.getElementById("checkout-status");

searchInput.addEventListener("input", renderMarketplace);
categorySelect.addEventListener("change", renderMarketplace);

function renderMarketplace() {
  const q = searchInput.value.toLowerCase().trim();
  const cat = categorySelect.value;
  const listEl = document.getElementById("product-list");
  document.getElementById("order-count").textContent = state.ordersCount;

  const filtered = state.products.filter((p) => {
    const matchesCat = cat === "All" || p.category === cat;
    const matchesQuery =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.caption.toLowerCase().includes(q) ||
      p.branch.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  if (!filtered.length) {
    listEl.innerHTML = `<p class="muted">No products match your filter yet.</p>`;
    return;
  }

  listEl.innerHTML = filtered
    .map(
      (p) => `
      <article class="item-card">
        <div>
          <div class="meta">${p.category} • ${p.branch}</div>
          <h3 style="margin:4px 0 6px;font-size:1rem;">${p.title}</h3>
          <p class="muted" style="margin:0 0 8px;">${p.caption}</p>
          <div class="meta">Channels: ${p.channels.join(", ")}</div>
        </div>
        <div>
          <div class="price" style="margin-bottom:8px;">
            ${formatNaira(p.price)} <span class="meta">(${p.stock} left)</span>
          </div>
          <button type="button" class="btn-primary" style="width:100%;" onclick="orderItem('${p.id}')" ${p.stock <= 0 ? "disabled" : ""}>
            ${p.stock > 0 ? "Order with Escrow" : "Out of Stock"}
          </button>
        </div>
      </article>
    `
    )
    .join("");
}

window.orderItem = function (productId) {
  const item = state.products.find((p) => p.id === productId);
  if (!item || item.stock <= 0) return;

  pendingOrderProductId = productId;
  checkoutStatus.textContent = "";
  checkoutSummary.innerHTML = `
    <div><strong>${item.title}</strong></div>
    <div class="meta">Store: ${state.storeName || "Kova Store"} • Branch: ${item.branch}</div>
    <div class="price">${formatNaira(item.price)}</div>
  `;
  checkoutModal.classList.remove("hidden");
};

document.getElementById("close-modal-btn").addEventListener("click", () => {
  checkoutModal.classList.add("hidden");
  pendingOrderProductId = null;
});

document.getElementById("copy-pay-link-btn").addEventListener("click", async () => {
  const item = state.products.find((p) => p.id === pendingOrderProductId);
  if (!item) return;
  const link = `https://kova.shop/${slugify(state.storeName)}/pay/${item.id}`;
  try {
    await navigator.clipboard.writeText(link);
    checkoutStatus.textContent = `Copied checkout link: ${link}`;
  } catch {
    checkoutStatus.textContent = `Checkout link: ${link}`;
  }
});

document.getElementById("confirm-escrow-btn").addEventListener("click", () => {
  const item = state.products.find((p) => p.id === pendingOrderProductId);
  if (!item || item.stock <= 0) return;

  const contact = document.getElementById("buyer-contact").value.trim() || "Walk-in Buyer";
  item.stock -= 1;
  state.ordersCount += 1;
  saveState();
  renderMarketplace();
  renderTransferOptions();

  checkoutStatus.textContent = `Escrow order confirmed for ${contact} (${formatNaira(item.price)}).`;
  document.getElementById("buyer-contact").value = "";
  document.getElementById("buyer-address").value = "";
});

// Hiring board
document.getElementById("job-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("job-title").value.trim();
  const location = document.getElementById("job-location").value.trim();
  if (!title || !location) return;

  state.jobs.unshift({
    id: "j_" + Date.now(),
    title,
    location,
    applied: false
  });
  saveState();
  renderJobs();
  e.target.reset();
});

function renderJobs() {
  const jobList = document.getElementById("job-list");
  jobList.innerHTML = state.jobs
    .map(
      (j) => `
      <div class="job-row">
        <div>
          <strong>${j.title}</strong>
          <div class="meta">${state.storeName} • ${j.location}</div>
        </div>
        <button type="button" class="btn-secondary" onclick="applyJob('${j.id}')">
          ${j.applied ? "Applied ✓" : "1-Click Apply"}
        </button>
      </div>
    `
    )
    .join("");
}

window.applyJob = function (jobId) {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return;
  job.applied = true;
  saveState();
  renderJobs();
};

renderTransferOptions();
renderMarketplace();
renderJobs();
