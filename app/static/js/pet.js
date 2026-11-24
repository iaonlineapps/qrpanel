// Ficha de mascota: "Enviar dónde estoy" manda la ubicación de quien la encuentra por WhatsApp.
const b = document.getElementById("loc");
if (b) b.addEventListener("click", () => {
  const send = (txt) => { location.href = `https://wa.me/${b.dataset.wa}?text=${encodeURIComponent(txt)}`; };
  const base = `¡Hola! He encontrado a ${b.dataset.name} gracias a su QR.`;
  if (!navigator.geolocation) return send(base);
  b.disabled = true; b.textContent = "📍 Buscando dónde estás…";
  navigator.geolocation.getCurrentPosition(
    (p) => send(`${base} Estoy aquí: https://maps.google.com/?q=${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)}`),
    () => { b.disabled = false; b.textContent = "📍 Enviar dónde estoy"; send(base + " (No he podido compartir la ubicación.)"); },
    { enableHighAccuracy: true, timeout: 12000 });
});
