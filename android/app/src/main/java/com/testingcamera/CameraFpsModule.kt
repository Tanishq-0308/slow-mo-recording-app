package com.testingcamera

import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.hardware.camera2.params.StreamConfigurationMap
import android.os.Build
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.*

class CameraFpsModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "CameraFpsModule"

  @ReactMethod
  fun getHighSpeedVideoFps(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      promise.reject("UNSUPPORTED", "Requires Android 6.0 (API 23) or higher")
      return
    }

    try {
      val manager = reactContext.getSystemService(CameraManager::class.java)
      val result = Arguments.createArray()

      for (cameraId in manager.cameraIdList) {
        val characteristics = manager.getCameraCharacteristics(cameraId)
        val map = characteristics.get(
          CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP
        ) as? StreamConfigurationMap ?: continue

        // ✅ Safely get high-speed video FPS ranges
        val fpsRanges = map.highSpeedVideoFpsRanges
        val sizes = map.highSpeedVideoSizes

        for (size in sizes) {
          for (range in fpsRanges) {
            val mapObj = Arguments.createMap()
            mapObj.putString("cameraId", cameraId)
            mapObj.putInt("width", size.width)
            mapObj.putInt("height", size.height)
            mapObj.putInt("fpsMin", range.lower)
            mapObj.putInt("fpsMax", range.upper)
            result.pushMap(mapObj)
          }
        }
      }

      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("ERR_CAMERA_FPS", e.message, e)
    }
  }
}
