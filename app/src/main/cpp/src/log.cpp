#include "log.hpp"

#include <cstdarg>
#include <cstdio>
#include <deque>
#include <mutex>

namespace voxel::dpi {
namespace {

std::mutex g_mutex;
std::deque<std::string> g_lines;
bool g_debug = false;
bool g_echo = false;
constexpr size_t kMaxLines = 256;

}  // namespace

void log_write(LogLevel level, const std::string& text) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (level == LogLevel::Debug && !g_debug) return;
  std::string line;
  line.reserve(text.size() + 2);
  line.push_back(static_cast<char>(level));
  line.push_back('|');
  for (char c : text) line.push_back(c == '\n' || c == '\r' ? ' ' : c);
  if (g_echo) std::fprintf(stderr, "%s\n", line.c_str());
  g_lines.push_back(std::move(line));
  while (g_lines.size() > kMaxLines) g_lines.pop_front();
}

void logf(LogLevel level, const char* fmt, ...) {
  char buffer[512];
  va_list args;
  va_start(args, fmt);
  std::vsnprintf(buffer, sizeof(buffer), fmt, args);
  va_end(args);
  log_write(level, buffer);
}

std::vector<std::string> log_drain() {
  std::lock_guard<std::mutex> lock(g_mutex);
  std::vector<std::string> out(g_lines.begin(), g_lines.end());
  g_lines.clear();
  return out;
}

void log_set_debug(bool enabled) {
  std::lock_guard<std::mutex> lock(g_mutex);
  g_debug = enabled;
}

void log_set_echo(bool enabled) {
  std::lock_guard<std::mutex> lock(g_mutex);
  g_echo = enabled;
}

}  // namespace voxel::dpi
