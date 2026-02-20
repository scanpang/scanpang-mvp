package expo.modules.scanpangarcore

import com.google.ar.core.ArCoreApk
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * ScanPang ARCore Expo Module
 * - Geospatial pose 조회
 * - VPS 가용성 체크
 * - ARCore 지원 확인
 * - Terrain Anchor 생성/제거
 * - ARCameraView 네이티브 뷰 등록
 */
class ScanPangARCoreModule : Module() {

    companion object {
        // 활성 ARCameraView 참조
        var activeView: ScanPangARCoreView? = null
    }

    override fun definition() = ModuleDefinition {
        Name("ScanPangARCore")

        // ARCore 지원 여부 (동기)
        Function("isARCoreSupported") {
            try {
                val ctx = appContext.reactContext ?: return@Function false
                val availability = ArCoreApk.getInstance().checkAvailability(ctx)
                availability.isSupported
            } catch (e: Exception) {
                false
            }
        }

        // 현재 Geospatial pose 조회 (비동기)
        AsyncFunction("getGeospatialPose") {
            activeView?.geospatialManager?.getCurrentPose()
        }

        // VPS 가용성 체크 (비동기)
        AsyncFunction("checkVPSAvailability") { lat: Double, lng: Double, promise: Promise ->
            val manager = activeView?.geospatialManager
            if (manager?.session == null) {
                promise.resolve(false)
                return@AsyncFunction
            }
            manager.checkVPSAvailability(lat, lng) { available ->
                promise.resolve(available)
            }
        }

        // Terrain Anchor 생성 (비동기)
        AsyncFunction("createTerrainAnchor") { id: String, lat: Double, lng: Double, altAboveTerrain: Double, promise: Promise ->
            val manager = activeView?.geospatialManager
            if (manager == null) {
                promise.resolve(false)
                return@AsyncFunction
            }
            manager.createTerrainAnchor(id, lat, lng, altAboveTerrain) { success ->
                promise.resolve(success)
            }
        }

        // 앵커 제거 (동기)
        Function("removeAnchor") { id: String ->
            activeView?.geospatialManager?.removeAnchor(id)
        }

        // 모든 앵커 제거 (동기)
        Function("removeAllAnchors") {
            activeView?.geospatialManager?.removeAllAnchors()
        }

        // ARCameraView 네이티브 뷰
        View(ScanPangARCoreView::class) {
            Events(
                "onGeospatialPoseUpdate",
                "onTrackingStateChanged",
                "onAnchorPositionsUpdate",
                "onReady",
                "onError"
            )
        }
    }
}
