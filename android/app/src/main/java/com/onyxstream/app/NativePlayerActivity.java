package com.onyxstream.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.VideoView;
import java.util.HashMap;
import java.util.Map;

public class NativePlayerActivity extends Activity {
    private VideoView videoView;
    private ProgressBar loadingSpinner;
    private FrameLayout overlayContainer;
    private TextView titleTextView;
    private TextView timeTextView;
    private TextView playPauseBtn;
    private SeekBar seekBar;
    private LinearLayout topBar;
    private LinearLayout bottomBar;

    private String streamUrl;
    private String streamTitle;
    private boolean isLive = false;

    private final Handler hideHandler = new Handler(Looper.getMainLooper());
    private final Handler progressHandler = new Handler(Looper.getMainLooper());
    private boolean isControlsVisible = true;
    private boolean isDraggingSeek = false;

    private final Runnable hideControlsRunnable = new Runnable() {
        @Override
        public void run() {
            if (videoView != null && videoView.isPlaying()) {
                hideControls();
            }
        }
    };

    private final Runnable updateProgressRunnable = new Runnable() {
        @Override
        public void run() {
            if (videoView != null && !isDraggingSeek) {
                int current = videoView.getCurrentPosition();
                int duration = videoView.getDuration();

                if (!isLive && duration > 0) {
                    seekBar.setMax(duration);
                    seekBar.setProgress(current);
                    timeTextView.setText(formatTime(current) + " / " + formatTime(duration));
                } else if (isLive) {
                    timeTextView.setText("LIVE STREAM");
                }
            }
            progressHandler.postDelayed(this, 1000);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Fullscreen flags
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        }

        Intent intent = getIntent();
        streamUrl = intent.getStringExtra("url");
        streamTitle = intent.getStringExtra("title");
        isLive = intent.getBooleanExtra("isLive", false);

        if (streamTitle == null || streamTitle.isEmpty()) {
            streamTitle = "OnyxStream Player";
        }

        buildPlayerUI();
        startPlayback();
    }

    private void buildPlayerUI() {
        FrameLayout rootLayout = new FrameLayout(this);
        rootLayout.setBackgroundColor(Color.BLACK);

        // 1. Native VideoView
        videoView = new VideoView(this);
        FrameLayout.LayoutParams videoParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
            Gravity.CENTER
        );
        rootLayout.addView(videoView, videoParams);

