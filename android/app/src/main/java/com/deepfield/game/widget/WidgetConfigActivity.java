package com.deepfield.game.widget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.os.Bundle;
import android.widget.ArrayAdapter;
import android.widget.ListView;
import android.widget.TextView;

import com.deepfield.game.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;

/** Long-press → configure: pick which base this widget instance shows. */
public class WidgetConfigActivity extends Activity {

  private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setResult(RESULT_CANCELED);
    setContentView(R.layout.activity_widget_config);

    Bundle extras = getIntent().getExtras();
    if (extras != null) {
      widgetId =
          extras.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
    }
    if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
      finish();
      return;
    }

    ListView list = findViewById(R.id.config_list);
    TextView empty = findViewById(R.id.config_empty);

    JSONObject manifest = WidgetStore.readManifest(this);
    ArrayList<String> labels = new ArrayList<>();
    ArrayList<String> panelKeys = new ArrayList<>();
    try {
      JSONArray bases = manifest != null ? manifest.getJSONArray("bases") : new JSONArray();
      for (int i = 0; i < bases.length(); i++) {
        JSONObject b = bases.getJSONObject(i);
        labels.add(b.getString("name").toUpperCase() + " · " + b.getString("resourceName").toUpperCase());
        panelKeys.add(b.getString("panelKey"));
      }
    } catch (Exception ignored) {}

    if (labels.isEmpty()) {
      empty.setText("NO OUTPOSTS YET — ESTABLISH A BASE IN-GAME FIRST");
      list.setEmptyView(empty);
    }

    list.setAdapter(new ArrayAdapter<>(this, R.layout.item_widget_config, labels));
    list.setOnItemClickListener((parent, view, pos, id) -> {
      WidgetStore.prefs(this)
          .edit()
          .putString(WidgetStore.keyFor(widgetId), panelKeys.get(pos))
          .apply();
      AppWidgetManager mgr = AppWidgetManager.getInstance(this);
      mgr.updateAppWidget(widgetId, BaseWidgetProvider.buildViews(this, widgetId));
      BaseWidgetProvider.ensureWorker(this);
      Intent result = new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
      setResult(RESULT_OK, result);
      finish();
    });
  }
}
