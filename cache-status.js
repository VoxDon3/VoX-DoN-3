/* حالة الكاش: AppCache (لمتصفح PS5) + Service Worker (للمتصفحات الحديثة) */
(function () {
  var box = document.getElementById("cache-status");
  if (!box) {
    box = document.createElement("p");
    box.id = "cache-status";
    (document.querySelector(".top") || document.body).appendChild(box);
  }
  function setmsg(t, c) { box.textContent = t; if (c) box.style.color = c; }
  function online() { try { return navigator.onLine !== false; } catch (e) { return true; } }

  /* ---------- Service Worker (للمتصفحات الحديثة فقط) ---------- */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then(function (reg) {
      var active = reg.active || reg.waiting;
      setmsg("كاش: جاري التحميل... لا تغلق الصفحة", "#ffcc66");
      try { active.postMessage({ type: "voxdon-status" }); } catch (e) {}
    }).catch(function () {});

    navigator.serviceWorker.addEventListener("message", function (e) {
      var d = e.data || {};
      if (d.type === "voxdon-status") {
        if (d.ready) setmsg("تم حفظ الكاش. اقطع النت وافتح نفس الرابط — جاهز.", "#39ff14");
        else setmsg("كاش: " + d.done + " / " + d.total + " ملف... لا تغلق الصفحة", "#ffcc66");
      }
    });

    try { navigator.serviceWorker.register("sw.js", { scope: "./" }); } catch (e) {}
  }

  /* ---------- AppCache (متصفح PS5) ---------- */
  var ac = window.applicationCache;
  if (ac) {
    setmsg(online() ? "كاش: جاري الفحص..." : "كاش: أوفلاين — جاري الاتصال بالكاش...", "#7df9ff");

    ac.addEventListener("checking", function () { if (online()) setmsg("كاش: جاري الفحص...", "#7df9ff"); });
    ac.addEventListener("downloading", function () { setmsg("كاش: جاري التحميل... لا تغلق الصفحة", "#ffcc66"); });
    ac.addEventListener("progress", function (e) {
      if (e && e.total && e.loaded) setmsg("كاش: " + e.loaded + " / " + e.total + " — لا تغلق الصفحة", "#ffcc66");
      else setmsg("كاش: جاري التحميل...", "#ffcc66");
    });
    ac.addEventListener("cached", function () { setmsg("تم حفظ الكاش. بعد الريستارت افتح نفس الرابط بدون نت.", "#39ff14"); });
    ac.addEventListener("noupdate", function () {
      if (online()) setmsg("الكاش موجود وجاهز بدون نت.", "#39ff14");
      else setmsg("وضع الأوفلاين — الكاش يعمل.", "#39ff14");
    });
    ac.addEventListener("updateready", function () {
      setmsg("تحديث كاش جديد جاهز.", "#39ff14");
      try { ac.swapCache(); } catch (e) {}
      setTimeout(function () { try { location.reload(); } catch (e) {} }, 800);
    });
    /* عندما تكون أوفلاين فإن فحص التحديث يفشل طبيعياً — الكاش يعمل. لا نوريه أحمر */
    ac.addEventListener("error", function () {
      if (!online()) {
        setmsg("وضع الأوفلاين — الكاش يعمل، والصفحة تُحمَّل من الجهاز.", "#39ff14");
      } else {
        setmsg("خطأ في الكاش: أول زيارة يجب أن تكون بالنت، ولا تمسح بيانات المتصفح.", "#ff5566");
      }
    });
    ac.addEventListener("obsolete", function () { if (online()) setmsg("الكاش أُلغي. أعد فتح الصفحة مع نت.", "#ff5566"); });
  }
})();