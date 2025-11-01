package com.testingcamera

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class CameraFpsPackage : ReactPackage {
  override fun createViewManagers(reactContext: ReactApplicationContext)
    = emptyList<ViewManager<*, *>>()

  override fun createNativeModules(reactContext: ReactApplicationContext)
    = listOf<NativeModule>(CameraFpsModule(reactContext))
}
