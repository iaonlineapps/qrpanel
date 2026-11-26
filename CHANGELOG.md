# Novedades de QRPanel (web y servidor)

La versión de la web está en [`app/VERSION`](app/VERSION) y se ve en **Ajustes → Acerca de**.
La app de Android tiene su propio número y sus novedades en
[`android/src/main/res/raw/novedades.md`](android/src/main/res/raw/novedades.md).

## 1.0.15

- **Cambio rápido de usuario.** En el menú de tu foto salen las otras cuentas abiertas en este
  dispositivo: tocas una y pasas a ella sin cerrar sesión ni escribir la contraseña. Con
  «Añadir otra cuenta» entras en otra (esa vez sí con su contraseña). Al salir, la pantalla de
  entrada te ofrece las cuentas recordadas, y la ✕ quita una del dispositivo.

## 1.0.14

- **Encuadra la foto al subirla.** Al poner una foto (mascota, producto, inmueble, logo…) se abre
  un editor para moverla y hacer zoom, así el perro o el gato no sale con la cabeza cortada. En
  las mascotas se ve el círculo tal como saldrá en su ficha.
- **El cartel de mascota perdida muestra la foto entera**, sin recortar, sobre un fondo difuminado.
- **Expositor de reseñas:** el bocadillo con el corazón es ahora una sola pieza (la colita va unida
  al recuadro) y arriba lleva un mensaje de agradecimiento, «¡Gracias por tu reseña!», que puedes
  cambiar. Revisado para imprimir en 3D: todas las piezas cerradas y sin detalles más finos que
  la boquilla de 0,4 mm, salvo puntas de menos de 1 mm² que el laminador ignora.

## 1.0.13

- **Español o inglés.** QRPanel ya se puede usar en inglés. El idioma se elige en
  **Ajustes → Idioma / Language** o en la pantalla de entrada. Si no eliges ninguno, usa el
  idioma del navegador.
- **Las páginas públicas también salen en inglés** para quien tenga el móvil en inglés: la carta,
  el hotel, la oficina, el producto, el evento, el inmueble, la ficha de la mascota, la página del
  PIN y la de compartir. Se traduce lo que pone QRPanel (botones, títulos, alérgenos, fechas); lo
  que escribes tú se queda como lo escribes. Con `?lang=en` o `?lang=es` en el enlace se fuerza un
  idioma.
- Los carteles, las tarjetas por mesa y el expositor 3D salen con los textos en el idioma elegido.
- **App Android 1.0.1:** también en inglés, siguiendo el idioma que elijas en la web o el del móvil.

## 1.0.12

- **Nuevo tipo «Tienda / producto»:** la ficha del producto para la etiqueta, el escaparate o el
  expositor. Incluye foto, precio y precio de oferta (tachado), descripción, características,
  botón de **Comprar** en tu web y **Preguntar por WhatsApp** con el producto ya escrito.
  También el horario y la dirección de la tienda. Con QR por expositor sabes dónde se escanea más.
- **Nuevo tipo «Evento con programa»:** para bodas, conciertos, ferias o fiestas. Lleva cartel,
  fecha con **cuenta atrás**, **programa por horas**, lugar con «Cómo llegar», enlace de entradas,
  precio, WiFi y botón **«Añadir al calendario»** (archivo .ics que abre el calendario del móvil).
- **Nuevo tipo «Inmobiliaria»:** el QR del cartel de «Se vende / Se alquila». Muestra la ficha
  con foto, precio, m², habitaciones, baños, planta, características y referencia, y los botones
  **«Pedir visita» por WhatsApp**, llamar o email. Si se vende, lo marcas como «Vendido» sin quitar
  el cartel.
- Al compartir cualquiera de estas páginas por WhatsApp o Telegram, la vista previa ya enseña
  el precio, la fecha o los datos principales.
- El antiguo tipo «Evento» pasa a llamarse «Fecha al calendario» para no confundirlo.

## 1.0.11

- **Nuevo tipo «Hotel / alojamiento»:** la página de bienvenida para hoteles, hostales y pisos
  turísticos. Incluye el WiFi con botón para copiar la contraseña, los horarios de entrada, salida y
  desayuno, los servicios y lo que hay cerca (se escriben como la carta), las normas de la casa,
  y botones para llamar a recepción, escribir por WhatsApp y ver cómo llegar.
  **QR por habitación:** la página dice «Estás en la habitación 12» y en Estadísticas ves los
  escaneos de cada habitación.
- **Nuevo tipo «Oficina / recepción»:** para oficinas, clínicas, coworkings y la entrada de
  cualquier empresa. Muestra cómo llegar, el horario, los contactos de cada departamento (con
  teléfono y email que se pueden pulsar) y el WiFi de invitados. La visita puede **avisar a
  recepción de que ha llegado** por WhatsApp o por email, con su nombre, su empresa y a quién
  viene a ver. También se pueden hacer QR por zona o por puerta.
- El expositor 3D ya trae los textos «BIENVENIDO» y «RECEPCIÓN» para estos tipos.
- Arreglado: en la carta, el botón «Copiar» de la contraseña del WiFi no funcionaba porque la
  política de seguridad del navegador lo bloqueaba.

## 1.0.10

- **Nuevo tipo «Reseñas»:** un QR que lleva directo a dejar tu reseña en Google, TripAdvisor,
  Facebook o donde quieras. Sale **dinámico** (QR más corto y cuentas los escaneos) y explica
  dónde copiar el enlace de cada plataforma.
