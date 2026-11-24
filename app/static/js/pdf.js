// PDF minimo para imprimir: una pagina A4 con el QR centrado (imagen JPEG de alta resolucion).
export async function makePdf(jpegBlob, imgW, imgH, title = "QR") {
  const jpg = new Uint8Array(await jpegBlob.arrayBuffer());
  const enc = new TextEncoder();
  const pw = 595.28, ph = 841.89;                  // A4 en puntos
  const maxW = pw - 2 * 72, maxH = ph - 2 * 72;     // 2,5 cm de margen
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
