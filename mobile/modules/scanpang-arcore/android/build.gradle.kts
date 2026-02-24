plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "expo.modules.scanpangarcore"
    compileSdk = 35

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    // assets 디렉토리 (YOLO TFLite 모델)
    sourceSets {
        getByName("main") {
            assets.srcDirs("src/main/assets")
        }
    }
}

dependencies {
    implementation(project(":expo-modules-core"))

    // Camera2 API (Android 프레임워크 내장 — 추가 의존성 불필요)

    // TensorFlow Lite (CPU only)
    implementation("org.tensorflow:tensorflow-lite:2.14.0")
}
