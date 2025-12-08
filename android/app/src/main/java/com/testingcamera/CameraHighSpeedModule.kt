package com.testingcamera

import android.content.Context
import android.hardware.camera2.*
import android.graphics.SurfaceTexture
import android.view.Surface
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
    private var previewSurface: Surface? = null
    private var surfaceTexture: SurfaceTexture? = null

    override fun getName() = "CameraHighSpeedModule"

@ReactMethod
fun startHighSpeedRecording(cameraId: String, fps: Int, promise: Promise) {
    try {
        val manager = reactContext.getSystemService(Context.CAMERA_SERVICE) as CameraManager

        val characteristics = manager.getCameraCharacteristics(cameraId)
        val caps = characteristics.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES)
        val supportsHighSpeed = caps?.contains(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_CONSTRAINED_HIGH_SPEED_VIDEO) == true

        if (!supportsHighSpeed) {
            promise.reject("NOT_SUPPORTED", "Camera $cameraId does not support high-speed video")
            return
        }

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

        mediaRecorder = MediaRecorder().apply {
            setVideoSource(MediaRecorder.VideoSource.SURFACE)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setVideoEncoder(MediaRecorder.VideoEncoder.H264)
            setVideoEncodingBitRate(20_000_000)
            setVideoFrameRate(30)
            setCaptureRate(fps.toDouble())
            setVideoSize(size.width, size.height)
            setOutputFile(outputFile!!.absolutePath)
            prepare()
        }

        manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
            override fun onOpened(device: CameraDevice) {
                cameraDevice = device
                val recorderSurface = mediaRecorder!!.surface
                val surfaces = mutableListOf<Surface>()

                // ✅ ALWAYS get fresh surface from registry (fixes minimize/restore bug)
                previewSurface = NativeTextureRegistry.previewSurface
                
                previewSurface?.let { 
                    surfaces.add(it)
                    Log.i("CameraHighSpeed", "✅ Added preview surface")
                } ?: Log.w("CameraHighSpeed", "⚠️ No preview surface available")

                surfaces.add(recorderSurface)

                device.createConstrainedHighSpeedCaptureSession(
                    surfaces,
                    object : CameraCaptureSession.StateCallback() {
                        override fun onConfigured(session: CameraCaptureSession) {
                            captureSession = session
                            val requestBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_RECORD).apply {
                                previewSurface?.let { addTarget(it) }
                                addTarget(recorderSurface)
                                set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, Range(fps, fps))
                            }

                            val hsSession = session as CameraConstrainedHighSpeedCaptureSession
                            val requestList = hsSession.createHighSpeedRequestList(requestBuilder.build())

                            mediaRecorder?.start()
                            hsSession.setRepeatingBurst(requestList, null, null)

                            promise.resolve(outputFile!!.absolutePath)
                        }

                        override fun onConfigureFailed(session: CameraCaptureSession) {
                            promise.reject("CONFIG_FAILED", "Failed to configure HS session")
                        }
                    },
                    null
                )
            }

            override fun onDisconnected(device: CameraDevice) {
                cleanup()
                promise.reject("DISCONNECTED", "Camera disconnected")
            }

            override fun onError(device: CameraDevice, error: Int) {
                cleanup()
                promise.reject("ERROR", "Camera error $error")
            }
        }, null)

    } catch (e: Exception) {
        e.printStackTrace()
        cleanup()
        promise.reject("START_ERROR", e)
    }
}

@ReactMethod
fun stopHighSpeedRecording(promise: Promise) {
    try {
        captureSession?.stopRepeating()
        captureSession?.close()
        captureSession = null

        mediaRecorder?.apply {
            try {
                stop()
            } catch (e: RuntimeException) {
                Log.e("CameraHighSpeed", "MediaRecorder stop failed: ${e.message}")
            }
            reset()
            release()
        }
        mediaRecorder = null

        cameraDevice?.close()
        cameraDevice = null

        // ✅ DON'T release preview surface - keep it for next recording!
        // previewSurface will be reused

        val path = outputFile?.absolutePath ?: ""
        Log.i("CameraHighSpeed", "✅ Saved slow-mo: $path")
        promise.resolve(path)
    } catch (e: Exception) {
        Log.e("CameraHighSpeed", "Stop error: ${e.message}")
        cleanup()
        promise.reject("STOP_ERROR", e)
    }
}

@ReactMethod
fun attachPreviewSurface(dummy: Int) {
    previewSurface = NativeTextureRegistry.previewSurface
    Log.i("CameraHighSpeed", "Preview surface attached: ${previewSurface != null}")
}

// ❌ REMOVE resetPreviewSurface() method completely!

private fun cleanup() {
    captureSession?.stopRepeating()
    captureSession?.close()
    captureSession = null

    mediaRecorder?.apply {
        try {
            stop()
        } catch (e: RuntimeException) {
            Log.e("CameraHighSpeed", "MediaRecorder stop failed: ${e.message}")
        }
        reset()
        release()
    }
    mediaRecorder = null

    cameraDevice?.close()
    cameraDevice = null

    // Only set to null, don't release (TextureView owns it)
    previewSurface = null
    surfaceTexture = null
}
}
