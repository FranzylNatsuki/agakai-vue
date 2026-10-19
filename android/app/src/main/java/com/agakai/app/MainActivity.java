package com.agakai.app;

import android.media.AudioManager;
import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        registerPlugin(PermissionSettingsPlugin.class);
        super.onCreate(savedInstanceState);
        // Keep hardware volume keys on normal media volume during microphone capture.
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
    }
}
