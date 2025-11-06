const processBtn = document.getElementById('processBtn');
const profilesInput = document.getElementById('profilesInput');
const status = document.getElementById('status');

// Backend endpoint - change if needed
const API_ENDPOINT = 'http://localhost:4000/profiles';

processBtn.addEventListener('click', async () => {
    const raw = profilesInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    if (raw.length < 3) {
        status.textContent = 'Please provide at least 3 profile URLs.';
        return;
    }

    status.textContent = `Starting processing ${raw.length} profiles...`;

    for (let i = 0; i < raw.length; i++) {
        const url = raw[i];
        status.textContent = `Opening ${i + 1}/${raw.length}: ${url}`;

        // open tab (background)
        const tab = await chrome.tabs.create({ url: url, active: false });

        // wait until tab finishes loading
        await waitForTabComplete(tab.id);

        status.textContent = `Extracting from ${url}...`;

        // execute extraction function in page context
        try {
            const [result] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: extractLinkedInProfile
            });

            // result.value is the object returned from extractLinkedInProfile in page context
            const profile = result?.result || result?.value || null;

            if (profile) {
                // send to backend
                await fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(profile)
                });
                status.textContent = `Posted profile ${i + 1}/${raw.length}`;
            } else {
                status.textContent = `Extraction returned empty for ${url}`;
            }
        } catch (err) {
            console.error('Script exec or post failed', err);
            status.textContent = `Error extracting or posting for ${url}: ${err.message}`;
        }

        // Close the tab to keep things tidy (optional)
        await chrome.tabs.remove(tab.id);

        // small delay between profiles to avoid throttling and emulate human behavior
        await delay(800);
    }

    status.textContent = 'All done!';
});

// Utility: wait until tab update status is complete
function waitForTabComplete(tabId) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve(); // give up after timeout and proceed (to avoid hanging)
        }, 20000); // 20s timeout
        function listener(updatedTabId, changeInfo) {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                clearTimeout(timeout);
                chrome.tabs.onUpdated.removeListener(listener);
                // small wait to let JS render dynamic content
                setTimeout(resolve, 800);
            }
        }
        chrome.tabs.onUpdated.addListener(listener);
    });
}

// small delay helper
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * This function runs inside the LinkedIn profile page (in page context).
 * It tries multiple selector fallbacks to extract name, location, headline (about),
 * bio/summary, followerCount, connectionCount, and a short bioLine.
 *
 * Return value will be serialized and passed back to popup.js.
 */
function extractLinkedInProfile() {
    // helper to try multiple selectors
    function pickText(selectors) {
        for (const s of selectors) {
            const el = document.querySelector(s);
            if (el && el.innerText && el.innerText.trim()) return el.innerText.trim();
        }
        return '';
    }

    try {
        const name = pickText([
            '.pv-text-details__left-panel h1',
            'h1.text-heading-xlarge',
            'h1'
        ]);

        const location = pickText([
            '.pv-text-details__left-panel .text-body-small',
            '.pv-top-card--list-bullet li',
            '.text-body-small.inline.t-black--light'
        ]);

        const about = pickText([
            '.pv-text-details__left-panel .text-body-medium',
            '.pv-top-card--experience-list .t-14',
            '.text-body-medium'
        ]);

        // bio / summary
        const bio = pickText([
            '.pv-about__summary-text .lt-line-clamp__raw-line',
            '.pv-about-section .pv-about__summary-text',
            '#about .pv-shared-text-with-see-more'
        ]);

        // follower count (various linkedin layouts)
        const follower = pickText([
            '.pv-top-card-v2-section__followers-count',
            '.pv-top-card-v2-section__connections',
            '.feed-following-info__count'
        ]);

        // connection count (e.g., "500+ connections")
        const connections = pickText([
            '.pv-top-card-v2-section__connections',
            '.pv-top-card--list-bullet li span',
            '.pv-top-card--list .text-body-small'
        ]);

        // bio line (short headline)
        const bioLine = pickText([
            '.pv-text-details__left-panel .text-body-medium.break-words',
            '.pv-top-card--list .text-body-small.inline.t-black--light',
            '.text-body-medium'
        ]);

        // build object
        const profile = {
            name: name || '',
            url: location ? window.location.href : window.location.href, // always use page URL
            about: about || '',
            bio: bio || '',
            location: location || '',
            followerCount: follower || '',
            connectionCount: connections || '',
            bioLine: bioLine || ''
        };

        return profile;
    } catch (err) {
        return { error: 'extraction_failed', message: err.message || String(err) };
    }
}
