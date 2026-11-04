import org.gradle.api.tasks.testing.Test
import org.gradle.api.tasks.testing.logging.TestExceptionFormat
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

val buildNumber = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 1

base {
    archivesName.set("voxel-vpn")
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

android {
    namespace = "com.voxel.vpn"
    compileSdk = 37

    // Builds libvoxeldpi.so (src/main/cpp) here and the Go core in src/main/go/build-aar.sh.
    ndkVersion = "29.0.14206865"

    defaultConfig {
        applicationId = "com.voxel.vpn"
        minSdk = 24
        targetSdk = 37
        versionCode = buildNumber
        versionName = "0.1.$buildNumber"

        // The ABIs voxelcore.aar is built for (see src/main/go/build-aar.sh); libvoxeldpi.so follows the same list.
        ndk {
            abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64")
        }
    }

    // A development key kept in the repository so that every build is signed identically and can be
    // installed over the previous one. Override it with the VOXEL_* variables for a real release.
    signingConfigs {
        create("voxel") {
            storeFile = file(System.getenv("VOXEL_KEYSTORE") ?: "debug.keystore")
            storePassword = System.getenv("VOXEL_KEYSTORE_PASSWORD") ?: "android"
            keyAlias = System.getenv("VOXEL_KEY_ALIAS") ?: "voxel"
            keyPassword = System.getenv("VOXEL_KEY_PASSWORD") ?: "android"
            storeType = "pkcs12"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("voxel")
        }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("voxel")
        }
    }

    // The DPI engine: a small C++17 library (SOCKS5 proxy that cuts up the first payload of each connection).
    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    androidResources {
        localeFilters += listOf("en", "ru")
    }

    packaging {
        jniLibs {
            useLegacyPackaging = true
        }
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

// voxelcore.aar is Xray-core wrapped by gomobile. It is built once (about ten minutes cold) and then
// reused; pass -PrebuildCore to force a rebuild after changing the Go sources.
val coreAar = layout.projectDirectory.file("libs/voxelcore.aar")
val buildXrayCore by tasks.registering(Exec::class) {
    group = "build"
    description = "Builds libs/voxelcore.aar (Xray-core through gomobile); needs Go and the Android NDK."
    workingDir = layout.projectDirectory.dir("src/main/go").asFile
    commandLine("bash", "build-aar.sh")
    onlyIf { !coreAar.asFile.exists() || project.hasProperty("rebuildCore") }
}

dependencies {
    implementation(files("libs/voxelcore.aar").builtBy(buildXrayCore))

    implementation(libs.androidx.core.ktx)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.animation)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    testImplementation(libs.junit)
}

tasks.withType<Test>().configureEach {
    // XrayConfigBuilderTest writes the configurations it generates here; CI feeds them to the Go test
    // that loads each of them into the real Xray-core.
    val configDir = layout.buildDirectory.dir("xray-configs")
    systemProperty("voxel.configDumpDir", configDir.get().asFile.absolutePath)
    outputs.dir(configDir)
    testLogging {
        events("failed", "skipped")
        exceptionFormat = TestExceptionFormat.FULL
    }
}
