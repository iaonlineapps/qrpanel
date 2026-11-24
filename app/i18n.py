"""Idioma de las páginas públicas (/r/... y /s/...): español o inglés.

Las páginas se escriben en español y, si toca inglés, se traducen al final con esta tabla.
Cada frase de la tabla lleva algún carácter de HTML (<, > o "): lo que escribe el usuario va
siempre escapado (&lt; &gt; &quot;), así que la tabla nunca toca sus textos.
"""
import re
from urllib.parse import quote

# frases sueltas que también se dicen en mensajes ya escritos (WhatsApp, email...)
MSG = {
    "¡Hola! He encontrado a ": "Hi! I've found ",
    " gracias a su QR.": " thanks to their QR.",
    "tu mascota": "your pet",
    "Hola, me interesa «": "Hi, I'm interested in «",
    "». ¿Me das más información?": "». Can you give me more information?",
    "Hola, me interesa el inmueble «": "Hi, I'm interested in the property «",
    ". ¿Podemos concertar una visita?": ". Can we arrange a viewing?",
    " (expositor ": " (display ",
    " (ref. ": " (ref. ",
    "Visita ": "Viewing ",
}

PAGE = [
    # comunes
    ('<html lang="es">', '<html lang="en">'),
    ('>Hecho con QRPanel<', '>Made with QRPanel<'),
    ('>📞 Llamar<', '>📞 Call<'), ('>📍 Cómo llegar<', '>📍 Directions<'), ('>🌐 Web<', '>🌐 Website<'),
    ('>💬 WhatsApp<', '>💬 WhatsApp<'), ('<h2>📶 WiFi</h2><p>Red: <b>', '<h2>📶 WiFi</h2><p>Network: <b>'),
    ('<br>Contraseña: <b', '<br>Password: <b'), ('>Copiar</button>', '>Copy</button>'),
    ('<h2>🕒 Horario</h2>', '<h2>🕒 Opening hours</h2>'), ('<h2>🕒 Horarios</h2>', '<h2>🕒 Times</h2>'),
    ('<h2>📍 Dirección</h2>', '<h2>📍 Address</h2>'), ('<h2>📍 Zona</h2>', '<h2>📍 Area</h2>'),
    # mascota
    ('· ¿Me has encontrado?</title>', '· Have you found me?</title>'),
    ('alt="Foto de ', 'alt="Photo of '), ('<h1>Hola, soy ', '<h1>Hi, I\'m '),
    ('>Si me has encontrado, por favor avisa a mi familia. ¡Gracias!<', '>If you\'ve found me, please tell my family. Thank you!<'),
    ('>¡Me he perdido! Ayúdame a volver a casa<', '>I\'m lost! Help me get back home<'),
    ('>📞 Llamar a ', '>📞 Call '), ('su familia</a>', 'their family</a>'),
    ('>💬 Mandar un WhatsApp<', '>💬 Send a WhatsApp<'), ('>📍 Enviar dónde estoy<', '>📍 Send where I am<'),
    ('>📞 Otro teléfono<', '>📞 Other phone<'), ('>✉️ Mandar un email<', '>✉️ Send an email<'),
    ('<h2>⚕️ Salud</h2>', '<h2>⚕️ Health</h2>'), ('<h2>Cómo es</h2>', '<h2>What it\'s like</h2>'),
    ('<dt>Raza</dt>', '<dt>Breed</dt>'), ('<dt>Color / señas</dt>', '<dt>Colour / markings</dt>'), ('<dt>Sexo</dt>', '<dt>Sex</dt>'),
    ('<dt>Edad</dt>', '<dt>Age</dt>'), ('<dt>Microchip</dt>', '<dt>Microchip</dt>'), ('<dt>Veterinario</dt>', '<dt>Vet</dt>'),
    ('<dt>Vive en</dt>', '<dt>Lives in</dt>'), ('<dd>Macho</dd>', '<dd>Male</dd>'), ('<dd>Hembra</dd>', '<dd>Female</dd>'),
    ('<p class="sub">Perro', '<p class="sub">Dog'), ('<p class="sub">Gato', '<p class="sub">Cat'), ('<p class="sub">Conejo', '<p class="sub">Rabbit'),
    ('<p class="sub">Pájaro', '<p class="sub">Bird'), ('<p class="sub">Hámster', '<p class="sub">Hamster'), ('<p class="sub">Tortuga', '<p class="sub">Tortoise'),
    ('<p class="sub">Caballo', '<p class="sub">Horse'), ('<p class="sub">Hurón', '<p class="sub">Ferret'),
    ('>Ficha hecha con QRPanel<', '>Profile made with QRPanel<'),
    # PIN y QR cerrados
    ('<title>QR protegido</title>', '<title>Protected QR</title>'), ('<h1>Este QR tiene PIN</h1>', '<h1>This QR has a PIN</h1>'),
    ('<p>Escribe el PIN que te han dado para continuar.</p>', '<p>Enter the PIN you were given to continue.</p>'),
    ('>Abrir</button>', '>Open</button>'),
    ('>PIN incorrecto. Vuelve a probar.<', '>Wrong PIN. Try again.<'),
    ('>Este QR no existe<', '>This QR doesn\'t exist<'), ('>Puede que lo hayan borrado. Pide uno nuevo a quien te lo dio.<', '>It may have been deleted. Ask whoever gave it to you for a new one.<'),
    ('>Este QR está en pausa<', '>This QR is paused<'), ('>Su dueño lo ha desactivado por ahora. Prueba más tarde.<', '>Its owner has turned it off for now. Try again later.<'),
    ('>Este QR ha caducado<', '>This QR has expired<'), ('>Ya no lleva a ningún sitio.<', '>It no longer leads anywhere.<'),
    ('>Este QR ya no está disponible<', '>This QR is no longer available<'), ('>Ha llegado al número máximo de lecturas.<', '>It has reached the maximum number of scans.<'),
    # carta
    ('· Carta</title>', '· Menu</title>'), ('>Nuestra carta<', '>Our menu<'),
    ('>La carta estará aquí muy pronto.<', '>The menu will be here very soon.<'),
    ('>📸 Instagram<', '>📸 Instagram<'), ('<h2>📍 Dónde estamos</h2>', '<h2>📍 Where we are</h2>'),
    ('🍽️ Estás en la <b>mesa ', '🍽️ You are at <b>table '), ('>Carta hecha con QRPanel<', '>Menu made with QRPanel<'),
    ('✅ Sin gluten</span>', '✅ Gluten-free</span>'), (' Crustáceos</span>', ' Crustaceans</span>'), (' Huevo</span>', ' Egg</span>'),
    (' Pescado</span>', ' Fish</span>'), (' Cacahuetes</span>', ' Peanuts</span>'), (' Soja</span>', ' Soy</span>'), (' Lácteos</span>', ' Dairy</span>'),
    (' Frutos secos</span>', ' Nuts</span>'), (' Apio</span>', ' Celery</span>'), (' Mostaza</span>', ' Mustard</span>'), (' Sésamo</span>', ' Sesame</span>'),
    (' Sulfitos</span>', ' Sulphites</span>'), (' Altramuces</span>', ' Lupin</span>'), (' Moluscos</span>', ' Molluscs</span>'),
    (' Vegano</span>', ' Vegan</span>'), (' Vegetariano</span>', ' Vegetarian</span>'), (' Picante</span>', ' Spicy</span>'),
    # hotel y oficina
    ('>📞 Recepción<', '>📞 Reception<'), ('<span>Entrada</span>', '<span>Check-in</span>'), ('<span>Salida</span>', '<span>Check-out</span>'),
    ('<span>Desayuno</span>', '<span>Breakfast</span>'), ('<h2>Servicios</h2>', '<h2>Services</h2>'),
    ('<h2>📋 Normas de la casa</h2>', '<h2>📋 House rules</h2>'), ('<h2>🧭 Cómo llegar</h2>', '<h2>🧭 How to get here</h2>'),
    ('<h2>👋 Avisa de que has llegado</h2>', '<h2>👋 Let them know you\'ve arrived</h2>'),
    ('placeholder="Tu nombre"', 'placeholder="Your name"'), ('placeholder="Empresa (opcional)"', 'placeholder="Company (optional)"'),
    ('placeholder="¿A quién vienes a ver?"', 'placeholder="Who are you here to see?"'),
    ('>💬 Avisar por WhatsApp<', '>💬 Notify by WhatsApp<'), ('>✉️ Avisar por email<', '>✉️ Notify by email<'),
    ('>Se abre tu WhatsApp o tu correo con el mensaje ya escrito: solo tienes que enviarlo.<', '>Your WhatsApp or email opens with the message already written: you just have to send it.<'),
    ('<h2>Contactos</h2>', '<h2>Contacts</h2>'), ('🛏️ Estás en la <b>habitación ', '🛏️ You are in <b>room '), ('📍 Estás en: <b>', '📍 You are at: <b>'),
    ('>Muy pronto tendrás aquí toda la información.<', '>All the information will be here very soon.<'),
    ('<title>Bienvenido</title>', '<title>Welcome</title>'), ('<h1>Bienvenido</h1>', '<h1>Welcome</h1>'),
    ('<title>Recepción</title>', '<title>Reception</title>'), ('<h1>Recepción</h1>', '<h1>Reception</h1>'),
    # producto, evento, inmueble
    ('>🛒 Comprar<', '>🛒 Buy<'), ('>💬 Preguntar<', '>💬 Ask<'), ('📸 Instagram</a>', '📸 Instagram</a>'),
    ('<h2>🕒 Horario de la tienda</h2>', '<h2>🕒 Shop opening hours</h2>'),
    ('>🎟️ Entradas<', '>🎟️ Tickets<'), ('>🗓️ Añadir al calendario<', '>🗓️ Add to calendar<'),
    ('<h2>💶 Precio</h2>', '<h2>💶 Price</h2>'), ('<h2 class="sec">Programa</h2>', '<h2 class="sec">Programme</h2>'),
    ('<h2>📍 Dónde</h2>', '<h2>📍 Where</h2>'), ('<h2>ℹ️ A tener en cuenta</h2>', '<h2>ℹ️ Good to know</h2>'),
    ('>Se vende<', '>For sale<'), ('>Se alquila<', '>For rent<'), ('>Se traspasa<', '>Lease for transfer<'), ('>Vendido<', '>Sold<'),
    ('<span>habitaciones</span>', '<span>bedrooms</span>'), ('<span>baños</span>', '<span>bathrooms</span>'), ('<span>planta</span>', '<span>floor</span>'),
    ('<h2>Características</h2>', '<h2>Features</h2>'), ('>💬 Pedir visita<', '>💬 Request a viewing<'), ('>✉️ Email<', '>✉️ Email<'),
    ('>📷 Más fotos<', '>📷 More photos<'), ('<h2>🏢 Contacto</h2>', '<h2>🏢 Contact</h2>'), ('Referencia: <b>', 'Reference: <b>'),
    ('<title>Producto</title>', '<title>Product</title>'), ('<h1>Producto</h1>', '<h1>Product</h1>'),
    ('<title>Evento</title>', '<title>Event</title>'), ('<h1>Evento</h1>', '<h1>Event</h1>'),
    ('<title>Inmueble</title>', '<title>Property</title>'), ('<h1>Inmueble</h1>', '<h1>Property</h1>'),
    # vista previa (WhatsApp, Telegram...)
    ('content="Abre el enlace para ver la carta, el horario y cómo llegar."', 'content="Open the link to see the menu, opening hours and directions."'),
    ('content="Abre el enlace para ir a su destino."', 'content="Open the link to go to its destination."'),
    ('content="Hace falta un PIN para abrirlo."', 'content="A PIN is needed to open it."'),
    ('content="Código QR protegido"', 'content="Protected QR code"'),
    ('content="¡Me he perdido! Abre el enlace para avisar a mi familia."', 'content="I\'m lost! Open the link to tell my family."'),
    ('content="Si me encuentras, abre el enlace para avisar a mi familia."', 'content="If you find me, open the link to tell my family."'),
    ('content="WiFi, horarios, servicios y contacto con recepción."', 'content="WiFi, times, services and reception contact."'),
    ('content="Cómo llegar, horario, contactos y aviso de llegada."', 'content="Directions, opening hours, contacts and arrival notice."'),
    ('content="Abre el enlace para ver la ficha del producto."', 'content="Open the link to see the product details."'),
    ('content="Abre el enlace para ver el programa."', 'content="Open the link to see the programme."'),
    ('content="Placa de mascota"', 'content="Pet tag"'),
]

