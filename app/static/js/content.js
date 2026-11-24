// Tipos de contenido: formulario de cada tipo, como se codifica y como se reconoce al escanear.

export const TYPES = {
  url: {
    name: "Enlace", icon: "link", dyn: true,
    fields: [{ k: "url", label: "Dirección web", ph: "https://tuweb.com", type: "url", req: true }],
    encode: (f) => normUrl(f.url),
  },
  text: {
    name: "Texto", icon: "text",
    fields: [{ k: "text", label: "Texto", ph: "Escribe lo que quieras", type: "textarea", req: true }],
    encode: (f) => f.text || "",
  },
  wifi: {
    name: "WiFi", icon: "wifi",
    fields: [
      { k: "ssid", label: "Nombre de la red (SSID)", ph: "MiCasa_5G", req: true },
      { k: "password", label: "Contraseña", ph: "••••••••", type: "password" },
      { k: "auth", label: "Seguridad", type: "select", options: [["WPA", "WPA / WPA2 / WPA3"], ["WEP", "WEP"], ["nopass", "Sin contraseña"]] },
      { k: "hidden", label: "Red oculta", type: "check" },
    ],
    encode: (f) => `WIFI:T:${f.auth || "WPA"};S:${wesc(f.ssid)};${f.auth === "nopass" ? "" : `P:${wesc(f.password)};`}${f.hidden ? "H:true;" : ""};`,
  },
  vcard: {
    name: "Contacto", icon: "user",
    fields: [
      { k: "first", label: "Nombre", ph: "Ana", half: true, req: true }, { k: "last", label: "Apellidos", ph: "García", half: true },
      { k: "phone", label: "Teléfono", ph: "+34 600 000 000", type: "tel", half: true }, { k: "email", label: "Email", ph: "ana@correo.com", type: "email", half: true },
      { k: "org", label: "Empresa", ph: "Mi Empresa", half: true }, { k: "title", label: "Cargo", ph: "Diseñadora", half: true },
      { k: "web", label: "Web", ph: "https://...", type: "url" },
      { k: "address", label: "Dirección", ph: "Calle, número, ciudad" },
      { k: "note", label: "Nota", ph: "", type: "textarea" },
    ],
    encode: (f) => ["BEGIN:VCARD", "VERSION:3.0", `N:${vesc(f.last)};${vesc(f.first)};;;`, `FN:${vesc([f.first, f.last].filter(Boolean).join(" "))}`,
      f.org && `ORG:${vesc(f.org)}`, f.title && `TITLE:${vesc(f.title)}`, f.phone && `TEL;TYPE=CELL:${f.phone}`,
      f.email && `EMAIL:${f.email}`, f.web && `URL:${normUrl(f.web)}`, f.address && `ADR:;;${vesc(f.address)};;;;`,
      f.note && `NOTE:${vesc(f.note)}`, "END:VCARD"].filter(Boolean).join("\n"),
  },
  email: {
    name: "Email", icon: "mail", dyn: true,
    fields: [
      { k: "to", label: "Para", ph: "hola@tuweb.com", type: "email", req: true },
      { k: "subject", label: "Asunto", ph: "" }, { k: "body", label: "Mensaje", type: "textarea" },
    ],
    encode: (f) => `mailto:${f.to || ""}${qs({ subject: f.subject, body: f.body })}`,
  },
  whatsapp: {
    name: "WhatsApp", icon: "chat", dyn: true,
    fields: [
      { k: "phone", label: "Número con prefijo", ph: "34600000000", type: "tel", req: true },
      { k: "text", label: "Mensaje inicial", type: "textarea", ph: "¡Hola! Vengo del QR" },
    ],
    encode: (f) => `https://wa.me/${(f.phone || "").replace(/[^0-9]/g, "")}${qs({ text: f.text })}`,
  },
  phone: {
    name: "Llamada", icon: "phone", dyn: true,
    fields: [{ k: "phone", label: "Teléfono", ph: "+34 600 000 000", type: "tel", req: true }],
    encode: (f) => `tel:${(f.phone || "").replace(/[^0-9+]/g, "")}`,
  },
  sms: {
    name: "SMS", icon: "sms",
    fields: [{ k: "phone", label: "Teléfono", ph: "+34 600 000 000", type: "tel", req: true }, { k: "text", label: "Mensaje", type: "textarea" }],
    encode: (f) => `SMSTO:${(f.phone || "").replace(/[^0-9+]/g, "")}:${f.text || ""}`,
  },
  geo: {
    name: "Ubicación", icon: "pin", dyn: true,
    fields: [
      { k: "lat", label: "Latitud", ph: "40.4168", half: true, req: true }, { k: "lng", label: "Longitud", ph: "-3.7038", half: true, req: true },
      { k: "label", label: "Nombre del sitio", ph: "Puerta del Sol" },
      { k: "_here", label: "Usar mi ubicación", type: "button", action: "geo" },
    ],
    encode: (f) => `https://maps.google.com/?q=${encodeURIComponent(`${(f.lat || "").trim()},${(f.lng || "").trim()}`)}${f.label ? `(${encodeURIComponent(f.label)})` : ""}`,
  },
  pet: {
    name: "Mascota", icon: "paw", dyn: true, page: true,
    fields: [
      { k: "photo", label: "Foto", type: "image" },
      { k: "name", label: "Nombre de la mascota", ph: "Toby", half: true, req: true },
      { k: "species", label: "Es un…", type: "select", half: true, options: [["perro", "Perro"], ["gato", "Gato"], ["conejo", "Conejo"], ["pajaro", "Pájaro"], ["hamster", "Hámster"], ["tortuga", "Tortuga"], ["caballo", "Caballo"], ["huron", "Hurón"], ["otro", "Otro"]] },
      { k: "breed", label: "Raza", ph: "Mestizo, Beagle…", half: true }, { k: "color", label: "Color / señas", ph: "Marrón con mancha blanca", half: true },
      { k: "sex", label: "Sexo", type: "select", half: true, options: [["", "—"], ["macho", "Macho"], ["hembra", "Hembra"]] }, { k: "age", label: "Edad o nacimiento", ph: "3 años", half: true },
      { k: "chip", label: "Nº de microchip", ph: "941000000000000", half: true }, { k: "vet", label: "Veterinario", ph: "Clínica… y teléfono", half: true },
      { k: "health", label: "Salud: alergias, medicación, enfermedades", type: "textarea", ph: "Toma pastillas para el corazón por la mañana" },
      { k: "notes", label: "Carácter y cosas a saber", type: "textarea", ph: "Es miedoso: no le persigas, llámale por su nombre" },
      { k: "owner", label: "Nombre del dueño", ph: "David", half: true, req: true }, { k: "phone", label: "Teléfono (con prefijo)", ph: "+34 600 000 000", type: "tel", half: true, req: true },
      { k: "phone2", label: "Otro teléfono", ph: "+34 …", type: "tel", half: true }, { k: "email", label: "Email", ph: "tu@correo.com", type: "email", half: true },
      { k: "zone", label: "Zona donde vive", ph: "Barrio, ciudad" }, { k: "reward", label: "Recompensa", ph: "Se gratificará" },
      { k: "lost", label: "Se ha perdido: mostrar un aviso grande", type: "check" },
    ],
    // sin servidor (o si se lee sin internet) el QR lleva los datos en texto
    encode: (f) => [`🐾 ${f.name ? "Me llamo " + f.name : "Mascota"}${(f.species || "perro") !== "otro" ? ` (${({ pajaro: "pájaro", hamster: "hámster", huron: "hurón" })[f.species] || f.species || "perro"}${f.breed ? ", " + f.breed : ""})` : ""}`,
      f.lost && "¡ME HE PERDIDO!", `Si me encuentras, avisa a ${f.owner || "mi familia"}: ${f.phone || ""}`, f.phone2 && `Otro teléfono: ${f.phone2}`,
      f.chip && `Microchip: ${f.chip}`, f.health && `Salud: ${f.health}`, f.reward && `Recompensa: ${f.reward}`].filter(Boolean).join("\n"),
  },
  review: {
    name: "Reseñas", icon: "star", dyn: true,
    help: "Un QR que lleva <b>directo a dejar una reseña</b> de tu negocio. Hazlo dinámico: si cambias de plataforma o de enlace, el QR impreso (o el <b>expositor 3D</b>) sigue valiendo, y ves cuántos clientes lo escanean.",
    fields: [
      { k: "platform", label: "Dónde quieres las reseñas", type: "select", options: [["google", "Google (Maps / Perfil de empresa)"], ["tripadvisor", "TripAdvisor"], ["facebook", "Facebook"], ["trustpilot", "Trustpilot"], ["otra", "Otra"]] },
      { k: "url", label: "Enlace para dejar la reseña", ph: "https://g.page/r/XXXXXXXX/review", type: "url", req: true },
      { k: "_help", type: "note", text: "<b>Google:</b> en tu Perfil de empresa (google.com/business o buscando tu negocio en Google con tu cuenta) pulsa <b>«Pedir reseñas»</b> y copia el enlace. <b>TripAdvisor:</b> en TripAdvisor para Empresas → «Consigue más opiniones». <b>Facebook:</b> el enlace de tu página terminado en <code>/reviews</code>." },
    ],
    encode: (f) => normUrl(f.url),
  },
  menu: {
    name: "Restaurante", icon: "food", dyn: true, page: true,
    help: "Quien escanee el QR verá <b>tu carta</b> en el móvil, con precios, alérgenos, horario, WiFi y cómo llegar. Cambia platos y precios cuando quieras <b>sin reimprimir</b> los QR. Con <b>QR por mesa</b> cada mesa tiene el suyo y sabes desde cuál escanean.",
    fields: [
      { k: "logo", label: "Logo o foto del local", type: "image", icon: "food" },
      { k: "name", label: "Nombre del restaurante", ph: "Casa Paco", half: true, req: true },
      { k: "tagline", label: "Frase corta", ph: "Cocina mediterránea desde 1985", half: true },
      { k: "carta", label: "La carta", type: "textarea", rows: 12, max: 20000, req: true,
        ph: "# Entrantes\nCroquetas caseras | 8,50 | Gluten, Leche\nDe jamón ibérico, cremosas por dentro\nPatatas bravas | 6 | Picante\n\n# Principales\nPaella de marisco | 16 | Crustáceos, Moluscos\nPor persona, mínimo 2\n\n# Postres\nTarta de queso | 5,50 | Leche, Huevo, Gluten" },
      { k: "_help", type: "note", text: "Cómo escribirla: <b># Sección</b> para empezar una sección. Cada plato en una línea: <b>Nombre | precio | alérgenos</b>. La línea de debajo (sin |) es su descripción. Alérgenos: gluten, crustáceos, huevo, pescado, cacahuetes, soja, leche, frutos secos, apio, mostaza, sésamo, sulfitos, altramuces, moluscos; y también vegano, vegetariano, picante o sin gluten." },
      { k: "hours", label: "Horario", type: "textarea", rows: 3, ph: "Lunes a viernes: 13:00 a 16:00 y 20:00 a 23:30\nSábados y domingos: 13:00 a 17:00" },
      { k: "phone", label: "Teléfono", ph: "+34 910 000 000", type: "tel", half: true }, { k: "address", label: "Dirección", ph: "Calle Mayor 12, Madrid", half: true },
      { k: "wifi_ssid", label: "WiFi para clientes (red)", ph: "CasaPaco-Clientes", half: true }, { k: "wifi_pass", label: "Contraseña del WiFi", ph: "bienvenidos", half: true },
      { k: "instagram", label: "Instagram", ph: "@casapaco", half: true }, { k: "web", label: "Web", ph: "casapaco.es", half: true },
      { k: "notes", label: "Nota al final", ph: "IVA incluido. Pregunta por el menú del día." },
    ],
    // sin servidor la carta no cabe en un QR: lleva el nombre y el teléfono
    encode: (f) => [f.name || "Restaurante", f.tagline, f.phone && `Tel: ${f.phone}`, f.address].filter(Boolean).join("\n"),
  },
  hotel: {
    name: "Hotel / alojamiento", icon: "bed", dyn: true, page: true,
    help: "Para hoteles, hostales y pisos turísticos. Quien escanee verá <b>la bienvenida</b>: WiFi con botón para copiar, horarios de entrada, salida y desayuno, servicios, normas y cómo contactar con recepción. Con <b>QR por habitación</b> la página dice «Estás en la habitación 12» y sabes desde cuál escanean.",
    fields: [
      { k: "logo", label: "Logo o foto del alojamiento", type: "image", icon: "bed" },
      { k: "name", label: "Nombre", ph: "Hotel Mirador", half: true, req: true },
      { k: "tagline", label: "Bienvenida", ph: "¡Bienvenido! Estamos aquí para lo que necesites", half: true },
      { k: "wifi_ssid", label: "WiFi (red)", ph: "Mirador-Clientes", half: true }, { k: "wifi_pass", label: "Contraseña del WiFi", ph: "bienvenidos2026", half: true },
      { k: "checkin", label: "Entrada (check-in)", ph: "Desde las 15:00", half: true }, { k: "checkout", label: "Salida (check-out)", ph: "Hasta las 12:00", half: true },
      { k: "breakfast", label: "Desayuno", ph: "7:30 a 10:30 en el comedor (planta baja)" },
      { k: "services", label: "Servicios", type: "textarea", rows: 7, max: 8000,
        ph: "# Servicios\nPiscina | 10:00 a 20:00\nToallas en recepción\nGimnasio | 24 h\nParking | 12 € / día\n\n# Cerca\nPlaya | 5 min andando\nSupermercado | 300 m" },
      { k: "_help", type: "note", text: "Igual que la carta: <b># Sección</b> para agrupar y una línea por servicio con <b>Nombre | horario o precio</b>. La línea de debajo (sin |) es su detalle." },
      { k: "rules", label: "Normas de la casa", type: "textarea", rows: 3, ph: "Silencio de 23:00 a 8:00\nNo se permite fumar en las habitaciones" },
      { k: "phone", label: "Teléfono de recepción", ph: "+34 910 000 000", type: "tel", half: true }, { k: "whatsapp", label: "WhatsApp de recepción", ph: "+34 600 000 000", type: "tel", half: true },
      { k: "address", label: "Dirección", ph: "Paseo Marítimo 8, Málaga", half: true }, { k: "web", label: "Web", ph: "hotelmirador.es", half: true },
      { k: "notes", label: "Nota al final", ph: "Urgencias: 112" },
    ],
    encode: (f) => [f.name || "Alojamiento", f.wifi_ssid && `WiFi: ${f.wifi_ssid}${f.wifi_pass ? " / " + f.wifi_pass : ""}`, f.phone && `Recepción: ${f.phone}`].filter(Boolean).join("\n"),
  },
  office: {
    name: "Oficina / recepción", icon: "building", dyn: true, page: true,
    help: "Para oficinas, clínicas, coworkings o la entrada de cualquier empresa. Quien escanee ve cómo llegar, el horario, a quién llamar de cada departamento y el WiFi de invitados, y puede <b>avisar a recepción de que ha llegado</b> (por WhatsApp o email) con su nombre y a quién viene a ver.",
    fields: [
      { k: "logo", label: "Logo de la empresa", type: "image", icon: "building" },
      { k: "name", label: "Nombre", ph: "Estudio Norte", half: true, req: true },
      { k: "tagline", label: "Bienvenida", ph: "Bienvenido a Estudio Norte", half: true },
      { k: "hours", label: "Horario", type: "textarea", rows: 2, ph: "Lunes a jueves: 9:00 a 18:00\nViernes: 8:00 a 15:00" },
      { k: "how", label: "Cómo llegar / instrucciones", type: "textarea", rows: 3, ph: "Planta 3, puerta B. Llama al timbre y espera en la sala de la entrada." },
      { k: "contacts", label: "Departamentos y contactos", type: "textarea", rows: 5, max: 6000,
        ph: "Recepción | ext. 100 | recepcion@empresa.es\nAdministración | ext. 120\nSoporte técnico | 910 000 001 | soporte@empresa.es" },
      { k: "_help", type: "note", text: "Una línea por contacto: <b>Nombre | teléfono o extensión | email</b>. Los números y emails se pueden pulsar." },
      { k: "wifi_ssid", label: "WiFi de invitados (red)", ph: "Norte-Invitados", half: true }, { k: "wifi_pass", label: "Contraseña", ph: "visita2026", half: true },
      { k: "checkin", label: "Aviso de llegada", type: "select", options: [["whatsapp", "Por WhatsApp"], ["email", "Por email"], ["both", "WhatsApp y email"], ["", "Sin aviso"]] },
      { k: "whatsapp", label: "WhatsApp de recepción", ph: "+34 600 000 000", type: "tel", half: true }, { k: "email", label: "Email de recepción", ph: "recepcion@empresa.es", type: "email", half: true },
      { k: "phone", label: "Teléfono", ph: "+34 910 000 000", type: "tel", half: true }, { k: "address", label: "Dirección", ph: "Calle Alcalá 100, Madrid", half: true },
      { k: "web", label: "Web", ph: "estudionorte.es", half: true }, { k: "notes", label: "Nota al final", ph: "Por favor, firma en el registro de visitas" },
    ],
    encode: (f) => [f.name || "Oficina", f.how, f.phone && `Tel: ${f.phone}`, f.address].filter(Boolean).join("\n"),
  },
  shop: {
    name: "Tienda / producto", icon: "cart", dyn: true, page: true,
    help: "Ponlo en la etiqueta, el escaparate o el expositor: quien escanee ve <b>la ficha del producto</b> (foto, precio, oferta, características) y puede comprarlo en tu web o <b>preguntar por WhatsApp</b> con el producto ya escrito. Cambia el precio cuando quieras sin reimprimir.",
    fields: [
      { k: "photo", label: "Foto del producto", type: "image", icon: "cart" },
      { k: "name", label: "Producto", ph: "Bolso de piel hecho a mano", half: true, req: true },
      { k: "brand", label: "Tienda o marca", ph: "Taller Luna", half: true },
      { k: "price", label: "Precio", ph: "89", half: true }, { k: "offer", label: "Precio de oferta", ph: "69", half: true },
      { k: "desc", label: "Descripción", type: "textarea", rows: 3, ph: "Piel curtida al vegetal, cosido a mano en nuestro taller." },
      { k: "specs", label: "Características", type: "textarea", rows: 5, max: 6000, ph: "Medidas | 30 × 22 × 10 cm\nMaterial | Piel de vaca\nColores | Marrón, negro\nGarantía | 2 años" },
      { k: "_help", type: "note", text: "Una línea por característica: <b>Nombre | valor</b>. Los precios sin símbolo se muestran en euros." },
      { k: "buy", label: "Enlace para comprarlo", ph: "https://tutienda.es/bolso", type: "url" },
      { k: "whatsapp", label: "WhatsApp para preguntar", ph: "+34 600 000 000", type: "tel", half: true }, { k: "phone", label: "Teléfono", ph: "+34 910 000 000", type: "tel", half: true },
      { k: "hours", label: "Horario de la tienda", type: "textarea", rows: 2, ph: "Lunes a sábado: 10:00 a 14:00 y 17:00 a 20:30" },
      { k: "address", label: "Dirección", ph: "Calle Real 5, Toledo", half: true }, { k: "instagram", label: "Instagram", ph: "@tallerluna", half: true },
      { k: "notes", label: "Nota al final", ph: "Envío gratis a partir de 50 €" },
    ],
    encode: (f) => [f.name || "Producto", f.price && `Precio: ${f.offer || f.price} €`, f.buy && normUrl(f.buy)].filter(Boolean).join("\n"),
  },
  eventpage: {
    name: "Evento con programa", icon: "ticket", dyn: true, page: true,
    help: "Para bodas, conciertos, ferias, congresos o fiestas: quien escanee ve <b>el cartel, la fecha con cuenta atrás, el programa por horas</b>, el sitio con «Cómo llegar», un botón para <b>añadirlo a su calendario</b> y el enlace de entradas. Si cambia algo, lo cambias sin reimprimir.",
    fields: [
      { k: "photo", label: "Cartel o foto", type: "image", icon: "ticket" },
      { k: "name", label: "Título", ph: "Fiesta de verano", req: true },
      { k: "tagline", label: "Frase corta", ph: "Música, comida y buen rollo" },
      { k: "start", label: "Empieza", type: "datetime-local", half: true, req: true }, { k: "end", label: "Termina", type: "datetime-local", half: true },
      { k: "venue", label: "Lugar", ph: "Finca Los Olivos", half: true }, { k: "address", label: "Dirección", ph: "Camino del Río s/n, Sevilla", half: true },
      { k: "program", label: "Programa", type: "textarea", rows: 7, max: 8000, ph: "# Sábado\n18:00 | Bienvenida\n19:30 | Concierto\nGrupo local de versiones\n22:00 | Cena\n\n# Domingo\n12:00 | Paella popular" },
      { k: "_help", type: "note", text: "Igual que la carta: <b># Día o bloque</b> y una línea por actividad con <b>Hora | actividad</b>. La línea de debajo (sin |) es su detalle." },
      { k: "tickets", label: "Enlace de entradas o inscripción", ph: "https://entradas.es/fiesta", type: "url", half: true }, { k: "price", label: "Precio", ph: "Gratis / 15 €", half: true },
      { k: "dress", label: "Indicaciones", ph: "Trae ropa cómoda. Hay parking gratuito." },
      { k: "wifi_ssid", label: "WiFi (red)", ph: "Fiesta-Invitados", half: true }, { k: "wifi_pass", label: "Contraseña del WiFi", ph: "verano2026", half: true },
      { k: "whatsapp", label: "WhatsApp de contacto", ph: "+34 600 000 000", type: "tel", half: true }, { k: "web", label: "Web", ph: "fiestadeverano.es", half: true },
      { k: "notes", label: "Nota al final", ph: "Organiza: Asociación Cultural El Río" },
    ],
    encode: (f) => ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", `SUMMARY:${vesc(f.name)}`,
      f.start && `DTSTART:${ical(f.start)}`, f.end && `DTEND:${ical(f.end)}`, (f.venue || f.address) && `LOCATION:${vesc([f.venue, f.address].filter(Boolean).join(", "))}`,
      "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\n"),
  },
  home: {
    name: "Inmobiliaria", icon: "house", dyn: true, page: true,
    help: "El cartel de «Se vende» o «Se alquila» en el balcón o en el escaparate: quien escanee ve <b>la ficha del inmueble</b> (foto, precio, metros, habitaciones, características) y puede <b>pedir una visita por WhatsApp</b> o llamar. Si baja el precio o se vende, lo cambias sin quitar el cartel.",
    fields: [
      { k: "photo", label: "Foto principal", type: "image", icon: "house" },
      { k: "op", label: "Operación", type: "select", half: true, options: [["venta", "Se vende"], ["alquiler", "Se alquila"], ["traspaso", "Se traspasa"], ["vendido", "Vendido / alquilado"]] },
      { k: "ref", label: "Referencia", ph: "REF-1042", half: true },
      { k: "name", label: "Título", ph: "Piso luminoso con terraza en el centro", req: true },
      { k: "price", label: "Precio", ph: "245.000 / 950 al mes", half: true }, { k: "address", label: "Zona o dirección", ph: "Barrio de Ruzafa, Valencia", half: true },
      { k: "m2", label: "Metros (m²)", ph: "95", half: true }, { k: "rooms", label: "Habitaciones", ph: "3", half: true },
      { k: "baths", label: "Baños", ph: "2", half: true }, { k: "floor", label: "Planta", ph: "4ª con ascensor", half: true },
      { k: "desc", label: "Descripción", type: "textarea", rows: 4, ph: "Reformado en 2024, orientación sur, a 5 minutos del metro." },
      { k: "features", label: "Características", type: "textarea", rows: 4, max: 4000, ph: "Terraza de 12 m²\nAire acondicionado\nPlaza de garaje incluida\nCertificado energético: C" },
      { k: "tour", label: "Enlace a más fotos o visita virtual", ph: "https://...", type: "url" },
      { k: "agent", label: "Agencia o contacto", ph: "Inmobiliaria Sol · Ana", half: true }, { k: "whatsapp", label: "WhatsApp", ph: "+34 600 000 000", type: "tel", half: true },
      { k: "phone", label: "Teléfono", ph: "+34 960 000 000", type: "tel", half: true }, { k: "email", label: "Email", ph: "ana@inmosol.es", type: "email", half: true },
      { k: "notes", label: "Nota al final", ph: "Gastos de comunidad: 60 €/mes" },
    ],
    encode: (f) => [f.name || "Inmueble", f.price && `Precio: ${f.price}`, f.phone && `Tel: ${f.phone}`, f.ref && `Ref: ${f.ref}`].filter(Boolean).join("\n"),
  },
  event: {
    name: "Fecha al calendario", icon: "calendar",
    fields: [
      { k: "title", label: "Título", ph: "Cumpleaños de Ana", req: true },
      { k: "start", label: "Empieza", type: "datetime-local", half: true, req: true }, { k: "end", label: "Termina", type: "datetime-local", half: true },
      { k: "location", label: "Lugar", ph: "" }, { k: "desc", label: "Descripción", type: "textarea" },
    ],
    encode: (f) => ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", `SUMMARY:${vesc(f.title)}`,
      f.start && `DTSTART:${ical(f.start)}`, f.end && `DTEND:${ical(f.end)}`, f.location && `LOCATION:${vesc(f.location)}`,
      f.desc && `DESCRIPTION:${vesc(f.desc)}`, "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\n"),
  },
};

