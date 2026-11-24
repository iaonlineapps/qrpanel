// Ficha de mascota: "Enviar dónde estoy" manda la ubicación de quien la encuentra por WhatsApp.
const EN = document.documentElement.lang === "en";
const T = {"¿Dónde estás? <span>(calle, número, barrio, un sitio conocido…)</span>": "Where are you? <span>(street, number, area, a well-known place…)</span>", "Ej.: Calle Mayor 12, junto a la farmacia": "E.g.: 12 High Street, next to the pharmacy", "💬 Mandar el aviso por WhatsApp": "💬 Send the notice by WhatsApp", "📍 Volver a intentar la ubicación": "📍 Try the location again", "Cómo activar la ubicación": "How to turn on location", "<b>Android:</b> Ajustes → Ubicación: activada. Luego Ajustes → Aplicaciones → tu navegador (Chrome, Opera…) → Permisos → Ubicación → Permitir. En el navegador, toca el candado junto a la dirección → Permisos → Ubicación → Permitir.": "<b>Android:</b> Settings → Location: on. Then Settings → Apps → your browser (Chrome, Opera…) → Permissions → Location → Allow. In the browser, tap the padlock next to the address → Permissions → Location → Allow.", "<b>iPhone:</b> Ajustes → Privacidad y seguridad → Localización: activada, y en la lista, Safari (o tu navegador) → «Mientras se usa la app».": "<b>iPhone:</b> Settings → Privacy & Security → Location Services: on, and in the list, Safari (or your browser) → «While Using the App».", " Estoy aquí: ": " I'm here: ", "Este navegador solo da la ubicación en páginas seguras (https), y esta no lo es. Escribe dónde estás y manda el aviso igualmente.": "This browser only gives the location on secure pages (https), and this one isn't. Write where you are and send the notice anyway.", "Este navegador no puede dar la ubicación. Escribe dónde estás y manda el aviso igualmente.": "This browser can't give the location. Write where you are and send the notice anyway.", "📍 Buscando dónde estás…": "📍 Finding where you are…", "El navegador no tiene permiso para saber dónde estás (o se ha dicho que no). Puedes darle permiso (mira abajo cómo) o escribir dónde estás.": "The browser doesn't have permission to know where you are (or it was refused). You can give it permission (see below how) or write where you are.", "Está tardando demasiado en encontrar tu ubicación. ¿Tienes el GPS (Ubicación) activado? Vuelve a intentarlo o escribe dónde estás.": "It's taking too long to find your location. Is GPS (Location) on? Try again or write where you are.", "No he podido encontrar tu ubicación. ¿Tienes el GPS (Ubicación) activado? Vuelve a intentarlo o escribe dónde estás.": "I couldn't find your location. Is GPS (Location) on? Try again or write where you are."};
const L = (s) => (EN && T[s]) || s;
// Si el navegador no da la ubicación (permiso denegado, GPS apagado, página sin https...),
// explica por qué y deja mandar el aviso igualmente, escribiendo dónde está.
const b = document.getElementById("loc");
if (b) {
  const name = b.dataset.name, wa = b.dataset.wa;
  const base = EN ? `Hi! I've found ${name} thanks to their QR.` : `¡Hola! He encontrado a ${name} gracias a su QR.`;
  const send = (txt) => { location.href = `https://wa.me/${wa}?text=${encodeURIComponent(txt)}`; };
  const label = b.textContent;

  // panel de plan B, debajo del botón
  const box = document.createElement("div");
  box.className = "nogeo"; box.hidden = true;
  box.innerHTML = `<p class="why"></p>
    <label for="where">${L("¿Dónde estás? <span>(calle, número, barrio, un sitio conocido…)</span>")}</label>
    <textarea id="where" rows="2" maxlength="300" placeholder="${L("Ej.: Calle Mayor 12, junto a la farmacia")}"></textarea>
    <button class="b wa" type="button" id="sendwhere">${L("💬 Mandar el aviso por WhatsApp")}</button>
    <button class="b alt" type="button" id="retry">${L("📍 Volver a intentar la ubicación")}</button>
    <details><summary>${L("Cómo activar la ubicación")}</summary>
      <p>${L("<b>Android:</b> Ajustes → Ubicación: activada. Luego Ajustes → Aplicaciones → tu navegador (Chrome, Opera…) → Permisos → Ubicación → Permitir. En el navegador, toca el candado junto a la dirección → Permisos → Ubicación → Permitir.")}</p>
      <p>${L("<b>iPhone:</b> Ajustes → Privacidad y seguridad → Localización: activada, y en la lista, Safari (o tu navegador) → «Mientras se usa la app».")}</p>
    </details>`;
  b.after(box);
  const why = box.querySelector(".why"), where = box.querySelector("#where");

  const fail = (msg) => {
    b.disabled = false; b.textContent = label;
    why.textContent = msg; box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  box.querySelector("#sendwhere").addEventListener("click", () => {
    const w = where.value.trim();
    send(w ? `${base}${L(" Estoy aquí: ")}${w}` : base);
  });
  box.querySelector("#retry").addEventListener("click", () => { box.hidden = true; ask(); });

  function ask() {
    if (!window.isSecureContext) return fail(L("Este navegador solo da la ubicación en páginas seguras (https), y esta no lo es. Escribe dónde estás y manda el aviso igualmente."));
    if (!navigator.geolocation) return fail(L("Este navegador no puede dar la ubicación. Escribe dónde estás y manda el aviso igualmente."));
    b.disabled = true; b.textContent = L("📍 Buscando dónde estás…");
    let done = false;
    const ok = (p) => {
      if (done) return; done = true;
      send(`${base}${L(" Estoy aquí: ")}https://maps.google.com/?q=${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)}`);
      setTimeout(() => { b.disabled = false; b.textContent = label; }, 1500);
    };
    const ko = (e) => {
      if (done) return; done = true;
      if (e && e.code === 1) fail(L("El navegador no tiene permiso para saber dónde estás (o se ha dicho que no). Puedes darle permiso (mira abajo cómo) o escribir dónde estás."));
      else if (e && e.code === 3) fail(L("Está tardando demasiado en encontrar tu ubicación. ¿Tienes el GPS (Ubicación) activado? Vuelve a intentarlo o escribe dónde estás."));
      else fail(L("No he podido encontrar tu ubicación. ¿Tienes el GPS (Ubicación) activado? Vuelve a intentarlo o escribe dónde estás."));
    };
    // primero con GPS; si tarda, con la ubicación aproximada (wifi / red móvil)
    navigator.geolocation.getCurrentPosition(ok, (e) => {
      if (e.code === 1) return ko(e);
      navigator.geolocation.getCurrentPosition(ok, ko, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }
  b.addEventListener("click", ask);
}
