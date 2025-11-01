package com.testingcamera

import android.content.Context
import android.hardware.camera2.*
import android.media.MediaRecorder
import android.os.Environment
import android.util.Log
import android.util.Range
import android.util.Size
import com.facebook.react.bridge.*
import java.io.File

class CameraHighSpeedModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var cameraDevice: CameraDevice? = null
  private var captureSession: CameraCaptureSession? = null
  private var mediaRecorder: MediaRecorder? = null
  private var outputFile: File? = null

  override fun getName() = "CameraHighSpeedModule"

  @ReactMethod
  fun startHighSpeedRecording(fps: Int, promise: Promise) {
    try {
      val manager = reactContext.getSystemService(Context.CAMERA_SERVICE) as CameraManager
      val cameraId = manager.cameraIdList.first { id ->
        val chars = manager.getCameraCharacteristics(id)
        val caps = chars.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES)
        caps?.contains(
          CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_CONSTRAINED_HIGH_SPEED_VIDEO
        ) == true
      }

      val characteristics = manager.getCameraCharacteristics(cameraId)
      val map = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
      val highSpeedSizes = map?.getHighSpeedVideoSizesFor(Range(fps, fps))
      val size: Size = highSpeedSizes?.firstOrNull()
        ?: map?.getOutputSizes(MediaRecorder::class.java)?.firstOrNull()
        ?: Size(1920, 1080)

      outputFile = File(
        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
        "TestingCamera/slowmo_${System.currentTimeMillis()}_${fps}fps.mp4"
      )
      outputFile!!.parentFile?.mkdirs()

      val playbackFps = 30

      mediaRecorder = MediaRecorder().apply {
        setVideoSource(MediaRecorder.VideoSource.SURFACE)
        setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        setVideoEncoder(MediaRecorder.VideoEncoder.H264)
        setVideoEncodingBitRate(20_000_000)
        setVideoFrameRate(playbackFps)
        setCaptureRate(fps.toDouble())
        setVideoSize(size.width, size.height)
        setOutputFile(outputFile!!.absolutePath)
        prepare()
      }

      manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
        override fun onOpened(device: CameraDevice) {
          cameraDevice = device
          val surface = mediaRecorder!!.surface

          device.createConstrainedHighSpeedCaptureSession(
            listOf(surface),
            object : CameraCaptureSession.StateCallback() {
              override fun onConfigured(session: CameraCaptureSession) {
                captureSession = session
                
                // Create the capture request
                val requestBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_RECORD).apply {
                  addTarget(surface)
                  set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, Range(fps, fps))
                }
                
                // Create high-speed request list and submit it
                val highSpeedSession = session as CameraConstrainedHighSpeedCaptureSession
                val requestList = highSpeedSession.createHighSpeedRequestList(requestBuilder.build())
                
                // Start the MediaRecorder first
                mediaRecorder?.start()
                
                // Then start capturing frames
                highSpeedSession.setRepeatingBurst(requestList, null, null)
                
                Log.i("CameraHighSpeed", "🎥 Recording started: ${outputFile!!.absolutePath}")
                promise.resolve(outputFile!!.absolutePath)
              }

              override fun onConfigureFailed(session: CameraCaptureSession) {
                promise.reject("CONFIG_FAILED", "High-speed session failed")
              }
            },
            null
          )
        }

        override fun onDisconnected(device: CameraDevice) {
          promise.reject("DISCONNECTED", "Camera disconnected")
        }

        override fun onError(device: CameraDevice, error: Int) {
          promise.reject("ERROR", "Camera error $error")
        }
      }, null)
    } catch (e: Exception) {
      e.printStackTrace()
      promise.reject("START_ERROR", e)
    }
  }

  @ReactMethod
  fun stopHighSpeedRecording(promise: Promise) {
    try {
      // Stop capture session first
      captureSession?.stopRepeating()
      captureSession?.close()
      captureSession = null
      
      // Then stop MediaRecorder with error handling
      mediaRecorder?.apply {
        try {
          stop()
        } catch (e: RuntimeException) {
          Log.e("CameraHighSpeed", "MediaRecorder stop failed (may be empty): ${e.message}")
        }
        reset()
        release()
      }
      mediaRecorder = null
      
      // Close camera
      cameraDevice?.close()
      cameraDevice = null

      val path = outputFile?.absolutePath ?: ""
      Log.i("CameraHighSpeed", "✅ Saved slow-mo: $path")
      promise.resolve(path)
    } catch (e: Exception) {
      Log.e("CameraHighSpeed", "Stop error: ${e.message}")
      promise.reject("STOP_ERROR", e)
    }
  }
}