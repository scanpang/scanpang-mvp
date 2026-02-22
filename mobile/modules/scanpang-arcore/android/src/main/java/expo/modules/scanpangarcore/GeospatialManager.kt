package expo.modules.scanpangarcore

import android.app.Activity
import android.content.Context
import android.opengl.Matrix
import android.os.Handler
import android.os.Looper
import com.google.ar.core.*
import com.google.ar.core.exceptions.*
import java.util.concurrent.ConcurrentHashMap

/**
 * ARCore Geospatial 세션 관리
 * - ARCore Session 생성 (GeospatialMode.ENABLED)
 * - Earth tracking 상태 모니터링
 * - Geospatial pose 획득
 * - VPS 가용성 체크
 */
class GeospatialManager(private val context: Context) {

    var session: Session? = null
        private set

    private var lastTrackingState: TrackingState? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    // 상태 (GL 스레드에서 업데이트, 메인 스레드에서 읽기)
    @Volatile
    var currentTrackingState: String = "initializing"
        private set

    @Volatile
    var trackingStateChanged: Boolean = false
        private set

    // 앵커 관리 (Phase 4) — GL/메인 스레드 양쪽에서 접근
    private val anchors = ConcurrentHashMap<String, Anchor>()

    /**
     * ARCore 지원 여부 확인
     */
    fun checkAvailability(): String {
        return try {
            val availability = ArCoreApk.getInstance().checkAvailability(context)
            when {
                availability.isSupported -> "supported"
                availability.isTransient -> "checking"
                else -> "unsupported"
            }
        } catch (e: Exception) {
            "unsupported"
        }
    }

    /**
     * ARCore 세션 생성 + Geospatial 모드 활성화
     * 성공 시 null, 실패 시 에러 코드 문자열 반환
     */
    fun createSession(activity: Activity): String? {
        return try {
            // ARCore 설치 확인 (프롬프트 없이)
            val installStatus = ArCoreApk.getInstance().requestInstall(activity, false)
            if (installStatus != ArCoreApk.InstallStatus.INSTALLED) {
                return "arcore_not_installed"
            }

            session = Session(activity).also { s ->
                // Geospatial 모드 지원 확인
                if (!s.isGeospatialModeSupported(Config.GeospatialMode.ENABLED)) {
                    s.close()
                    session = null
                    return "geospatial_not_supported"
                }

                val config = Config(s).apply {
                    geospatialMode = Config.GeospatialMode.ENABLED
                    updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
                    // 불필요한 기능 비활성화 (성능 최적화)
                    planeFindingMode = Config.PlaneFindingMode.DISABLED
                    depthMode = Config.DepthMode.DISABLED
                    lightEstimationMode = Config.LightEstimationMode.DISABLED
                }
                s.configure(config)
            }
            null // 성공
        } catch (e: UnavailableArcoreNotInstalledException) {
            "arcore_not_installed"
        } catch (e: UnavailableDeviceNotCompatibleException) {
            "device_not_compatible"
        } catch (e: UnavailableSdkTooOldException) {
            "arcore_sdk_too_old"
        } catch (e: UnavailableUserDeclinedInstallationException) {
            "user_declined_install"
        } catch (e: Exception) {
            "session_exception:${e.message}"
        }
    }

    /**
     * GL 스레드에서 매 프레임 호출
     * 카메라 프레임 업데이트 + Earth 상태 추출
     */
    fun update(): Frame? {
        val session = this.session ?: return null
        return try {
            val frame = session.update()
            processEarthState(session)
            frame
        } catch (e: CameraNotAvailableException) {
            null
        } catch (e: Exception) {
            null
        }
    }

    private fun processEarthState(session: Session) {
        val earth = session.earth ?: return
        val state = earth.trackingState

        // Tracking 상태 변화 감지
        if (state != lastTrackingState) {
            lastTrackingState = state
            currentTrackingState = when (state) {
                TrackingState.TRACKING -> "tracking"
                TrackingState.PAUSED -> "limited"
                TrackingState.STOPPED -> "stopped"
                else -> "initializing"
            }
            trackingStateChanged = true
        } else {
            trackingStateChanged = false
        }
    }

    /**
     * 현재 Geospatial pose 반환 (동기)
     */
    fun getCurrentPose(): Map<String, Any>? {
        val earth = session?.earth ?: return null
        if (earth.trackingState != TrackingState.TRACKING) return null

        val pose = earth.cameraGeospatialPose
        return mapOf(
            "latitude" to pose.latitude,
            "longitude" to pose.longitude,
            "altitude" to pose.altitude,
            "heading" to pose.heading,
            "horizontalAccuracy" to pose.horizontalAccuracy.toDouble(),
            "headingAccuracy" to pose.headingAccuracy.toDouble(),
            "verticalAccuracy" to pose.verticalAccuracy.toDouble()
        )
    }