- **Expositor de mesa 3D:** botón «Expositor 3D» en el editor y en la Biblioteca. Genera una
  placa de color con el texto (por defecto «DEJA TU RESEÑA»), un icono o **tu logo**, 5
  estrellas amarillas y **tu QR en relieve**, más una base con ranura para que se tenga de pie.
  **Todas las aristas redondeadas** para que no pinche. Tres tamaños, cuatro colores de placa y
  descarga en **3MF multicolor** (Bambu, Orca, Prusa…) o STL por color. También sirve para la
  carta («NUESTRA CARTA»), el WiFi («WIFI GRATIS») y cualquier otro QR.

## 1.0.9

- **Nuevo tipo «Restaurante»:** un QR que abre **tu carta** en el móvil: secciones, platos,
  precios, descripción, **alérgenos** con iconos, horario, WiFi (con botón para copiar la
  contraseña), dirección, teléfono, Instagram y web. Se escribe como texto sencillo
  («# Sección» y «Plato | precio | alérgenos») y se cambia sin reimprimir los QR.
- **QR por mesa:** de la mesa 1 a la que digas, cada una con su QR. Todas abren la misma carta
  pero la página dice «Estás en la mesa 5». **PDF con tarjetas** (6 por folio A4) con el logo,
  el nombre y el número de mesa, o un ZIP con un PNG por mesa.
- **Estadísticas por mesa:** cuántas veces se escanea cada mesa.

## 1.0.8

- **Cartel «Se busca» sin tu teléfono a la vista:** por privacidad, el cartel ya no lleva el
  teléfono impreso; solo lo ve quien escanea el QR (en la ficha). Las tiras recortables
  llevan un QR pequeño. Si quieres que salga, activa «Mostrar mi teléfono en el cartel».
- **Desinstalador** `uninstall.sh`: un solo comando para quitar QRPanel. Pregunta antes de
  borrar, ofrece copia de seguridad de los datos y deja elegir si se borran los datos y la
  carpeta del programa.

## 1.0.7

- **Cartel «Se busca» para mascotas perdidas:** en la placa de mascota (y en la Biblioteca),
  un cartel con la foto, el nombre, sus señas, la recompensa, el teléfono y el QR de su
  ficha. En **PDF A4** para imprimir y pegar, con **tiras recortables** con el teléfono, y en
  **post cuadrado** e **historia vertical** para compartir en WhatsApp, Telegram, Instagram,
  TikTok o Facebook. Título a elegir (SE BUSCA, PERDIDO, ¿ME HAS VISTO?…) y texto extra.
- **Foto de perfil o logo de tu marca** en tu cuenta (Ajustes → Tu cuenta). Sale arriba a la
  derecha, en la lista de usuarios y en las páginas que compartes.

## 1.0.6

- **Aviso de https:** si la dirección pública es `http://` o una IP de casa, QRPanel lo avisa en
  Ajustes, al crear un QR dinámico o de mascota y al compartir: sin https con dominio no
  funcionan la ubicación de la ficha de mascota ni la imagen del QR en WhatsApp/Telegram.
- README: apartado «HTTPS y dominio» con qué funciona y qué no, y cómo ponerlo con Pangolin,
  Nginx Proxy Manager o Cloudflare Tunnel.

## 1.0.5

- **Ficha de mascota: «Enviar dónde estoy» con plan B.** Si el navegador no da la ubicación
  (permiso denegado, GPS apagado, página sin https, navegadores como Opera…) explica por qué,
  deja **escribir dónde estás** y mandar el aviso por WhatsApp igualmente, volver a
  intentarlo y ver cómo activar la ubicación en Android y iPhone. Si el GPS tarda, prueba con
  la ubicación aproximada (wifi / red móvil).

## 1.0.4

- **La imagen del QR sale al pegar el enlace en WhatsApp, Telegram, etc.** La vista previa
  es ahora una tarjeta de 1200x630 con el QR, el nombre y (en las mascotas) su foto. Va en
  JPG ligero y siempre con fondo: antes era un PNG grande y transparente que WhatsApp no
  mostraba o enseñaba en negro.
- Funciona tanto con el **enlace para compartir** como con el **enlace corto** de los QR
  dinámicos. Las visitas de WhatsApp, Telegram y demás para hacer la vista previa **no cuentan
  como lecturas** ni gastan las lecturas de un QR que caduca.
- Al recargar, la web pide siempre la versión nueva al servidor.

## 1.0.3

- **Animales dentro del QR:** perro, gato, conejo, pájaro, pez, hámster, tortuga, caballo,
  huella y hueso para el centro del QR, en su color o en el del QR.
- **La foto de tu mascota en el centro** de la placa, recortada en redondo, con un toque.
- **Botón «Placa de mascota»:** colores, ojos con forma de huella, el animal que toca y el
  texto «SI ME PIERDO, ESCANÉAME» de una vez. Textos de placa listos en «Marco y texto».
- Los ojos del QR pueden tener **forma de huella**.
- Más especies en la ficha: conejo, pájaro, hámster, tortuga, caballo y hurón.

## 1.0.2

- **QR para mascotas (perros, gatos…):** ficha con foto, nombre, raza, señas, microchip,
  salud, carácter y los datos del dueño. Quien encuentra a la mascota ve la ficha con botones
  para **llamar**, mandar un **WhatsApp** o **enviar dónde está** (su ubicación en el mapa).
  Se puede marcar como **perdida** (aviso grande en rojo) y poner recompensa. Los datos se
  cambian sin reimprimir la placa. Va genial con la placa 3D con anilla de llavero.

## 1.0.1

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
