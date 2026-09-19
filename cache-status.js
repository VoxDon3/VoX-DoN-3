/* حالة الكاش: AppCache (قديم) + Service Worker (جديد) */
(function () {
  var box = document.getElementById("cache-status");
  if (!box) {
    box = document.createElement("p");
    box.id = "cache-status";
    var host = document.querySelector(".top") || document.body;
    host.appendChild(box);
  }

  function set(t, color) {
    box.textContent = t;
    if (color) box.style.color = color;
  }

  /* ---- Service Worker ---- */
  function setupSW() {
    if (!("serviceWorker" in navigator)) {
      set("كاش: المتصفح لا يدعم التخزين للعمل بدون نت");
      return;
    }

    navigator.serviceWorker.ready.then(function (reg) {
      var active = reg.active || reg.waiting;
      box.textContent = "كاش: جاري التحميل... لا تغلق الصفحة";
      box.style.color = "#ffcc66";
      if (active) {
        try { active.postMessage({ type: "voxdon-status" }); } catch (e) {}
      }
    }).catch(function () {});

    navigator.serviceWorker.addEventListener("message", function (e) {
      var d = e.data || {};
      if (d.type === "voxdon-status") {
        if (d.ready) {
          set("تم حفظ الكاش (SW). الآن افتح نفس الرابط بدون نت، خلي الكاش.", "#39ff14");
        } else {
          set("كاش: " + d.done + " / " + d.total + " ملف... لا تغلق الصفحة", "#ffcc66");
        }
      }
    });

    navigator.serviceWorker.register("sw.js", { scope: "./" });
  }

  /* ---- AppCache (احتياط) ---- */
  var ac = window.applicationCache;
  if (ac) {
    var names = {
      0: "UNCACHED",
      1: "IDLE — جاهز بدون نت",
      2: "CHECKING",
      3: "DOWNLOADING",
      4: "UPDATEREADY",
      5: "OBSOLETE"
    };
    ac.addEventListener("cached", function () { set("تم حفظ الكاش. بعد الريستارت افتح نفس الرابط بدون نت.", "#39ff14"); });
    ac.addEventListener("noupdate", function () { set("الكاش موجود وجاهز بدون نت.", "#39ff14"); });
    ac.addEventListener("updateready", function () {
      set("تحديث كاش جديد جاهز.", "#39ff14");
      try { ac.swapCache(); } catch (e) {}
      setTimeout(function () { location.reload(); }, 800);
    });
    ac.addEventListener("error", function () {
      set("خطأ في الكاش. أول زيارة تحتاج نت. لا تمسح بيانات المتصفح.", "#ff5566");
    });
  }

  setupSW();
})();