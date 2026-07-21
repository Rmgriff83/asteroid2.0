package com.deepfield.game.widget;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/**
 * Periodic (15-min floor) refresh: swaps to the pre-rendered frame closest
 * to now and recomputes the silo texts. No rendering happens here — the app
 * pre-renders the timeline; this worker only re-reads it.
 */
public class WidgetFrameWorker extends Worker {

  public WidgetFrameWorker(@NonNull Context context, @NonNull WorkerParameters params) {
    super(context, params);
  }

  @NonNull
  @Override
  public Result doWork() {
    BaseWidgetProvider.updateAll(getApplicationContext());
    return Result.success();
  }
}
