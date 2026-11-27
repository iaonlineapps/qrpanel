// Código de recuperación: cada cuenta tiene uno que se enseña una sola vez (al crearla, o al
// entrar la primera vez si la cuenta es de antes). Con él se ve el usuario y se pone una
// contraseña nueva, aunque se hayan olvidado los dos. No hace falta servidor de correo.
import { t } from "./i18n.js";
import { icon, esc, toast, dialog, download, shareText, canShareText } from "./ui.js";

async function post(url, body) {
  const r = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let d = null; try { d = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok) throw new Error(typeof d?.detail === "string" ? d.detail : `Error ${r.status}`);
  return d;
}

/** Enseña el código con botones para guardarlo. other = lo ve el administrador para pasárselo a alguien. */
export function recoveryCodeDialog(code, user = "", other = false, appName = "QRPanel") {
  const text = t(`Código de recuperación de ${appName}`) + (user ? ` (${t("usuario")} ${user})` : "") + ": " + code + "\n" + location.origin + "\n" +
    t("Sirve para entrar si olvidas el usuario o la contraseña: «¿Has olvidado tu usuario o contraseña?».");
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast("Copiado"); }
    catch { const a = document.createElement("textarea"); a.value = text; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); toast("Copiado"); } catch { /* nada */ } a.remove(); }
  };
  const open = (u) => window.open(u, "_blank", "noopener");
  return dialog({
    title: other ? `Código de recuperación de ${user}` : "Tu código de recuperación",
    sticky: true,
    body: `${user && !other ? `<p style="margin:0 0 6px">Tu usuario es <b data-noi18n>${esc(user)}</b></p>` : ""}
      <p class="muted" style="margin:0">${other ? "Pásaselo junto con su contraseña. Con este código podrá entrar si olvida su usuario o su contraseña. Solo se enseña ahora."
        : "Si algún día olvidas tu usuario o tu contraseña, con este código podrás entrar otra vez. Apúntalo o hazle una foto y guárdalo en un sitio seguro: solo se enseña ahora."}</p>
      <div class="rec-code" data-noi18n>${esc(code)}</div>
      <p class="small muted" style="margin:0 0 8px">Guárdalo donde quieras: cópialo, mándatelo por WhatsApp o Telegram (a ti mismo o a «Mensajes guardados») o bájalo como archivo.</p>
      <div class="rec-send">
        <button type="button" class="btn sm" data-r="copy">${icon("copy", "sm")}Copiar</button>
        <button type="button" class="btn sm rec-wa" data-r="wa">${icon("chat", "sm")}WhatsApp</button>
        <button type="button" class="btn sm rec-tg" data-r="tg">${icon("share", "sm")}Telegram</button>
        <button type="button" class="btn sm" data-r="mail">${icon("mail", "sm")}Correo</button>
        <button type="button" class="btn sm" data-r="file">${icon("download", "sm")}Bajar archivo</button>
        ${canShareText() ? `<button type="button" class="btn sm" data-r="more">${icon("share", "sm")}Otras apps</button>` : ""}
      </div>`,
    buttons: [["Ya lo he guardado", true, "primary"]],
    onOpen: (w) => w.querySelector(".rec-send").addEventListener("click", (e) => {
      const b = e.target.closest("[data-r]"); if (!b) return;
      const a = b.dataset.r;
      if (a === "copy") copy();
      if (a === "wa") open("https://wa.me/?text=" + encodeURIComponent(text));
      if (a === "tg") open("https://t.me/share/url?url=" + encodeURIComponent(location.origin) + "&text=" + encodeURIComponent(text.replace("\n" + location.origin, "")));
      if (a === "mail") location.href = "mailto:?subject=" + encodeURIComponent(t(`Código de recuperación de ${appName}`)) + "&body=" + encodeURIComponent(text);
      if (a === "file") download(new Blob([text.replace(/\n/g, "\r\n") + "\r\n"], { type: "text/plain" }), `${appName}-${t("codigo-recuperacion")}${user ? "-" + user : ""}.txt`);
      if (a === "more") shareText(text, t(`Código de recuperación de ${appName}`));
    }),
  });
}

/** «¿Has olvidado tu usuario o contraseña?»: código + contraseña nueva. Devuelve {username, status} o null. */
export async function forgotDialog() {
  let res = null;
  await dialog({
    title: "Recuperar mi cuenta",
    body: `<form class="steps" style="gap:10px" id="fg">
      <p class="muted" style="margin:0">Escribe tu código de recuperación (te lo enseñamos al crear la cuenta) y elige una contraseña nueva. Si no tienes el código, pide al administrador que te ponga una contraseña nueva.</p>
      <label class="field"><span>Código de recuperación</span><input id="fg-code" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="40"></label>
      <label class="field"><span>Usuario (si no lo recuerdas, déjalo vacío)</span><input id="fg-user" autocomplete="username" autocapitalize="none" maxlength="64"></label>
      <label class="field"><span>Contraseña nueva</span><input id="fg-p1" type="password" autocomplete="new-password"></label>
      <label class="field"><span>Repite la contraseña nueva</span><input id="fg-p2" type="password" autocomplete="new-password"></label>
      <div class="auth-msg" id="fg-msg"></div><button hidden></button></form>`,
    buttons: [["Cancelar", null], ["Recuperar", (w) => { w.querySelector("#fg").requestSubmit(); return undefined; }, "primary"]],
    onOpen: (w, close) => {
      const f = w.querySelector("#fg"), msg = w.querySelector("#fg-msg");
      // el botón «Recuperar» no cierra la ventana hasta que el código es correcto
      w.querySelector(".btns .primary").addEventListener("click", (e) => { e.stopPropagation(); f.requestSubmit(); }, true);
      f.addEventListener("submit", async (e) => {
        e.preventDefault(); msg.textContent = "";
        const p1 = w.querySelector("#fg-p1").value;
        if (p1 !== w.querySelector("#fg-p2").value) { msg.textContent = "Las contraseñas no coinciden"; return; }
        try { res = await post("/api/recover", { code: w.querySelector("#fg-code").value, username: w.querySelector("#fg-user").value.trim(), password: p1 }); }
        catch (err) { msg.textContent = err.message; return; }
        close(true);
      });
    },
  });
  if (!res) return null;
  await recoveryCodeDialog(res.recovery_code, res.username);
  return res;
}

/** Desde el menú: crea un código nuevo (pide la contraseña actual). */
export async function newRecoveryDialog(username) {
  const pw = await dialog({
    title: "Código de recuperación",
    body: `<p class="muted" style="margin:0 0 10px">Te damos un código nuevo y el anterior deja de valer. Sirve para entrar si olvidas tu usuario o tu contraseña.</p>
      <label class="field"><span>Tu contraseña actual</span><input id="rc-pw" type="password" autocomplete="current-password"></label>`,
    buttons: [["Cancelar", null], ["Crear código nuevo", (w) => w.querySelector("#rc-pw").value, "primary"]],
  });
  if (!pw) return;
  try { const r = await post("/api/recovery", { password: pw }); await recoveryCodeDialog(r.recovery_code, username); }
  catch (e) { toast(e.message, "bad"); }
}

/** Mensaje para la pantalla de entrada después de recuperar. */
export const recoveredMsg = (status) => status === "approved" ? "Contraseña cambiada. Ya puedes entrar con la nueva."
  : status === "pending" ? "Contraseña cambiada, pero tu cuenta aún está pendiente de aprobación" : "Contraseña cambiada, pero tu cuenta está bloqueada";
