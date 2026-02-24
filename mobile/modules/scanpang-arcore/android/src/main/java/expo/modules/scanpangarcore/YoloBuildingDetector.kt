package expo.modules.scanpangarcore

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import org.tensorflow.lite.Interpreter
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
 * YOLO OIV7 TFLite 건물+컵 감지기
 * - CPU 4스레드, 300ms 쓰로틀
 * - 건물 5개 클래스 (25% 임계값) + 컵 2개 클래스 (50% 임계값)
 * - Detection.type으로 "building" / "cup" 구분
 */
class YoloBuildingDetector(private val context: Context) {

    /**
     * 감지 결과 (정규화 좌표 0~1)
     * type: "building" 또는 "cup"
     */
    data class Detection(
        val left: Float,
        val top: Float,
        val right: Float,
        val bottom: Float,
        val centerX: Float,
        val confidence: Float,
        val type: String  // "building" or "cup"
    )

    interface ResultCallback {
        fun onDetections(detections: List<Detection>, timestamp: Long)
    }

    private var interpreter: Interpreter? = null
    private val isProcessing = AtomicBoolean(false)
    private var lastProcessTime = 0L
    private val THROTTLE_MS = 150L

    // 모델 파라미터
    private val INPUT_SIZE = 320
    private val NUM_CLASSES = 601
    // 출력 형태: [1, 605, 2100] → 전치 후 [2100, 605] (x,y,w,h + 601 classes)
    private val NUM_DETECTIONS = 2100
    private val OUTPUT_ROW_SIZE = NUM_CLASSES + 4  // 605

    // OIV7 건물 관련 클래스 인덱스
    private val BUILDING_CLASS_INDICES = intArrayOf(70, 257, 354, 466, 546)
    // Building=70, House=257, Office building=354, Skyscraper=466, Tower=546

    // OIV7 컵 관련 클래스 인덱스 (실내 테스트용)
    private val CUP_CLASS_INDICES = intArrayOf(121, 345)
    // Coffee cup=121, Mug=345

    // 임계값
    private val BUILDING_CONFIDENCE = 0.25f
    private val CUP_CONFIDENCE = 0.30f
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

            // CPU 4스레드 모드
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
     * Bitmap 프레임에서 건물+컵 감지
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
                buffer.putFloat(((pixel shr 16) and 0xFF) / 255.0f) // R
                buffer.putFloat(((pixel shr 8) and 0xFF) / 255.0f)  // G
                buffer.putFloat((pixel and 0xFF) / 255.0f)          // B
            }

            if (resized != bitmap) resized.recycle()

            // 추론
            val output = outputBuffer!!
            interpreter!!.run(buffer, output)

            // 후처리: [1][605][2100] → 각 detection에서 건물/컵 클래스 체크
            val rawDetections = mutableListOf<Detection>()

            // 디버그: 전체 프레임에서 최대 confidence 추적
            var debugMaxBuildingConf = 0f
            var debugMaxCupConf = 0f

            for (d in 0 until NUM_DETECTIONS) {
                // 건물 클래스 최대 confidence
                var buildingConf = 0f
                for (classIdx in BUILDING_CLASS_INDICES) {
                    val conf = output[0][classIdx + 4][d]
                    if (conf > buildingConf) buildingConf = conf
                }

                // 컵 클래스 최대 confidence
                var cupConf = 0f
                for (classIdx in CUP_CLASS_INDICES) {
                    val conf = output[0][classIdx + 4][d]
                    if (conf > cupConf) cupConf = conf
                }

                // 디버그 추적
                if (buildingConf > debugMaxBuildingConf) debugMaxBuildingConf = buildingConf
                if (cupConf > debugMaxCupConf) debugMaxCupConf = cupConf

                // 어떤 타입인지 결정 (더 높은 confidence 우선)
                val type: String
                val maxConf: Float
                if (buildingConf >= cupConf && buildingConf >= BUILDING_CONFIDENCE) {
                    type = "building"
                    maxConf = buildingConf
                } else if (cupConf > buildingConf && cupConf >= CUP_CONFIDENCE) {
                    type = "cup"
                    maxConf = cupConf
                } else if (buildingConf >= BUILDING_CONFIDENCE) {
                    type = "building"
                    maxConf = buildingConf
                } else if (cupConf >= CUP_CONFIDENCE) {
                    type = "cup"
                    maxConf = cupConf
                } else {
                    continue  // 둘 다 임계값 미달
                }

                // 바운딩박스 (cx, cy, w, h → left, top, right, bottom)
                val cx = output[0][0][d]
                val cy = output[0][1][d]
                val w = output[0][2][d]
                val h = output[0][3][d]

                // 디버그: 첫 번째 감지의 raw 좌표 출력
                if (rawDetections.isEmpty()) {
                    Log.d(TAG, "[bbox raw] cx=$cx, cy=$cy, w=$w, h=$h (INPUT_SIZE=$INPUT_SIZE)")
                }

                // 모델 출력이 이미 0~1 정규화 좌표 → INPUT_SIZE로 나누지 않음
                val left = max(0f, cx - w / 2)
                val top = max(0f, cy - h / 2)
                val right = min(1f, cx + w / 2)
                val bottom = min(1f, cy + h / 2)

                rawDetections.add(Detection(
                    left = left,
                    top = top,
                    right = right,
                    bottom = bottom,
                    centerX = (left + right) / 2,
                    confidence = maxConf,
                    type = type
                ))
            }

            // 디버그 로그: 매 프레임 최대 confidence + 첫 감지 raw 좌표
            val debugFirst = rawDetections.firstOrNull()
            Log.d(TAG, "[processFrame] raw=${rawDetections.size}, maxBuilding=${String.format("%.3f", debugMaxBuildingConf)}, maxCup=${String.format("%.3f", debugMaxCupConf)}" +
                if (debugFirst != null) ", first: l=${String.format("%.4f", debugFirst.left)} t=${String.format("%.4f", debugFirst.top)} r=${String.format("%.4f", debugFirst.right)} b=${String.format("%.4f", debugFirst.bottom)}" else "")

            // NMS 적용 (타입별 분리)
            val buildingDetections = applyNMS(rawDetections.filter { it.type == "building" })
            val cupDetections = applyNMS(rawDetections.filter { it.type == "cup" })
            val allResults = buildingDetections + cupDetections

            // 감지 유무와 관계없이 항상 콜백 (0개일 때 JS에서 이전 박스 제거용)
            if (allResults.isNotEmpty()) {
                Log.d(TAG, "[processFrame] 감지! buildings=${buildingDetections.size}, cups=${cupDetections.size}")
            }
            callback.onDetections(allResults, now)
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
