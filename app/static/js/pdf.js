// PDF minimo para imprimir: una pagina A4 con el QR centrado (imagen JPEG de alta resolucion).
export async function makePdf(jpegBlob, imgW, imgH, title = "QR", margin = 72) {
  const jpg = new Uint8Array(await jpegBlob.arrayBuffer());
  const enc = new TextEncoder();
  const pw = 595.28, ph = 841.89;                  // A4 en puntos
  const maxW = pw - 2 * margin, maxH = ph - 2 * margin; // 2,5 cm de margen por defecto
  const k = Math.min(maxW / imgW, maxH / imgH);
  const w = imgW * k, h = imgH * k, x = (pw - w) / 2, y = (ph - h) / 2;
  const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
  const safe = String(title).replace(/[^\x20-\x7e]/g, "").replace(/[()\\]/g, "").slice(0, 80) || "QR";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    null, // imagen
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Title (${safe}) /Producer (QRPanel) >>`,
  ];
  const parts = [enc.encode("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  let off = parts[0].length;
  const xref = [];
  objs.forEach((o, i) => {
    xref.push(off);
    let chunk;
    if (o === null) {
      const head = enc.encode(`${i + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
      const tail = enc.encode("\nendstream\nendobj\n");
      chunk = new Uint8Array(head.length + jpg.length + tail.length);
      chunk.set(head); chunk.set(jpg, head.length); chunk.set(tail, head.length + jpg.length);
    } else chunk = enc.encode(`${i + 1} 0 obj\n${o}\nendobj\n`);
    parts.push(chunk); off += chunk.length;
  });
  const x0 = off;
  let t = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + xref.map((n) => String(n).padStart(10, "0") + " 00000 n \n").join("");
  t += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${x0}\n%%EOF\n`;
  parts.push(enc.encode(t));
  return new Blob(parts, { type: "application/pdf" });
}

/** PDF de varias páginas A4, cada una una imagen JPEG a página completa. pages: [{jpg, w, h}] */
export async function makePdfPages(pages, title = "QR") {
  const enc = new TextEncoder();
  const pw = 595.28, ph = 841.89;
  const safe = String(title).replace(/[^\x20-\x7e]/g, "").replace(/[()\\]/g, "").slice(0, 80) || "QR";
  const n = pages.length;
  // objetos: 1 catalogo, 2 paginas, 3 info, y por cada pagina: page, imagen, contenido
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 3} 0 R`).join(" ")}] /Count ${n} >>`,
    `<< /Title (${safe}) /Producer (QRPanel) >>`];
  const imgs = [];
  for (let i = 0; i < n; i++) {
    const p = pages[i], k = Math.min(pw / p.w, ph / p.h), w = p.w * k, h = p.h * k;
    const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${((pw - w) / 2).toFixed(2)} ${((ph - h) / 2).toFixed(2)} cm /Im0 Do Q`;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${5 + i * 3} 0 R >> >> /Contents ${6 + i * 3} 0 R >>`);
    objs.push(null); imgs.push({ idx: objs.length - 1, jpg: new Uint8Array(await p.jpg.arrayBuffer()), w: p.w, h: p.h });
    objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }
  const parts = [enc.encode("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  let off = parts[0].length;
  const xref = [];
  objs.forEach((o, i) => {
    xref.push(off);
    let chunk;
    if (o === null) {
      const im = imgs.find((x) => x.idx === i);
      const head = enc.encode(`${i + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.jpg.length} >>\nstream\n`);
      const tail = enc.encode("\nendstream\nendobj\n");
      chunk = new Uint8Array(head.length + im.jpg.length + tail.length);
      chunk.set(head); chunk.set(im.jpg, head.length); chunk.set(tail, head.length + im.jpg.length);
    } else chunk = enc.encode(`${i + 1} 0 obj\n${o}\nendobj\n`);
    parts.push(chunk); off += chunk.length;
  });
  let t = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + xref.map((x) => String(x).padStart(10, "0") + " 00000 n \n").join("");
  t += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${off}\n%%EOF\n`;
  parts.push(enc.encode(t));
  return new Blob(parts, { type: "application/pdf" });
}
