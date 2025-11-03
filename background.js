// Elements
const showBtn = document.getElementById("showBtn");
const copyBtn = document.getElementById("copyBtn");
const saveBtn = document.getElementById("saveBtn");
const pinBtn = document.getElementById("pinBtn");
const clearFavsBtn = document.getElementById("clearFavs");
const infoCard = document.getElementById("info-card");
const titleEl = document.getElementById("tab-title");
const pinnedBadge = document.getElementById("pinned-badge");
const urlEl = document.getElementById("tab-url");
const toast = document.getElementById("toast");
const themeSwitch = document.getElementById("themeSwitch");
const favList = document.getElementById("fav-list");

let currentTab = null;

/** Helper: show toast */
function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1500);
}

/** Render favorites list */
function renderFavorites(favs) {
    favList.innerHTML = "";
    if (!favs || favs.length === 0) {
        favList.innerHTML = "<p style='font-size:0.8rem;opacity:0.7;'>No favorites yet.</p>";
        return;
    }

    favs.forEach((f, idx) => {
        const div = document.createElement("div");
        div.className = "fav-item";
        // clickable link + small remove button
        div.innerHTML = `
      <a href="${f.url}" target="_blank" class="fav-link">🔗 ${escapeHtml(f.title)}</a>
      <button data-idx="${idx}" class="remove-fav" style="float:right;border:none;background:transparent;cursor:pointer;font-size:0.9rem;">🗑</button>
    `;
        favList.appendChild(div);
    });

    // attach remove handlers
    const removeBtns = favList.querySelectorAll(".remove-fav");
    removeBtns.forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const idx = Number(btn.getAttribute("data-idx"));
            chrome.storage.sync.get({ favorites: [] }, (data) => {
                const arr = data.favorites || [];
                arr.splice(idx, 1);
                chrome.storage.sync.set({ favorites: arr }, () => {
                    renderFavorites(arr);
                    showToast("Removed!");
                });
            });
        });
    });
}

/** Escape HTML to avoid injection when reusing title as innerHTML */
function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Load and show the active tab info (triggered by Show Info) */
async function loadTabInfoAndShow() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) throw new Error("No active tab");

        currentTab = tab;

        // Update UI
        titleEl.childNodes[0].nodeValue = tab.title || "(no title)"; // keep pinnedBadge element
        urlEl.textContent = tab.url || "(no url)";
        urlEl.href = tab.url || "#";

        // pinned badge + pin button label
        pinnedBadge.style.display = tab.pinned ? "inline-block" : "none";
        pinBtn.textContent = tab.pinned ? "📌 Unpin Tab" : "📌 Pin Tab";

        // reveal card
        infoCard.style.display = "block";
        infoCard.style.opacity = 0;
        infoCard.style.transform = "translateY(6px)";
        requestAnimationFrame(() => {
            infoCard.style.transition = "opacity 180ms ease, transform 180ms ease";
            infoCard.style.opacity = 1;
            infoCard.style.transform = "translateY(0)";
        });

        // enable controls
        copyBtn.disabled = false;
        saveBtn.disabled = false;
        pinBtn.disabled = false;
    } catch (err) {
        console.error("Error loading tab:", err);
        titleEl.textContent = "Unable to fetch tab";
        urlEl.textContent = "";
        infoCard.style.display = "block";
        copyBtn.disabled = true;
        saveBtn.disabled = true;
        pinBtn.disabled = true;
        showToast("Could not load tab");
    }
}

/** Copy title to clipboard */
copyBtn.addEventListener("click", async () => {
    if (!currentTab) return;
    try {
        await navigator.clipboard.writeText(currentTab.title || "");
        showToast("Copied!");
    } catch (err) {
        console.error("Copy failed:", err);
        showToast("Copy failed");
    }
});

/** Save tab to favorites */
saveBtn.addEventListener("click", () => {
    if (!currentTab) return;
    const fav = { title: currentTab.title || "(no title)", url: currentTab.url || "" };

    chrome.storage.sync.get({ favorites: [] }, (data) => {
        const existing = data.favorites || [];
        if (!existing.some((t) => t.url === fav.url)) {
            existing.push(fav);
            chrome.storage.sync.set({ favorites: existing }, () => {
                renderFavorites(existing);
                showToast("Saved!");
            });
        } else {
            showToast("Already saved!");
        }
    });
});

/** Clear all favorites */
clearFavsBtn.addEventListener("click", () => {
    chrome.storage.sync.set({ favorites: [] }, () => {
        renderFavorites([]);
        showToast("Cleared!");
    });
});

/** Pin / Unpin the current tab */
pinBtn.addEventListener("click", async () => {
    if (!currentTab) return;
    try {
        const newPinnedState = !currentTab.pinned;
        // Update the tab pinned state
        await chrome.tabs.update(currentTab.id, { pinned: newPinnedState });
        // Reflect new state locally
        currentTab.pinned = newPinnedState;
        pinnedBadge.style.display = newPinnedState ? "inline-block" : "none";
        pinBtn.textContent = newPinnedState ? "📌 Unpin Tab" : "📌 Pin Tab";
        showToast(newPinnedState ? "Pinned!" : "Unpinned!");
    } catch (err) {
        console.error("Pin/unpin failed:", err);
        showToast("Action failed");
    }
});

/** Theme handling */
themeSwitch.addEventListener("change", () => {
    const isDark = themeSwitch.checked;
    document.body.classList.toggle("dark", isDark);
    chrome.storage.sync.set({ theme: isDark ? "dark" : "light" });
});

/** Apply stored theme & favorites on load */
chrome.storage.sync.get(["theme", "favorites"], (data) => {
    const isDark = data.theme === "dark";
    document.body.classList.toggle("dark", isDark);
    themeSwitch.checked = isDark;
    renderFavorites(data.favorites || []);
});

/** Show Info button handler */
showBtn.addEventListener("click", loadTabInfoAndShow);

/** keyboard accessibility: Enter triggers show */
showBtn.addEventListener("keyup", (e) => {
    if (e.key === "Enter") loadTabInfoAndShow();
});
