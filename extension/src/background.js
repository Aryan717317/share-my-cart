importScripts("config.js");

const REQUEST_TIMEOUT_MS = 8000;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CREATE_SHARED_CART") {
    (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const res = await fetch(`${API_BASE_URL}/api/cart`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: message.items, domain: message.domain }),
          signal: controller.signal,
        });

        // Read the body once and reuse it whether the request succeeded or not,
        // so a validation error from the server (e.g. "no valid items") reaches
        // the popup instead of a generic "backend returned 400".
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          sendResponse({ ok: false, error: data?.error || `Backend returned ${res.status}` });
          return;
        }

        if (!data?.shareUrl) {
          sendResponse({ ok: false, error: "Backend response was missing a share URL" });
          return;
        }

        sendResponse({ ok: true, shareUrl: data.shareUrl });
      } catch (err) {
        const errMsg = err?.name === "AbortError" ? "Backend didn't respond in time" : String(err);
        sendResponse({ ok: false, error: errMsg });
      } finally {
        clearTimeout(timeout);
      }
    })();
    return true; // async response
  }
});
