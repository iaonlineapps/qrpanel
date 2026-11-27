package io.github.pctecnikk.qrpanel;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.text.InputType;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * App de QRPanel: la web de tu propio servidor dentro de una app, con la camara para
 * escanear, descargas a la carpeta Descargas y compartir con WhatsApp, Telegram, etc.
 * Guarda dos direcciones (la de casa y la de fuera) y usa sola la que responda.
 */
public class MainActivity extends Activity {
    private static final String K_HOME = "url_home", K_OUT = "url_out", K_LAST = "url_last";
    private static final int VIOLET = 0xFF7C3AED, BG = 0xFF0A0C13, PANEL = 0xFF131722, TEXT = 0xFFE8EAF3, MUTED = 0xFF9AA2B8;
    private static final int REQ_FILE = 10, REQ_PERM_CAMERA = 11, REQ_PERM_GEO = 12, REQ_PERM_STORAGE = 13;

    private SharedPreferences prefs;
    private FrameLayout root;
    private WebView web;
    private ProgressBar progress;
    private String base;
    private boolean errorShown;
    private ValueCallback<Uri[]> fileCb;
    private Uri photoUri;
    private PermissionRequest pendingWebPerm;
    private GeolocationPermissions.Callback geoCb;
    private String geoOrigin;
    private Runnable afterStoragePerm;
    private String startHash;
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences("qrpanel", MODE_PRIVATE);
        String l = prefs.getString("lang", "");
        EN = l.isEmpty() ? !"es".equals(java.util.Locale.getDefault().getLanguage()) : "en".equals(l);
        root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        setContentView(root);
        handleIntent(getIntent(), state);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent, null);
    }

    private void handleIntent(Intent i, Bundle state) {
        Uri d = i != null ? i.getData() : null;
        String what = d != null && "qrpanel".equals(d.getScheme()) ? d.getHost() : null;
        if ("servidor".equals(what)) { showSetup(null); return; }
        startHash = "crear".equals(what) ? "#/crear" : "escanear".equals(what) ? "#/escanear" : null;
        if (web != null && startHash != null) { web.evaluateJavascript("location.hash='" + startHash + "'", null); return; }
        if (prefs.getString(K_HOME, "").isEmpty() && prefs.getString(K_OUT, "").isEmpty()) showSetup(null);
        else connect(state);
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    static String version(Activity a) {
        try { return a.getPackageManager().getPackageInfo(a.getPackageName(), 0).versionName; } catch (Exception e) { return "?"; }
    }

    // ------------------------------------------------------------ Pantalla de conexion

    private TextView text(LinearLayout box, String s, int size, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s); t.setTextSize(size); t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        box.addView(t);
        return t;
    }

    private EditText field(LinearLayout box, String label, String hint, String value) {
        TextView l = text(box, label, 14, TEXT, true);
        l.setPadding(0, dp(14), 0, dp(6));
        EditText e = new EditText(this);
        e.setHint(hint); e.setSingleLine(true); e.setText(value);
        e.setTextColor(TEXT); e.setHintTextColor(0xFF6C748A);
        e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        e.setPadding(dp(14), dp(12), dp(14), dp(12));
        GradientDrawable g = new GradientDrawable();
        g.setColor(PANEL); g.setCornerRadius(dp(12)); g.setStroke(dp(1), 0xFF2E3649);
        e.setBackground(g);
        box.addView(e, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return e;
    }

    private void showSetup(String message) {
        if (web != null) { root.removeAllViews(); web.destroy(); web = null; }
        root.removeAllViews();
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(26), dp(44), dp(26), dp(26));
        scroll.addView(box);

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.mipmap.ic_launcher);
        LinearLayout.LayoutParams llp = new LinearLayout.LayoutParams(dp(84), dp(84));
        llp.gravity = Gravity.CENTER_HORIZONTAL;
        box.addView(logo, llp);
        TextView title = text(box, "QRPanel", 28, TEXT, true);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(10), 0, dp(4));
        TextView sub = text(box, t("Tu propio generador de códigos QR", "Your own QR code generator"), 15, MUTED, false);
        sub.setGravity(Gravity.CENTER);
        sub.setPadding(0, 0, 0, dp(18));

        TextView need = text(box, t("Esta app entra en tu propio servidor QRPanel (una Raspberry Pi o un ordenador con Docker). ", "This app connects to your own QRPanel server (a Raspberry Pi or a computer with Docker). ")
                + t("Sin servidor no funciona. ¿Aún no lo tienes? Toca aquí para ver cómo instalarlo.", "It doesn't work without a server. Don't have one yet? Tap here to see how to install it."), 14, 0xFFFBBF24, false);
        need.setPadding(dp(14), dp(12), dp(14), dp(12));
        GradientDrawable nbg = new GradientDrawable();
        nbg.setColor(0xFF33270B); nbg.setCornerRadius(dp(12));
        need.setBackground(nbg);
        need.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            openExternal("https://github.com/iaonlineapps/qrpanel#2-instalar");
        } });

        final EditText home = field(box, t("En casa (con tu wifi)", "At home (on your WiFi)"), "192.168.1.x:8091", prefs.getString(K_HOME, ""));
        text(box, t("La IP de tu servidor y el puerto. Solo funciona conectado a la wifi de casa.", "Your server's IP and port. Only works on your home WiFi."), 13, MUTED, false).setPadding(0, dp(6), 0, 0);
        final EditText out = field(box, t("Fuera de casa (tu dominio)", "Away from home (your domain)"), "https://qr.midominio.com", prefs.getString(K_OUT, ""));
        text(box, t("Opcional. Tu dirección pública con https, para usarla con datos móviles. ", "Optional. Your public https address, to use it on mobile data. ")
                + t("Si pones las dos, la app usa sola la que funcione.", "If you set both, the app uses whichever works."), 13, MUTED, false).setPadding(0, dp(6), 0, 0);

        final TextView status = text(box, message != null ? message : "", 14, 0xFFFB7185, false);
        status.setGravity(Gravity.CENTER);
        status.setPadding(0, dp(14), 0, dp(10));

        final Button go = new Button(this);
        go.setText(t("Conectar", "Connect"));
        go.setTextColor(Color.WHITE);
        go.setAllCaps(false);
        go.setTextSize(16);
        GradientDrawable gb = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{0xFF7C3AED, 0xFF2563EB, 0xFF06B6D4});
        gb.setCornerRadius(dp(14));
        go.setBackground(gb);
        box.addView(go, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54)));
        go.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            final String h = normalize(home.getText().toString()), o = normalize(out.getText().toString());
            if (h == null && o == null) { status.setText(t("Escribe al menos una dirección.", "Enter at least one address.")); return; }
            go.setEnabled(false);
            status.setTextColor(MUTED);
            status.setText(t("Comprobando…", "Checking…"));
            new Thread(new Runnable() { @Override public void run() {
                final String eh = h != null ? check(h, 6000) : null, eo = o != null ? check(o, 8000) : null;
                main.post(new Runnable() { @Override public void run() {
                    go.setEnabled(true);
                    boolean okH = h != null && eh == null, okO = o != null && eo == null;
                    if (okH || okO) {
                        prefs.edit().putString(K_HOME, h == null ? "" : h).putString(K_OUT, o == null ? "" : o).apply();
                        showWeb(okH ? h : o, null);
                        if (h != null && o != null && !(okH && okO))
                            toast(okH ? t("La dirección de fuera no responde ahora; se guardará igual.", "The away address isn't responding now; it will be saved anyway.") : t("Ahora no estás en la wifi de casa: uso la de fuera.", "You're not on your home WiFi now: using the away one."));
                        return;
                    }
                    status.setTextColor(0xFFFB7185);
                    status.setText(eh != null ? eh : eo);
                    new AlertDialog.Builder(MainActivity.this)
                            .setTitle(t("No se ha podido comprobar", "Couldn't check"))
                            .setMessage((eh != null ? eh : eo) + t("\n\n¿Quieres guardarla de todas formas?", "\n\nDo you want to save it anyway?"))
                            .setPositiveButton(t("Guardar", "Save"), new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface d, int w) {
                                prefs.edit().putString(K_HOME, h == null ? "" : h).putString(K_OUT, o == null ? "" : o).apply();
                                showWeb(h != null ? h : o, null);
                            } })
                            .setNegativeButton(t("Corregir", "Fix"), null).show();
                } });
            } }).start();
        } });

        TextView help = text(box, t("\nDespués entras con tu usuario y contraseña de QRPanel. Para cambiar las direcciones, ", "\nThen sign in with your QRPanel username and password. To change the addresses, ")
                + t("pulsa Atrás en la pantalla principal o mantén pulsado el icono y elige «Cambiar servidor».", "press Back on the main screen or long-press the icon and choose «Change server»."), 13, MUTED, false);
        help.setGravity(Gravity.CENTER);
        TextView ver = text(box, t("\nApp versión ", "\nApp version ") + version(this) + t(" · Ver novedades", " · What's new"), 13, 0xFFA78BFA, false);
        ver.setGravity(Gravity.CENTER);
        ver.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { showNews(); } });
        root.addView(scroll);
    }

    static String normalize(String s) {
        if (s == null) return null;
        s = s.trim();
        if (s.isEmpty() || s.contains(" ")) return null;
        if (!s.matches("(?i)^https?://.*")) s = "http://" + s;
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        Uri u = Uri.parse(s);
        return u.getHost() == null || u.getHost().isEmpty() ? null : s;
    }

    /** Comprueba que en esa direccion hay un QRPanel. Devuelve null si va bien o el motivo del fallo. */
    private String check(String url, int timeout) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url + "/api/info").openConnection();
            c.setConnectTimeout(timeout);
            c.setReadTimeout(timeout);
            int code = c.getResponseCode();
            if (code != 200) return t("El servidor ha respondido con un error (", "The server replied with an error (") + code + ").";
            BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
            String body = r.readLine();
            r.close();
            return body != null && body.contains("\"qrpanel\"") ? null : t("Esa dirección responde, pero no es un QRPanel.", "That address responds, but it isn't a QRPanel.");
        } catch (javax.net.ssl.SSLException e) {
            return t("Problema con el certificado https del servidor.", "Problem with the server's https certificate.");
        } catch (java.net.UnknownHostException e) {
            return t("No encuentro esa dirección. Revisa que esté bien escrita.", "I can't find that address. Check it's written correctly.");
        } catch (Exception e) {
            return t("No puedo conectar. Si es la IP de casa, mira que estés en la wifi de casa.", "I can't connect. If it's the home IP, check you're on your home WiFi.");
        } finally {
            if (c != null) c.disconnect();
        }
    }

    /** Elige la direccion que responda: primero la de casa (rapido) y si no, la de fuera. */
    private void connect(final Bundle state) {
        final String h = prefs.getString(K_HOME, ""), o = prefs.getString(K_OUT, "");
        if (h.isEmpty() || o.isEmpty()) { showWeb(h.isEmpty() ? o : h, state); return; }
        showLoading();
        new Thread(new Runnable() { @Override public void run() {
            final String use = check(h, 2500) == null ? h : o;
            main.post(new Runnable() { @Override public void run() { showWeb(use, state); } });
        } }).start();
    }

    private void showLoading() {
        root.removeAllViews();
        ProgressBar p = new ProgressBar(this);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(48), dp(48));
        lp.gravity = Gravity.CENTER;
        root.addView(p, lp);
    }

    // ------------------------------------------------------------------ La web

    private void showWeb(String url, Bundle state) {
        base = url;
        prefs.edit().putString(K_LAST, url).apply();
        root.removeAllViews();
        errorShown = false;
        web = new WebView(this);
        web.setBackgroundColor(BG);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(progress, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setGeolocationEnabled(true);
        s.setUserAgentString(s.getUserAgentString() + " QRPanelApp/" + version(this));
        CookieManager.getInstance().setAcceptCookie(true);
        web.addJavascriptInterface(new Bridge(), "QRPanelAndroid");

        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                Uri b = Uri.parse(base);
                boolean same = u.getHost() != null && u.getHost().equals(b.getHost()) && u.getPort() == b.getPort()
                        && !u.getPath().startsWith("/r/") && !u.getPath().startsWith("/s/");
                if (same) return false;
                openExternal(u.toString());
                return true;
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) showConnectionError();
            }
            @Override public void onPageFinished(WebView v, String url) {
                progress.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView v, int p) {
                progress.setVisibility(p < 100 ? View.VISIBLE : View.GONE);
                progress.setProgress(p);
            }
            @Override public void onPermissionRequest(final PermissionRequest r) {
                main.post(new Runnable() { @Override public void run() {
                    if (has(Manifest.permission.CAMERA)) r.grant(r.getResources());
                    else { pendingWebPerm = r; requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_PERM_CAMERA); }
                } });
            }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                if (has(Manifest.permission.ACCESS_FINE_LOCATION)) cb.invoke(origin, true, false);
                else {
                    geoCb = cb; geoOrigin = origin;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_PERM_GEO);
                }
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                if (p.isCaptureEnabled() && !has(Manifest.permission.CAMERA)) {
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_PERM_CAMERA);
                    fileCb.onReceiveValue(null); fileCb = null;
                    toast(t("Da permiso a la cámara y vuelve a pulsar.", "Allow the camera and tap again."));
                    return true;
                }
                openChooser(p.isCaptureEnabled());
                return true;
            }
        });

        if (state != null) web.restoreState(state);
        else web.loadUrl(base + "/" + (startHash != null ? startHash : ""));
        startHash = null;
    }

    private void openChooser(boolean capture) {
        Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
        pick.addCategory(Intent.CATEGORY_OPENABLE);
        pick.setType("image/*");
        Intent chooser = Intent.createChooser(pick, t("Elige una imagen", "Choose an image"));
        photoUri = null;
        if (has(Manifest.permission.CAMERA)) {
            try {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Images.Media.DISPLAY_NAME, "qrpanel-" + System.currentTimeMillis() + ".jpg");
                cv.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                if (Build.VERSION.SDK_INT >= 29) cv.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/QRPanel");
                photoUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                cam.putExtra(MediaStore.EXTRA_OUTPUT, photoUri);
                if (capture) chooser = cam;
                else chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cam});
            } catch (Exception e) { photoUri = null; }
        }
        try { startActivityForResult(chooser, REQ_FILE); }
        catch (ActivityNotFoundException e) { fileCb.onReceiveValue(null); fileCb = null; toast(t("No hay ninguna app para elegir imágenes.", "There is no app to choose images.")); }
    }

    @Override
    protected void onActivityResult(int req, int result, Intent data) {
        if (req != REQ_FILE || fileCb == null) { super.onActivityResult(req, result, data); return; }
        Uri[] res = null;
        if (result == RESULT_OK) {
            if (data != null && data.getData() != null) res = new Uri[]{data.getData()};
            else if (photoUri != null) res = new Uri[]{photoUri};
        } else if (photoUri != null) {
            try { getContentResolver().delete(photoUri, null, null); } catch (Exception ignored) { }
        }
        fileCb.onReceiveValue(res);
        fileCb = null;
    }

    private boolean has(String perm) { return checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED; }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        boolean ok = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
        if (code == REQ_PERM_CAMERA && pendingWebPerm != null) {
            if (ok) pendingWebPerm.grant(pendingWebPerm.getResources()); else pendingWebPerm.deny();
            pendingWebPerm = null;
        } else if (code == REQ_PERM_GEO && geoCb != null) {
            geoCb.invoke(geoOrigin, ok, false);
            geoCb = null;
        } else if (code == REQ_PERM_STORAGE && afterStoragePerm != null) {
            if (ok) afterStoragePerm.run(); else toast(t("Sin permiso no puedo guardar en Descargas.", "Without permission I can't save to Downloads."));
            afterStoragePerm = null;
        }
    }

    private void showConnectionError() {
        if (errorShown || isFinishing()) return;
        errorShown = true;
        final String other = base.equals(prefs.getString(K_HOME, "")) ? prefs.getString(K_OUT, "") : prefs.getString(K_HOME, "");
        AlertDialog.Builder b = new AlertDialog.Builder(this)
                .setTitle(t("No se puede conectar", "Can't connect"))
                .setMessage(t("QRPanel no responde en ", "QRPanel isn't responding at ") + base + t(".\n\nSi es la dirección de casa, comprueba que estás en tu wifi.", ".\n\nIf it's the home address, check you're on your WiFi."))
                .setPositiveButton(t("Reintentar", "Retry"), new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface d, int w) { errorShown = false; web.reload(); } })
                .setNegativeButton(t("Cambiar servidor", "Change server"), new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface d, int w) { showSetup(null); } });
        if (!other.isEmpty()) b.setNeutralButton(t("Usar la otra", "Use the other one"), new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface d, int w) { showWeb(other, null); } });
        b.setCancelable(false).show();
    }

    // ------------------------------------------------- Puente con la web (descargas y compartir)

    public final class Bridge {
        @JavascriptInterface public String version() { return MainActivity.version(MainActivity.this); }

        @JavascriptInterface public void saveFile(final String b64, final String name, final String mime) {
            final byte[] data = Base64.decode(b64, Base64.DEFAULT);
            main.post(new Runnable() { @Override public void run() { save(data, clean(name), mime); } });
        }

        @JavascriptInterface public void shareFile(final String b64, final String name, final String mime, final String text) {
            final byte[] data = Base64.decode(b64, Base64.DEFAULT);
            main.post(new Runnable() { @Override public void run() { share(data, clean(name), mime, text); } });
        }

        @JavascriptInterface public void shareText(final String text) {
            main.post(new Runnable() { @Override public void run() {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(i, t("Compartir", "Share")));
            } });
        }

        @JavascriptInterface public void changeServer() {
            main.post(new Runnable() { @Override public void run() { showSetup(null); } });
        }

        @JavascriptInterface public void setLang(final String l) {
            if (!"es".equals(l) && !"en".equals(l)) return;
            prefs.edit().putString("lang", l).apply();
            EN = "en".equals(l);
        }

        @JavascriptInterface public void news() {
            main.post(new Runnable() { @Override public void run() { showNews(); } });
        }
    }

    static String clean(String n) {
        n = n == null ? "qr" : n.replaceAll("[^A-Za-z0-9._-]", "_");
        return n.isEmpty() ? "qr" : n;
    }

    private void save(final byte[] data, final String name, final String mime) {
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
                cv.put(MediaStore.Downloads.MIME_TYPE, mime);
                cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/QRPanel");
                Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                OutputStream o = getContentResolver().openOutputStream(u);
                o.write(data);
                o.close();
            } else {
                if (!has(Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
                    afterStoragePerm = new Runnable() { @Override public void run() { save(data, name, mime); } };
                    requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_PERM_STORAGE);
                    return;
                }
                File d = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "QRPanel");
                d.mkdirs();
                FileOutputStream o = new FileOutputStream(new File(d, name));
                o.write(data);
                o.close();
            }
            toast(t("Guardado en Descargas/QRPanel: ", "Saved in Downloads/QRPanel: ") + name);
        } catch (Exception e) {
            toast(t("No se pudo guardar el archivo.", "Couldn't save the file."));
        }
    }

    private void share(byte[] data, String name, String mime, String text) {
        try {
            File d = Archivos.dir(this);
            File[] old = d.listFiles();
            if (old != null) for (File f : old) if (System.currentTimeMillis() - f.lastModified() > 3600_000L) f.delete();
            File f = new File(d, name);
            FileOutputStream o = new FileOutputStream(f);
            o.write(data);
            o.close();
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType(mime);
            i.putExtra(Intent.EXTRA_STREAM, Archivos.uri(f));
            if (text != null && !text.isEmpty()) i.putExtra(Intent.EXTRA_TEXT, text);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(i, t("Compartir QR", "Share QR")));
        } catch (Exception e) {
            toast(t("No se pudo compartir.", "Couldn't share."));
        }
    }

    private void openExternal(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        catch (ActivityNotFoundException e) { toast(t("No hay ninguna app para abrir esto.", "There is no app to open this.")); }
    }

    // ------------------------------------------------------------------ Varios

    /** Idioma de la app: el elegido en la web (Ajustes → Idioma) o el del móvil. */
    static boolean EN = false;
    static String t(String es, String en) { return EN ? en : es; }

    private void showNews() {
        StringBuilder sb = new StringBuilder();
        try {
            InputStream in = getResources().openRawResource(R.raw.novedades);
            BufferedReader r = new BufferedReader(new InputStreamReader(in, "UTF-8"));
            String line;
            while ((line = r.readLine()) != null) {
                if (line.startsWith("# ")) continue;
                if (line.startsWith("## ")) line = "\n" + line.substring(3).toUpperCase();
                else if (line.startsWith("- ")) line = "•  " + line.substring(2);
                sb.append(line).append('\n');
            }
            r.close();
        } catch (Exception ignored) { }
        new AlertDialog.Builder(this).setTitle(t("Novedades · app ", "What's new · app ") + version(this))
                .setMessage(sb.toString().trim())
                .setPositiveButton(t("Vale", "OK"), null)
                .setNeutralButton("Ver en GitHub", new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface d, int w) {
                    openExternal("https://github.com/iaonlineapps/qrpanel/releases");
                } }).show();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) { web.goBack(); return; }
        if (web == null) { super.onBackPressed(); return; }
        new AlertDialog.Builder(this).setTitle("QRPanel · app " + version(this))
                .setItems(new CharSequence[]{t("Salir", "Exit"), t("Cambiar servidor", "Change server"), t("Recargar", "Reload"), t("Novedades", "What's new")}, new DialogInterface.OnClickListener() {
                    @Override public void onClick(DialogInterface d, int which) {
                        if (which == 0) finish();
                        else if (which == 1) showSetup(null);
                        else if (which == 2) web.reload();
                        else showNews();
                    }
                }).show();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override protected void onPause() { super.onPause(); if (web != null) web.onPause(); CookieManager.getInstance().flush(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() { if (web != null) web.destroy(); super.onDestroy(); }

    private void toast(String msg) { Toast.makeText(this, msg, Toast.LENGTH_LONG).show(); }
}
