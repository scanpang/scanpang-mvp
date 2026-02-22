package expo.modules.scanpangarcore

import android.content.Context
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

/**
 * ARCore 카메라 프리뷰 네이티브 뷰
 * GLSurfaceView로 ARCore 카메라 프레임 렌더링 + Geospatial pose 이벤트 발행
 *
 * 초기화 순서 (GL Surface 기반):
 *   1. init: GLSurfaceView 생성 + 렌더러 등록
 *   2. GL thread: onSurfaceCreated → 텍스처 생성 → mainHandler로 세션 초기화 요청
 *   3. Main thread: initializeSession → 세션 생성 → displayGeometry 설정 → resume
 *   4. GL thread: queueEvent → setCameraTexture (GL 컨텍스트 보장)
 *   5. GL thread: onDrawFrame → session.update() → 카메라 렌더링
 *
 * EGL 컨텍스트 소실 시 (홈 복귀 등):
 *   onSurfaceCreated 재호출 → 새 텍스처 생성 → 기존 세션에 재등록
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
    // View.post 대신 Handler 사용 (View 미attach 상태에서도 확실히 실행)
    private val mainHandler = Handler(Looper.getMainLooper())

    private var isSessionCreated = false
    private var isPaused = false
    private var cameraTextureId = -1  // GL 스레드에서 생성된 텍스처 ID
    private var hasRenderedFirstFrame = false  // 깜빡임 방지용

    // 포즈 업데이트 쓰로틀링 (200ms 간격)
    private var lastPoseUpdateTime = 0L
    private val POSE_UPDATE_INTERVAL = 200L

    // 뷰포트 크기 + 디스플레이 회전 (세션 생성 시 적용)
    private var viewWidth = 0
    private var viewHeight = 0
    private var displayRotation = 0

    init {
        geospatialManager = GeospatialManager(context)

        // 모듈에 활성 뷰 등록
        ScanPangARCoreModule.activeView = this

        // GLSurfaceView 설정 (렌더러 등록 → GL 스레드 시작)
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
     * ARCore 세션 초기화 (메인 스레드에서 실행)
     * onSurfaceCreated에서만 호출됨 → GL 텍스처 생성 보장
     */
    private fun initializeSession() {
        if (isSessionCreated) return
        if (cameraTextureId < 0) return  // GL 텍스처 미생성 안전 가드

        val activity = appContext.currentActivity
        if (activity == null) {
            onError(mapOf("error" to "no_activity"))
            return
        }

        // ARCore 지원 확인
        if (geospatialManager.checkAvailability() == "unsupported") {
            onError(mapOf("error" to "arcore_unsupported"))
            return
        }

        // 세션 생성 (null=성공, 문자열=에러 코드)
        val sessionError = geospatialManager.createSession(activity)
        if (sessionError == null) {
            isSessionCreated = true

            // ※ setCameraTexture는 GL스레드에서만 호출해야 함
            // → onSurfaceCreated에서 queueEvent로 처리

            // 1. 디스플레이 지오메트리 설정 (onSurfaceChanged에서 캐시된 값)
            if (viewWidth > 0 && viewHeight > 0) {
                geospatialManager.setDisplayGeometry(displayRotation, viewWidth, viewHeight)
            }

            // 2. 세션 시작 → 카메라 피드 활성화
            geospatialManager.resume()

            onReady(mapOf("status" to "session_created"))
        } else {
            onError(mapOf("error" to sessionError))
        }
    }

    fun pauseSession() {
        if (!isPaused && isSessionCreated) {
            isPaused = true
            hasRenderedFirstFrame = false
            geospatialManager.pause()
            glSurfaceView.onPause()
        }
    }

    fun resumeSession() {
        if (isPaused && isSessionCreated) {
            isPaused = false
            geospatialManager.resume()
            glSurfaceView.onResume()
            // onResume 후 GL 스레드가 재시작됨:
            // - EGL 컨텍스트 유지 → onSurfaceChanged만 호출 → 정상 렌더링
            // - EGL 컨텍스트 소실 → onSurfaceCreated 재호출 → 텍스처 재등록
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
     * GL 렌더러 — onSurfaceCreated가 세션 초기화의 유일한 트리거
     */
    private inner class ARRenderer : GLSurfaceView.Renderer {

        override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
            GLES20.glClearColor(0f, 0f, 0f, 1f)

            // GL 텍스처 생성 (항상 새로 생성 — EGL 컨텍스트 소실 대응)
            backgroundRenderer.createOnGlThread()
            cameraTextureId = backgroundRenderer.getTextureId()
            hasRenderedFirstFrame = false

            if (isSessionCreated) {
                // EGL 컨텍스트 재생성됨 (홈 복귀 등):
                // 기존 세션은 살아있지만 GL 텍스처가 새로 만들어졌으므로 재등록
                geospatialManager.setCameraTexture(cameraTextureId)
            } else {
                // 최초 마운트: 메인스레드에서 세션 생성 후, GL스레드로 돌아와서 텍스처 등록
                mainHandler.post {
                    initializeSession()
                    // 세션 생성 완료 후 GL스레드에서 텍스처 등록
                    glSurfaceView.queueEvent {
                        if (isSessionCreated && cameraTextureId >= 0) {
                            geospatialManager.setCameraTexture(cameraTextureId)
                        }
                    }
                }
            }
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
                mainHandler.post { onTrackingStateChanged(mapOf("state" to state)) }
            }

            // Geospatial pose + depth + 앵커 위치 업데이트 (200ms 쓰로틀)
            val now = System.currentTimeMillis()
            if (now - lastPoseUpdateTime >= POSE_UPDATE_INTERVAL) {
                lastPoseUpdateTime = now
                val pose = geospatialManager.getCurrentPose()
                if (pose != null) {
                    // depth 정보 추가
                    val poseWithDepth = pose.toMutableMap()
                    val depthMeters = geospatialManager.getCenterDepth(frame)
                    if (depthMeters != null) poseWithDepth["depthMeters"] = depthMeters
                    poseWithDepth["depthSupported"] = geospatialManager.isDepthSupported
                    mainHandler.post { onGeospatialPoseUpdate(poseWithDepth) }
                }

                // 앵커 screen-space 좌표 업데이트
                if (viewWidth > 0 && viewHeight > 0) {
                    val anchorPositions = geospatialManager.getAnchorScreenPositions(
                        frame, viewWidth, viewHeight
                    )
                    if (anchorPositions.isNotEmpty()) {
                        mainHandler.post { onAnchorPositionsUpdate(mapOf("anchors" to anchorPositions)) }
                    }
                }
            }
        }
    }
}
