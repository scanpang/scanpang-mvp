package expo.modules.scanpangarcore

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.YuvImage
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.ByteArrayOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

private const val TAG = "ScanPangARCoreView"

/**
 * CameraX 카메라 프리뷰 + YOLO TFLite 건물 감지 뷰
 *
 * ARCore GLSurfaceView → CameraX PreviewView 전환
 * LifecycleOwner 구현 (CameraX 요구)
 */
class ScanPangARCoreView(context: Context, appContext: AppContext) : ExpoView(context, appContext), LifecycleOwner {

    // View 이벤트 (JS로 전달)
    val onObjectDetection by EventDispatcher()
    val onReady by EventDispatcher()
    val onError by EventDispatcher()

    private val previewView: PreviewView
    private val mainHandler = Handler(Looper.getMainLooper())

    // YOLO 건물 감지기
    private val buildingDetector = YoloBuildingDetector(context)

    // CameraX
    private var cameraProvider: ProcessCameraProvider? = null
    private lateinit var analysisExecutor: ExecutorService

    // LifecycleOwner 구현
    private val lifecycleRegistry = LifecycleRegistry(this)

    override val lifecycle: Lifecycle
        get() = lifecycleRegistry

    init {
        // 모듈에 활성 뷰 등록
        ScanPangARCoreModule.activeView = this

        // PreviewView 설정
        previewView = PreviewView(context).apply {
            implementationMode = PreviewView.ImplementationMode.PERFORMANCE
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }

        addView(previewView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

        // 분석 스레드
        analysisExecutor = Executors.newSingleThreadExecutor()

        // YOLO 모델 초기화 (백그라운드)
        analysisExecutor.execute {
            buildingDetector.initialize()
            if (buildingDetector.isInitialized) {
                mainHandler.post {
                    onReady(mapOf("status" to "model_loaded"))
                }
            } else {
                mainHandler.post {
                    onError(mapOf("error" to "model_load_failed"))
                }
            }
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        lifecycleRegistry.currentState = Lifecycle.State.STARTED
        startCamera()
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        lifecycleRegistry.currentState = Lifecycle.State.DESTROYED
        if (ScanPangARCoreModule.activeView == this) {
            ScanPangARCoreModule.activeView = null
        }
        buildingDetector.destroy()
        cameraProvider?.unbindAll()
        analysisExecutor.shutdown()
    }

    /**
     * CameraX 카메라 시작
     */
    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            try {
                val provider = cameraProviderFuture.get()
                cameraProvider = provider

                // 프리뷰
                val preview = Preview.Builder()
                    .build()
                    .also { it.setSurfaceProvider(previewView.surfaceProvider) }

                // 이미지 분석 (YOLO 추론)
                val imageAnalysis = ImageAnalysis.Builder()
                    .setTargetResolution(Size(640, 480))
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                    .build()

                imageAnalysis.setAnalyzer(analysisExecutor) { imageProxy ->
                    processImage(imageProxy)
                }

                // 후면 카메라
                val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

                // 바인딩
                provider.unbindAll()
                provider.bindToLifecycle(this, cameraSelector, preview, imageAnalysis)

                Log.d(TAG, "[startCamera] CameraX 바인딩 완료")
            } catch (e: Exception) {
                Log.e(TAG, "[startCamera] 카메라 시작 실패: ${e.message}")
                mainHandler.post {
                    onError(mapOf("error" to "camera_start_failed: ${e.message}"))
                }
            }
        }, ContextCompat.getMainExecutor(context))
    }

    /**
     * ImageProxy → Bitmap 변환 → YOLO 추론
     */
    private fun processImage(imageProxy: ImageProxy) {
        if (!buildingDetector.isInitialized) {
            imageProxy.close()
            return
        }

        try {
            val bitmap = imageProxyToBitmap(imageProxy)
            if (bitmap != null) {
                buildingDetector.processFrame(bitmap, object : YoloBuildingDetector.ResultCallback {
                    override fun onDetections(detections: List<YoloBuildingDetector.Detection>, timestamp: Long) {
                        val detectionsData = detections.map { d ->
                            mapOf(
                                "left" to d.left.toDouble(),
                                "top" to d.top.toDouble(),
                                "right" to d.right.toDouble(),
                                "bottom" to d.bottom.toDouble(),
                                "centerX" to d.centerX.toDouble(),
                                "confidence" to d.confidence.toDouble()
                            )
                        }
                        mainHandler.post {
                            onObjectDetection(mapOf(
                                "detections" to detectionsData,
                                "timestamp" to timestamp
                            ))
                        }
                    }
                })
                bitmap.recycle()
            }
        } catch (e: Exception) {
            Log.w(TAG, "[processImage] 처리 실패: ${e.message}")
        } finally {
            imageProxy.close()
        }
    }

    /**
     * YUV_420_888 ImageProxy → Bitmap 변환
     */
    private fun imageProxyToBitmap(imageProxy: ImageProxy): Bitmap? {
        return try {
            val yBuffer = imageProxy.planes[0].buffer
            val uBuffer = imageProxy.planes[1].buffer
            val vBuffer = imageProxy.planes[2].buffer

            val ySize = yBuffer.remaining()
            val uSize = uBuffer.remaining()
            val vSize = vBuffer.remaining()

            val nv21 = ByteArray(ySize + uSize + vSize)
            yBuffer.get(nv21, 0, ySize)
            vBuffer.get(nv21, ySize, vSize)
            uBuffer.get(nv21, ySize + vSize, uSize)

            val yuvImage = YuvImage(nv21, ImageFormat.NV21, imageProxy.width, imageProxy.height, null)
            val out = ByteArrayOutputStream()
            yuvImage.compressToJpeg(Rect(0, 0, imageProxy.width, imageProxy.height), 80, out)
            val jpegBytes = out.toByteArray()

            val bitmap = BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size)

            // 회전 보정
            val rotation = imageProxy.imageInfo.rotationDegrees
            if (rotation != 0 && bitmap != null) {
                val matrix = Matrix().apply { postRotate(rotation.toFloat()) }
                val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
                if (rotated != bitmap) bitmap.recycle()
                rotated
            } else {
                bitmap
            }
        } catch (e: Exception) {
            Log.w(TAG, "[imageProxyToBitmap] 변환 실패: ${e.message}")
            null
        }
    }
}
