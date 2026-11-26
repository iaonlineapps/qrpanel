# What's new in QRPanel (web and server)

<!-- Newest version on top. Same versions and order as NOVEDADES.md (Spanish). -->

## 1.0.16

- **What's new notice.** After QRPanel is updated, the first time you sign in a window shows you
  what has changed. You can read it again any time from your photo menu → "What's new", in
  **Settings → About** or with the "What's new" link at the bottom of the page.

## 1.0.15

- **Quick account switching.** Your photo menu shows the other accounts signed in on this device:
  tap one to switch to it without signing out or typing the password. "Add another account" signs
  in to a new one (that time with its password). When you sign out, the sign-in screen offers the
  remembered accounts, and the ✕ removes one from the device.

## 1.0.14

- **Frame the photo when you upload it.** When you add a photo (pet, product, property, logo…) an
  editor opens to move and zoom it, so the dog or cat doesn't get its head cut off. For pets you
  see the circle exactly as it will look on its profile.
- **The lost pet poster shows the whole photo**, uncropped, over a blurred background.
- **Review stand:** the speech bubble with the heart is now a single piece (the tail is joined to
  the box) and on top it has a thank-you message, "Thanks for your review!", that you can change.
  Checked for 3D printing: all parts closed and no details thinner than a 0.4 mm nozzle.

## 1.0.13

- **Spanish or English.** QRPanel can now be used in English. Choose the language in
  **Settings → Idioma / Language** or on the sign-in screen. If you don't choose one, it uses the
  browser's language.
- **Public pages also show in English** for people whose phone is in English: the menu, the hotel,
  the office, the product, the event, the property, the pet profile, the PIN page and the share
  page. What QRPanel writes is translated (buttons, titles, allergens, dates); what you write stays
  as you wrote it. Add `?lang=en` or `?lang=es` to the link to force a language.
- Posters, table cards and the 3D stand come out with the texts in the chosen language.
- **Android app 1.0.1:** also in English, following the language you choose on the web or the phone's.

## 1.0.12

- **New "Shop / product" type:** the product page for the label, the shop window or the stand.
  Photo, price and sale price (crossed out), description, features, a **Buy** button to your web
  and **Ask on WhatsApp** with the product already written. Also the shop's opening hours and
  address. With one QR per stand you know where it is scanned most.