# frases con datos dentro
REGEX = [
    (re.compile(r">Demasiados intentos\. Espera (\d+) minutos\.<"), r">Too many attempts. Wait \1 minutes.<"),
    (re.compile(r'content="Mesa ([^".]+)\. Abre el enlace para ver la carta\."'), r'content="Table \1. Open the link to see the menu."'),
    (re.compile(r'content="Habitación ([^".]+)\. WiFi, horarios'), r'content="Room \1. WiFi, times'),
    (re.compile(r'content="Hola, soy '), 'content="Hi, I\'m '),
    (re.compile(r'(content="[^"]*?)Se vende · '), r'\1For sale · '), (re.compile(r'(content="[^"]*?)Se alquila · '), r'\1For rent · '),
    (re.compile(r'(content="[^"]*?) hab\. · '), r'\1 bed. · '),
    (re.compile(r'(content="|📅 )(lunes|martes|miércoles|jueves|viernes|sábado|domingo) (\d+) de (\w+) de (\d{4}), '), None),
]
DAYS = {"lunes": "Monday", "martes": "Tuesday", "miércoles": "Wednesday", "jueves": "Thursday", "viernes": "Friday", "sábado": "Saturday", "domingo": "Sunday"}
MONTHS = {"enero": "January", "febrero": "February", "marzo": "March", "abril": "April", "mayo": "May", "junio": "June", "julio": "July",
          "agosto": "August", "septiembre": "September", "octubre": "October", "noviembre": "November", "diciembre": "December"}
