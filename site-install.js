/* Local install control. No game, account, cache or service-worker changes. */
(() => {
  if (customElements.get("site-install-app")) return;
  let pending = null;
  let installed = false;
  let busy = false;
  const subscribers = new Set();
  const standalone = () => navigator.standalone === true || ["standalone", "fullscreen", "minimal-ui"].some(mode => matchMedia("(display-mode: " + mode + ")").matches);
  const notify = () => subscribers.forEach(update => update());
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    pending = event;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    pending = null;
    notify();
  });
  window.addEventListener("pageshow", notify);
  const mode = matchMedia("(display-mode: standalone)");
  mode.addEventListener?.("change", notify);

  class SiteInstallApp extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) { subscribers.add(this.update); this.update(); return; }
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `
        <style>
          :host { display:inline-flex; flex-shrink:0; max-width:100%; vertical-align:middle; font-family:inherit; }
          * { box-sizing:border-box; }
          button { font:inherit; cursor:pointer; }
          .trigger { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:44px; padding:8px 14px; border:1px solid transparent; border-radius:999px; background:var(--install-accent,#e9b856); color:var(--install-ink,#172238); font-size:13px; font-weight:800; white-space:nowrap; line-height:1.2; box-shadow:0 2px 8px #0002; }
          .trigger:hover { filter:brightness(1.08); }
          button:focus-visible,a:focus-visible { outline:3px solid #3080dd; outline-offset:3px; }
          button:disabled { cursor:wait; opacity:.7; }
          svg { width:18px; height:18px; flex-shrink:0; }
          dialog { position:fixed; inset:0; width:min(390px,calc(100vw - 32px)); max-height:calc(100dvh - 32px); overflow:auto; margin:auto; padding:26px; border:1px solid #657382; border-radius:18px; background:#fff; color:#172238; font:400 15px/1.6 system-ui,sans-serif; text-align:left; letter-spacing:normal; text-transform:none; box-shadow:0 20px 80px #0005; }
          dialog::backdrop { background:#0008; }
          h2 { font-size:22px; line-height:1.3; margin:0 28px 14px 0; }
          p { margin:12px 0; }
          .note { font-size:13px; color:#485665; }
          .close { position:absolute; top:10px; right:10px; display:grid; place-items:center; width:32px; height:32px; padding:0; border:0; background:transparent; color:inherit; border-radius:50%; }
          .close:hover { background:#17223812; }
          .close svg { width:16px; height:16px; }
          .copy { min-height:44px; border:1px solid #84909e; border-radius:10px; padding:8px 16px; background:#f1f5f9; color:#172238; font-weight:700; }
          .status { font-size:13px; overflow-wrap:anywhere; }
          @media(max-width:480px) { .trigger { padding:8px 10px; gap:5px; font-size:12px; } }
        </style>
        <button class="trigger" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="install-guide" title="Install or save this website">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M12 7v7m-3-3 3 3 3-3M11 18h2"/></svg>
          <span>Install App</span>
        </button>
        <dialog id="install-guide" aria-labelledby="install-title">
          <button class="close" type="button" aria-label="Close install guide" title="Close"><svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
          <h2 id="install-title"></h2><p class="instructions"></p>
          <p class="note">This saves the website as a browser app or shortcut, not a native game download. Online games, accounts and network tools still need an internet connection.</p>
          <button class="copy" type="button">Copy site link</button><p class="status" role="status" aria-live="polite"></p>
        </dialog>`;
      const trigger = root.querySelector(".trigger");
      const dialog = root.querySelector("dialog");
      const status = root.querySelector(".status");
      const isInstalled = () => installed || standalone();
      this.update = () => {
        trigger.disabled = busy;
        trigger.querySelector("span").textContent = isInstalled() ? "Installed" : "Install App";
      };
      const openGuide = message => {
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        root.querySelector("h2").textContent = (isInstalled() ? "Open " : "Install or save ") + (this.getAttribute("app-name") || "this website");
        root.querySelector(".instructions").textContent = isInstalled()
          ? "This website is installed or running in an app window. Open it from your home screen, dock or app list next time."
          : ios
            ? "Open this site in Safari, tap Share, then Add to Home Screen. If you are in an in-app browser, open the link in Safari first."
            : "In Chrome or Edge, use the browser menu to install this site when offered. On supported Macs, use Safari: File > Add to Dock. If installation is unavailable, bookmark this page instead.";
        status.textContent = message || "";
        if (!dialog.open) dialog.showModal();
        trigger.setAttribute("aria-expanded", "true");
      };
      trigger.addEventListener("click", async () => {
        if (busy) return;
        if (!pending || isInstalled()) { openGuide(); return; }
        const event = pending;
        pending = null;
        busy = true;
        notify();
        try {
          await event.prompt();
          const choice = await event.userChoice;
          if (choice.outcome !== "accepted") openGuide("Installation was cancelled. You can still save the site using your browser menu.");
        } catch {
          openGuide("The browser could not open the installer. Please use the instructions below or try again later.");
        } finally {
          busy = false;
          notify();
        }
      });
      root.querySelector(".close").addEventListener("click", () => dialog.close());
      dialog.addEventListener("close", () => { trigger.setAttribute("aria-expanded", "false"); trigger.focus(); });
      dialog.addEventListener("click", event => {
        if (event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
      });
      root.querySelector(".copy").addEventListener("click", async () => {
        const url = new URL("/", location.href).href;
        try { await navigator.clipboard.writeText(url); status.textContent = "Site link copied."; }
        catch { status.textContent = "Copy this link manually: " + url; }
      });
      subscribers.add(this.update);
      this.update();
    }
    disconnectedCallback() { subscribers.delete(this.update); }
  }
  customElements.define("site-install-app", SiteInstallApp);
})();
