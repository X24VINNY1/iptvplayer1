package com.onyxstream.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            if (bridge != null && bridge.getWebView() != null) {
                WebView webView = bridge.getWebView();
                WebSettings settings = webView.getSettings();
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setDomStorageEnabled(true);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
