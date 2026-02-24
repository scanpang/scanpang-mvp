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
}

dependencies {
    implementation(project(":expo-modules-core"))
    implementation("com.google.ar:core:1.42.0")
    api("com.google.android.gms:play-services-location:21.1.0")
    // ML Kit Object Detection — 건물 객체 인식
    implementation("com.google.mlkit:object-detection:17.0.2")
}
