document.getElementById("getTitleBtn").addEventListener("click", async () => {
    // Query the current active tab in the current window
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Display the title
    document.getElementById("title").textContent = tab.title;
});
