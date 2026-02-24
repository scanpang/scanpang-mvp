package expo.modules.scanpangarcore

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import org.tensorflow.lite.Interpreter
// GPU Delegate 제거 — GpuDelegateFactory$Options 클래스 누락으로 크래시 발생
// import org.tensorflow.lite.gpu.GpuDelegate
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max
import kotlin.math.min

private const val TAG = "YoloBuildingDetector"

/**
 * YOLO OIV7 TFLite 건물 감지기
 * - GPU Delegate 우선, 실패 시 CPU 4스레드 폴백
 * - 300ms 쓰로틀, AtomicBoolean 동시 실행 방지
 * - 건물 관련 5개 클래스만 필터: Building, House, Office building, Skyscraper, Tower
 */
class YoloBuildingDetector(private val context: Context) {

    /**
     * 감지 결과 (정규화 좌표 0~1)
     */
    data class Detection(
        val left: Float,
        val top: Float,
        val right: Float,
        val bottom: Float,
        val centerX: Float,
        val confidence: Float
    )

    interface ResultCallback {
        fun onDetections(detections: List<Detection>, timestamp: Long)
    }

    private var interpreter: Interpreter? = null
    private val isProcessing = AtomicBoolean(false)
    private var lastProcessTime = 0L
    private val THROTTLE_MS = 300L

    // 모델 파라미터
    private val INPUT_SIZE = 320
    private val NUM_CLASSES = 601
    // 출력 형태: [1, 605, 2100] → 전치 후 [2100, 605] (x,y,w,h + 601 classes)
    private val NUM_DETECTIONS = 2100
    private val OUTPUT_ROW_SIZE = NUM_CLASSES + 4  // 605

    // OIV7 건물 관련 클래스 인덱스
    private val BUILDING_CLASS_INDICES = intArrayOf(70, 257, 354, 466, 546)
    // Building=70, House=257, Office building=354, Skyscraper=466, Tower=546

    // NMS 임계값
    private val CONFIDENCE_THRESHOLD = 0.25f
    private val NMS_IOU_THRESHOLD = 0.45f

    // 입력 버퍼 (재사용)
    private var inputBuffer: ByteBuffer? = null
    // 출력 버퍼: [1][605][2100] float
    private var outputBuffer: Array<Array<FloatArray>>? = null

    @Volatile
    var isInitialized = false
        private set

    /**
     * 비동기 초기화 — 모델 로드 + Interpreter 생성
     */
    fun initialize() {
        try {
            val modelBuffer = loadModelFile()

            // CPU 4스레드 모드 (GPU Delegate는 버전 호환 문제로 제거)
            val options = Interpreter.Options().apply {
                setNumThreads(4)
            }
            interpreter = Interpreter(modelBuffer, options)
            Log.d(TAG, "[initialize] CPU 4스레드 모드")

            // 입력 버퍼 할당
            inputBuffer = ByteBuffer.allocateDirect(1 * INPUT_SIZE * INPUT_SIZE * 3 * 4).apply {
                order(ByteOrder.nativeOrder())
            }

            // 출력 버퍼 할당: [1][605][2100]
            outputBuffer = Array(1) { Array(OUTPUT_ROW_SIZE) { FloatArray(NUM_DETECTIONS) } }

            isInitialized = true
            Log.d(TAG, "[initialize] 모델 로드 완료")
        } catch (e: Exception) {
            Log.e(TAG, "[initialize] 초기화 실패: ${e.message}")
            isInitialized = false
        }
    }

