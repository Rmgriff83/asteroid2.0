package com.example.asteroidzen;

import android.util.Base64;

import com.example.asteroidzen.widget.BaseWidgetProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

/**
 * In-app Capacitor plugin: receives pre-rendered widget frames + manifest
 * from the web layer and stores them where the widget provider (same
 * process/uid) can read them: filesDir/widgets/.
 */
@CapacitorPlugin(name = "WidgetFeed")
public class WidgetFeedPlugin extends Plugin {

  public static final String DIR = "widgets";
  public static final String MANIFEST = "manifest.json";

  private File widgetsDir() {
    File dir = new File(getContext().getFilesDir(), DIR);
    if (!dir.exists()) dir.mkdirs();
    return dir;
  }

  @PluginMethod
  public void write(PluginCall call) {
    try {
      File root = widgetsDir();
      JSArray files = call.getArray("files");
      if (files != null) {
        for (int i = 0; i < files.length(); i++) {
          JSONObject f = files.getJSONObject(i);
          String rel = f.getString("path");
          if (rel.contains("..")) continue; // stay inside the feed dir
          byte[] bytes = Base64.decode(f.getString("dataB64"), Base64.DEFAULT);
          File out = new File(root, rel);
          File parent = out.getParentFile();
          if (parent != null && !parent.exists()) parent.mkdirs();
          try (FileOutputStream fos = new FileOutputStream(out)) {
            fos.write(bytes);
          }
        }
      }
      String manifestJson = call.getString("manifestJson");
      if (manifestJson != null) {
        // manifest written last + atomically: widgets never see a half feed
        File tmp = new File(root, MANIFEST + ".tmp");
        try (FileOutputStream fos = new FileOutputStream(tmp)) {
          fos.write(manifestJson.getBytes(StandardCharsets.UTF_8));
        }
        tmp.renameTo(new File(root, MANIFEST));
        pruneStaleBaseDirs(root, manifestJson);
      }
      call.resolve();
    } catch (Exception e) {
      call.reject("widget feed write failed", e);
    }
  }

  @PluginMethod
  public void reloadWidgets(PluginCall call) {
    BaseWidgetProvider.updateAll(getContext());
    BaseWidgetProvider.ensureWorker(getContext());
    call.resolve();
  }

  private void pruneStaleBaseDirs(File root, String manifestJson) throws IOException {
    Set<String> keep = new HashSet<>();
    try {
      JSONObject manifest = new JSONObject(manifestJson);
      org.json.JSONArray bases = manifest.getJSONArray("bases");
      for (int i = 0; i < bases.length(); i++) {
        keep.add("b_" + bases.getJSONObject(i).getString("panelKey").replace(",", "_"));
      }
    } catch (Exception ignored) {
      return;
    }
    File[] children = root.listFiles();
    if (children == null) return;
    for (File c : children) {
      if (c.isDirectory() && c.getName().startsWith("b_") && !keep.contains(c.getName())) {
        File[] frames = c.listFiles();
        if (frames != null) for (File f : frames) f.delete();
        c.delete();
      }
    }
  }
}
