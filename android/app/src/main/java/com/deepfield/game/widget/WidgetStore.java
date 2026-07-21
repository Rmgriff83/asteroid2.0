package com.example.asteroidzen.widget;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/**
 * Read side of the widget feed: manifest parsing, per-widget base selection
 * (widgetId -> panelKey in SharedPreferences), frame choice, and the silo
 * math mirrored from src/game/systems/baseYield.js:
 *   stored = min(capacity, floor(hoursSince(lastCollected) * ratePerHour))
 */
public final class WidgetStore {

  public static final String PREFS = "widget_prefs";

  private WidgetStore() {}

  public static File feedDir(Context ctx) {
    return new File(ctx.getFilesDir(), "widgets");
  }

  public static JSONObject readManifest(Context ctx) {
    try {
      File f = new File(feedDir(ctx), "manifest.json");
      if (!f.exists()) return null;
      byte[] bytes = Files.readAllBytes(f.toPath());
      return new JSONObject(new String(bytes, StandardCharsets.UTF_8));
    } catch (Exception e) {
      return null;
    }
  }

  public static JSONObject baseFor(Context ctx, int widgetId) {
    JSONObject manifest = readManifest(ctx);
    if (manifest == null) return null;
    try {
      JSONArray bases = manifest.getJSONArray("bases");
      if (bases.length() == 0) return null;
      String panelKey = prefs(ctx).getString(keyFor(widgetId), null);
      for (int i = 0; i < bases.length(); i++) {
        JSONObject b = bases.getJSONObject(i);
        if (b.getString("panelKey").equals(panelKey)) return b;
      }
      return bases.getJSONObject(0); // unconfigured/stale: first base
    } catch (Exception e) {
      return null;
    }
  }

  /** frame with the greatest atMs <= now, else the first frame */
  public static File frameFor(Context ctx, JSONObject base, long now) {
    try {
      JSONArray frames = base.getJSONArray("frames");
      JSONObject best = frames.getJSONObject(0);
      for (int i = 0; i < frames.length(); i++) {
        JSONObject f = frames.getJSONObject(i);
        if (f.getLong("atMs") <= now) best = f;
      }
      return new File(feedDir(ctx), best.getString("file"));
    } catch (Exception e) {
      return null;
    }
  }

  public static int storedFor(JSONObject base, long now) {
    try {
      double hrs = (now - base.getLong("lastCollected")) / 3600000.0;
      int stored = (int) Math.floor(hrs * base.getInt("ratePerHour"));
      return Math.max(0, Math.min(base.getInt("capacity"), stored));
    } catch (Exception e) {
      return 0;
    }
  }

  /** "FULL IN 1H 40M" / "SILO FULL" */
  public static String fullLabel(JSONObject base, long now) {
    long fullAt = base.optLong("siloFullAt", 0);
    long ms = fullAt - now;
    if (ms <= 0) return "SILO FULL";
    long totalM = (ms + 59999) / 60000;
    long h = totalM / 60;
    long m = totalM % 60;
    return h > 0 ? "FULL IN " + h + "H " + m + "M" : "FULL IN " + m + "M";
  }

  public static SharedPreferences prefs(Context ctx) {
    return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  public static String keyFor(int widgetId) {
    return "base_" + widgetId;
  }
}
