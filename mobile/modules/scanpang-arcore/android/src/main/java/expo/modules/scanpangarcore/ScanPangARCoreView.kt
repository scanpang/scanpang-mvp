package expo.modules.scanpangarcore

import android.app.Activity
import android.app.Application
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.SurfaceTexture
import android.graphics.YuvImage
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.params.StreamConfigurationMap
import android.os.Bundle
import android.util.Size
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.util.Log
import android.view.Surface
import android.view.TextureView
import android.view.View.MeasureSpec
import androidx.core.content.ContextCompat
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.ByteArrayOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

private const val TAG = "ScanPangARCoreView"

/**
 * TextureView + Camera2 API 카메라 프리뷰 + YOLO TFLite 건물 감지 뷰
 *
 * CameraX PreviewView는 React Native ExpoView 안에서 Surface 생성 안 됨
 * → TextureView + Camera2 직접 사용으로 해결
 */
class ScanPangARCoreView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {

    // View 이벤트 (JS로 전달)
    val onObjectDetection by EventDispatcher()
    val onReady by EventDispatcher()
    val onError by EventDispatcher()

    private val textureView: TextureView
    private val mainHandler = Handler(Looper.getMainLooper())

    // YOLO 건물 감지기
    private val buildingDetector = YoloBuildingDetector(context)

    // Camera2
    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var imageReader: ImageReader? = null
    private var cameraThread: HandlerThread? = null
    private var cameraHandler: Handler? = null
    private var imageReaderThread: HandlerThread? = null
    private var imageReaderHandler: Handler? = null
    private var sensorOrientation = 0
    private var analysisSize = Size(640, 480) // 카메라 지원 크기로 업데이트됨
    private var previewSize = Size(1920, 1080) // 프리뷰 출력 크기 (비율 보정용)
    private var isCameraActive = false // 생명주기 관리용

    // YOLO 분석
    private lateinit var analysisExecutor: ExecutorService

    // Activity 생명주기 콜백 (백그라운드 시 카메라 해제)
    private val lifecycleCallbacks = object : Application.ActivityLifecycleCallbacks {
        override fun onActivityPaused(activity: Activity) {
            Log.d(TAG, "[lifecycle] onPause — 카메라 해제")
            isCameraActive = false
            closeCamera()
        }
        override fun onActivityResumed(activity: Activity) {
            Log.d(TAG, "[lifecycle] onResume — 카메라 재시작")
            isCameraActive = true
            if (textureView.isAvailable) {
                openCamera()
            }
        }
        override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
        override fun onActivityStarted(activity: Activity) {}
        override fun onActivityStopped(activity: Activity) {}
        override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
        override fun onActivityDestroyed(activity: Activity) {}
    }