- **New "Event with schedule" type:** for weddings, concerts, fairs or parties. Poster, date with a
  **countdown**, **schedule by time**, place with "Directions", tickets link, price, WiFi and an
  **"Add to calendar"** button (an .ics file that opens the phone's calendar).
- **New "Real estate" type:** the QR on the "For sale / For rent" sign. Shows the listing with
  photo, price, m², bedrooms, bathrooms, floor, features and reference, and the buttons
  **"Book a viewing" on WhatsApp**, call or email. When it's sold, mark it as "Sold" without
  taking the sign down.
- When you share any of these pages on WhatsApp or Telegram, the preview shows the price, the date
  or the main details.
- The old "Event" type is now called "Date to calendar" so it isn't confused.

## 1.0.11

- **New "Hotel / accommodation" type:** the welcome page for hotels, hostels and holiday flats.
  WiFi with a button to copy the password, check-in, check-out and breakfast times, services and
  what's nearby, house rules, and buttons to call reception, write on WhatsApp and get directions.
  **One QR per room:** the page says "You are in room 12" and Statistics shows each room's scans.
- **New "Office / reception" type:** for offices, clinics, coworkings and any company entrance.
  Shows directions, opening hours, each department's contacts (tap to call or email) and the guest
  WiFi. Visitors can **tell reception they have arrived** on WhatsApp or by email, with their name,
  company and who they are visiting. You can also make one QR per area or door.
- The 3D stand now has the texts "WELCOME" and "RECEPTION" for these types.
- Fixed: on the menu, the "Copy" button for the WiFi password didn't work because the browser's
  security policy blocked it.

## 1.0.10

- **New "Reviews" type:** a QR that goes straight to leaving your review on Google, TripAdvisor,
  Facebook or wherever you want. It is **dynamic** (shorter QR and scan counting) and explains
  where to copy each platform's link.
- **3D table stand:** "3D stand" button in the editor and in the Library. It makes a coloured
  plate with the text (by default "LEAVE A REVIEW"), an icon or **your logo**, 5 yellow stars and
  **your QR in relief**, plus a slotted base so it stands up. **All edges rounded.** Three sizes,
  four plate colours and download as **multicolour 3MF** (Bambu, Orca, Prusa…) or one STL per
  colour. It also works for the menu, the WiFi and any other QR.

## 1.0.9

- **New "Restaurant" type:** a QR that opens **your menu** on the phone: sections, dishes, prices,
  description, **allergens** with icons, opening hours, WiFi (with a button to copy the password),
  address, phone, Instagram and web. You write it as simple text and change it without reprinting
  the QR codes.
- **One QR per table:** from table 1 to the one you say, each with its own QR. They all open the
  same menu but the page says "You are at table 5". **PDF with cards** (6 per A4 sheet) with the
  logo, the name and the table number, or a ZIP with one PNG per table.
- **Statistics per table:** how many times each table is scanned.

## 1.0.8

- **"Wanted" poster without your phone number showing:** for privacy, the poster no longer has
  the phone printed; only whoever scans the QR sees it (on the profile). The tear-off strips have
  a small QR. If you want it to show, turn on "Show my phone on the poster".
- **Uninstaller** `uninstall.sh`: one command to remove QRPanel. It asks before deleting, offers a
  backup of the data and lets you choose whether to delete the data and the program folder.

## 1.0.7

- **"Wanted" poster for lost pets:** on the pet tag (and in the Library), a poster with the photo,
  name, markings, reward, phone and the QR of its profile. As an **A4 PDF** to print, with
  **tear-off strips**, and as a **square post** and **vertical story** to share on WhatsApp,
  Telegram, Instagram, TikTok or Facebook. Choose the title (WANTED, LOST, HAVE YOU SEEN ME?…).
- **Profile photo or brand logo** on your account (Settings → Your account). It shows at the top
  right, in the user list and on the pages you share.

## 1.0.6

- **https warning:** if the public address is `http://` or a home IP, QRPanel warns you in
  Settings, when creating a dynamic or pet QR and when sharing: without https and a domain, the pet
  profile's location and the QR image on WhatsApp/Telegram don't work.
- README: "HTTPS and domain" section with what works and what doesn't, and how to set it up with
  Pangolin, Nginx Proxy Manager or Cloudflare Tunnel.

## 1.0.5

- **Pet profile: "Send my location" with a plan B.** If the browser doesn't give the location
  (permission denied, GPS off, page without https, browsers like Opera…) it explains why, lets you
  **type where you are** and send the alert on WhatsApp anyway, try again and see how to turn on
  location on Android and iPhone.

## 1.0.4

- **The QR image shows when you paste the link on WhatsApp, Telegram, etc.** The preview is now a
  1200x630 card with the QR, the name and (for pets) its photo.
- It works with both the **share link** and the dynamic QR's **short link**. Visits from WhatsApp,
  Telegram and others to build the preview **don't count as scans**.
- When you reload, the web always asks the server for the new version.

## 1.0.3

- **Animals inside the QR:** dog, cat, rabbit, bird, fish, hamster, tortoise, horse, paw print and
  bone for the centre of the QR.
- **Your pet's photo in the centre** of the tag, cropped round, in one tap.
- **"Pet tag" button:** colours, paw-shaped eyes, the right animal and the text "IF I'M LOST, SCAN
  ME" all at once.
- The QR eyes can be **paw-shaped**.
- More species on the profile: rabbit, bird, hamster, tortoise, horse and ferret.

## 1.0.2

- **QR for pets (dogs, cats…):** profile with photo, name, breed, markings, microchip, health,
  temperament and the owner's details. Whoever finds the pet sees the profile with buttons to
  **call**, send a **WhatsApp** or **send where it is** (their location on the map). It can be
  marked as **lost** (big red warning) with a reward. Details change without reprinting the tag.

## 1.0.1

- **3D printing:** download the QR as a 3D model in **two-colour 3MF**, **STL** or two STLs (base
  and modules), with a 3D preview you can rotate and zoom.
- **Share with image:** on WhatsApp and Telegram the QR image is sent, and the shared link shows
  the QR image as its preview.
- **Versions in view:** at the bottom of each page and in your user menu you see the web version
  and, inside the app, the app version.

## 1.0.0

First version.

- QR editor with 10 types, full design, 12 templates and real scan checking.
- Downloads in PNG, SVG, JPG, WebP and PDF; dynamic QR codes with statistics, library, scanner,
  batch QR, backups, users and your own brand.
