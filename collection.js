/* ==========================================================================
   Hançerlioğlu — Ustalık Eserleri
   Vanilla JS + GSAP (core & ScrollTrigger) + Lenis
   --------------------------------------------------------------------------
   00. Environment & helpers
   01. Media fallbacks
   02. Lenis smooth scroll
   03. Preloader
   04. Cover
   05. Header, menu & anchors
   06. Cursor
   07. Scroll progress
   08. Category index
   09. Catalogue rows
   10. Hover preview (cursor follower)
   11. Story drawer
   12. Footer
   13. Boot & resize
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

  function pad(number) {
    return number < 10 ? "0" + number : String(number);
  }

  /* Cached elements */
  var preloader = $("#preloader");
  var header = $("#header");
  var cursor = $("#cursor");

  /* The catalogue, in the order it is printed */
  var items = $$("[data-item]");
  var categories = $$("[data-category]");

  /* ========================================================================
     01. MEDIA FALLBACKS
     --------------------------------------------------------------------
     No binary assets ship with this build. A missing file flags its element
     and the gold placeholder underneath simply stays where it is.
     ===================================================================== */

  function initMediaFallbacks() {
    $$("[data-media-img]").forEach(function (image) {
      if (!image.getAttribute("src")) return;

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

    /* A <video> with <source> children never fires its own error event, so
       the sources are counted out individually. */
    var cover = $(".cover__video");
    if (!cover) return;

    var sources = $$("source", cover);
    var failed = 0;

    sources.forEach(function (source) {
      source.addEventListener(
        "error",
        function () {
          failed += 1;
          if (failed >= sources.length) cover.classList.add("is-broken");
        },
        { once: true }
      );
    });
  }

  /* ========================================================================
     02. LENIS SMOOTH SCROLL
     ===================================================================== */

  var lenis = null;

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

    gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);
  }

  /** Keeps a jumped-to heading clear of the fixed header. */
  function anchorOffset() {
    return window.innerWidth > 1024 ? 128 : 88;
  }

  function scrollTo(target, options) {
    var settings = options || {};
    var offset = typeof settings.offset === "number" ? settings.offset : 0;

    if (lenis) {
      lenis.scrollTo(target, {
        offset: offset,
        duration: settings.duration || 1.6,
        easing: function (t) {
          return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        }
      });
      return;
    }

    var top = typeof target === "number"
      ? target
      : target.getBoundingClientRect().top + window.pageYOffset + offset;

    window.scrollTo({ top: Math.max(top, 0), behavior: MOTION ? "smooth" : "auto" });
  }

  /* ========================================================================
     03. PRELOADER
     --------------------------------------------------------------------
     The counter climbs to 92% on a timed curve, then completes the moment
     fonts and the window load event are in — with a hard ceiling so a slow
     asset can never trap the visitor behind the curtain.
     ===================================================================== */

  var MIN_LOAD = 1.7;
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

    var approach = gsap.to(counter, {
      value: 92,
      duration: MIN_LOAD,
      ease: "power2.out",
      onUpdate: render
    });

    gsap.to(barEl, { scaleX: 0.92, duration: MIN_LOAD, ease: "power2.out" });

    function finish() {
      if (settled) return;
      settled = true;

      approach.kill();

      var exit = gsap.timeline({
        defaults: { ease: "power4.inOut" },
        onComplete: function () {
          preloader.remove();
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

    Promise.all([
      whenPageReady(),
      new Promise(function (resolve) {
        window.setTimeout(resolve, MIN_LOAD * 1000 * 0.72);
      })
    ]).then(finish);
  }

  /* ========================================================================
     04. COVER
     --------------------------------------------------------------------
     The title is authored as explicit masked lines in the HTML rather than
     split at runtime — two words need no splitter, and static markup means
     nothing to rebuild when the viewport changes.
     ===================================================================== */

  function buildCoverTimeline() {
    var overline = $('[data-cover="overline"]');
    var title = $('[data-cover="title"]');
    var english = $('[data-cover="english"]');
    var lede = $('[data-cover="lede"]');
    var facts = $('[data-cover="facts"]');
    var factItems = $$(".cover__fact");
    var cue = $('[data-cover="cue"]');
    var titleLines = $$(".split__line-inner", title);

    gsap.set(title, { autoAlpha: 1 });
    gsap.set(titleLines, { yPercent: 115 });
    gsap.set(header, { autoAlpha: 0 });

    var tl = gsap.timeline({ paused: true, defaults: { ease: "power4.out" } });

    tl.fromTo($(".cover__media-inner"), { scale: 1.24 }, { scale: 1, duration: 2.6, ease: "power3.out" }, 0)
      .fromTo(overline, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1.05 }, 0.18)
      .to(titleLines, { yPercent: 0, duration: 1.5, stagger: 0.11 }, 0.26)
      .fromTo(english, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 1 }, 0.62)
      .fromTo(lede, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 1.15 }, 0.7)
      .set(facts, { autoAlpha: 1 }, 0.78)
      .from(factItems, { autoAlpha: 0, y: 22, duration: 1, stagger: 0.08 }, 0.78)
      .fromTo(cue, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.95 }, 0.9)
      .to(header, { autoAlpha: 1, duration: 1.1 }, 0.55);

    return tl;
  }

  function initCoverAmbience() {
    var cover = $("#cover");
    if (!cover) return;

    gsap.to($(".cover__media-inner"), {
      yPercent: 12,
      scale: 1.06,
      ease: "none",
      scrollTrigger: { trigger: cover, start: "top top", end: "bottom top", scrub: 1 }
    });

    gsap.to($(".cover__inner"), {
      yPercent: -14,
      autoAlpha: 0,
      ease: "none",
      scrollTrigger: { trigger: cover, start: "top top", end: "bottom 30%", scrub: 1 }
    });

    gsap.fromTo(
      $(".cover__cue-dot"),
      { xPercent: -110 },
      { xPercent: 260, duration: 2.1, ease: "power2.inOut", repeat: -1, repeatDelay: 0.35 }
    );
  }

  /* ========================================================================
     05. HEADER, MENU & ANCHORS
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

        if (menuIsOpen || drawerIsOpen) return;

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

        /* A category begins with a tall band of air that is there to separate
           it from the one above. Jumping from the index should land on the
           heading, not on the whitespace in front of it. */
        var head = $(".category__head", target);

        scrollTo(head || target, { offset: -anchorOffset() });
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
     06. CURSOR
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

    /* Over a catalogue row the ring shrinks instead of swelling, so it reads
       as a focus point against the preview rather than competing with it. */
    $$('a, button, [data-cursor="link"]').forEach(function (target) {
      var isItem = target.getAttribute("data-cursor") === "item";

      target.addEventListener("mouseenter", function () {
        cursor.classList.add("is-active");
        gsap.to(ring, { scale: isItem ? 0.42 : 1.75, duration: 0.45, ease: "power3.out" });
        gsap.to(dot, { scale: isItem ? 1.6 : 0.4, duration: 0.45, ease: "power3.out" });
      });

      target.addEventListener("mouseleave", function () {
        cursor.classList.remove("is-active");
        gsap.to(ring, { scale: 1, duration: 0.45, ease: "power3.out" });
        gsap.to(dot, { scale: 1, duration: 0.45, ease: "power3.out" });
      });
    });
  }

  /* ========================================================================
     07. SCROLL PROGRESS
     ===================================================================== */

  function initProgressBar() {
    var bar = $("#progressBar");
    if (!bar) return;

    gsap.to(bar, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { start: 0, end: "max", scrub: 0.35 }
    });
  }

  /* ========================================================================
     08. CATEGORY INDEX
     --------------------------------------------------------------------
     One trigger per category spanning the middle band of the viewport. The
     active link is never cleared without another taking its place, so the
     index still reads correctly in the closing pages after the last work.
     ===================================================================== */

  var catnavLinks = $$("[data-catnav]");

  function setActiveCategory(index) {
    catnavLinks.forEach(function (link, i) {
      link.classList.toggle("is-active", i === index);
    });
  }

  function initCategoryIndex() {
    if (!categories.length) return;

    setActiveCategory(0);

    categories.forEach(function (section, index) {
      ScrollTrigger.create({
        trigger: section,
        start: "top 45%",
        end: "bottom 45%",
        onToggle: function (self) {
          if (self.isActive) setActiveCategory(index);
        }
      });
    });
  }

  /** Reduced motion / no GSAP: the same behaviour without a scroll library. */
  function initCategoryIndexStatic() {
    if (!categories.length || typeof IntersectionObserver === "undefined") return;

    setActiveCategory(0);

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          setActiveCategory(categories.indexOf(entry.target));
        });
      },
      { rootMargin: "-45% 0px -55% 0px" }
    );

    categories.forEach(function (section) {
      observer.observe(section);
    });
  }

  /* ========================================================================
     09. CATALOGUE ROWS
     ===================================================================== */

  function initCategoryHeads() {
    categories.forEach(function (section) {
      var head = $(".category__head", section);
      if (!head) return;

      var meta = $(".category__meta", head);
      var lines = $$(".split__line-inner", head);
      var rest = [$(".category__english", head), $(".category__note", head)].filter(Boolean);

      gsap.set(lines, { yPercent: 115 });

      var tl = gsap.timeline({
        defaults: { ease: "power4.out" },
        scrollTrigger: { trigger: head, start: "top 82%" }
      });

      tl.fromTo(meta, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 1 }, 0)
        .to(lines, { yPercent: 0, duration: 1.35, stagger: 0.09 }, 0.1)
        .fromTo(rest, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.08 }, 0.32);
    });
  }

  /* The reveal targets .item__inner rather than .item, because .item is an
     ancestor of the position: fixed preview and a transform on it would trap
     that preview in a new containing block. */
  function initItemReveals() {
    var inners = items.map(function (item) {
      return $(".item__inner", item);
    });

    gsap.set(inners, { autoAlpha: 0, y: 32 });

    ScrollTrigger.batch(inners, {
      start: "top 94%",
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          duration: 1.05,
          ease: "power3.out",
          stagger: 0.065,
          overwrite: true
        });

        batch.forEach(function (inner, i) {
          gsap.delayedCall(i * 0.065, function () {
            inner.parentElement.classList.add("is-in");
          });
        });
      }
    });
  }

  /** Hover / focus state, shared by pointer and keyboard. */
  function initItemStates() {
    items.forEach(function (item) {
      var trigger = $(".item__trigger", item);
      if (!trigger) return;

      function enter() {
        item.classList.add("is-hover");
      }

      function leave() {
        item.classList.remove("is-hover");
      }

      trigger.addEventListener("mouseenter", enter);
      trigger.addEventListener("mouseleave", leave);
      trigger.addEventListener("focus", enter);
      trigger.addEventListener("blur", leave);
    });
  }

  /* ========================================================================
     10. HOVER PREVIEW (CURSOR FOLLOWER)
     --------------------------------------------------------------------
     Scoped to gsap.matchMedia so that dropping below the breakpoint reverts
     every inline style GSAP wrote and hands the figures back to the CSS,
     which puts them in the flow as thumbnails.
     ===================================================================== */

  function initPreview() {
    var mm = gsap.matchMedia();

    mm.add("(min-width: 1025px) and (pointer: fine)", function () {
      var pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      var current = { x: pointer.x, y: pointer.y };

      var activeFigure = null;
      var setX = null;
      var setY = null;
      var setRotate = null;
      var bounds = { min: 0, max: 0 };

      var figures = items
        .map(function (item) {
          return $(".preview", item);
        })
        .filter(Boolean);

      gsap.set(figures, { xPercent: -50, yPercent: -50, scale: 0.9, autoAlpha: 0 });

      function measure(figure) {
        var height = figure.offsetHeight || 380;
        /* Never let the card slide up behind the fixed header */
        bounds.min = height / 2 + 104;
        bounds.max = window.innerHeight - height / 2 - 24;
        if (bounds.max < bounds.min) bounds.max = bounds.min;
      }

      function show(item) {
        var figure = $(".preview", item);
        if (!figure || figure === activeFigure) return;

        if (activeFigure) hide(activeFigure);

        activeFigure = figure;
        measure(figure);

        setX = gsap.quickSetter(figure, "x", "px");
        setY = gsap.quickSetter(figure, "y", "px");
        setRotate = gsap.quickSetter(figure, "rotate", "deg");

        current.x = pointer.x;
        current.y = pointer.y;
        setX(current.x);
        setY(gsap.utils.clamp(bounds.min, bounds.max, current.y));

        gsap.to(figure, {
          autoAlpha: 1,
          scale: 1,
          duration: 0.55,
          ease: "power3.out",
          overwrite: "auto"
        });
      }

      function hide(figure) {
        var target = figure || activeFigure;
        if (!target) return;

        gsap.to(target, {
          autoAlpha: 0,
          scale: 0.92,
          duration: 0.4,
          ease: "power3.out",
          overwrite: "auto"
        });

        if (target === activeFigure) {
          activeFigure = null;
          setX = null;
          setY = null;
          setRotate = null;
        }
      }

      function onMove(event) {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
      }

      function onTick() {
        current.x += (pointer.x - current.x) * 0.16;
        current.y += (pointer.y - current.y) * 0.16;

        if (!activeFigure || !setX) return;

        setX(current.x);
        setY(gsap.utils.clamp(bounds.min, bounds.max, current.y));
        setRotate(gsap.utils.clamp(-7, 7, (pointer.x - current.x) * 0.32));
      }

      var handlers = [];

      items.forEach(function (item) {
        var trigger = $(".item__trigger", item);
        if (!trigger) return;

        var enter = function () {
          show(item);
        };
        var leave = function () {
          hide($(".preview", item));
        };

        trigger.addEventListener("mouseenter", enter);
        trigger.addEventListener("mouseleave", leave);
        handlers.push([trigger, enter, leave]);
      });

      window.addEventListener("mousemove", onMove, { passive: true });
      gsap.ticker.add(onTick);

      /* The card must never hang over an open drawer */
      var onDrawerOpen = function () {
        hide();
      };
      doc.addEventListener("drawer:open", onDrawerOpen);

      return function cleanup() {
        window.removeEventListener("mousemove", onMove);
        gsap.ticker.remove(onTick);
        doc.removeEventListener("drawer:open", onDrawerOpen);

        handlers.forEach(function (entry) {
          entry[0].removeEventListener("mouseenter", entry[1]);
          entry[0].removeEventListener("mouseleave", entry[2]);
        });

        /* quickSetter writes are not recorded by the context, so the
           transforms it left behind are cleared by hand before the figures
           go back into the flow as thumbnails. */
        gsap.set(figures, { clearProps: "transform,opacity,visibility" });
      };
    });
  }

  /* ========================================================================
     11. STORY DRAWER
     --------------------------------------------------------------------
     One shell for forty-two works. The panel itself slides on a CSS
     transition so it behaves with or without GSAP; the contents are
     staggered in by GSAP when there is motion to spend.
     ===================================================================== */

  var drawerIsOpen = false;

  function initDrawer() {
    var drawer = $("#drawer");
    if (!drawer || !items.length) return;

    var panel = $(".drawer__panel", drawer);
    var scroller = $(".drawer__scroll", drawer);
    var media = $(".drawer__media", drawer);
    var video = $("#drawerVideo");
    var image = $("#drawerImg");
    var indexEl = $("#drawerIndex");
    var categoryEl = $("#drawerCategory");
    var titleEl = $("#drawerTitle");
    var subEl = $("#drawerSub");
    var storyEl = $("#drawerStory");
    var prevBtn = $("[data-drawer-prev]", drawer);
    var nextBtn = $("[data-drawer-next]", drawer);

    var currentIndex = -1;
    var lastFocused = null;

    /* ---- Reading an item ---- */

    function titleOf(item) {
      var name = $(".item__name", item);
      if (!name) return "";

      var clone = name.cloneNode(true);
      var tag = $(".item__tag", clone);
      if (tag) tag.remove();

      return clone.textContent.replace(/\s+/g, " ").trim();
    }

    function categoryOf(item) {
      var section = item.closest("[data-category]");
      var heading = section ? $(".category__title", section) : null;
      return heading ? heading.textContent.trim() : "Hançerlioğlu";
    }

    function fill(index) {
      var item = items[index];
      var note = $(".item__note", item);
      var story = $(".item__story", item);
      var thumb = $(".preview__img", item);

      indexEl.textContent = pad(index + 1);
      categoryEl.textContent = categoryOf(item);
      titleEl.textContent = titleOf(item);
      subEl.textContent = note ? note.textContent.trim() : "";
      storyEl.innerHTML = story ? story.innerHTML : "";

      /* Still: doubles as the poster behind the film */
      image.classList.remove("is-broken");
      if (thumb && thumb.getAttribute("src")) {
        image.src = thumb.getAttribute("src");
        image.alt = "Hançerlioğlu - " + titleEl.textContent.trim();
        if (thumb.classList.contains("is-broken")) image.classList.add("is-broken");
      } else {
        image.removeAttribute("src");
        image.alt = "Hançerlioğlu - " + titleEl.textContent.trim();
        image.classList.add("is-broken");
      }

      /* Film: optional, and silently absent when the file is not there */
      video.classList.remove("is-broken");
      video.pause();

      if (item.dataset.video) {
        video.src = item.dataset.video;
        var attempt = video.play();
        if (attempt && typeof attempt.catch === "function") attempt.catch(function () {});
      } else {
        /* No load() here: calling it on an empty source only raises noise */
        video.removeAttribute("src");
      }

      prevBtn.disabled = index === 0;
      nextBtn.disabled = index === items.length - 1;

      scroller.scrollTop = 0;
      currentIndex = index;
    }

    video.addEventListener("error", function () {
      video.classList.add("is-broken");
    });

    /* ---- Content flourish ---- */

    function animateContent(delay) {
      if (!MOTION) return;

      gsap.fromTo(
        [media, categoryEl, titleEl, subEl, storyEl],
        { autoAlpha: 0, y: 28 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.85,
          ease: "power3.out",
          stagger: 0.06,
          delay: delay,
          overwrite: true
        }
      );
    }

    /* ---- Focus handling ---- */

    function focusables() {
      return $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', panel).filter(
        function (element) {
          return element.offsetWidth > 0 || element.offsetHeight > 0;
        }
      );
    }

    function onKeydown(event) {
      if (!drawerIsOpen) return;

      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key === "ArrowLeft" && currentIndex > 0) {
        step(-1);
        return;
      }

      if (event.key === "ArrowRight" && currentIndex < items.length - 1) {
        step(1);
        return;
      }

      if (event.key !== "Tab") return;

      var list = focusables();
      if (!list.length) return;

      var first = list[0];
      var last = list[list.length - 1];

      if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    /* ---- Open / step / close ---- */

    function open(index) {
      if (drawerIsOpen) {
        fill(index);
        animateContent(0);
        return;
      }

      lastFocused = doc.activeElement;
      drawerIsOpen = true;

      fill(index);

      drawer.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");

      if (lenis) lenis.stop();
      else body.classList.add("is-drawer-open");

      doc.dispatchEvent(new CustomEvent("drawer:open"));
      animateContent(0.3);

      window.setTimeout(function () {
        var closeBtn = $(".drawer__close", panel);
        if (closeBtn) closeBtn.focus({ preventScroll: true });
      }, MOTION ? 320 : 0);
    }

    function step(direction) {
      var next = currentIndex + direction;
      if (next < 0 || next > items.length - 1) return;

      fill(next);
      animateContent(0);
    }

    function close() {
      if (!drawerIsOpen) return;
      drawerIsOpen = false;

      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");

      video.pause();
      video.removeAttribute("src");

      if (lenis) lenis.start();
      else body.classList.remove("is-drawer-open");

      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus({ preventScroll: true });
      }
    }

    /* ---- Wiring ---- */

    items.forEach(function (item, index) {
      var trigger = $(".item__trigger", item);
      if (!trigger) return;

      trigger.addEventListener("click", function () {
        open(index);
      });
    });

    $$("[data-drawer-close]", drawer).forEach(function (control) {
      control.addEventListener("click", close);
    });

    prevBtn.addEventListener("click", function () {
      step(-1);
    });

    nextBtn.addEventListener("click", function () {
      step(1);
    });

    doc.addEventListener("keydown", onKeydown);
  }

  /* ========================================================================
     12. FOOTER
     ===================================================================== */

  function initFooter() {
    var footer = $("#footer");
    if (!footer) return;

    var mark = $(".footer__mark", footer);
    var reveals = $$("[data-footer-reveal]", footer).filter(function (element) {
      return element !== mark;
    });

    var tl = gsap.timeline({
      defaults: { ease: "power3.out" },
      scrollTrigger: { trigger: footer, start: "top 78%" }
    });

    tl.fromTo(
      mark,
      { autoAlpha: 0, yPercent: 22 },
      { autoAlpha: 1, yPercent: 0, duration: 1.5, ease: "power4.out" },
      0
    ).fromTo(reveals, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.055 }, 0.25);
  }

  function initClosing() {
    $$("[data-reveal]").forEach(function (element) {
      gsap.fromTo(
        element,
        { autoAlpha: 0, y: 34 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1.15,
          ease: "power3.out",
          scrollTrigger: { trigger: element, start: "top 88%" }
        }
      );
    });
  }

  /* ========================================================================
     13. BOOT & RESIZE
     ===================================================================== */

  function stampYear() {
    var year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  /** Static rendering path: no GSAP, or the visitor prefers reduced motion. */
  function renderStatic() {
    $$("[data-reveal], [data-cover], [data-footer-reveal]").forEach(function (element) {
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
  }

  function initResize() {
    var lastWidth = window.innerWidth;
    var timer = null;

    window.addEventListener("resize", function () {
      if (window.innerWidth === lastWidth) return; /* ignore mobile chrome height changes */
      lastWidth = window.innerWidth;

      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        if (!drawerIsOpen) ScrollTrigger.refresh();
      }, 260);
    });
  }

  function boot() {
    stampYear();
    initMediaFallbacks();
    initItemStates();
    initDrawer();

    if (!MOTION) {
      renderStatic();
      initCategoryIndexStatic();
      initAnchors();
      return;
    }

    /* Unlocks the enhanced layouts in CSS (cursor follower, undrawn hairlines) */
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
      var coverTimeline = buildCoverTimeline();

      /* Global / chrome scenes */
      initProgressBar();
      initHeaderScroll();
      initMenu();
      initAnchors();
      initCursor();

      /* Scroll scenes, created in the order they appear on the page */
      initCoverAmbience();
      initCategoryIndex();
      initCategoryHeads();
      initItemReveals();
      initPreview();
      initClosing();
      initFooter();

      initResize();
      ScrollTrigger.refresh();

      runPreloader(function () {
        coverTimeline.play();
      });
    });
  }

  boot();
})();
