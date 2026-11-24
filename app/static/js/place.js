// Páginas de carta, hotel y oficina: copiar la contraseña del WiFi y avisar de la llegada.
document.addEventListener("click", function (e) {
  var b = e.target.closest("[data-copy]");
  if (!b) return;
  if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy);
  b.textContent = document.documentElement.lang === "en" ? "Copied!" : "¡Copiada!";
});
document.addEventListener("submit", function (e) {
  var f = e.target.closest(".visit");
  if (!f) return;
  e.preventDefault();
  var via = (e.submitter && e.submitter.value) || (f.dataset.wa ? "wa" : "mail");
  var who = f.who.value.trim(), org = f.org.value.trim(), see = f.see.value.trim();
  if (!who) { f.who.focus(); return; }
  var en = document.documentElement.lang === "en";
  var msg = (en ? "Hi, I'm " : "Hola, soy ") + who + (org ? " (" + org + ")" : "") + (en ? ". I've just arrived at " : ". Acabo de llegar a ") + f.dataset.place +
    (f.dataset.tag ? " (" + f.dataset.tag + ")" : "") + (see ? (en ? " and I'm here to see " : " y vengo a ver a ") + see : "") + ".";
  if (via === "wa") location.href = "https://wa.me/" + f.dataset.wa + "?text=" + encodeURIComponent(msg);
  else location.href = "mailto:" + f.dataset.mail + "?subject=" + encodeURIComponent((en ? "Visit: " : "Visita: ") + who) + "&body=" + encodeURIComponent(msg);
});
// cuenta atrás del evento
(function () {
  var c = document.querySelector(".count[data-start]");
  if (!c) return;
  var t = new Date(c.dataset.start).getTime();
  function tick() {
    var s = Math.floor((t - Date.now()) / 1000);
    if (isNaN(s)) return;
    if (s <= 0) { c.className = "count live"; c.textContent = s > -6 * 3600 ? (document.documentElement.lang === "en" ? "It has started!" : "¡Ya ha empezado!") : ""; return; }
    var en = document.documentElement.lang === "en";
    var u = [[Math.floor(s / 86400), en ? "days" : "días"], [Math.floor(s / 3600) % 24, en ? "hours" : "horas"], [Math.floor(s / 60) % 60, "min"], [s % 60, en ? "sec" : "seg"]];
    c.innerHTML = u.map(function (x) { return "<div><b>" + x[0] + "</b><span>" + x[1] + "</span></div>"; }).join("");
    setTimeout(tick, 1000);
  }
  tick();
})();
