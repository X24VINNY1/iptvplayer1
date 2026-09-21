package com.onyxstream.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.widget.Toast;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativePlayer")
public class NativePlayerPlugin extends Plugin {

    @PluginMethod
    public void playInNativePlayer(PluginCall call) {
        String url = call.getString("url");
        String title = call.getString("title", "OnyxStream");
        Boolean isLive = call.getBoolean("isLive", false);

        if (url == null || url.isEmpty()) {
            call.reject("Must provide stream URL");
            return;
        }

        try {
            Intent intent = new Intent(getContext(), NativePlayerActivity.class);
            intent.putExtra("url", url);
            intent.putExtra("title", title);
            intent.putExtra("isLive", isLive != null && isLive);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("player", "native");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to launch native player: " + e.getMessage());
        }
    }

    @PluginMethod
    public void playInVlc(PluginCall call) {
        String url = call.getString("url");
        String title = call.getString("title", "OnyxStream");

        if (url == null || url.isEmpty()) {
            call.reject("Must provide stream URL");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(Uri.parse(url), "video/*");
            intent.setPackage("org.videolan.vlc");
            intent.putExtra("title", title);
            intent.putExtra("from_start", false);
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("player", "vlc");
            call.resolve(ret);
        } catch (ActivityNotFoundException e) {
            // Fallback to chooser if VLC is not installed
            openChooser(call, url, title, "VLC Player not installed. Choose another player:");
        } catch (Exception e) {
            call.reject("Error launching VLC: " + e.getMessage());
        }
    }

    @PluginMethod
    public void playInMxPlayer(PluginCall call) {
        String url = call.getString("url");
        String title = call.getString("title", "OnyxStream");

        if (url == null || url.isEmpty()) {
            call.reject("Must provide stream URL");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(Uri.parse(url), "video/*");
            intent.setPackage("com.mxtech.videoplayer.ad");
            intent.putExtra("title", title);
            intent.putExtra("decode_mode", (byte) 2); // HW+ decoder
            getContext().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("player", "mx");
            call.resolve(ret);
        } catch (ActivityNotFoundException e) {
            try {
                // Try MX Player Pro
                Intent proIntent = new Intent(Intent.ACTION_VIEW);
                proIntent.setDataAndType(Uri.parse(url), "video/*");
                proIntent.setPackage("com.mxtech.videoplayer.pro");
                proIntent.putExtra("title", title);
                proIntent.putExtra("decode_mode", (byte) 2);
                getContext().startActivity(proIntent);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("player", "mx_pro");
                call.resolve(ret);
            } catch (ActivityNotFoundException ex) {
                openChooser(call, url, title, "MX Player not installed. Choose another player:");
            }
        } catch (Exception e) {
            call.reject("Error launching MX Player: " + e.getMessage());
        }
    }

    @PluginMethod
    public void playInChooser(PluginCall call) {
        String url = call.getString("url");
        String title = call.getString("title", "OnyxStream");

        if (url == null || url.isEmpty()) {
            call.reject("Must provide stream URL");
            return;
        }

        openChooser(call, url, title, "Play with...");
    }

    private void openChooser(PluginCall call, String url, String title, String chooserTitle) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(Uri.parse(url), "video/*");
            intent.putExtra("title", title);
            Intent chooser = Intent.createChooser(intent, chooserTitle);
            getContext().startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("player", "chooser");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open player chooser: " + e.getMessage());
        }
    }
}
