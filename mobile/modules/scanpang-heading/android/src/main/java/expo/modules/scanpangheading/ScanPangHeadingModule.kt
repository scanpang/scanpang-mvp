package expo.modules.scanpangheading

import android.content.Context
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ScanPangHeadingModule : Module() {

  private var sensorManager: SensorManager? = null
  private var listener: SensorEventListener? = null

  // 회전 행렬 버퍼 (재사용)
  private val rotationMatrix = FloatArray(9)
  private val remappedMatrix = FloatArray(9)
  private val orientation = FloatArray(3)

  // 자기편차 보정 (진북 변환)
  private var declination = 0f

  // Low-pass 필터 (미세떨림 보정)
  private var filteredHeading = -1.0
  private val ALPHA = 0.15  // 새 값 반영 비율 (낮을수록 부드러움)

  override fun definition() = ModuleDefinition {
    Name("ScanPangHeading")

    Events("onHeadingUpdate")

    // GPS 좌표 수신 → 자기편차 계산
    Function("setLocation") { lat: Double, lng: Double, alt: Double ->
      val geoField = GeomagneticField(
        lat.toFloat(), lng.toFloat(), alt.toFloat(),
        System.currentTimeMillis()
      )
      declination = geoField.declination
    }

    // heading 감시 시작
    Function("startWatching") {
      val ctx = appContext.reactContext ?: return@Function false
      val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
      sensorManager = sm

      val rotationSensor = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
        ?: return@Function false

      val sensorListener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
          // 회전 벡터 → 회전 행렬
          SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)

          // 세로 들기 보정: AXIS_X, AXIS_Z
          SensorManager.remapCoordinateSystem(
            rotationMatrix,
            SensorManager.AXIS_X,
            SensorManager.AXIS_Z,
            remappedMatrix
          )

          // 방위각 추출 + 자기편차 보정 (자북 → 진북)
          SensorManager.getOrientation(remappedMatrix, orientation)
          val rawDeg = (Math.toDegrees(orientation[0].toDouble()) + 360) % 360
          val trueDeg = (rawDeg + declination + 360) % 360

          // Low-pass 필터 (각도 래핑 처리)
          val result = if (filteredHeading < 0) {
            trueDeg
          } else {
            var diff = trueDeg - filteredHeading
            if (diff > 180) diff -= 360
            if (diff < -180) diff += 360
            (filteredHeading + ALPHA * diff + 360) % 360
          }
          filteredHeading = result

          sendEvent("onHeadingUpdate", mapOf("heading" to result))
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
      }

      listener = sensorListener
      sm.registerListener(sensorListener, rotationSensor, SensorManager.SENSOR_DELAY_GAME)
      return@Function true
    }

    // heading 감시 중지
    Function("stopWatching") {
      listener?.let { sensorManager?.unregisterListener(it) }
      listener = null
      sensorManager = null
      filteredHeading = -1.0
    }
  }
}
