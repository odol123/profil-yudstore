/* =========================================================
   Yudstore — interaksi ringan
   ========================================================= */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Navigasi Liquid Glass ---------- */
  const dockBar = document.querySelector(".dock__bar");
  const dockLiquid = document.getElementById("dockLiquid");
  const navItems = Array.from(document.querySelectorAll("[data-nav]"));

  // "Beranda" menunjuk #top (yaitu <main>) yang mencakup seluruh halaman,
  // jadi untuk scroll-spy ia dipetakan ke section hero saja.
  const spyTargets = navItems
    .map((item) => {
      const href = item.getAttribute("href");
      return {
        item,
        el: href === "#top" ? document.querySelector(".hero") : document.querySelector(href),
      };
    })
    .filter((t) => t.el);

  // Posisi gelembung dihitung dari koordinat viewport (bukan rect yang sedang
  // beranimasi), supaya tetap akurat walau dipanggil berturut-turut.
  const liquidPos = (item) => {
    const border = parseFloat(getComputedStyle(dockBar).borderLeftWidth) || 0;
    const barRect = dockBar.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    return {
      width: itemRect.width,
      x: itemRect.left - barRect.left - border,
    };
  };

  const applyLiquid = (item, snap) => {
    const { width, x } = liquidPos(item);
    dockLiquid.classList.toggle("is-snap", snap);
    dockLiquid.style.width = `${width}px`;
    dockLiquid.style.transform = `translateX(${x}px)`;
    dockLiquid.classList.add("is-ready");
    if (snap) {
      // paksa browser menerapkan posisi ini sebelum transisi dinyalakan lagi
      void dockLiquid.offsetWidth;
      dockLiquid.classList.remove("is-snap");
    }
  };

  const moveLiquid = (item) => {
    if (!dockBar || !dockLiquid || !item) return;
    applyLiquid(item, false);
  };

  // Klik beruntun cepat: gelembung "snap" ke menu terakhir agar transisi
  // tidak saling menimpa dan tidak terlihat melompat.
  let lastClickAt = 0;
  const RAPID_MS = 380;
  // Selama gulir halus akibat klik, scroll-spy diabaikan sementara.
  let spyLockUntil = 0;

  const setActive = (item, { pulse = false } = {}) => {
    navItems.forEach((el) => {
      const on = el === item;
      el.classList.toggle("is-active", on);
      if (on) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
    if (!dockBar || !dockLiquid || !item) return;

    const now = performance.now();
    const rapid = now - lastClickAt < RAPID_MS;
    lastClickAt = now;
    applyLiquid(item, rapid);

    if (pulse && !rapid) {
      dockLiquid.classList.remove("is-pulse");
      void dockLiquid.offsetWidth; // paksa reflow agar animasi bisa diulang
      dockLiquid.classList.add("is-pulse");
    }
  };

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      // Kunci scroll-spy sampai gulir halus selesai, supaya gelembung tidak
      // ikut melompat ke menu yang sekadar dilewati saat halaman menggulir.
      spyLockUntil = performance.now() + 900;
      setActive(item, { pulse: true });
    });
  });

  // Sorot menu sesuai bagian yang melewati garis tengah layar.
  // Perhitungan deterministik (bukan bergantung urutan callback) agar
  // selalu ada tepat satu menu aktif.
  if (spyTargets.length) {
    let spyTick = false;
    const updateSpy = () => {
      spyTick = false;
      if (performance.now() < spyLockUntil) return;
      const mid = window.innerHeight * 0.5;
      let best = spyTargets[0];
      let bestDist = Infinity;
      for (const t of spyTargets) {
        const r = t.el.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) { best = t; bestDist = -1; break; }
        const d = Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
        if (d < bestDist) { bestDist = d; best = t; }
      }
      if (best && !best.item.classList.contains("is-active")) setActive(best.item);
    };
    window.addEventListener("scroll", () => {
      if (spyTick) return;
      spyTick = true;
      requestAnimationFrame(updateSpy);
    }, { passive: true });
    updateSpy();
  }

  // Posisikan ulang gelembung saat ukuran berubah
  let dockTimer;
  window.addEventListener("resize", () => {
    clearTimeout(dockTimer);
    dockTimer = setTimeout(() => {
      const current = navItems.find((el) => el.classList.contains("is-active")) || navItems[0];
      moveLiquid(current);
    }, 150);
  });

  // Posisi awal: pastikan gelembung tepat setelah font dimuat
  const placeInitial = () => moveLiquid(navItems[0]);
  if (document.fonts?.ready) document.fonts.ready.then(placeInitial);
  requestAnimationFrame(placeInitial);

  /* ---------- Kelopak sakura (ringan) ---------- */
  const canvas = document.getElementById("sakura");
  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext("2d");
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let petals = [];
    const rand = (min, max) => Math.random() * (max - min) + min;

    const makePetal = () => ({
      x: rand(0, w),
      y: rand(-h, 0),
      r: rand(4, 9),
      vy: rand(0.35, 0.95),
      vx: rand(-0.3, 0.3),
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.012, 0.012),
      phase: rand(0, Math.PI * 2),
      alpha: rand(0.4, 0.85),
    });

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * DPR);
      canvas.height = Math.round(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      // lebih sedikit kelopak supaya tetap ringan
      const count = Math.round((w * h) / 90000);
      petals = Array.from({ length: Math.max(10, Math.min(count, 28)) }, makePetal);
    };

    const drawPetal = (p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = "hsla(343, 90%, 82%, 0.95)";
      ctx.beginPath();
      ctx.moveTo(0, -p.r);
      ctx.bezierCurveTo(p.r * 0.95, -p.r * 0.55, p.r * 0.72, p.r * 0.7, 0, p.r);
      ctx.bezierCurveTo(-p.r * 0.72, p.r * 0.7, -p.r * 0.95, -p.r * 0.55, 0, -p.r);
      ctx.fill();
      ctx.restore();
    };

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of petals) {
        p.phase += 0.01;
        p.y += p.vy;
        p.x += p.vx + Math.sin(p.phase) * 0.14;
        p.rot += p.vr;
        if (p.y - p.r > h) Object.assign(p, makePetal(), { y: -12 });
        if (p.x < -30) p.x = w + 20;
        if (p.x > w + 30) p.x = -20;
        drawPetal(p);
      }
      requestAnimationFrame(frame);
    };

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    });

    resize();
    requestAnimationFrame(frame);
  }

  /* ---------- Validasi form → WhatsApp ---------- */
  const form = document.getElementById("contactForm");
  const note = document.getElementById("formNote");
  // Ganti nomor ini dengan nomor WhatsApp Anda (format internasional, tanpa +).
  const WA_NUMBER = "6289529422727";

  if (form) {
    const setNote = (msg, isError = false) => {
      if (!note) return;
      note.textContent = msg;
      note.classList.toggle("is-error", isError);
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));

      if (!String(data.nama || "").trim()) return setNote("Mohon isi nama Anda.", true);
      if (!String(data.telepon || "").trim()) return setNote("Mohon isi nomor WhatsApp Anda.", true);
      if (!String(data.pesan || "").trim()) return setNote("Mohon tuliskan pesan Anda.", true);

      const teks =
        `Halo Yudstore!\n\n` +
        `Nama: ${String(data.nama).trim()}\n` +
        `WhatsApp: ${String(data.telepon).trim()}\n\n` +
        `${String(data.pesan).trim()}`;

      window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(teks)}`, "_blank", "noopener");
      setNote("Terima kasih! Pesan Anda dibuka di WhatsApp untuk dikirim.");
      form.reset();
    });
  }
})();