    /**
     * VPS 가용성 체크 (비동기)
     */
    fun checkVPSAvailability(lat: Double, lng: Double, callback: (Boolean) -> Unit) {
        val session = this.session
        if (session == null) {
            callback(false)
            return
        }
        try {
            session.checkVpsAvailabilityAsync(lat, lng) { availability ->
                mainHandler.post {
                    callback(availability == VpsAvailability.AVAILABLE)
                }
            }
        } catch (e: Exception) {
            callback(false)
        }
    }

    /**
     * Terrain Anchor 생성 (Phase 4)
     */
    fun createTerrainAnchor(
        id: String, lat: Double, lng: Double, altAboveTerrain: Double,
        callback: (Boolean) -> Unit
    ) {
        val earth = session?.earth
        if (earth == null || earth.trackingState != TrackingState.TRACKING) {
            callback(false)
            return
        }
        try {
            earth.resolveAnchorOnTerrainAsync(
                lat, lng, altAboveTerrain,
                0f, 0f, 0f, 1f, // 기본 회전 (identity quaternion)
            ) { anchor, state ->
                mainHandler.post {
                    if (state == Anchor.TerrainAnchorState.SUCCESS && anchor != null) {
                        anchors[id] = anchor
                        callback(true)
                    } else {
                        callback(false)
                    }
                }
            }
        } catch (e: Exception) {
            callback(false)
        }
    }

    /**
     * 앵커 제거
     */
    fun removeAnchor(id: String) {
        anchors[id]?.detach()
        anchors.remove(id)
    }

    /**
     * 모든 앵커 제거
     */
    fun removeAllAnchors() {
        anchors.values.forEach { it.detach() }
        anchors.clear()
    }

    /**
     * 앵커들의 screen-space 좌표 투영 (GL 스레드에서 호출)
     */
    fun getAnchorScreenPositions(frame: Frame, viewWidth: Int, viewHeight: Int): List<Map<String, Any>> {
        if (anchors.isEmpty()) return emptyList()

        val viewMatrix = FloatArray(16)
        val projMatrix = FloatArray(16)
        frame.camera.getViewMatrix(viewMatrix, 0)
        frame.camera.getProjectionMatrix(projMatrix, 0, 0.1f, 300f)

        val results = mutableListOf<Map<String, Any>>()
        for ((id, anchor) in anchors) {
            if (anchor.trackingState != TrackingState.TRACKING) continue

            val pose = anchor.pose
            val worldPos = floatArrayOf(pose.tx(), pose.ty(), pose.tz(), 1f)

            // View space
            val viewPos = FloatArray(4)
            Matrix.multiplyMV(viewPos, 0, viewMatrix, 0, worldPos, 0)

            // Clip space
            val clipPos = FloatArray(4)
            Matrix.multiplyMV(clipPos, 0, projMatrix, 0, viewPos, 0)

            if (clipPos[3] <= 0) continue // 카메라 뒤

            // NDC → Screen
            val ndcX = clipPos[0] / clipPos[3]
            val ndcY = clipPos[1] / clipPos[3]
            val screenX = ((ndcX + 1f) * 0.5f * viewWidth).toDouble()
            val screenY = ((1f - ndcY) * 0.5f * viewHeight).toDouble()

            // 카메라로부터 거리
            val dist = Math.sqrt(
                (viewPos[0] * viewPos[0] + viewPos[1] * viewPos[1] + viewPos[2] * viewPos[2]).toDouble()
            )

            results.add(mapOf(
                "id" to id,
                "screenX" to screenX,
                "screenY" to screenY,
                "distance" to dist,
                "resolved" to true
            ))
        }
        return results
    }

    /**
     * 카메라 텍스처 ID 설정 (GL 스레드)
     */
    fun setCameraTexture(textureId: Int) {
        session?.setCameraTextureName(textureId)
    }

    /**
     * 디스플레이 지오메트리 업데이트
     */
    fun setDisplayGeometry(rotation: Int, width: Int, height: Int) {
        session?.setDisplayGeometry(rotation, width, height)
    }

    fun pause() {
        try { session?.pause() } catch (_: Exception) {}
    }

    fun resume() {
        try { session?.resume() } catch (_: Exception) {}
    }

    fun destroy() {
        anchors.values.forEach { it.detach() }
        anchors.clear()
        session?.close()
        session = null
        lastTrackingState = null
    }
}
