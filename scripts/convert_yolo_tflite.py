"""
YOLO OIV7 → TFLite 변환 스크립트

사용법:
  pip install ultralytics
  python scripts/convert_yolo_tflite.py

산출물: yolov8s-oiv7_float32.tflite (~23MB)
배치 위치: mobile/modules/scanpang-arcore/android/src/main/assets/
"""
from ultralytics import YOLO

model = YOLO("yolov8s-oiv7.pt")
model.export(format="tflite", imgsz=320)

print("변환 완료! 생성된 .tflite 파일을 아래 경로에 복사하세요:")
print("  mobile/modules/scanpang-arcore/android/src/main/assets/yolov8s-oiv7.tflite")