    init {
        Log.d(TAG, "[init] 뷰 생성 시작")

        // 모듈에 활성 뷰 등록
        ScanPangARCoreModule.activeView = this

        // TextureView 설정
        textureView = TextureView(context)
        addView(textureView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

        // 카메라 스레드
        cameraThread = HandlerThread("CameraThread").also { it.start() }
        cameraHandler = Handler(cameraThread!!.looper)

        // ImageReader 전용 스레드 (카메라 스레드와 분리)
        imageReaderThread = HandlerThread("ImageReaderThread").also { it.start() }
        imageReaderHandler = Handler(imageReaderThread!!.looper)

        // 분석 스레드
        analysisExecutor = Executors.newSingleThreadExecutor()

        // YOLO 모델 초기화 (백그라운드)
        analysisExecutor.execute {
            buildingDetector.initialize()
            if (buildingDetector.isInitialized) {
                mainHandler.post { onReady(mapOf("status" to "model_loaded")) }
                Log.d(TAG, "[init] YOLO 모델 로드 완료")
            } else {
                mainHandler.post { onError(mapOf("error" to "model_load_failed")) }
                Log.e(TAG, "[init] YOLO 모델 로드 실패")
            }
        }

        // Activity 생명주기 감시 등록
        val activity = (context as? Activity) ?: (context as? android.content.ContextWrapper)?.baseContext as? Activity
        activity?.application?.registerActivityLifecycleCallbacks(lifecycleCallbacks)
        isCameraActive = true

        Log.d(TAG, "[init] 뷰 생성 완료")
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        Log.d(TAG, "[onAttachedToWindow] w=${width} h=${height}")
        // SurfaceTextureListener는 init보다 뒤에 선언되어 있으므로 여기서 설정
        textureView.surfaceTextureListener = surfaceTextureListener
    }

    /**
     * React Native Yoga는 네이티브 addView() 자식을 레이아웃하지 않음
     * TextureView에 수동으로 크기 배정
     */
    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        val w = right - left
        val h = bottom - top
        if (w > 0 && h > 0) {
            textureView.measure(
                MeasureSpec.makeMeasureSpec(w, MeasureSpec.EXACTLY),
                MeasureSpec.makeMeasureSpec(h, MeasureSpec.EXACTLY)
            )
            textureView.layout(0, 0, w, h)
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        Log.d(TAG, "[onDetachedFromWindow] 정리 시작")
        if (ScanPangARCoreModule.activeView == this) {
            ScanPangARCoreModule.activeView = null
        }

        // 생명주기 콜백 해제
        val activity = (context as? Activity) ?: (context as? android.content.ContextWrapper)?.baseContext as? Activity
        activity?.application?.unregisterActivityLifecycleCallbacks(lifecycleCallbacks)

        isCameraActive = false
        closeCamera()
        buildingDetector.destroy()
        analysisExecutor.shutdown()
        cameraThread?.quitSafely()
        cameraThread = null
        cameraHandler = null
        imageReaderThread?.quitSafely()
        imageReaderThread = null
        imageReaderHandler = null
    }

    // ===== TextureView.SurfaceTextureListener =====
    private val surfaceTextureListener = object : TextureView.SurfaceTextureListener {
        override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) {
            Log.d(TAG, "[SurfaceTexture] available: ${width}x${height}")
            openCamera()
        }

        override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) {
            Log.d(TAG, "[SurfaceTexture] sizeChanged: ${width}x${height}")
            configureTransform()
        }

        override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean {
            Log.d(TAG, "[SurfaceTexture] destroyed")
            closeCamera()
            return true
        }

