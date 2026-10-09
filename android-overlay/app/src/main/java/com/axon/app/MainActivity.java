package com.axon.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import com.axon.app.background.BackgroundJobsPlugin;
import com.axon.app.filesaver.FileSaverPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackgroundJobsPlugin.class);
        registerPlugin(FileSaverPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
