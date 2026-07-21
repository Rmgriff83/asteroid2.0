package com.deepfield.game.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.deepfield.game.R;

import org.json.JSONObject;

import java.io.File;
import java.util.concurrent.TimeUnit;

/**
 * The base-window home-screen widget: full-width frame from the pre-rendered
 * feed (accurate day/night + weather for its timestamp), silo fill bar and
 * countdown computed live from timestamp math, tap deep-links into the base.
 */
public class BaseWidgetProvider extends AppWidgetProvider {

  public static final String WORK_NAME = "widget-frames";

  @Override
  public void onUpdate(Context ctx, AppWidgetManager mgr, int[] widgetIds) {
    for (int id : widgetIds) {
      mgr.updateAppWidget(id, buildViews(ctx, id));
    }
  }

  @Override
  public void onEnabled(Context ctx) {
    ensureWorker(ctx);
  }

  @Override
  public void onDisabled(Context ctx) {
    WorkManager.getInstance(ctx).cancelUniqueWork(WORK_NAME);
  }

  @Override
  public void onDeleted(Context ctx, int[] widgetIds) {
    for (int id : widgetIds) {
      WidgetStore.prefs(ctx).edit().remove(WidgetStore.keyFor(id)).apply();
    }
  }

  public static void ensureWorker(Context ctx) {
    PeriodicWorkRequest req =
        new PeriodicWorkRequest.Builder(WidgetFrameWorker.class, 15, TimeUnit.MINUTES).build();
    WorkManager.getInstance(ctx)
        .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, req);
  }

  /** refresh every placed widget (called by the worker and the feed plugin) */
  public static void updateAll(Context ctx) {
    AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
    int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, BaseWidgetProvider.class));
    for (int id : ids) {
      mgr.updateAppWidget(id, buildViews(ctx, id));
    }
  }

  static RemoteViews buildViews(Context ctx, int widgetId) {
    RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_base);
    JSONObject base = WidgetStore.baseFor(ctx, widgetId);
    long now = System.currentTimeMillis();

    if (base == null) {
      boolean hasFeed = WidgetStore.readManifest(ctx) != null;
      rv.setViewVisibility(R.id.widget_body, View.GONE);
      rv.setViewVisibility(R.id.widget_empty, View.VISIBLE);
      rv.setTextViewText(
          R.id.widget_empty, hasFeed ? "NO OUTPOSTS YET" : "OPEN DEEPFIELD");
      rv.setOnClickPendingIntent(R.id.widget_root, launchIntent(ctx, null));
      return rv;
    }

    rv.setViewVisibility(R.id.widget_body, View.VISIBLE);
    rv.setViewVisibility(R.id.widget_empty, View.GONE);

    File frame = WidgetStore.frameFor(ctx, base, now);
    if (frame != null && frame.exists()) {
      Bitmap bmp = BitmapFactory.decodeFile(frame.getAbsolutePath());
      if (bmp != null) rv.setImageViewBitmap(R.id.widget_frame, bmp);
    }

    String panelKey = base.optString("panelKey", "");
    String resName = base.optString("resourceName", "").toUpperCase();
    int stored = WidgetStore.storedFor(base, now);
    int capacity = base.optInt("capacity", 24);

    rv.setTextViewText(R.id.widget_title, base.optString("name", "OUTPOST").toUpperCase());
    rv.setTextViewText(R.id.widget_silo_text, resName + " " + stored + "/" + capacity);
    rv.setTextViewText(R.id.widget_full_in, WidgetStore.fullLabel(base, now));
    rv.setProgressBar(R.id.widget_silo_bar, capacity, stored, false);
    try {
      rv.setTextColor(R.id.widget_silo_text, Color.parseColor(base.optString("colorHex", "#ffb35c")));
    } catch (Exception ignored) {}

    rv.setOnClickPendingIntent(R.id.widget_root, launchIntent(ctx, panelKey));
    return rv;
  }

  private static PendingIntent launchIntent(Context ctx, String panelKey) {
    Intent intent;
    if (panelKey != null && !panelKey.isEmpty()) {
      intent = new Intent(Intent.ACTION_VIEW, Uri.parse("deepfield://base/" + panelKey));
      intent.setPackage(ctx.getPackageName());
    } else {
      intent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
    }
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    return PendingIntent.getActivity(
        ctx,
        panelKey == null ? 0 : panelKey.hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }
}
