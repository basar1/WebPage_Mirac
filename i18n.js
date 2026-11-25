/* ==========================================================================
   Hançerlioğlu — i18n
   Turkish is the default copy in the HTML. English and Arabic replace it
   before GSAP splits the type, and again live when the language changes.
   A missing key falls back to Turkish, then to the text already in the DOM.
   ========================================================================== */

(function () {
  "use strict";

  var STORAGE_KEY = "hancerlioglu-lang";
  var DIRS = { tr: "ltr", en: "ltr", ar: "rtl" };
  var LOCALES = { tr: "tr_TR", en: "en_US", ar: "ar_AR" };
  var dictionaries = {};
  var current = document.documentElement.lang || "tr";

  if (!DIRS[current]) current = "tr";

  function get(tree, path) {
    if (!tree || !path) return null;
    var node = tree;
    var parts = path.split(".");
    for (var i = 0; i < parts.length; i++) {
      if (node == null || typeof node !== "object" || !(parts[i] in node)) return null;
      node = node[parts[i]];
    }
    return typeof node === "string" ? node : null;
  }

  function t(key) {
    var value = get(dictionaries[current], key);
    if (value == null && current !== "tr") value = get(dictionaries.tr, key);
    return value;
  }

  function isSplitRoot(element) {
    return element.hasAttribute("data-split") || element.hasAttribute("data-philosophy");
  }

  function isolateLatin(value, asHtml) {
    if (current !== "ar" || !value || value.indexOf("\u2066") !== -1) return value;
    var pattern = /[A-Za-zÀ-ÖØ-öø-ÿİıŞşĞğÜüÖöÇç](?:[A-Za-zÀ-ÖØ-öø-ÿİıŞşĞğÜüÖöÇç'’.·\s-]*[A-Za-zÀ-ÖØ-öø-ÿİıŞşĞğÜüÖöÇç])?/g;
    var wrap = function (text) {
      return text.replace(pattern, function (word) {
        return "\u2066" + word + "\u2069";
      });
    };
    if (!asHtml) return wrap(value);
    return value.replace(/(^|>)([^<]+)/g, function (full, boundary, text) {
      return boundary + wrap(text);
    });
  }

  function write(element, value, asHtml) {
    if (value == null || !element) return;
    value = isolateLatin(value, asHtml);
    if (asHtml) element.innerHTML = value;
    else element.textContent = value;
    if (isSplitRoot(element)) delete element.dataset.splitSource;
  }

  function load(lang) {
    if (dictionaries[lang]) return Promise.resolve(dictionaries[lang]);
    return fetch("locales/" + lang + ".json", { cache: "reload" }).then(function (response) {
      if (!response.ok) throw new Error(lang);
      return response.json();
    }).then(function (data) {
      dictionaries[lang] = data;
      return data;
    });
  }

  var arabicFontReady = Promise.resolve();

  function ensureArabicFont() {
    if (current !== "ar") return Promise.resolve();
    if (document.getElementById("font-arabic")) return arabicFontReady;

    arabicFontReady = new Promise(function (resolve) {
      var link = document.createElement("link");
      link.id = "font-arabic";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700&family=Tajawal:wght@300;400;500;700&display=swap";
      link.onload = function () {
        document.fonts.ready.then(resolve);
      };
      link.onerror = function () {
        resolve();
      };
      document.head.appendChild(link);
    });

    return arabicFontReady;
  }

  function syncMapLanguage() {
    var frame = document.querySelector(".visit__iframe");
    if (!frame) return;
    var src = frame.getAttribute("src") || "";
    var hl = current === "ar" ? "ar" : current;
    if (src.indexOf("hl=") === -1) return;
    var next = src.replace(/hl=[a-z]{2}/, "hl=" + hl);
    if (next !== src) frame.setAttribute("src", next);
  }

  function apply(root) {
    var scope = root || document;

    scope.querySelectorAll("[data-i18n]").forEach(function (element) {
      write(element, t(element.getAttribute("data-i18n")), false);
    });

    scope.querySelectorAll("[data-i18n-html]").forEach(function (element) {
      write(element, t(element.getAttribute("data-i18n-html")), true);
    });

    scope.querySelectorAll("[data-i18n-aria-label]").forEach(function (element) {
      var value = t(element.getAttribute("data-i18n-aria-label"));
      if (value != null) element.setAttribute("aria-label", value);
    });

    scope.querySelectorAll("[data-i18n-alt]").forEach(function (element) {
      var value = t(element.getAttribute("data-i18n-alt"));
      if (value != null) element.setAttribute("alt", value);
    });

    scope.querySelectorAll("[data-i18n-title]").forEach(function (element) {
      var value = t(element.getAttribute("data-i18n-title"));
      if (value != null) element.setAttribute("title", value);
    });

    scope.querySelectorAll("[data-i18n-content]").forEach(function (element) {
      var value = t(element.getAttribute("data-i18n-content"));
      if (value != null) element.setAttribute("content", value);
    });

    document.documentElement.lang = current;
    document.documentElement.dir = DIRS[current];

    var locale = document.querySelector('meta[property="og:locale"]');
    if (locale) locale.setAttribute("content", LOCALES[current]);

    scope.querySelectorAll("[data-lang]").forEach(function (button) {
      var active = button.getAttribute("data-lang") === current;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    syncMapLanguage();
    ensureArabicFont();
  }

  function setLang(lang) {
    if (!DIRS[lang] || lang === current) return Promise.resolve();
    current = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (error) {
      /* private mode */
    }

    return load("tr").then(function () {
      return lang === "tr" ? null : load(lang);
    }).then(function () {
      apply();
      return ensureArabicFont();
    }).then(function () {
      document.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang: lang } }));
    }).catch(function () {
      current = "tr";
      document.documentElement.lang = "tr";
      document.documentElement.dir = "ltr";
    });
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-lang]");
    if (!button) return;
    event.preventDefault();
    setLang(button.getAttribute("data-lang"));
  });

  var ready = load("tr").then(function () {
    if (current === "tr") {
      apply();
      return;
    }
    return load(current).then(function () {
      apply();
      return ensureArabicFont();
    });
  }).catch(function () {
    current = "tr";
    document.documentElement.lang = "tr";
    document.documentElement.dir = "ltr";
  }).then(function () {
    document.documentElement.classList.remove("is-i18n-wait");
  });

  window.HancerliogluI18n = {
    ready: ready,
    t: t,
    setLang: setLang,
    apply: apply,
    get lang() {
      return current;
    }
  };
})();
