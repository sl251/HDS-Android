package io.hdsinterlude.android;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HdsRuntimePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
