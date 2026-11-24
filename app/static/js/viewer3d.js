// Visor 3D mínimo con WebGL (sin librerías): gira con el ratón o el dedo, zoom con la rueda
// o pellizcando. Sombreado plano para que se vean bien los bordes de cada módulo.
const VS = `attribute vec3 p;attribute vec3 n;attribute vec3 c;uniform mat4 mv;uniform mat4 pr;varying vec3 vn;varying vec3 vc;
void main(){vn=mat3(mv)*n;vc=c;gl_Position=pr*mv*vec4(p,1.0);}`;
const FS = `precision mediump float;varying vec3 vn;varying vec3 vc;
void main(){vec3 N=normalize(vn);float d=max(dot(N,normalize(vec3(0.35,0.55,0.75))),0.0);float b=max(dot(N,normalize(vec3(-0.6,-0.2,0.4))),0.0);
gl_FragColor=vec4(vc*(0.38+0.62*d+0.12*b),1.0);}`;

const rgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); const v = m ? parseInt(m[1], 16) : 0x888888; return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; };
function persp(f, a, n, fa) { const t = 1 / Math.tan(f / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0]; }
function lookAt(e, c, u) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], nrm = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const z = nrm(sub(e, c)), x = nrm(cr(u, z)), y = cr(z, x);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dt(x, e), -dt(y, e), -dt(z, e), 1];
}

export function viewer(canvas) {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true, preserveDrawingBuffer: true });
  if (!gl) return null;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const pg = gl.createProgram(); gl.attachShader(pg, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pg, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pg); gl.useProgram(pg);
  const loc = { p: gl.getAttribLocation(pg, "p"), n: gl.getAttribLocation(pg, "n"), c: gl.getAttribLocation(pg, "c"), mv: gl.getUniformLocation(pg, "mv"), pr: gl.getUniformLocation(pg, "pr") };
  const buf = gl.createBuffer();
  let count = 0, center = [0, 0, 0], radius = 50, raf = 0;
  const cam = { th: -0.55, ph: 0.9, zoom: 1, auto: true };
  const start = { th: cam.th, ph: cam.ph };

  function setModel(model) {
    const tris = model.parts.reduce((s, p) => s + p.mesh.idx.length / 3, 0);
    const data = new Float32Array(tris * 3 * 9);
    let o = 0, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const part of model.parts) {
      const P = part.mesh.pos, I = part.mesh.idx, col = rgb(part.color);
      // un poco más claro el negro y más oscuro el blanco, para que se vean las caras
      const c = col.map((v) => 0.08 + v * 0.86);
      for (let i = 0; i < I.length; i += 3) {
        const a = I[i] * 3, b = I[i + 1] * 3, d = I[i + 2] * 3;
        const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[d] - P[a], vy = P[d + 1] - P[a + 1], vz = P[d + 2] - P[a + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        for (const k of [a, b, d]) {
          data[o++] = P[k]; data[o++] = P[k + 1]; data[o++] = P[k + 2]; data[o++] = nx; data[o++] = ny; data[o++] = nz; data[o++] = c[0]; data[o++] = c[1]; data[o++] = c[2];
          for (let j = 0; j < 3; j++) { mn[j] = Math.min(mn[j], P[k + j]); mx[j] = Math.max(mx[j], P[k + j]); }
        }
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    count = tris * 3; center = mn.map((v, j) => (v + mx[j]) / 2); radius = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2;
    draw();
  }
  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
    if (!count) return;
    const dist = (radius / Math.sin(0.33)) * cam.zoom;
    const eye = [center[0] + dist * Math.cos(cam.ph) * Math.cos(cam.th), center[1] + dist * Math.cos(cam.ph) * Math.sin(cam.th), center[2] + dist * Math.sin(cam.ph)];
    const up = [-Math.sin(cam.ph) * Math.cos(cam.th), -Math.sin(cam.ph) * Math.sin(cam.th), Math.cos(cam.ph)];
    gl.uniformMatrix4fv(loc.mv, false, lookAt(eye, center, up));
    gl.uniformMatrix4fv(loc.pr, false, persp(0.66, w / Math.max(h, 1), dist / 20, dist * 4));
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const F = 36;
    gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, F, 0);
    gl.enableVertexAttribArray(loc.n); gl.vertexAttribPointer(loc.n, 3, gl.FLOAT, false, F, 12);
    gl.enableVertexAttribArray(loc.c); gl.vertexAttribPointer(loc.c, 3, gl.FLOAT, false, F, 24);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  }
  // giro automático suave hasta que el usuario lo toque
  const spin = () => { if (!cam.auto || !canvas.isConnected) return; cam.th += 0.006; draw(); raf = requestAnimationFrame(spin); };
  const stopAuto = () => { cam.auto = false; cancelAnimationFrame(raf); };
  const pts = new Map(); let pinch = 0;
  canvas.addEventListener("pointerdown", (e) => { stopAuto(); canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); });
  canvas.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    const [x, y] = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) cam.zoom = Math.min(3, Math.max(0.35, cam.zoom * (pinch / d)));
      pinch = d;
    } else {
      cam.th -= (e.clientX - x) * 0.01; cam.ph = Math.min(1.5707, Math.max(-0.2, cam.ph + (e.clientY - y) * 0.01));
    }
    draw();
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); stopAuto(); cam.zoom = Math.min(3, Math.max(0.35, cam.zoom * (e.deltaY > 0 ? 1.1 : 0.9))); draw(); }, { passive: false });
  canvas.addEventListener("dblclick", () => api.reset());
  const ro = new ResizeObserver(() => draw()); ro.observe(canvas);
  const api = {
    setModel, draw,
    top() { stopAuto(); cam.th = -Math.PI / 2; cam.ph = 1.5707; cam.zoom = 0.9; draw(); },
    reset() { stopAuto(); Object.assign(cam, start, { zoom: 1 }); draw(); },
    spin() { cam.auto = !cam.auto; if (cam.auto) spin(); else cancelAnimationFrame(raf); return cam.auto; },
    destroy() { stopAuto(); ro.disconnect(); },
  };
  spin();
  return api;
}
