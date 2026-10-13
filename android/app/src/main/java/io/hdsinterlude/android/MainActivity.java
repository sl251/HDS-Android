package io.hdsinterlude.android;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.content.res.Configuration;
import android.graphics.Color;
import android.view.View;
import android.view.WindowManager;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HdsRuntimePlugin.class);
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        // Own system bars/cutout here; Capacitor's CONSUMED listener is disabled in config.
        View container = (View) bridge.getWebView().getParent();
        final int left = container.getPaddingLeft(), top = container.getPaddingTop();
        final int right = container.getPaddingRight(), bottom = container.getPaddingBottom();
        ViewCompat.setOnApplyWindowInsetsListener(container, (view, windowInsets) -> {
            int types = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
            Insets bars = windowInsets.getInsets(types);
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            view.setPadding(left + bars.left, top + bars.top, right + bars.right,
                bottom + Math.max(bars.bottom, ime.bottom));
            // Keep IME information for WebView viewport updates; zero only our bar types.
            bridge.getWebView().evaluateJavascript("document.documentElement.classList.toggle('ime-visible', "
                + windowInsets.isVisible(WindowInsetsCompat.Type.ime()) + ");", null);
            return new WindowInsetsCompat.Builder(windowInsets).setInsets(types, Insets.NONE)
                .setInsetsIgnoringVisibility(types, Insets.NONE).build();
        });
        updateSystemBars(container);
        ViewCompat.requestApplyInsets(container);
    }
    private void updateSystemBars(View container) {
        boolean dark = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        container.setBackgroundColor(Color.parseColor(dark ? "#20241f" : "#f5f3ed"));
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), container);
        controller.setAppearanceLightStatusBars(!dark);
        controller.setAppearanceLightNavigationBars(!dark);
    }
    @Override public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        if (bridge != null) {
            View container = (View) bridge.getWebView().getParent();
            updateSystemBars(container);
            ViewCompat.requestApplyInsets(container);
        }
    }
}