DATE_RE = re.compile(r"\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo) (\d+) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) de (\d{4})")


def _with_quoted(pairs):
    """Los mensajes de WhatsApp/email van dentro de enlaces (codificados) o en atributos."""
    out = []
    for es, en in pairs:
        out.append((quote(es), quote(en)))
    return out


MSG_Q = _with_quoted(MSG.items())


def pick(query_lang: str | None, cookie_lang: str | None, accept: str | None, owner_lang: str | None) -> str:
    """El idioma de una página pública: ?lang=, el elegido en QRPanel, el del navegador o el del dueño."""
    for v in (query_lang, cookie_lang):
        if v in ("es", "en"):
            return v
    if accept:
        first = accept.split(",")[0].strip().lower()
        if first:
            return "es" if first.startswith("es") else "en"
    return owner_lang if owner_lang in ("es", "en") else "es"


def localize(html: str, lang: str) -> str:
    if lang != "en":
        return html
    for es, en in PAGE:
        html = html.replace(es, en)
    for es, en in MSG_Q:
        html = html.replace(es, en)
    for rx, rep in REGEX:
        if rep is not None:
            html = rx.sub(rep, html)
    html = DATE_RE.sub(lambda m: f"{DAYS[m.group(1)]} {m.group(2)} {MONTHS[m.group(3)]} {m.group(4)}", html)
    return html
