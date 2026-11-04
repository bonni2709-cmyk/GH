#pragma once

#include <string>
#include <vector>

namespace voxel::dpi {

enum class LogLevel : char { Debug = 'D', Info = 'I', Warn = 'W', Error = 'E' };

/** Queues one line for the host application. Safe to call from any thread. */
void log_write(LogLevel level, const std::string& text);
void logf(LogLevel level, const char* fmt, ...) __attribute__((format(printf, 2, 3)));

/** Takes the queued lines out of the queue. Each one is "<level letter>|<text>". */
std::vector<std::string> log_drain();

/** Debug lines are dropped unless this is switched on. */
void log_set_debug(bool enabled);
/** Also prints every line to stderr (the command line tool). */
void log_set_echo(bool enabled);

}  // namespace voxel::dpi
