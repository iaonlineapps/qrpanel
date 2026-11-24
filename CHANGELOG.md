# Novedades de QRPanel (web y servidor)

La versión de la web está en [`app/VERSION`](app/VERSION) y se ve en **Ajustes → Acerca de**.
La app de Android tiene su propio número y sus novedades en
[`android/src/main/res/raw/novedades.md`](android/src/main/res/raw/novedades.md).

## 1.2.0

- **QR para mascotas (perros, gatos…):** ficha con foto, nombre, raza, señas, microchip,
  salud, carácter y los datos del dueño. Quien encuentra a la mascota ve la ficha con botones
  para **llamar**, mandar un **WhatsApp** o **enviar dónde está** (su ubicación en el mapa).
  Se puede marcar como **perdida** (aviso grande en rojo) y poner recompensa. Los datos se
  cambian sin reimprimir la placa. Va genial con la placa 3D con anilla de llavero.

## 1.1.0

- **Imprimir en 3D:** descarga el QR como modelo 3D en **3MF de dos colores**, **STL** o dos
  STL (base y módulos). Vista previa 3D que se gira y se acerca, y que cambia al momento al
  tocar el tamaño, el grosor de la base, la altura de los módulos, el borde, las esquinas
  redondeadas o la anilla de llavero. Avisa si los módulos son demasiado pequeños y dice a
  qué altura cambiar de filamento.
- **Compartir con imagen:** por WhatsApp y Telegram se manda la imagen del QR (en el móvil y
  en la app), y el enlace compartido sale con la imagen del QR como vista previa.
- **Versiones a la vista:** abajo de cada página y en tu menú de usuario se ve la versión de
  la web y, dentro de la app, la de la app.

## 1.0.0

Primera versión.

- Editor de QR con 10 tipos, diseño completo (módulos, ojos, colores, degradados, logos,
  marcos con texto), 12 plantillas y comprobación de lectura real.
- Descargas en PNG, SVG, JPG, WebP y PDF. Compartir la imagen por WhatsApp, Telegram,
  correo… y compartir con un enlace público.
- QR dinámicos con estadísticas, pausa, caducidad (no caduca / en una fecha / tras X lecturas)
  y PIN opcional.
- Biblioteca con carpetas y favoritos, escáner, QR por lotes, copia de seguridad.
- Usuarios con aprobación del administrador, marca propia (nombre y logo).
- Preparada para la app de Android (descargas y compartir nativos).
