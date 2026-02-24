package expo.modules.scanpangarcore

import android.media.Image
import android.util.Log
import com.google.ar.core.Frame
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.objects.ObjectDetection
import com.google.mlkit.vision.objects.ObjectDetector
import com.google.mlkit.vision.objects.defaults.ObjectDetectorOptions
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

private const val TAG = "MLKitObjectDetector"

/**
 * ML Kit Object Detection 래퍼
 * - ARCore Frame에서 카메라 이미지를 추출하여 ML Kit로 객체 감지
 * - 300ms 쓰로틀링 + AtomicBoolean 동시 처리 방지
 * - 별도 Executor에서 비동기 처리 (GL 스레드 블로킹 방지)
 * - 바운딩박스를 이미지 크기 대비 0~1 정규화하여 반환
 */
class MLKitObjectDetector {

    /**
     * 감지된 객체 정보 (정규화 좌표)
     */
    data class DetectedObject(
        val left: Float,    // 0~1 정규화
        val top: Float,     // 0~1 정규화
        val right: Float,   // 0~1 정규화
        val bottom: Float,  // 0~1 정규화
        val trackingId: Int?,
        val labels: List<String>,
        val confidence: Float
    )

    /**
     * 감지 결과 콜백 인터페이스
     */
    interface ResultCallback {
        fun onDetected(
            detections: List<DetectedObject>,
            imageWidth: Int,
            imageHeight: Int,
            timestamp: Long
        )
    }

    private val detector: ObjectDetector
    private val executor = Executors.newSingleThreadExecutor()
    private val isProcessing = AtomicBoolean(false)

    // 쓰로틀링: 300ms 간격
    private var lastProcessTime = 0L
    private val THROTTLE_MS = 300L

    init {
        val options = ObjectDetectorOptions.Builder()
            .setDetectorMode(ObjectDetectorOptions.STREAM_MODE)
            .enableMultipleObjects()
            .enableClassification()  // Place, Food 등 카테고리 분류
            .build()

        detector = ObjectDetection.getClient(options)
        Log.d(TAG, "[init] ML Kit ObjectDetector 초기화 완료")
    }

    /**
     * ARCore Frame에서 카메라 이미지를 추출하여 ML Kit 감지 실행
     * GL 스레드에서 호출해도 안전 (비동기 처리)
     *
     * @param frame ARCore Frame
     * @param displayRotation 디스플레이 회전 (Surface.ROTATION_*)
     * @param callback 결과 콜백 (메인 스레드에서 호출됨)
     */
    fun processFrame(frame: Frame, displayRotation: Int, callback: ResultCallback) {
        // 쓰로틀링 체크
        val now = System.currentTimeMillis()
        if (now - lastProcessTime < THROTTLE_MS) return

        // 동시 처리 방지
        if (!isProcessing.compareAndSet(false, true)) return

        lastProcessTime = now

        // 카메라 이미지 획득
        val image: Image
        try {
            image = frame.acquireCameraImage()
        } catch (e: Exception) {
            isProcessing.set(false)
            return
        }

        val imageWidth = image.width
        val imageHeight = image.height
        val timestamp = frame.timestamp

        // 디스플레이 회전에 따른 InputImage 회전 각도
        val rotation = when (displayRotation) {
            0 -> 90   // ROTATION_0: 세로 모드 → 센서는 가로 → 90도 회전
            1 -> 0    // ROTATION_90: 가로 모드 → 회전 불필요
            2 -> 270  // ROTATION_180
            3 -> 180  // ROTATION_270
            else -> 90
        }

        try {
            val inputImage = InputImage.fromMediaImage(image, rotation)

            executor.execute {
                detector.process(inputImage)
                    .addOnSuccessListener { results ->
                        val detections = results.map { obj ->
                            val box = obj.boundingBox
                            // 바운딩박스를 이미지 크기 대비 0~1 정규화
                            DetectedObject(
                                left = box.left.toFloat() / imageWidth,
                                top = box.top.toFloat() / imageHeight,
                                right = box.right.toFloat() / imageWidth,
                                bottom = box.bottom.toFloat() / imageHeight,
                                trackingId = obj.trackingId,
                                labels = obj.labels.map { it.text },
                                confidence = obj.labels.firstOrNull()?.confidence ?: 0f
                            )
                        }

                        callback.onDetected(detections, imageWidth, imageHeight, timestamp)
                        image.close()
                        isProcessing.set(false)
                    }
                    .addOnFailureListener { e ->
                        Log.w(TAG, "[processFrame] ML Kit 감지 실패: ${e.message}")
                        image.close()
                        isProcessing.set(false)
                    }
            }
        } catch (e: Exception) {
            Log.w(TAG, "[processFrame] InputImage 생성 실패: ${e.message}")
            image.close()
            isProcessing.set(false)
        }
    }

    /**
     * 리소스 해제
     */
    fun destroy() {
        detector.close()
        executor.shutdown()
        Log.d(TAG, "[destroy] ML Kit ObjectDetector 해제 완료")
    }
}
