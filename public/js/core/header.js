// Üst menü: bütün sayfalarda aynı. Sayfadaki <div id="app-header" data-active="..."> yer tutucusunu doldurur.
// data-active: "dashboard" ya da "history" (detay sayfası geçmişin altında sayılır)

import { getLanguage, switchLanguage } from "./i18n.js";

// Depo yayınlanınca gerçek adresle değiştirilecek
const GITHUB_URL = "";
export const VERSION = "v1.0";

const NAV_ITEMS = [
  { key: "dashboard", href: "/", label: "nav.dashboard" },
  { key: "history", href: "/history.html", label: "nav.history" },
];

const LANGUAGES = [
  { code: "tr", label: "TR" },
  { code: "en", label: "EN" },
];

const LINK_BASE = "font-label-caps text-label-caps h-full flex items-center pt-1 px-1 transition-colors duration-200";
const LINK_ACTIVE = "text-primary border-b-2 border-primary";
const LINK_IDLE = "text-on-surface-variant hover:text-primary";

const LANG_BASE = "px-2.5 py-1 rounded-full transition-colors";
const LANG_ACTIVE = "bg-primary-container text-[#000000]";
const LANG_IDLE = "text-on-surface-variant hover:text-primary";

export function renderHeader() {
  const host = document.getElementById("app-header");
  if (!host) return;

  const active = host.dataset.active;
  const links = NAV_ITEMS.map(
    (item) =>
      `<a href="${item.href}" class="${LINK_BASE} ${item.key === active ? LINK_ACTIVE : LINK_IDLE}" data-i18n="${item.label}"></a>`
  ).join("");

  const current = getLanguage();
  const languageButtons = LANGUAGES.map(
    (lang) =>
      `<button type="button" data-lang="${lang.code}" aria-pressed="${lang.code === current}"
         class="${LANG_BASE} ${lang.code === current ? LANG_ACTIVE : LANG_IDLE}">${lang.label}</button>`
  ).join("");

  host.outerHTML = `
    <header class="bg-surface-container-lowest border-b border-border-subtle h-16 fixed top-0 w-full z-50 flex items-center justify-between px-margin-page">
      <div class="flex items-center gap-8 h-full">
        <a href="/" class="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <span class="flex items-center gap-1 font-data-lg text-[20px] font-bold tracking-[0.15em] text-primary">
            <span class="material-symbols-outlined text-[24px]" style="font-variation-settings: 'FILL' 1">bolt</span>VOLTA
          </span>
          <span class="font-label-caps text-[10px] px-1.5 py-0.5 rounded bg-surface-container-highest text-secondary border border-border-subtle">${VERSION}</span>
        </a>
        <nav class="hidden md:flex items-center h-full gap-6">${links}</nav>
      </div>

      <div class="flex items-center gap-3">
        <!-- Dil seçimi: değişince sayfa yenilenir -->
        <div id="language-switch" role="group" data-i18n-title="nav.language"
             class="flex items-center border border-border-subtle rounded-full p-0.5 font-label-caps text-[11px]">
          ${languageButtons}
        </div>

                ${GITHUB_URL
      ? `<a href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer"
                 class="flex items-center gap-2 bg-surface-container hover:bg-surface-bright border border-border-subtle px-3.5 py-1.5 rounded-full transition-colors group">
                <span class="font-data-md text-primary font-bold text-sm tracking-tighter group-hover:text-secondary transition-colors">&lt;&gt;</span>
                <span class="font-data-md text-on-surface text-sm" data-i18n="nav.github"></span>
              </a>`
      : ""
    }
      </div>
    </header>`;

  document.querySelectorAll("#language-switch [data-lang]").forEach((button) => {
    button.addEventListener("click", () => switchLanguage(button.dataset.lang));
  });
}