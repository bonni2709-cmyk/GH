// The JNI face of the engine: com.voxel.vpn.vpn.DpiEngine (see DpiEngine.kt).

#include <jni.h>

#include <mutex>
#include <string>

#include "desync.hpp"
#include "engine.hpp"
#include "log.hpp"
#include "strategy.hpp"

namespace {

// Never destroyed: connection threads may still be running when the process unloads the library.
voxel::dpi::Engine& engine() {
  static voxel::dpi::Engine* instance = new voxel::dpi::Engine();
  return *instance;
}

std::mutex g_control;

std::string to_std(JNIEnv* env, jstring text) {
  if (text == nullptr) return {};
  const char* chars = env->GetStringUTFChars(text, nullptr);
  if (chars == nullptr) return {};
  std::string out(chars);
  env->ReleaseStringUTFChars(text, chars);
  return out;
}

jstring to_java(JNIEnv* env, const std::string& text) { return env->NewStringUTF(text.c_str()); }

}  // namespace

extern "C" {

/** Starts the proxy: "OK:<port>" or "ERR:<message>". [hosts] is `name=ip,ip;name=ip` (may be empty). */
JNIEXPORT jstring JNICALL Java_com_voxel_vpn_vpn_DpiEngine_nativeStart(JNIEnv* env, jobject, jstring strategy, jstring user, jstring pass, jstring hosts) {
  std::lock_guard<std::mutex> lock(g_control);
  voxel::dpi::EngineOptions options;
  std::string error;
  if (!voxel::dpi::parse_strategy(to_std(env, strategy), &options.strategy, &error)) return to_java(env, "ERR:" + error);
  if (!voxel::dpi::parse_hosts(to_std(env, hosts), &options.hosts)) return to_java(env, "ERR:malformed host list");
  options.credentials = {to_std(env, user), to_std(env, pass)};
  engine().stop();
  if (!engine().start(options, &error)) return to_java(env, "ERR:" + error);
  return to_java(env, "OK:" + std::to_string(engine().port()));
}

JNIEXPORT void JNICALL Java_com_voxel_vpn_vpn_DpiEngine_nativeStop(JNIEnv*, jobject) {
  std::lock_guard<std::mutex> lock(g_control);
  engine().stop();
}

/** accepted, active, connected, desynced, failed, bytes up, bytes down. */
JNIEXPORT jlongArray JNICALL Java_com_voxel_vpn_vpn_DpiEngine_nativeStats(JNIEnv* env, jobject) {
  const voxel::dpi::Stats s = engine().stats();
  const jlong values[7] = {static_cast<jlong>(s.accepted), static_cast<jlong>(s.active),   static_cast<jlong>(s.connected), static_cast<jlong>(s.desynced),
                           static_cast<jlong>(s.failed),   static_cast<jlong>(s.bytes_up), static_cast<jlong>(s.bytes_down)};
  jlongArray array = env->NewLongArray(7);
  if (array != nullptr) env->SetLongArrayRegion(array, 0, 7, values);
  return array;
}

/** The queued log lines, one per line, each "<level letter>|<text>". */
JNIEXPORT jstring JNICALL Java_com_voxel_vpn_vpn_DpiEngine_nativeDrainLog(JNIEnv* env, jobject) {
  std::string joined;
  for (const std::string& line : voxel::dpi::log_drain()) {
    joined += line;
    joined += '\n';
  }
  return to_java(env, joined);
}

/** "OK:<canonical strategy>" or "ERR:<what is wrong>". */
JNIEXPORT jstring JNICALL Java_com_voxel_vpn_vpn_DpiEngine_nativeCheck(JNIEnv* env, jobject, jstring strategy) {
  voxel::dpi::Strategy parsed;
  std::string error;
  if (!voxel::dpi::parse_strategy(to_std(env, strategy), &parsed, &error)) return to_java(env, "ERR:" + error);
  return to_java(env, "OK:" + parsed.describe());
}

/** "version=<v>;fake=<0|1>". */
JNIEXPORT jstring JNICALL Java_com_voxel_vpn_vpn_DpiEngine_nativeInfo(JNIEnv* env, jobject) {
  return to_java(env, std::string("version=") + voxel::dpi::kVersion + ";fake=" + (voxel::dpi::fake_supported() ? "1" : "0"));
}

JNIEXPORT void JNICALL Java_com_voxel_vpn_vpn_DpiEngine_nativeSetDebug(JNIEnv*, jobject, jboolean enabled) { voxel::dpi::log_set_debug(enabled == JNI_TRUE); }

}  // extern "C"
