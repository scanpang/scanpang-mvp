package expo.modules.scanpangarcore

import android.util.Log
import com.google.ar.core.Frame
import com.google.ar.core.SemanticLabel
import com.google.ar.core.exceptions.NotYetAvailableException
import java.util.concurrent.atomic.AtomicBoolean

private const val TAG = "BuildingSemanticDetector"

/**
 * ARCore Scene Semantics 기반 건물 감지
 * - 별도 모델 파일 불필요 (ARCore 내장)
 * - acquireSemanticImage() → 건물 픽셀 추출 → 컬럼 클러스터링 → 바운딩박스
 * - 300ms 쓰로틀링 + AtomicBoolean 동시 처리 방지
 * - 건물 영역 confidence ≥ 50% 필터
 */
class BuildingSemanticDetector {

    /**
     * 건물 영역 (정규화 좌표 0~1)
     */
    data class BuildingRegion(
        val left: Float,
        val top: Float,
        val right: Float,
        val bottom: Float,
        val centerX: Float,
        val confidence: Float  // 영역 내 건물 픽셀 비율
    )

    /**
     * 결과 콜백
     */
    interface ResultCallback {
        fun onBuildingRegions(regions: List<BuildingRegion>, timestamp: Long)
    }

    private val isProcessing = AtomicBoolean(false)
    private var lastProcessTime = 0L
    private val THROTTLE_MS = 300L

    // 건물 영역 최소 기준
    private val MIN_COLUMN_BUILDING_RATIO = 0.10f  // 컬럼의 10% 이상이 건물
    private val MIN_CONFIDENCE = 0.50f              // 영역 내 건물 비율 50% 이상

    /**
     * ARCore Frame에서 Scene Semantics로 건물 영역 감지
     * GL 스레드에서 호출 — acquireSemanticImage는 동기 호출이나 매우 가벼움
     */
    fun processFrame(frame: Frame, callback: ResultCallback) {
        val now = System.currentTimeMillis()
        if (now - lastProcessTime < THROTTLE_MS) return
        if (!isProcessing.compareAndSet(false, true)) return
        lastProcessTime = now

        try {
            val semanticImage = frame.acquireSemanticImage()
            try {
                val w = semanticImage.width
                val h = semanticImage.height
                val plane = semanticImage.planes[0]
                val buffer = plane.buffer
                val rowStride = plane.rowStride

                // SemanticLabel.BUILDING = 건물 클래스
                val buildingLabel = SemanticLabel.BUILDING.ordinal.toByte()

                // 각 컬럼의 건물 픽셀 비율 계산
                val columnRatio = FloatArray(w) { col ->
                    var buildingPixels = 0
                    for (row in 0 until h) {
                        val pixel = buffer.get(row * rowStride + col)
                        if (pixel == buildingLabel) buildingPixels++
                    }
                    buildingPixels.toFloat() / h
                }

                // 인접 건물 컬럼 그룹화 → 바운딩박스 추출
                val regions = extractRegions(columnRatio, buffer, buildingLabel, w, h, rowStride)

                if (regions.isNotEmpty()) {
                    callback.onBuildingRegions(regions, frame.timestamp)
                }
            } finally {
                semanticImage.close()
            }
        } catch (_: NotYetAvailableException) {
            // 세션 초기화 중 — 정상, 무시
        } catch (e: Exception) {
            Log.w(TAG, "[processFrame] 시맨틱 감지 실패: ${e.message}")
        } finally {
            isProcessing.set(false)
        }
    }

    /**
     * 컬럼 기반 클러스터링으로 건물 바운딩박스 추출
     */
    private fun extractRegions(
        columnRatio: FloatArray,
        buffer: java.nio.ByteBuffer,
        buildingLabel: Byte,
        w: Int,
        h: Int,
        rowStride: Int
    ): List<BuildingRegion> {
        val regions = mutableListOf<BuildingRegion>()
        var regionStart = -1

        for (col in 0..w) {
            val isBuildingCol = col < w && columnRatio[col] > MIN_COLUMN_BUILDING_RATIO

            if (isBuildingCol && regionStart == -1) {
                regionStart = col
            } else if (!isBuildingCol && regionStart != -1) {
                // 영역 끝 → 수직 범위 계산
                var minRow = h
                var maxRow = 0
                var totalBuildingPixels = 0

                for (c in regionStart until col) {
                    for (r in 0 until h) {
                        if (buffer.get(r * rowStride + c) == buildingLabel) {
                            totalBuildingPixels++
                            if (r < minRow) minRow = r
                            if (r > maxRow) maxRow = r
                        }
                    }
                }

                val regionPixels = (col - regionStart) * (maxRow - minRow + 1)
                val confidence = if (regionPixels > 0) totalBuildingPixels.toFloat() / regionPixels else 0f

                // 임계값 50% 이상만 통과
                if (confidence >= MIN_CONFIDENCE) {
                    regions.add(BuildingRegion(
                        left = regionStart.toFloat() / w,
                        top = minRow.toFloat() / h,
                        right = col.toFloat() / w,
                        bottom = (maxRow + 1).toFloat() / h,
                        centerX = (regionStart + col).toFloat() / (2 * w),
                        confidence = confidence
                    ))
                }

                regionStart = -1
            }
        }

        return regions
    }

    fun destroy() {
        // ARCore 내장 기능이므로 별도 해제 불필요
        Log.d(TAG, "[destroy] BuildingSemanticDetector 해제")
    }
}
