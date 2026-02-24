package expo.modules.scanpangarcore

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * ScanPang Expo Module — CameraX + YOLO TFLite 건물 감지
 * ARCore 제거 후 단순화: ARCameraView + 3개 이벤트
 */
class ScanPangARCoreModule : Module() {

    companion object {
        // 활성 ARCameraView 참조
        var activeView: ScanPangARCoreView? = null
    }

    override fun definition() = ModuleDefinition {
        Name("ScanPangARCore")

        // ARCameraView 네이티브 뷰 (CameraX 프리뷰 + YOLO 감지)
        View(ScanPangARCoreView::class) {
            Events(
                "onObjectDetection",
                "onReady",
                "onError"
            )
        }
    }
}
