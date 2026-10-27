/* ==========================================================================
   Hançerlioğlu — Tatlıda Ustalık
   Vanilla JS + GSAP (core & ScrollTrigger) + Lenis
   --------------------------------------------------------------------------
   00. Environment & helpers
   01. Text splitting (lines / words)
   02. Reveal factory
   03. Media fallbacks
   04. Lenis smooth scroll
   05. Preloader
   06. Hero
   07. Header, menu & anchors
   08. Cursor
   09. Scroll progress
   10. Marquee
   11. Philosophy
   12. Legacy (parallax + counters)
   13. Heritage timeline
   14. Craft (pinned horizontal showcase)
   15. Visit (location)
   16. Footer
   17. Boot & resize
   ========================================================================== */

(function () {
  "use strict";

  /* ========================================================================
     00. ENVIRONMENT & HELPERS
     ===================================================================== */

  var doc = document;
  var body = doc.body;

  var hasGSAP = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  var hasLenis = typeof window.Lenis !== "undefined";
  var reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  /** Master switch: when false the page renders fully but statically. */
  var MOTION = hasGSAP && !reducedMotionQuery.matches;

  function $(selector, scope) {
    return (scope || doc).querySelector(selector);
  }

  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || doc).querySelectorAll(selector));
  }

  /* Cached elements */
  var preloader = $("#preloader");
  var header = $("#header");
  var cursor = $("#cursor");

  /* Registry of split elements so they can be rebuilt on resize */
  var splitRegistry = [];

  /* ========================================================================
     01. TEXT SPLITTING
     --------------------------------------------------------------------
     Words are wrapped first (inline formatting is flattened into classes so
     the word list stays a flat set of siblings), then grouped into lines by
     comparing offsetTop. Each line gets an overflow-hidden mask plus an
     inner element that is the actual animation target.
     ===================================================================== */

  var LINE_TOLERANCE = 6;

  function wrapWords(node, inheritedClasses) {
    var children = Array.prototype.slice.call(node.childNodes);

    children.forEach(function (child) {
      /* Text node → one span per word, spaces kept as plain text nodes */
      if (child.nodeType === 3) {
        if (!child.nodeValue.length) return;

        var fragment = doc.createDocumentFragment();
        var parts = child.nodeValue.split(/(\s+)/);

        parts.forEach(function (part) {
          if (!part) return;

          if (/^\s+$/.test(part)) {
            fragment.appendChild(doc.createTextNode(" "));
            return;
          }

          var word = doc.createElement("span");
          word.className = ["split__word"].concat(inheritedClasses).join(" ");
          word.textContent = part;
          fragment.appendChild(word);
        });

        node.replaceChild(fragment, child);
        return;
      }

      /* Element node → recurse, then unwrap so all words become siblings */
      if (child.nodeType === 1) {
        var tag = child.tagName.toLowerCase();
        if (tag === "br") return;

        var carried = inheritedClasses.slice();
        Array.prototype.forEach.call(child.classList, function (name) {
          carried.push(name);
        });
        if (tag === "em" || tag === "i") carried.push("split__word--em");
        if (tag === "strong" || tag === "b") carried.push("split__word--strong");

        wrapWords(child, carried);

        var unwrapped = doc.createDocumentFragment();
        while (child.firstChild) unwrapped.appendChild(child.firstChild);
        node.replaceChild(unwrapped, child);
      }
    });
  }

  function groupIntoLines(element) {
    var words = $$(".split__word", element);
    if (!words.length) return [];

    /* Bucket words by vertical offset */
    var groups = [];
    var currentGroup = null;
    var currentTop = null;

    words.forEach(function (word) {
      var top = word.offsetTop;

      if (currentTop === null || Math.abs(top - currentTop) > LINE_TOLERANCE) {
        currentGroup = [];
        groups.push(currentGroup);
        currentTop = top;
      }

      currentGroup.push(word);
    });

    /* Wrap each bucket in a mask + inner */
    var inners = groups.map(function (group) {
      var line = doc.createElement("span");
      line.className = "split__line";

      var inner = doc.createElement("span");
      inner.className = "split__line-inner";
      line.appendChild(inner);

      element.insertBefore(line, group[0]);

      /* Move the whole sibling range so the spaces travel with the words */
      var last = group[group.length - 1];
      var node = group[0];

      while (node) {
        var next = node.nextSibling;
        inner.appendChild(node);
        if (node === last) break;
        node = next;
      }

      /* Keep the space that separated this line from the next, so the text
         still reads (and copies) as prose rather than as "ofSweet". */
      var trailing = line.nextSibling;
      if (trailing && trailing.nodeType === 3 && !trailing.nodeValue.trim()) {
        inner.appendChild(trailing);
      }

      return inner;
    });

    /* Clean up the leftovers between lines */
    Array.prototype.slice.call(element.childNodes).forEach(function (node) {
      var isBlankText = node.nodeType === 3 && !node.nodeValue.trim();
      var isBreak = node.nodeType === 1 && node.tagName === "BR";
      if (isBlankText || isBreak) element.removeChild(node);
    });

    return inners;
  }

  /**
   * @param {HTMLElement} element
   * @param {{lines?: boolean}} options
   * @returns {{words: HTMLElement[], lines: HTMLElement[]}}
   */
  function splitText(element, options) {
    var config = options || {};

    if (typeof element.dataset.splitSource === "string") {
      element.innerHTML = element.dataset.splitSource;
    } else {
      element.dataset.splitSource = element.innerHTML;
    }

    wrapWords(element, []);

    return {
      words: $$(".split__word", element),
      lines: config.lines === false ? [] : groupIntoLines(element)
    };
  }

  /** One rebuild per element — breakpoint changes re-register rather than stack. */
  function registerSplit(element, rebuild) {
    for (var i = 0; i < splitRegistry.length; i++) {
      if (splitRegistry[i].element === element) {
        splitRegistry[i].rebuild = rebuild;
        return;
      }
    }
    splitRegistry.push({ element: element, rebuild: rebuild });
  }

  function rebuildSplits() {
    splitRegistry.forEach(function (entry) {
      entry.rebuild();
    });
  }

  /* ========================================================================
     02. REVEAL FACTORY
     ===================================================================== */

  function triggerConfig(element, config) {
    var settings = {
      trigger: config.trigger || element,
      start: config.start || (config.containerAnimation ? "left 82%" : "top 86%")
    };

    if (config.containerAnimation) settings.containerAnimation = config.containerAnimation;

    return settings;
  }

  function createFadeReveal(element, config) {
    return gsap.fromTo(
      element,
      { autoAlpha: 0, y: 34 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 1.15,
        ease: "power3.out",
        delay: parseFloat(element.dataset.revealDelay) || 0,
        scrollTrigger: triggerConfig(element, config)
      }
    );
  }

  function createLineReveal(element, config) {
    var build = function () {
      var result = splitText(element, { lines: true });

      gsap.set(element, { autoAlpha: 1 });
      gsap.set(result.lines, { yPercent: 110 });

      return gsap.to(result.lines, {
        yPercent: 0,
        duration: 1.25,
        ease: "power4.out",
        stagger: 0.085,
        delay: parseFloat(element.dataset.revealDelay) || 0,
        scrollTrigger: triggerConfig(element, config),
        onComplete: function () {
          element.dataset.revealed = "true";
        }
      });
    };

    var tween = build();

    registerSplit(element, function () {
      if (tween) {
        if (tween.scrollTrigger) tween.scrollTrigger.kill();
        tween.kill();
      }

      if (element.dataset.revealed === "true") {
        var result = splitText(element, { lines: true });
        gsap.set(element, { autoAlpha: 1 });
        gsap.set(result.lines, { yPercent: 0 });
        tween = null;
        return;
      }

      tween = build();
    });

    return tween;
  }

  function createReveal(element, config) {
    var settings = config || {};
    return element.dataset.reveal === "lines"
      ? createLineReveal(element, settings)
      : createFadeReveal(element, settings);
  }

  /** Creates every [data-reveal] inside a scope, in DOM order. */
  function revealWithin(scope, config) {
    if (!scope) return;
    $$("[data-reveal]", scope).forEach(function (element) {
      createReveal(element, config);
    });
  }

  /* ========================================================================
     03. MEDIA FALLBACKS
     --------------------------------------------------------------------
     No binary assets ship with this build. When an image file is absent the
     <img> is flagged and the CSS placeholder underneath stays visible.
     ===================================================================== */

  function initMediaFallbacks() {
    $$("[data-media-img]").forEach(function (image) {
      if (image.complete) {
        if (!image.naturalWidth) image.classList.add("is-broken");
        return;
      }

      image.addEventListener(
        "error",
        function () {
          image.classList.add("is-broken");
        },
        { once: true }
      );
    });
  }

  /* ========================================================================
     04. LENIS SMOOTH SCROLL
     ===================================================================== */

  var lenis = null;
  var lenisTicker = null;

  function initLenis() {
    if (!MOTION || !hasLenis) return;

    lenis = new Lenis({
      lerp: 0.085,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      smoothWheel: true,
      syncTouch: false,
      autoRaf: false
    });

    lenis.on("scroll", ScrollTrigger.update);

    lenisTicker = function (time) {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(lenisTicker);
    gsap.ticker.lagSmoothing(0);
  }

  function scrollTo(target, options) {
    var settings = options || {};

    if (lenis) {
      lenis.scrollTo(target, {
        duration: settings.duration || 1.6,
        easing: function (t) {
          return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        }
      });
      return;
    }

    if (typeof target === "number") {
      window.scrollTo({ top: target, behavior: MOTION ? "smooth" : "auto" });
      return;
    }

    target.scrollIntoView({ behavior: MOTION ? "smooth" : "auto", block: "start" });
  }

  /* ========================================================================
     05. PRELOADER
     --------------------------------------------------------------------
     The counter climbs to 92% on a timed curve, then completes the moment
     fonts and the window load event are in — with a hard ceiling so a slow
     asset can never trap the visitor behind the curtain.
     ===================================================================== */

  var MIN_LOAD = 1.9;
  var MAX_LOAD = 5;

  function whenPageReady() {
    var fonts = doc.fonts ? doc.fonts.ready : Promise.resolve();

    var windowLoaded = new Promise(function (resolve) {
      if (doc.readyState === "complete") {
        resolve();
        return;
      }
      window.addEventListener("load", resolve, { once: true });
    });

    var ceiling = new Promise(function (resolve) {
      window.setTimeout(resolve, MAX_LOAD * 1000);
    });

    return Promise.race([Promise.all([fonts, windowLoaded]), ceiling]);
  }

  function runPreloader(onReveal) {
    var numberEl = $("#preloaderNumber");
    var barEl = $("#preloaderBar");
    var counter = { value: 0 };
    var settled = false;

    function render() {
      var rounded = Math.round(counter.value);
      numberEl.textContent = rounded;
      preloader.setAttribute("aria-valuenow", String(rounded));
    }

    /* Approach phase */
    var approach = gsap.to(counter, {
      value: 92,
      duration: MIN_LOAD,
      ease: "power2.out",
      onUpdate: render
    });

    gsap.to(barEl, {
      scaleX: 0.92,
      duration: MIN_LOAD,
      ease: "power2.out"
    });

    function finish() {
      if (settled) return;
      settled = true;

      approach.kill();

      var exit = gsap.timeline({
        defaults: { ease: "power4.inOut" },
        onComplete: function () {
          preloader.remove();
          body.classList.remove("is-loading");
          ScrollTrigger.refresh();
        }
      });

      exit
        .to(counter, { value: 100, duration: 0.55, ease: "power2.inOut", onUpdate: render }, 0)
        .to(barEl, { scaleX: 1, duration: 0.55, ease: "power2.inOut" }, 0)
        .to(barEl, { transformOrigin: "right center", scaleX: 0, duration: 0.6 }, 0.6)
        .to(
          $(".preloader__inner"),
          { yPercent: -60, autoAlpha: 0, duration: 1, ease: "power3.inOut" },
          0.72
        )
        .to(
          preloader,
          {
            clipPath: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
            duration: 1.35,
            ease: "power4.inOut",
            onStart: function () {
              body.classList.remove("is-loading");
              if (lenis) lenis.start();
              onReveal();
            }
          },
          0.85
        );
    }

    /* Never resolve before the approach has had time to feel deliberate */
    Promise.all([
      whenPageReady(),
      new Promise(function (resolve) {
        window.setTimeout(resolve, MIN_LOAD * 1000 * 0.72);
      })
    ]).then(finish);
  }

  /* ========================================================================
     06. HERO
     ===================================================================== */

  function buildHeroTimeline() {
    var mediaInner = $(".hero__media-inner");
    var overline = $('[data-hero="overline"]');
    var title = $('[data-hero="title"]');
    var lede = $('[data-hero="lede"]');
    var facts = $('[data-hero="facts"]');
    var factItems = $$(".hero__fact");
    var cue = $('[data-hero="cue"]');

    var titleLines = splitText(title, { lines: true }).lines;
    var ledeLines = splitText(lede, { lines: true }).lines;

    gsap.set([title, lede], { autoAlpha: 1 });
    gsap.set(titleLines.concat(ledeLines), { yPercent: 115 });
    gsap.set(header, { autoAlpha: 0 });

    registerSplit(title, function () {
      gsap.set(splitText(title, { lines: true }).lines, { yPercent: 0 });
      gsap.set(title, { autoAlpha: 1 });
    });

    registerSplit(lede, function () {
      gsap.set(splitText(lede, { lines: true }).lines, { yPercent: 0 });
      gsap.set(lede, { autoAlpha: 1 });
    });

    var tl = gsap.timeline({ paused: true, defaults: { ease: "power4.out" } });

    tl.fromTo(
      mediaInner,
      { scale: 1.3, yPercent: 3 },
      { scale: 1, yPercent: 0, duration: 2.8, ease: "power3.out" },
      0
    )
      .fromTo(overline, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 1.1 }, 0.2)
      .to(titleLines, { yPercent: 0, duration: 1.5, stagger: 0.11 }, 0.28)
      .to(ledeLines, { yPercent: 0, duration: 1.25, stagger: 0.075 }, 0.62)
      .set(facts, { autoAlpha: 1 }, 0.7)
      .from(factItems, { autoAlpha: 0, y: 24, duration: 1.05, stagger: 0.09 }, 0.7)
      .fromTo(cue, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1 }, 0.85)
      .to(header, { autoAlpha: 1, duration: 1.1 }, 0.6);

    return tl;
  }

  function initHeroAmbience() {
    var mediaInner = $(".hero__media-inner");
    var hero = $("#hero");
    var dot = $(".hero__cue-dot");

    /* Slow drift of the film behind the type */
    gsap.to(mediaInner, {
      yPercent: 14,
      scale: 1.08,
      ease: "none",
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: 1
      }
    });

    gsap.to($(".hero__content"), {
      yPercent: -12,
      autoAlpha: 0,
      ease: "none",
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom 25%",
        scrub: 1
      }
    });

    /* The travelling dot in the scroll cue — vertical on desktop, horizontal below */
    var mm = gsap.matchMedia();

    mm.add("(min-width: 901px)", function () {
      gsap.fromTo(
        dot,
        { yPercent: -120 },
        { yPercent: 260, duration: 2.1, ease: "power2.inOut", repeat: -1, repeatDelay: 0.35 }
      );
    });

    mm.add("(max-width: 900px)", function () {
      gsap.fromTo(
        dot,
        { xPercent: -120 },
        { xPercent: 260, duration: 2.1, ease: "power2.inOut", repeat: -1, repeatDelay: 0.35 }
      );
    });
  }

  /* ========================================================================
     07. HEADER, MENU & ANCHORS
     ===================================================================== */

  var menuIsOpen = false;

  function initHeaderScroll() {
    var hidden = false;

    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: function (self) {
        var y = self.scroll();

        header.classList.toggle("is-stuck", y > 40);

        if (menuIsOpen) return;

        var shouldHide = self.direction === 1 && y > 260;

        if (shouldHide === hidden) return;
        hidden = shouldHide;

        gsap.to(header, {
          yPercent: hidden ? -130 : 0,
          duration: 0.7,
          ease: "power3.out",
          overwrite: "auto"
        });
      }
    });
  }

  function initMenu() {
    var menu = $("#menu");
    var toggle = $("#menuToggle");
    var toggleLabel = $("[data-menu-label]");
    var backdrop = $(".menu__backdrop");
    var links = $$(".menu__link");
    var note = $(".menu__note");

    if (!menu || !toggle) return;

    var tl = gsap.timeline({
      paused: true,
      defaults: { ease: "power4.inOut" },
      onReverseComplete: function () {
        menu.classList.remove("is-open");
        menu.setAttribute("aria-hidden", "true");
      }
    });

    tl.fromTo(backdrop, { scaleY: 0 }, { scaleY: 1, duration: 0.9, transformOrigin: "top center" }, 0)
      .fromTo(
        links,
        { autoAlpha: 0, y: 48 },
        { autoAlpha: 1, y: 0, duration: 0.85, stagger: 0.07, ease: "power3.out" },
        0.42
      )
      .fromTo(note, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 0.65);

    function open() {
      menuIsOpen = true;
      menu.classList.add("is-open");
      menu.setAttribute("aria-hidden", "false");
      toggle.setAttribute("aria-expanded", "true");
      toggleLabel.textContent = "Kapat";
      body.classList.add("is-menu-open");
      if (lenis) lenis.stop();
      gsap.to(header, { yPercent: 0, duration: 0.4, ease: "power3.out", overwrite: "auto" });
      tl.play();
    }

    function close() {
      menuIsOpen = false;
      toggle.setAttribute("aria-expanded", "false");
      toggleLabel.textContent = "Menü";
      body.classList.remove("is-menu-open");
      if (lenis) lenis.start();
      tl.reverse();
    }

    toggle.addEventListener("click", function () {
      if (menuIsOpen) close();
      else open();
    });

    doc.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && menuIsOpen) close();
    });

    $$("[data-menu-link]").forEach(function (link) {
      link.addEventListener("click", function () {
        close();
      });
    });

    window.addEventListener("resize", function () {
      if (menuIsOpen && window.innerWidth > 1024) close();
    });
  }

  function initAnchors() {
    $$('a[href^="#"]').forEach(function (link) {
      var id = link.getAttribute("href");
      if (!id || id === "#") return;

      link.addEventListener("click", function (event) {
        var target = doc.querySelector(id);
        if (!target) return;

        event.preventDefault();
        scrollTo(target);
      });
    });

    var backToTop = $("#backToTop");
    if (backToTop) {
      backToTop.addEventListener("click", function () {
        scrollTo(0, { duration: 2 });
      });
    }
  }

  /* ========================================================================
     08. CURSOR
     ===================================================================== */

  function initCursor() {
    if (!cursor) return;
    if (!window.matchMedia("(pointer: fine) and (min-width: 901px)").matches) return;

    var ring = $(".cursor__ring", cursor);
    var dot = $(".cursor__dot", cursor);

    gsap.set(cursor, { autoAlpha: 0 });

    var ringX = gsap.quickTo(ring, "x", { duration: 0.55, ease: "power3" });
    var ringY = gsap.quickTo(ring, "y", { duration: 0.55, ease: "power3" });
    var dotX = gsap.quickTo(dot, "x", { duration: 0.14, ease: "power3" });
    var dotY = gsap.quickTo(dot, "y", { duration: 0.14, ease: "power3" });

    var revealed = false;

    window.addEventListener(
      "mousemove",
      function (event) {
        if (!revealed) {
          revealed = true;
          gsap.set([ring, dot], { x: event.clientX, y: event.clientY });
          gsap.to(cursor, { autoAlpha: 1, duration: 0.4 });
        }

        ringX(event.clientX);
        ringY(event.clientY);
        dotX(event.clientX);
        dotY(event.clientY);
      },
      { passive: true }
    );

    doc.addEventListener("mouseleave", function () {
      gsap.to(cursor, { autoAlpha: 0, duration: 0.3 });
    });

    doc.addEventListener("mouseenter", function () {
      if (revealed) gsap.to(cursor, { autoAlpha: 1, duration: 0.3 });
    });

    $$('a, button, [data-cursor="link"]').forEach(function (target) {
      target.addEventListener("mouseenter", function () {
        cursor.classList.add("is-active");
        gsap.to(ring, { scale: 1.75, duration: 0.45, ease: "power3.out" });
        gsap.to(dot, { scale: 0.4, duration: 0.45, ease: "power3.out" });
      });

      target.addEventListener("mouseleave", function () {
        cursor.classList.remove("is-active");
        gsap.to(ring, { scale: 1, duration: 0.45, ease: "power3.out" });
        gsap.to(dot, { scale: 1, duration: 0.45, ease: "power3.out" });
      });
    });
  }

  /* ========================================================================
     09. SCROLL PROGRESS
     ===================================================================== */

  function initProgressBar() {
    var bar = $("#progressBar");
    if (!bar) return;

    gsap.to(bar, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: {
        start: 0,
        end: "max",
        scrub: 0.35
      }
    });
  }

  /* ========================================================================
     10. MARQUEE
     ===================================================================== */

  function initMarquee() {
    var track = $("#marqueeTrack");
    if (!track) return;

    var loop = gsap.to(track, {
      xPercent: -50,
      duration: 28,
      ease: "none",
      repeat: -1
    });

    /* Scroll velocity nudges the ribbon, then it eases back to its own pace */
    var targetScale = 1;

    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: function (self) {
        var boost = Math.min(Math.abs(self.getVelocity()) / 550, 4.5);
        targetScale = Math.max(targetScale, 1 + boost);
      }
    });

    gsap.ticker.add(function () {
      var current = loop.timeScale();
      loop.timeScale(current + (targetScale - current) * 0.075);
      targetScale += (1 - targetScale) * 0.045;
    });
  }

  /* ========================================================================
     11. PHILOSOPHY
     ===================================================================== */

  function initPhilosophy() {
    var section = $("#philosophy");
    if (!section) return;

    revealWithin(section, {});

    var statement = $("[data-philosophy]", section);
    if (!statement) return;

    var build = function () {
      var words = splitText(statement, { lines: false }).words;

      return gsap.fromTo(
        words,
        { opacity: 0.12 },
        {
          opacity: 1,
          ease: "none",
          duration: 1,
          stagger: 0.45,
          scrollTrigger: {
            trigger: statement,
            start: "top 80%",
            end: "bottom 58%",
            scrub: 0.6
          }
        }
      );
    };

    var tween = build();

    registerSplit(statement, function () {
      if (tween) {
        if (tween.scrollTrigger) tween.scrollTrigger.kill();
        tween.kill();
      }
      tween = build();
    });
  }

  /* ========================================================================
     12. LEGACY (PARALLAX + COUNTERS)
     ===================================================================== */

  function initLegacy() {
    var section = $("#legacy");
    if (!section) return;

    revealWithin(section, {});

    /* Portrait parallax */
    var frame = $("[data-parallax]", section);
    var inner = $("[data-parallax-inner]", section);

    if (frame && inner) {
      /* Driven by the section, not the frame: the frame is sticky and stops
         moving, so the drift has to be measured against the whole column. */
      gsap.fromTo(
        inner,
        { yPercent: -12 },
        {
          yPercent: 12,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "bottom top",
            scrub: 1
          }
        }
      );

      /* A slow settle of the frame itself as it arrives */
      gsap.fromTo(
        frame,
        { clipPath: "inset(14% 8% 14% 8%)" },
        {
          clipPath: "inset(0% 0% 0% 0%)",
          duration: 1.6,
          ease: "power3.out",
          scrollTrigger: {
            trigger: frame,
            start: "top 88%"
          }
        }
      );
    }

    /* Counters */
    $$("[data-count]", section).forEach(function (element) {
      var end = parseFloat(element.dataset.count);
      var isPlain = element.hasAttribute("data-count-plain");
      var start = isPlain ? end - 26 : 0;
      var value = { current: start };

      element.textContent = String(start);

      gsap.to(value, {
        current: end,
        duration: isPlain ? 2.4 : 1.8,
        ease: "power2.out",
        scrollTrigger: {
          trigger: element,
          start: "top 92%"
        },
        onUpdate: function () {
          element.textContent = String(Math.round(value.current));
        }
      });
    });
  }

  /* ========================================================================
     13. HERITAGE TIMELINE
     ===================================================================== */

  function initHeritage() {
    var section = $("#heritage");
    if (!section) return;

    revealWithin($(".heritage__head", section), {});

    var timeline = $("#timeline", section);
    var progress = $("#timelineProgress", section);
    var entries = $$("[data-timeline-entry]", section);

    /* The gold spine draws itself downward */
    if (progress) {
      gsap.fromTo(
        progress,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: timeline,
            start: "top 62%",
            end: "bottom 82%",
            scrub: 0.5
          }
        }
      );
    }

    /* Entries arrive from their own side as the line reaches them.
       The loop follows however many [data-timeline-entry] nodes exist,
       so two milestones draw the same spine as a longer list. */
    entries.forEach(function (entry, index) {
      var side = index % 2 === 0 ? -1 : 1;
      var content = $("[data-timeline-content]", entry);
      var media = $("[data-timeline-media]", entry);

      var offset = function (sign) {
        return function () {
          return window.innerWidth > 900 ? 56 * sign : 30;
        };
      };

      var tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        scrollTrigger: {
          trigger: entry,
          start: "top 76%",
          invalidateOnRefresh: true,
          onEnter: function () {
            entry.classList.add("is-active");
          }
        }
      });

      tl.from(content, { autoAlpha: 0, x: offset(side), y: 26, duration: 1.15 }, 0).from(
        media,
        { autoAlpha: 0, x: offset(-side), y: 26, scale: 1.03, duration: 1.25 },
        0.1
      );
    });
  }

  /* ========================================================================
     14. CRAFT (PINNED HORIZONTAL SHOWCASE)
     ===================================================================== */

  function initCraft() {
    var section = $("#craft");
    var track = $("#craftTrack");
    if (!section || !track) return;

    var mm = gsap.matchMedia();

    /* ---- Desktop: pin the section, run the track sideways ---- */
    mm.add("(min-width: 901px)", function () {
      var distance = function () {
        return Math.max(0, track.scrollWidth - window.innerWidth);
      };

      var scrollTween = gsap.to(track, {
        x: function () {
          return -distance();
        },
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: function () {
            return "+=" + distance();
          },
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true
        }
      });

      /* The intro is already on screen when the pin engages, so it answers to
         the section itself rather than to horizontal progress. */
      revealWithin($(".craft__panel--intro", track), { trigger: section, start: "top 62%" });

      $$("[data-craft-panel]", track).forEach(function (panel) {
        var inner = $("[data-craft-inner]", panel);
        var bodyEl = $(".craft__panel-body", panel);

        /* Media eases down to true scale exactly as the panel centres */
        gsap
          .timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: panel,
              containerAnimation: scrollTween,
              start: "left right",
              end: "right left",
              scrub: true
            }
          })
          .fromTo(inner, { scale: 1.22, xPercent: 5 }, { scale: 1, xPercent: 0, duration: 1 })
          .to(inner, { scale: 1.22, xPercent: -5, duration: 1 });

        /* Copy lifts in slightly behind the media */
        gsap.from(gsap.utils.toArray(bodyEl.children), {
          autoAlpha: 0,
          y: 34,
          duration: 1.1,
          ease: "power3.out",
          stagger: 0.07,
          scrollTrigger: {
            trigger: panel,
            containerAnimation: scrollTween,
            start: "left 68%"
          }
        });
      });

      /* The closing quote lives off to the right — it answers to the track */
      revealWithin($(".craft__panel--outro", track), { containerAnimation: scrollTween });

      return function () {
        /* matchMedia reverts the animations; the split cache is reused */
      };
    });

    /* ---- Below 901px: the same content, stacked and scrolled normally ---- */
    mm.add("(max-width: 900px)", function () {
      revealWithin(track, {});

      $$("[data-craft-panel]", track).forEach(function (panel) {
        var inner = $("[data-craft-inner]", panel);
        var bodyEl = $(".craft__panel-body", panel);

        gsap.fromTo(
          inner,
          { scale: 1.16 },
          {
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: panel,
              start: "top bottom",
              end: "center center",
              scrub: 1
            }
          }
        );

        gsap.from(gsap.utils.toArray(bodyEl.children), {
          autoAlpha: 0,
          y: 28,
          duration: 1,
          ease: "power3.out",
          stagger: 0.06,
          scrollTrigger: {
            trigger: bodyEl,
            start: "top 88%"
          }
        });
      });

      return function () {};
    });
  }

  /* ========================================================================
     15. VISIT (LOCATION)
     --------------------------------------------------------------------
     Copy rises from yPercent 50. The map eases open through clip-path with
     a slight scale settle — both fired once, as the section enters.
     ===================================================================== */

  function initVisit() {
    var section = $("#visit");
    if (!section) return;

    var lines = $$("[data-visit-line]", section);
    var map = $("[data-visit-map]", section);

    if (lines.length) {
      gsap.fromTo(
        lines,
        { yPercent: 50, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 1.25,
          ease: "power3.out",
          stagger: 0.09,
          scrollTrigger: {
            trigger: section,
            start: "top 76%"
          }
        }
      );
    }

    if (map) {
      gsap.fromTo(
        map,
        { clipPath: "inset(9% 7% 9% 7%)", scale: 1.045 },
        {
          clipPath: "inset(0% 0% 0% 0%)",
          scale: 1,
          duration: 1.8,
          ease: "power3.inOut",
          scrollTrigger: {
            trigger: map,
            start: "top 82%"
          }
        }
      );
    }
  }

  /* ========================================================================
     16. FOOTER
     ===================================================================== */

  function initFooter() {
    var footer = $("#footer");
    if (!footer) return;

    var mark = $(".footer__mark", footer);
    var items = $$("[data-footer-reveal]", footer).filter(function (element) {
      return element !== mark;
    });

    var tl = gsap.timeline({
      defaults: { ease: "power3.out" },
      scrollTrigger: {
        trigger: footer,
        start: "top 78%"
      }
    });

    tl.fromTo(
      mark,
      { autoAlpha: 0, yPercent: 22 },
      { autoAlpha: 1, yPercent: 0, duration: 1.5, ease: "power4.out" },
      0
    ).fromTo(
      items,
      { autoAlpha: 0, y: 28 },
      { autoAlpha: 1, y: 0, duration: 1, stagger: 0.055 },
      0.25
    );
  }

  /* ========================================================================
     16. BOOT & RESIZE
     ===================================================================== */

  function stampYear() {
    var year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  /** Static rendering path: no GSAP, or the visitor prefers reduced motion. */
  function renderStatic() {
    $$("[data-reveal], [data-hero], [data-footer-reveal]").forEach(function (element) {
      element.style.opacity = "1";
      element.style.visibility = "visible";
      element.style.transform = "none";
    });

    if (preloader) preloader.remove();
    body.classList.remove("is-loading");

    var menu = $("#menu");
    var toggle = $("#menuToggle");
    var toggleLabel = $("[data-menu-label]");

    if (menu && toggle) {
      var backdrop = $(".menu__backdrop");
      backdrop.style.transform = "scaleY(1)";
      $$(".menu__link, .menu__note").forEach(function (element) {
        element.style.opacity = "1";
      });

      toggle.addEventListener("click", function () {
        menuIsOpen = !menuIsOpen;
        menu.classList.toggle("is-open", menuIsOpen);
        menu.setAttribute("aria-hidden", menuIsOpen ? "false" : "true");
        toggle.setAttribute("aria-expanded", menuIsOpen ? "true" : "false");
        toggleLabel.textContent = menuIsOpen ? "Kapat" : "Menü";
        body.classList.toggle("is-menu-open", menuIsOpen);
      });

      $$("[data-menu-link]").forEach(function (link) {
        link.addEventListener("click", function () {
          menuIsOpen = false;
          menu.classList.remove("is-open");
          menu.setAttribute("aria-hidden", "true");
          toggle.setAttribute("aria-expanded", "false");
          toggleLabel.textContent = "Menü";
          body.classList.remove("is-menu-open");
        });
      });
    }

    var backToTop = $("#backToTop");
    if (backToTop) {
      backToTop.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "auto" });
      });
    }
  }

  function initResize() {
    var lastWidth = window.innerWidth;
    var timer = null;

    window.addEventListener("resize", function () {
      if (window.innerWidth === lastWidth) return; /* ignore mobile chrome height changes */
      lastWidth = window.innerWidth;

      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        rebuildSplits();
        ScrollTrigger.refresh();
      }, 260);
    });
  }

  function boot() {
    stampYear();
    initMediaFallbacks();

    if (!MOTION) {
      renderStatic();
      initAnchors();
      return;
    }

    /* Unlocks the enhanced layouts in CSS (pinned gallery, undrawn timeline) */
    doc.documentElement.classList.add("has-motion");

    /* The curtain must always open on the top of the page */
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    gsap.registerPlugin(ScrollTrigger);
    gsap.defaults({ ease: "power3.out", duration: 1 });
    ScrollTrigger.config({ ignoreMobileResize: true });

    initLenis();
    if (lenis) lenis.stop();

    var fontsReady = doc.fonts ? doc.fonts.ready : Promise.resolve();

    fontsReady.then(function () {
      /* Hero first — its splits must exist before anything measures layout */
      var heroTimeline = buildHeroTimeline();

      /* Global / chrome scenes */
      initProgressBar();
      initHeaderScroll();
      initMenu();
      initAnchors();
      initCursor();

      /* Scroll scenes, created in the order they appear on the page */
      initHeroAmbience();
      initMarquee();
      initPhilosophy();
      initLegacy();
      initHeritage();
      initCraft();
      revealWithin($("#house"), {});
      initVisit();
      initFooter();

      initResize();
      ScrollTrigger.refresh();

      runPreloader(function () {
        heroTimeline.play();
      });
    });
  }

  boot();
})();
