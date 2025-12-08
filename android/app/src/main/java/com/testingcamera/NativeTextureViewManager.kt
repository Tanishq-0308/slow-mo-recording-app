package com.testingcamera

import android.view.Surface
import android.view.TextureView
import android.graphics.SurfaceTexture
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class NativeTextureViewManager : SimpleViewManager<TextureView>() {

    override fun getName() = "NativeTextureView"

    override fun createViewInstance(reactContext: ThemedReactContext): TextureView {
        val view = TextureView(reactContext)

        view.surfaceTextureListener = object : TextureView.SurfaceTextureListener {

            override fun onSurfaceTextureAvailable(surfaceTexture: SurfaceTexture, w: Int, h: Int) {
                // Force surface size to match high-speed camera resolution
                val width = 1920
                val height = 1080

                // Set the default buffer size for SurfaceTexture
                surfaceTexture.setDefaultBufferSize(width, height)

                // create a Surface
                val surface = Surface(surfaceTexture)

                // Save globally
                NativeTextureRegistry.previewSurface = surface

                // Emit the event to JS that the surface is ready
                val event = Arguments.createMap().apply {
                    putInt("textureAvailable", 1)
                    putInt("width", width)
                    putInt("height", height)
                }

                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("onSurfaceReady", event)
            }

            override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, w: Int, h: Int) {}
            override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean {
                NativeTextureRegistry.previewSurface = null
                return true
            }

            override fun onSurfaceTextureUpdated(surface: SurfaceTexture) {}
        }

        return view
    }
}