    /**
     * Bitmap 프레임에서 건물 감지
     */
    fun processFrame(bitmap: Bitmap, callback: ResultCallback) {
        if (!isInitialized) return

        val now = System.currentTimeMillis()
        if (now - lastProcessTime < THROTTLE_MS) return
        if (!isProcessing.compareAndSet(false, true)) return
        lastProcessTime = now

        try {
            // 전처리: 320x320 RGB float
            val resized = Bitmap.createScaledBitmap(bitmap, INPUT_SIZE, INPUT_SIZE, true)
            val buffer = inputBuffer!!
            buffer.rewind()

            val pixels = IntArray(INPUT_SIZE * INPUT_SIZE)
            resized.getPixels(pixels, 0, INPUT_SIZE, 0, 0, INPUT_SIZE, INPUT_SIZE)

            for (pixel in pixels) {
                // RGB 정규화 0~1
                buffer.putFloat(((pixel shr 16) and 0xFF) / 255.0f) // R
                buffer.putFloat(((pixel shr 8) and 0xFF) / 255.0f)  // G
                buffer.putFloat((pixel and 0xFF) / 255.0f)          // B
            }

            if (resized != bitmap) resized.recycle()

            // 추론
            val output = outputBuffer!!
            interpreter!!.run(buffer, output)

            // 후처리: [1][605][2100] → 전치하여 각 detection 파싱
            val rawDetections = mutableListOf<Detection>()

            for (d in 0 until NUM_DETECTIONS) {
                // 건물 클래스 중 최대 confidence 찾기
                var maxConf = 0f
                for (classIdx in BUILDING_CLASS_INDICES) {
                    val conf = output[0][classIdx + 4][d]  // +4 = x,y,w,h 건너뛰기
                    if (conf > maxConf) maxConf = conf
                }

                if (maxConf < CONFIDENCE_THRESHOLD) continue

                // 바운딩박스 (cx, cy, w, h → left, top, right, bottom)
                val cx = output[0][0][d]
                val cy = output[0][1][d]
                val w = output[0][2][d]
                val h = output[0][3][d]

                val left = max(0f, (cx - w / 2) / INPUT_SIZE)
                val top = max(0f, (cy - h / 2) / INPUT_SIZE)
                val right = min(1f, (cx + w / 2) / INPUT_SIZE)
                val bottom = min(1f, (cy + h / 2) / INPUT_SIZE)

                rawDetections.add(Detection(
                    left = left,
                    top = top,
                    right = right,
                    bottom = bottom,
                    centerX = (left + right) / 2,
                    confidence = maxConf
                ))
            }

            // NMS 적용
            val nmsResults = applyNMS(rawDetections)

            if (nmsResults.isNotEmpty()) {
                callback.onDetections(nmsResults, now)
            }
        } catch (e: Exception) {
            Log.w(TAG, "[processFrame] 감지 실패: ${e.message}")
        } finally {
            isProcessing.set(false)
        }
    }

    /**
     * Non-Maximum Suppression
     */
    private fun applyNMS(detections: List<Detection>): List<Detection> {
        if (detections.isEmpty()) return emptyList()

        // confidence 내림차순 정렬
        val sorted = detections.sortedByDescending { it.confidence }
        val selected = mutableListOf<Detection>()
        val suppressed = BooleanArray(sorted.size)

        for (i in sorted.indices) {
            if (suppressed[i]) continue
            selected.add(sorted[i])

            for (j in i + 1 until sorted.size) {
                if (suppressed[j]) continue
                if (computeIoU(sorted[i], sorted[j]) > NMS_IOU_THRESHOLD) {
                    suppressed[j] = true
                }
            }
        }

        return selected
    }

    private fun computeIoU(a: Detection, b: Detection): Float {
        val interLeft = max(a.left, b.left)
        val interTop = max(a.top, b.top)
        val interRight = min(a.right, b.right)
        val interBottom = min(a.bottom, b.bottom)

        if (interLeft >= interRight || interTop >= interBottom) return 0f

        val interArea = (interRight - interLeft) * (interBottom - interTop)
        val areaA = (a.right - a.left) * (a.bottom - a.top)
        val areaB = (b.right - b.left) * (b.bottom - b.top)

        return interArea / (areaA + areaB - interArea)
    }

    private fun loadModelFile(): MappedByteBuffer {
        val assetFileDescriptor = context.assets.openFd("yolov8s-oiv7.tflite")
        val fileInputStream = FileInputStream(assetFileDescriptor.fileDescriptor)
        val fileChannel = fileInputStream.channel
        return fileChannel.map(
            FileChannel.MapMode.READ_ONLY,
            assetFileDescriptor.startOffset,
            assetFileDescriptor.declaredLength
        )
    }

    fun destroy() {
        interpreter?.close()
        interpreter = null
        isInitialized = false
        Log.d(TAG, "[destroy] YoloBuildingDetector 해제")
    }
}