        override fun onSurfaceTextureUpdated(surface: SurfaceTexture) {
            // 매 프레임 호출 — 로그 안 찍음
        }
    }

    // ===== Camera2 API =====
    private fun openCamera() {
        if (!isCameraActive) {
            Log.d(TAG, "[openCamera] 카메라 비활성 상태 — 무시")
            return
        }
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "[openCamera] 카메라 권한 없음")
            mainHandler.post { onError(mapOf("error" to "camera_permission_denied")) }
            return
        }

        try {
            val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val cameraId = findBackCamera(cameraManager) ?: run {
                Log.e(TAG, "[openCamera] 후면 카메라 없음")
                mainHandler.post { onError(mapOf("error" to "no_back_camera")) }
                return
            }

            // 센서 방향 + 지원 크기 조회
            val characteristics = cameraManager.getCameraCharacteristics(cameraId)
            sensorOrientation = characteristics.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 90

            // 프리뷰 + ImageReader 크기 선택
            val map = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
            if (map != null) {
                // 프리뷰용: SurfaceTexture 지원 크기 중 1920x1080에 가장 가까운 것
                val previewSizes = map.getOutputSizes(SurfaceTexture::class.java)
                if (previewSizes != null && previewSizes.isNotEmpty()) {
                    previewSize = previewSizes.minByOrNull {
                        Math.abs(it.width * it.height - 1920 * 1080)
                    } ?: previewSize
                    Log.d(TAG, "[openCamera] 프리뷰 크기 선택: $previewSize")
                }

                // ImageReader용: YUV 640x480에 가장 가까운 것
                val yuvSizes = map.getOutputSizes(ImageFormat.YUV_420_888)
                if (yuvSizes != null && yuvSizes.isNotEmpty()) {
                    analysisSize = yuvSizes.minByOrNull {
                        Math.abs(it.width * it.height - 640 * 480)
                    } ?: analysisSize
                    Log.d(TAG, "[openCamera] YUV 분석 크기 선택: $analysisSize")
                }
            }

            Log.d(TAG, "[openCamera] cameraId=$cameraId, sensorOrientation=$sensorOrientation, preview=$previewSize, analysis=$analysisSize")
            cameraManager.openCamera(cameraId, cameraStateCallback, cameraHandler)
        } catch (e: Exception) {
            Log.e(TAG, "[openCamera] 실패: ${e.message}", e)
            mainHandler.post { onError(mapOf("error" to "camera_open_failed: ${e.message}")) }
        }
    }

    private fun findBackCamera(manager: CameraManager): String? {
        for (id in manager.cameraIdList) {
            val chars = manager.getCameraCharacteristics(id)
            val facing = chars.get(CameraCharacteristics.LENS_FACING)
            if (facing == CameraCharacteristics.LENS_FACING_BACK) return id
        }
        return null
    }

    private val cameraStateCallback = object : CameraDevice.StateCallback() {
        override fun onOpened(camera: CameraDevice) {
            Log.d(TAG, "[Camera] onOpened")
            cameraDevice = camera
            createCaptureSession()
        }

        override fun onDisconnected(camera: CameraDevice) {
            Log.w(TAG, "[Camera] onDisconnected")
            camera.close()
            cameraDevice = null
        }

        override fun onError(camera: CameraDevice, error: Int) {
            Log.e(TAG, "[Camera] onError: $error")
            camera.close()
            cameraDevice = null
            mainHandler.post { onError(mapOf("error" to "camera_error_$error")) }
        }
    }

    private fun createCaptureSession() {
        val camera = cameraDevice ?: return
        val surfaceTexture = textureView.surfaceTexture ?: return

        try {
            // 프리뷰 Surface — 카메라 프리뷰 크기를 버퍼에 설정 (뷰 크기가 아닌 카메라 출력 크기!)
            surfaceTexture.setDefaultBufferSize(previewSize.width, previewSize.height)
            val previewSurface = Surface(surfaceTexture)

            // 비율 보정 Matrix 적용
            configureTransform()

            // YOLO 분석용 ImageReader (카메라 지원 크기)
            Log.d(TAG, "[createCaptureSession] ImageReader 크기: ${analysisSize.width}x${analysisSize.height}, 프리뷰: ${previewSize.width}x${previewSize.height}")
            imageReader = ImageReader.newInstance(analysisSize.width, analysisSize.height, ImageFormat.YUV_420_888, 2)
            imageReader!!.setOnImageAvailableListener({ reader ->
                val image = reader.acquireLatestImage()
                if (image == null) {
                    return@setOnImageAvailableListener
                }
                processYuvImage(image)
                image.close()
            }, imageReaderHandler)

            val surfaces = listOf(previewSurface, imageReader!!.surface)

            camera.createCaptureSession(surfaces, object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    Log.d(TAG, "[CaptureSession] onConfigured")
                    captureSession = session

                    try {
                        val requestBuilder = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
                        requestBuilder.addTarget(previewSurface)
                        requestBuilder.addTarget(imageReader!!.surface)
                        requestBuilder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO)

                        session.setRepeatingRequest(requestBuilder.build(), null, cameraHandler)
                        Log.d(TAG, "[CaptureSession] repeatingRequest 시작 — 카메라 프리뷰 활성화!")
                    } catch (e: Exception) {
                        Log.e(TAG, "[CaptureSession] repeatingRequest 실패: ${e.message}", e)
                    }
                }

                override fun onConfigureFailed(session: CameraCaptureSession) {
                    Log.e(TAG, "[CaptureSession] onConfigureFailed")
                    mainHandler.post { onError(mapOf("error" to "capture_session_failed")) }
                }
            }, cameraHandler)

            Log.d(TAG, "[createCaptureSession] 세션 생성 요청 완료")
        } catch (e: Exception) {
            Log.e(TAG, "[createCaptureSession] 실패: ${e.message}", e)
        }
    }

    /**
     * TextureView 비율 보정 — center-crop 방식
     * 카메라 출력(보통 4:3)을 화면 비율에 맞게 확대하여 찌그러짐 없이 표시
     */
    private fun configureTransform() {
        val viewWidth = textureView.width.toFloat()
        val viewHeight = textureView.height.toFloat()
        if (viewWidth == 0f || viewHeight == 0f) return

        // 세로 모드: 센서가 landscape이므로 w/h 반전
        val previewW = previewSize.height.toFloat()
        val previewH = previewSize.width.toFloat()

        val viewAspect = viewWidth / viewHeight
        val previewAspect = previewW / previewH

        val matrix = Matrix()
        // 기준점을 뷰 중앙으로
        val centerX = viewWidth / 2f
        val centerY = viewHeight / 2f

        // center-crop: 더 큰 비율 축을 기준으로 스케일
        val scaleX: Float
        val scaleY: Float
        if (viewAspect > previewAspect) {
            // 화면이 더 넓음 → 가로 맞춤, 세로 확대
            scaleX = 1f
            scaleY = (viewAspect / previewAspect)
        } else {
            // 화면이 더 좁음 → 세로 맞춤, 가로 확대
            scaleX = (previewAspect / viewAspect)
            scaleY = 1f
        }

        matrix.postScale(scaleX, scaleY, centerX, centerY)
        textureView.setTransform(matrix)
        Log.d(TAG, "[configureTransform] viewAspect=${viewAspect}, previewAspect=${previewAspect}, scale=${scaleX}x${scaleY}")
    }

    private fun closeCamera() {
        try {
            captureSession?.close()
            captureSession = null
            cameraDevice?.close()
            cameraDevice = null
            imageReader?.close()
            imageReader = null
        } catch (e: Exception) {
            Log.w(TAG, "[closeCamera] 정리 중 에러: ${e.message}")
        }
    }

    // ===== YOLO 이미지 처리 =====
    private var frameCount = 0L
    private fun processYuvImage(image: android.media.Image) {
        frameCount++
        if (frameCount % 30 == 1L) {
            Log.d(TAG, "[processYuvImage] frame=$frameCount, size=${image.width}x${image.height}, modelReady=${buildingDetector.isInitialized}")
        }
        if (!buildingDetector.isInitialized) return

        try {
            val bitmap = yuvImageToBitmap(image) ?: return

            buildingDetector.processFrame(bitmap, object : YoloBuildingDetector.ResultCallback {
                override fun onDetections(detections: List<YoloBuildingDetector.Detection>, timestamp: Long) {
                    val detectionsData = detections.map { d ->
                        mapOf(
                            "left" to d.left.toDouble(),
                            "top" to d.top.toDouble(),
                            "right" to d.right.toDouble(),
                            "bottom" to d.bottom.toDouble(),
                            "centerX" to d.centerX.toDouble(),
                            "confidence" to d.confidence.toDouble(),
                            "type" to d.type  // "building" or "cup"
                        )
                    }
                    Log.d(TAG, "[onDetections] JS로 전송: ${detectionsData.size}개 (types: ${detections.map { it.type }.distinct()})")
                    mainHandler.post {
                        onObjectDetection(mapOf(
                            "detections" to detectionsData,
                            "timestamp" to timestamp
                        ))
                    }
                }
            })
            bitmap.recycle()
        } catch (e: Exception) {
            Log.w(TAG, "[processYuvImage] 처리 실패: ${e.message}")
        }
    }

    /**
     * Camera2 Image (YUV_420_888) → Bitmap 변환
     */
    private fun yuvImageToBitmap(image: android.media.Image): Bitmap? {
        return try {
            val yBuffer = image.planes[0].buffer
            val uBuffer = image.planes[1].buffer
            val vBuffer = image.planes[2].buffer

            val ySize = yBuffer.remaining()
            val uSize = uBuffer.remaining()
            val vSize = vBuffer.remaining()

            val nv21 = ByteArray(ySize + uSize + vSize)
            yBuffer.get(nv21, 0, ySize)
            vBuffer.get(nv21, ySize, vSize)
            uBuffer.get(nv21, ySize + vSize, uSize)

            val yuvImage = YuvImage(nv21, ImageFormat.NV21, image.width, image.height, null)
            val out = ByteArrayOutputStream()
            yuvImage.compressToJpeg(Rect(0, 0, image.width, image.height), 80, out)
            val jpegBytes = out.toByteArray()

            val bitmap = BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size)

            // 회전 보정 (센서 방향)
            if (sensorOrientation != 0 && bitmap != null) {
                val matrix = Matrix().apply { postRotate(sensorOrientation.toFloat()) }
                val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
                if (rotated != bitmap) bitmap.recycle()
                rotated
            } else {
                bitmap
            }
        } catch (e: Exception) {
            Log.w(TAG, "[yuvImageToBitmap] 변환 실패: ${e.message}")
            null
        }
    }
}
