import org.jetbrains.compose.desktop.application.dsl.TargetFormat
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("multiplatform")
    kotlin("plugin.serialization")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.compose")
    id("com.android.application")
}

kotlin {
    androidTarget {
        compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
    }
    jvm("desktop") {
        // Lazysodium's desktop release is compiled for Java 21.
        compilerOptions { jvmTarget.set(JvmTarget.JVM_21) }
    }
    sourceSets {
        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.materialIconsExtended)
            implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.2")
            implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
        }
        val jvmSharedMain by creating {
            dependsOn(commonMain.get())
            dependencies {
                // Android and desktop provide matching implementations and native binaries.
                compileOnly("com.goterl:lazysodium-java:5.2.0")
                implementation("com.google.zxing:core:3.5.3")
            }
        }
        androidMain {
            dependsOn(jvmSharedMain)
            dependencies {
                implementation("androidx.activity:activity-compose:1.10.1")
                implementation("androidx.core:core-ktx:1.16.0")
                implementation("com.goterl:lazysodium-android:5.2.0@aar")
                implementation("net.java.dev.jna:jna:5.17.0@aar")
                implementation("net.zetetic:sqlcipher-android:4.12.0@aar")
                implementation("androidx.sqlite:sqlite:2.5.0")
                implementation("com.journeyapps:zxing-android-embedded:4.3.0")
            }
        }
        val desktopMain by getting {
            dependsOn(jvmSharedMain)
            dependencies {
                implementation(compose.desktop.currentOs)
                implementation("com.goterl:lazysodium-java:5.2.0")
                implementation("net.java.dev.jna:jna-platform:5.17.0")
                implementation("io.github.willena:sqlite-jdbc:3.46.1.0")
                implementation("com.github.sarxos:webcam-capture:0.3.12")
                implementation("com.google.zxing:javase:3.5.3")
            }
        }
        val desktopTest by getting {
            dependencies {
                implementation(kotlin("test"))
                implementation("junit:junit:4.13.2")
            }
        }
    }
}

android {
    namespace = "chat.vale.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "chat.vale.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    packaging.resources.excludes += setOf("META-INF/AL2.0", "META-INF/LGPL2.1", "META-INF/LICENSE*")
}

compose.desktop {
    application {
        mainClass = "chat.vale.desktop.MainKt"
        nativeDistributions {
            targetFormats(TargetFormat.Exe)
            packageName = "Vale"
            packageVersion = "0.1.0"
            description = "A quieter place to connect."
            vendor = "Vale"
            windows {
                menuGroup = "Vale"
                shortcut = true
            }
        }
    }
}