        // 2. Buffering Loading Spinner
        loadingSpinner = new ProgressBar(this);
        FrameLayout.LayoutParams spinnerParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER
        );
        rootLayout.addView(loadingSpinner, spinnerParams);

        // 3. Overlay Container
        overlayContainer = new FrameLayout(this);
        FrameLayout.LayoutParams overlayParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        );
        rootLayout.addView(overlayContainer, overlayParams);

        // Top Bar
        topBar = new LinearLayout(this);
        topBar.setOrientation(LinearLayout.HORIZONTAL);
        topBar.setGravity(Gravity.CENTER_VERTICAL);
        topBar.setPadding(dp(20), dp(16), dp(20), dp(24));

        GradientDrawable topGradient = new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[]{Color.parseColor("#E6000000"), Color.TRANSPARENT}
        );
        topBar.setBackground(topGradient);

        // Back Button
        TextView backBtn = createButton("← Back", Color.parseColor("#33FFFFFF"), Color.WHITE);
        backBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
        topBar.addView(backBtn);

        // Title
        titleTextView = new TextView(this);
        titleTextView.setText(streamTitle);
        titleTextView.setTextColor(Color.WHITE);
        titleTextView.setTextSize(18);
        titleTextView.setTypeface(Typeface.DEFAULT_BOLD);
        titleTextView.setSingleLine(true);
        titleTextView.setPadding(dp(16), 0, dp(16), 0);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
        topBar.addView(titleTextView, titleParams);

        // "Open in VLC" Button
        TextView vlcBtn = createButton("🟧 Open in VLC", Color.parseColor("#F97316"), Color.WHITE);
        vlcBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                launchExternal("org.videolan.vlc", "VLC Player");
            }
        });
        topBar.addView(vlcBtn);

        // Margin spacer
        View spacer = new View(this);
        topBar.addView(spacer, new LinearLayout.LayoutParams(dp(8), dp(1)));

        // "Open in MX" Button
        TextView mxBtn = createButton("🟦 Open in MX", Color.parseColor("#2563EB"), Color.WHITE);
        mxBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                launchExternal("com.mxtech.videoplayer.ad", "MX Player");
            }
        });
        topBar.addView(mxBtn);

        FrameLayout.LayoutParams topBarParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.TOP
        );
        overlayContainer.addView(topBar, topBarParams);

        // Bottom Bar
        bottomBar = new LinearLayout(this);
        bottomBar.setOrientation(LinearLayout.VERTICAL);
        bottomBar.setPadding(dp(24), dp(24), dp(24), dp(20));

        GradientDrawable bottomGradient = new GradientDrawable(
            GradientDrawable.Orientation.BOTTOM_TOP,
            new int[]{Color.parseColor("#F2000000"), Color.TRANSPARENT}
        );
        bottomBar.setBackground(bottomGradient);

        // Seek Bar (if VOD)
        if (!isLive) {
            seekBar = new SeekBar(this);
            seekBar.setPadding(0, dp(8), 0, dp(8));
            seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
                @Override
                public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                    if (fromUser) {
                        timeTextView.setText(formatTime(progress) + " / " + formatTime(videoView.getDuration()));
                    }
                }

                @Override
                public void onStartTrackingTouch(SeekBar seekBar) {
                    isDraggingSeek = true;
                    scheduleHideControls();
                }

                @Override
                public void onStopTrackingTouch(SeekBar seekBar) {
                    isDraggingSeek = false;
                    videoView.seekTo(seekBar.getProgress());
                    scheduleHideControls();
                }
            });
            bottomBar.addView(seekBar, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ));
        }

        // Bottom Controls Row
        LinearLayout controlsRow = new LinearLayout(this);
        controlsRow.setOrientation(LinearLayout.HORIZONTAL);
        controlsRow.setGravity(Gravity.CENTER_VERTICAL);
        controlsRow.setPadding(0, dp(6), 0, 0);

        playPauseBtn = createButton("⏸ Pause", Color.parseColor("#4F46E5"), Color.WHITE);
        playPauseBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                togglePlayPause();
            }
        });
        controlsRow.addView(playPauseBtn);

        timeTextView = new TextView(this);
        timeTextView.setTextColor(Color.parseColor("#CCCCCC"));
        timeTextView.setTextSize(14);
        timeTextView.setPadding(dp(16), 0, 0, 0);
        timeTextView.setText(isLive ? "LIVE STREAM" : "00:00 / 00:00");
        controlsRow.addView(timeTextView);

        bottomBar.addView(controlsRow);

        FrameLayout.LayoutParams bottomBarParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM
        );
        overlayContainer.addView(bottomBar, bottomBarParams);

        setContentView(rootLayout);

        // Touch anywhere to toggle controls
        rootLayout.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                if (event.getAction() == MotionEvent.ACTION_UP) {
                    toggleControls();
                }
                return true;
            }
        });
    }

    private TextView createButton(String text, int bgColor, int textColor) {
        TextView btn = new TextView(this);
        btn.setText(text);
        btn.setTextColor(textColor);
        btn.setTextSize(13);
        btn.setTypeface(Typeface.DEFAULT_BOLD);
        btn.setPadding(dp(14), dp(8), dp(14), dp(8));
        btn.setFocusable(true);
        btn.setClickable(true);

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(bgColor);
        bg.setCornerRadius(dp(8));
        btn.setBackground(bg);

        btn.setOnFocusChangeListener(new View.OnFocusChangeListener() {
            @Override
            public void onFocusChange(View v, boolean hasFocus) {
                if (hasFocus) {
                    v.setScaleX(1.1f);
                    v.setScaleY(1.1f);
                } else {
                    v.setScaleX(1.0f);
                    v.setScaleY(1.0f);
                }
            }
        });

        return btn;
    }

    private void startPlayback() {
        if (streamUrl == null || streamUrl.isEmpty()) {
            Toast.makeText(this, "Error: Invalid stream URL", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        loadingSpinner.setVisibility(View.VISIBLE);

        Map<String, String> headers = new HashMap<>();
        headers.put("User-Agent", "OnyxStream/1.0 (Android TV; ExoPlayer)");

        Uri uri = Uri.parse(streamUrl);
        videoView.setVideoURI(uri, headers);

        videoView.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
            @Override
            public void onPrepared(MediaPlayer mp) {
                loadingSpinner.setVisibility(View.GONE);
                videoView.start();
                updatePlayPauseState(true);
                progressHandler.post(updateProgressRunnable);
                scheduleHideControls();
            }
        });

        videoView.setOnErrorListener(new MediaPlayer.OnErrorListener() {
            @Override
            public boolean onError(MediaPlayer mp, int what, int extra) {
                loadingSpinner.setVisibility(View.GONE);
                Toast.makeText(NativePlayerActivity.this, "Native playback error. Launching in VLC / MX...", Toast.LENGTH_SHORT).show();
                launchExternal(null, "External Player");
                return true;
            }
        });

        videoView.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
            @Override
            public void onCompletion(MediaPlayer mp) {
                if (!isLive) {
                    finish();
                }
            }
        });
    }

    private void togglePlayPause() {
        if (videoView == null) return;
        if (videoView.isPlaying()) {
            videoView.pause();
            updatePlayPauseState(false);
            showControls();
        } else {
            videoView.start();
            updatePlayPauseState(true);
            scheduleHideControls();
        }
    }

    private void updatePlayPauseState(boolean isPlaying) {
        if (playPauseBtn != null) {
            playPauseBtn.setText(isPlaying ? "⏸ Pause" : "▶ Play");
        }
    }

    private void toggleControls() {
        if (isControlsVisible) {
            hideControls();
        } else {
            showControls();
        }
    }

    private void showControls() {
        overlayContainer.setVisibility(View.VISIBLE);
        isControlsVisible = true;
        scheduleHideControls();
    }

    private void hideControls() {
        overlayContainer.setVisibility(View.GONE);
        isControlsVisible = false;
        hideHandler.removeCallbacks(hideControlsRunnable);
    }

    private void scheduleHideControls() {
        hideHandler.removeCallbacks(hideControlsRunnable);
        hideHandler.postDelayed(hideControlsRunnable, 4500);
    }

    private void launchExternal(String targetPackage, String appName) {
        if (streamUrl == null) return;
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(Uri.parse(streamUrl), "video/*");
            intent.putExtra("title", streamTitle);
            intent.putExtra("from_start", false);
            intent.putExtra("position", videoView != null ? videoView.getCurrentPosition() : 0);

            if (targetPackage != null) {
                intent.setPackage(targetPackage);
                startActivity(intent);
            } else {
                startActivity(Intent.createChooser(intent, "Play Stream with..."));
            }
            finish();
        } catch (ActivityNotFoundException e) {
            // If specified package isn't installed, launch system chooser
            try {
                Intent chooser = new Intent(Intent.ACTION_VIEW);
                chooser.setDataAndType(Uri.parse(streamUrl), "video/*");
                chooser.putExtra("title", streamTitle);
                startActivity(Intent.createChooser(chooser, "Choose Player (VLC, MX, etc.):"));
                finish();
            } catch (Exception ex) {
                Toast.makeText(this, appName + " is not installed on this device.", Toast.LENGTH_SHORT).show();
            }
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        showControls();

        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                togglePlayPause();
                return true;

            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_MEDIA_REWIND:
                if (!isLive && videoView != null) {
                    int pos = Math.max(0, videoView.getCurrentPosition() - 10000);
                    videoView.seekTo(pos);
                    return true;
                }
                break;

            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                if (!isLive && videoView != null) {
                    int pos = Math.min(videoView.getDuration(), videoView.getCurrentPosition() + 10000);
                    videoView.seekTo(pos);
                    return true;
                }
                break;

            case KeyEvent.KEYCODE_BACK:
                finish();
                return true;
        }

        return super.onKeyDown(keyCode, event);
    }

    private String formatTime(int ms) {
        if (ms <= 0) return "00:00";
        int totalSeconds = ms / 1000;
        int hours = totalSeconds / 3600;
        int minutes = (totalSeconds % 3600) / 60;
        int seconds = totalSeconds % 60;
        if (hours > 0) {
            return String.format("%d:%02d:%02d", hours, minutes, seconds);
        } else {
            return String.format("%02d:%02d", minutes, seconds);
        }
    }

    private int dp(int dp) {
        return (int) (dp * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (videoView != null && videoView.isPlaying()) {
            videoView.pause();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        progressHandler.removeCallbacks(updateProgressRunnable);
        hideHandler.removeCallbacks(hideControlsRunnable);
        if (videoView != null) {
            videoView.stopPlayback();
        }
    }
}