function normUrl(u) {
  u = (u || "").trim();
  if (!u) return "";
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : "https://" + u;
}
const wesc = (s) => String(s || "").replace(/([\\;,:"])/g, "\\$1");
const vesc = (s) => String(s || "").replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");
const ical = (v) => v.replace(/[-:]/g, "").slice(0, 13) + "00";
function qs(o) {
  const p = Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return p.length ? "?" + p.join("&") : "";
}

export function encode(kind, fields) {
  const t = TYPES[kind] || TYPES.text;
  return t.encode(fields || {});
}

export function missing(kind, fields) {
  const t = TYPES[kind];
  return t ? t.fields.filter((f) => f.req && !String(fields?.[f.k] ?? "").trim()).map((f) => f.label) : [];
}

/** Reconoce lo que hay dentro de un QR leido: {kind, fields, title, summary}. */
export function parse(raw) {
  const s = String(raw || "");
  const unv = (x) => (x || "").replace(/\\n/g, "\n").replace(/\\([\\;,:"])/g, "$1");
  if (/^WIFI:/i.test(s)) {
    const get = (k) => { const m = s.match(new RegExp(`[:;]${k}:((?:\\\\.|[^;])*)`, "i")); return m ? unv(m[1]) : ""; };
    const auth = get("T") || "nopass";
    return { kind: "wifi", fields: { ssid: get("S"), password: get("P"), auth: /wep/i.test(auth) ? "WEP" : /nopass/i.test(auth) || !auth ? "nopass" : "WPA", hidden: /true/i.test(get("H")) }, title: "Red WiFi", summary: get("S") };
  }
  if (/^BEGIN:VCARD/i.test(s)) {
    const line = (k) => { const m = s.match(new RegExp(`^${k}[^:\\n]*:(.*)$`, "im")); return m ? unv(m[1].trim()) : ""; };
    const [last = "", first = ""] = line("N").split(";");
    return { kind: "vcard", fields: { first: first || line("FN"), last, phone: line("TEL"), email: line("EMAIL"), org: line("ORG"), title: line("TITLE"), web: line("URL"), address: line("ADR").replace(/;+/g, " ").trim(), note: line("NOTE") }, title: "Contacto", summary: line("FN") || first };
  }
  if (/BEGIN:VEVENT/i.test(s)) {
    const line = (k) => { const m = s.match(new RegExp(`^${k}[^:\\n]*:(.*)$`, "im")); return m ? unv(m[1].trim()) : ""; };
    const dt = (v) => (v && v.length >= 13 ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(9, 11)}:${v.slice(11, 13)}` : "");
    return { kind: "event", fields: { title: line("SUMMARY"), start: dt(line("DTSTART")), end: dt(line("DTEND")), location: line("LOCATION"), desc: line("DESCRIPTION") }, title: "Evento", summary: line("SUMMARY") };
  }
  if (/^mailto:/i.test(s)) {
    const u = new URL(s);
    return { kind: "email", fields: { to: decodeURIComponent(u.pathname), subject: u.searchParams.get("subject") || "", body: u.searchParams.get("body") || "" }, title: "Email", summary: decodeURIComponent(u.pathname) };
  }
  if (/^tel:/i.test(s)) return { kind: "phone", fields: { phone: s.slice(4) }, title: "Llamada", summary: s.slice(4) };
  if (/^(SMSTO|sms):/i.test(s)) {
    const [, phone = "", text = ""] = s.match(/^(?:SMSTO|sms):([^:?]*)[:?]?(?:body=)?(.*)$/i) || [];
    return { kind: "sms", fields: { phone, text: decodeURIComponent(text) }, title: "SMS", summary: phone };
  }
  let m = s.match(/^https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?(\d+)(?:[?&]text=(.*))?/i);
  if (m) return { kind: "whatsapp", fields: { phone: m[1], text: m[2] ? decodeURIComponent(m[2]) : "" }, title: "WhatsApp", summary: "+" + m[1] };
  m = s.match(/^geo:(-?[\d.]+),(-?[\d.]+)/i) || s.match(/maps\.google\.[^/]+\/\?q=(-?[\d.]+)(?:,|%2C)(-?[\d.]+)/i);
  if (m) return { kind: "geo", fields: { lat: m[1], lng: m[2], label: "" }, title: "Ubicación", summary: `${m[1]}, ${m[2]}` };
  if (/^https?:\/\//i.test(s)) { let host = s; try { host = new URL(s).host; } catch { /* nada */ } return { kind: "url", fields: { url: s }, title: "Enlace", summary: host }; }
  return { kind: "text", fields: { text: s }, title: "Texto", summary: s.slice(0, 80) };
}
