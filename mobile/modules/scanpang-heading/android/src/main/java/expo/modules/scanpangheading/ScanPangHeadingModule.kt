package expo.modules.scanpangheading

import android.content.Context
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

  override fun definition() = ModuleDefinition {
    Name("ScanPangHeading")

    Events("onHeadingUpdate")

    // heading 감시 시작
    Function("startWatching") {
      val ctx = appContext.reactContext ?: return@Function false
      val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
      sensorManager = sm

      val rotationSensor = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
        ?: return@Function false  // 센서 없으면 무시

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

          // 방위각 추출
          SensorManager.getOrientation(remappedMatrix, orientation)
          val azimuthDeg = (Math.toDegrees(orientation[0].toDouble()) + 360) % 360

          sendEvent("onHeadingUpdate", mapOf("heading" to azimuthDeg))
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
    }
  }
}
