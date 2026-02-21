package expo.modules.scanpangarcore

import android.content.Context
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.view.WindowManager
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

/**
 * ARCore 카메라 프리뷰 네이티브 뷰
 * GLSurfaceView로 ARCore 카메라 프레임 렌더링 + Geospatial pose 이벤트 발행
 */
class ScanPangARCoreView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {

    // View 이벤트 (JS로 전달)
    val onGeospatialPoseUpdate by EventDispatcher()
    val onTrackingStateChanged by EventDispatcher()
    val onAnchorPositionsUpdate by EventDispatcher()
    val onReady by EventDispatcher()
    val onError by EventDispatcher()

    private val glSurfaceView: GLSurfaceView
    val geospatialManager: GeospatialManager
    private val backgroundRenderer = BackgroundRenderer()
    private var isSessionCreated = false
    private var isPaused = false
    private var cameraTextureId = -1  // GL 스레드에서 생성된 텍스처 ID 캐시
    private var hasRenderedFirstFrame = false  // 첫 유효 프레임 렌더링 여부 (깜빡임 방지)

    // 포즈 업데이트 쓰로틀링 (200ms 간격)
    private var lastPoseUpdateTime = 0L
    private val POSE_UPDATE_INTERVAL = 200L

    // 뷰포트 크기 + 디스플레이 회전 (세션 생성 후 재적용 필요)
    private var viewWidth = 0
    private var viewHeight = 0
    private var displayRotation = 0

    init {
        geospatialManager = GeospatialManager(context)

        // 모듈에 활성 뷰 등록
        ScanPangARCoreModule.activeView = this

        // GLSurfaceView 설정
        glSurfaceView = GLSurfaceView(context).apply {
            preserveEGLContextOnPause = true
            setEGLContextClientVersion(2)
            setEGLConfigChooser(8, 8, 8, 8, 16, 0)
            setRenderer(ARRenderer())
            renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
        }

        addView(glSurfaceView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    }

    /**
     * ARCore 세션 시작
     */
    fun startSession() {
        if (isSessionCreated) return

        val activity = appContext.currentActivity
        if (activity == null) {
            onError(mapOf("error" to "no_activity"))
            return
        }

        // ARCore 지원 확인
        val availability = geospatialManager.checkAvailability()
        if (availability == "unsupported") {
            onError(mapOf("error" to "arcore_unsupported"))
            return
        }

        // 세션 생성
        if (geospatialManager.createSession(activity)) {
            isSessionCreated = true

            // 카메라 텍스처를 세션에 등록 (GL 스레드에서 이미 생성됨)
            if (cameraTextureId >= 0) {
                geospatialManager.setCameraTexture(cameraTextureId)
            }

            // 디스플레이 지오메트리 설정 (onSurfaceChanged가 세션 생성 전에 호출되어 누락됨)
            // 이 호출이 없으면 텍스처 좌표가 계산되지 않아 회색 화면 발생
            if (viewWidth > 0 && viewHeight > 0) {
                geospatialManager.setDisplayGeometry(displayRotation, viewWidth, viewHeight)
            }

            // 세션 resume → 카메라 피드 시작
            geospatialManager.resume()

            onReady(mapOf("status" to "session_created"))
        } else {
            onError(mapOf("error" to "session_create_failed"))
        }
    }

    fun pauseSession() {
        if (!isPaused && isSessionCreated) {
            isPaused = true
            hasRenderedFirstFrame = false  // resume 시 안정화 전까지 검은 화면 허용
            geospatialManager.pause()
            glSurfaceView.onPause()
        }
    }

    fun resumeSession() {
        if (isPaused && isSessionCreated) {
            isPaused = false
            geospatialManager.resume()
            glSurfaceView.onResume()
        }
    }

    fun destroySession() {
        geospatialManager.destroy()
        isSessionCreated = false
        hasRenderedFirstFrame = false
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (isPaused) {
            resumeSession()
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        if (ScanPangARCoreModule.activeView == this) {
            ScanPangARCoreModule.activeView = null
        }
        destroySession()
    }

    /**
     * GL 렌더러 — ARCore 프레임 처리 + 카메라 배경 렌더링
     */
    private inner class ARRenderer : GLSurfaceView.Renderer {

        override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
            GLES20.glClearColor(0f, 0f, 0f, 1f)
            backgroundRenderer.createOnGlThread()

            // 텍스처 ID 캐시 (세션 생성 후 등록됨)
            cameraTextureId = backgroundRenderer.getTextureId()

            // 메인 스레드에서 세션 시작 (세션 생성 → 텍스처 등록 → resume 순서)
            post { startSession() }
        }

        override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
            GLES20.glViewport(0, 0, width, height)
            viewWidth = width
            viewHeight = height
            val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
            displayRotation = wm.defaultDisplay.rotation
            geospatialManager.setDisplayGeometry(displayRotation, width, height)
        }

        override fun onDrawFrame(gl: GL10?) {
            // 세션 미생성/일시정지: 검은 화면
            if (!isSessionCreated || isPaused) {
                GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
                return
            }

            // ARCore 프레임 업데이트
            val frame = geospatialManager.update()

            // 유효한 프레임이 없는 경우:
            // - 첫 프레임 전: 검은 화면 (로딩 중)
            // - 첫 프레임 후: glClear 스킵 → 이전 버퍼 유지 (깜빡임 방지)
            if (frame == null || frame.timestamp == 0L) {
                if (!hasRenderedFirstFrame) {
                    GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
                }
                return
            }

            // 유효한 프레임: 클리어 + 카메라 배경 렌더링
            GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
            backgroundRenderer.draw(frame)
            hasRenderedFirstFrame = true

            // Tracking 상태 변화 이벤트
            if (geospatialManager.trackingStateChanged) {
                val state = geospatialManager.currentTrackingState
                post { onTrackingStateChanged(mapOf("state" to state)) }
            }

            // Geospatial pose + 앵커 위치 업데이트 (200ms 쓰로틀)
            val now = System.currentTimeMillis()
            if (now - lastPoseUpdateTime >= POSE_UPDATE_INTERVAL) {
                lastPoseUpdateTime = now
                val pose = geospatialManager.getCurrentPose()
                if (pose != null) {
                    post { onGeospatialPoseUpdate(pose) }
                }

                // 앵커 screen-space 좌표 업데이트
                if (viewWidth > 0 && viewHeight > 0) {
                    val anchorPositions = geospatialManager.getAnchorScreenPositions(
                        frame, viewWidth, viewHeight
                    )
                    if (anchorPositions.isNotEmpty()) {
                        post { onAnchorPositionsUpdate(mapOf("anchors" to anchorPositions)) }
                    }
                }
            }
        }
    }
}
