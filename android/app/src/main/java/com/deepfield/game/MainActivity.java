package com.deepfield.game;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(WidgetFeedPlugin.class); // in-app plugin: widget feed writer
    super.onCreate(savedInstanceState);
  }
}
