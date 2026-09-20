/* AppCache status for PS5 WebKit / Internet Browser */
(function () {
  var ac = window.applicationCache;
  if (!ac) return;

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

  var names = {
    0: "UNCACHED",
    1: "IDLE — جاهز بدون نت",
    2: "CHECKING",
    3: "DOWNLOADING",
    4: "UPDATEREADY",
    5: "OBSOLETE"
  };

  set("كاش: " + (names[ac.status] || String(ac.status)));

  ac.addEventListener("checking", function () { set("كاش: جاري الفحص..."); });
  ac.addEventListener("downloading", function () { set("كاش: جاري التحميل... لا تغلق الصفحة", "#ffcc66"); });
  ac.addEventListener("progress", function (e) {
    if (e && e.total) set("كاش: " + e.loaded + " / " + e.total, "#ffcc66");
    else set("كاش: جاري التحميل...", "#ffcc66");
  });
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
  ac.addEventListener("obsolete", function () { set("الكاش أُلغي. أعد فتح الصفحة مع نت.", "#ff5566"); });
})();
