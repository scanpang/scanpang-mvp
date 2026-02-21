package expo.modules.scanpangarcore

import android.opengl.GLES11Ext
import android.opengl.GLES20
import com.google.ar.core.Coordinates2d
import com.google.ar.core.Frame
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

/**
 * ARCore 카메라 배경 렌더러
 * OES 텍스처를 전체 화면 쿼드에 렌더링
 */
class BackgroundRenderer {

    private var textureId = -1
    private var program = 0
    private var positionAttrib = 0
    private var texCoordAttrib = 0
    private var texCoordsInitialized = false

    // NDC 전체 화면 쿼드 좌표
    private val quadVertices: FloatBuffer = ByteBuffer
        .allocateDirect(QUAD_COORDS.size * FLOAT_SIZE)
        .order(ByteOrder.nativeOrder())
        .asFloatBuffer()
        .put(QUAD_COORDS)
        .also { it.position(0) }

    // ARCore가 계산하는 텍스처 좌표
    private val transformedTexCoords: FloatBuffer = ByteBuffer
        .allocateDirect(QUAD_COORDS.size * FLOAT_SIZE)
        .order(ByteOrder.nativeOrder())
        .asFloatBuffer()

    fun getTextureId(): Int = textureId

    /**
     * GL 스레드에서 초기화
     */
    fun createOnGlThread() {
        // OES 외부 텍스처 생성
        val textures = IntArray(1)
        GLES20.glGenTextures(1, textures, 0)
        textureId = textures[0]

        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
        GLES20.glTexParameteri(
            GLES11Ext.GL_TEXTURE_EXTERNAL_OES,
            GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE
        )
        GLES20.glTexParameteri(
            GLES11Ext.GL_TEXTURE_EXTERNAL_OES,
            GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE
        )
        GLES20.glTexParameteri(
            GLES11Ext.GL_TEXTURE_EXTERNAL_OES,
            GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR
        )
        GLES20.glTexParameteri(
            GLES11Ext.GL_TEXTURE_EXTERNAL_OES,
            GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR
        )

        // 셰이더 프로그램 생성
        val vertexShader = loadShader(GLES20.GL_VERTEX_SHADER, VERTEX_SHADER)
        val fragmentShader = loadShader(GLES20.GL_FRAGMENT_SHADER, FRAGMENT_SHADER)

        program = GLES20.glCreateProgram()
        GLES20.glAttachShader(program, vertexShader)
        GLES20.glAttachShader(program, fragmentShader)
        GLES20.glLinkProgram(program)

        positionAttrib = GLES20.glGetAttribLocation(program, "a_Position")
        texCoordAttrib = GLES20.glGetAttribLocation(program, "a_TexCoord")

        texCoordsInitialized = false  // EGL 컨텍스트 재생성 시 UV 재계산 보장
    }

    /**
     * 카메라 프레임을 전체 화면에 렌더링
     */
    fun draw(frame: Frame) {
        // 최초 1회는 반드시 UV 좌표 계산 실행 (초기값 0.0f → 회색 화면 방지)
        if (!texCoordsInitialized || frame.hasDisplayGeometryChanged()) {
            frame.transformCoordinates2d(
                Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES,
                quadVertices,
                Coordinates2d.TEXTURE_NORMALIZED,
                transformedTexCoords
            )
            texCoordsInitialized = true
        }

        if (frame.timestamp == 0L) return

        // 깊이 테스트 비활성화 (배경이므로)
        GLES20.glDisable(GLES20.GL_DEPTH_TEST)
        GLES20.glDepthMask(false)

        GLES20.glUseProgram(program)

        // 카메라 텍스처 바인딩
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)

        // 버텍스 설정
        GLES20.glEnableVertexAttribArray(positionAttrib)
        GLES20.glVertexAttribPointer(
            positionAttrib, COORDS_PER_VERTEX,
            GLES20.GL_FLOAT, false, 0, quadVertices
        )

        GLES20.glEnableVertexAttribArray(texCoordAttrib)
        GLES20.glVertexAttribPointer(
            texCoordAttrib, COORDS_PER_VERTEX,
            GLES20.GL_FLOAT, false, 0, transformedTexCoords
        )

        // 그리기
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)

        // 정리
        GLES20.glDisableVertexAttribArray(positionAttrib)
        GLES20.glDisableVertexAttribArray(texCoordAttrib)
        GLES20.glDepthMask(true)
        GLES20.glEnable(GLES20.GL_DEPTH_TEST)
    }

    private fun loadShader(type: Int, source: String): Int {
        val shader = GLES20.glCreateShader(type)
        GLES20.glShaderSource(shader, source)
        GLES20.glCompileShader(shader)
        return shader
    }

    companion object {
        private const val FLOAT_SIZE = 4
        private const val COORDS_PER_VERTEX = 2

        // NDC 전체 화면 쿼드 (triangle strip)
        private val QUAD_COORDS = floatArrayOf(
            -1f, -1f, // 좌하
            +1f, -1f, // 우하
            -1f, +1f, // 좌상
            +1f, +1f  // 우상
        )

        private const val VERTEX_SHADER = """
            attribute vec4 a_Position;
            attribute vec2 a_TexCoord;
            varying vec2 v_TexCoord;
            void main() {
                gl_Position = a_Position;
                v_TexCoord = a_TexCoord;
            }
        """

        private const val FRAGMENT_SHADER = """
            #extension GL_OES_EGL_image_external : require
            precision mediump float;
            varying vec2 v_TexCoord;
            uniform samplerExternalOES u_Texture;
            void main() {
                gl_FragColor = texture2D(u_Texture, v_TexCoord);
            }
        """
    }
}
