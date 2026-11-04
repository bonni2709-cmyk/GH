// voxel-dpi: the engine as a command line tool, for development and for the host tests.
//
//   voxel-dpi --user U --pass P [--strategy TEXT] [--port N] [--hosts name=ip,...] [--allow-local] [--debug]
//       runs the proxy until SIGINT/SIGTERM; prints "READY <port>" once it listens and "STATS ..." when it stops
//   voxel-dpi --check TEXT          prints the canonical form of a strategy (exit status 2 when it is invalid)
//   voxel-dpi --plan TEXT < file    shows how a strategy cuts the payload read from stdin

#include <signal.h>
#include <unistd.h>

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <iterator>
#include <string>

#include "desync.hpp"
#include "engine.hpp"
#include "log.hpp"
#include "strategy.hpp"

namespace {

int usage() {
  std::fprintf(stderr, "usage: voxel-dpi --user U --pass P [--strategy TEXT] [--port N] [--hosts LIST] [--allow-local] [--debug]\n"
                       "       voxel-dpi --check TEXT\n"
                       "       voxel-dpi --plan TEXT < payload\n");
  return 64;
}

int plan_command(const std::string& text) {
  voxel::dpi::Strategy strategy;
  std::string error;
  if (!voxel::dpi::parse_strategy(text, &strategy, &error)) {
    std::fprintf(stderr, "invalid strategy: %s\n", error.c_str());
    return 2;
  }
  const std::string input((std::istreambuf_iterator<char>(std::cin)), std::istreambuf_iterator<char>());
  const voxel::dpi::Plan plan = voxel::dpi::build_plan(strategy, reinterpret_cast<const uint8_t*>(input.data()), input.size());
  const char* kind = plan.kind == voxel::dpi::PayloadKind::TlsClientHello ? "tls" : plan.kind == voxel::dpi::PayloadKind::HttpRequest ? "http" : "other";
  std::printf("kind=%s input=%zu stream=%zu segments=%zu\n", kind, input.size(), plan.stream.size(), plan.segment_count());
  size_t begin = 0;
  for (size_t i = 0; i <= plan.cuts.size(); ++i) {
    const size_t end = i < plan.cuts.size() ? plan.cuts[i] : plan.stream.size();
    std::printf("segment %zu: %zu..%zu (%zu bytes)\n", i, begin, end, end - begin);
    begin = end;
  }
  return 0;
}

}  // namespace

int main(int argc, char** argv) {
  std::string strategy_text;
  std::string user;
  std::string pass;
  std::string hosts;
  unsigned port = 0;
  bool allow_local = false;
  for (int i = 1; i < argc; ++i) {
    const std::string arg = argv[i];
    const bool has_next = i + 1 < argc;
    if (arg == "--check" && has_next) {
      voxel::dpi::Strategy strategy;
      std::string error;
      if (!voxel::dpi::parse_strategy(argv[i + 1], &strategy, &error)) {
        std::fprintf(stderr, "invalid strategy: %s\n", error.c_str());
        return 2;
      }
      std::printf("%s\n", strategy.describe().c_str());
      return 0;
    }
    if (arg == "--plan" && has_next) return plan_command(argv[i + 1]);
    if (arg == "--strategy" && has_next) strategy_text = argv[++i];
    else if (arg == "--user" && has_next) user = argv[++i];
    else if (arg == "--pass" && has_next) pass = argv[++i];
    else if (arg == "--hosts" && has_next) hosts = argv[++i];
    else if (arg == "--port" && has_next) port = static_cast<unsigned>(std::strtoul(argv[++i], nullptr, 10));
    else if (arg == "--allow-local") allow_local = true;
    else if (arg == "--debug") voxel::dpi::log_set_debug(true);
    else return usage();
  }
  if (user.empty() || pass.empty() || port > 65535) return usage();

  voxel::dpi::EngineOptions options;
  std::string error;
  if (!voxel::dpi::parse_strategy(strategy_text, &options.strategy, &error)) {
    std::fprintf(stderr, "invalid strategy: %s\n", error.c_str());
    return 2;
  }
  if (!hosts.empty() && !voxel::dpi::parse_hosts(hosts, &options.hosts)) {
    std::fprintf(stderr, "invalid --hosts\n");
    return 2;
  }
  options.credentials = {user, pass};
  options.listen_port = static_cast<uint16_t>(port);
  options.allow_local_targets = allow_local;
  voxel::dpi::log_set_echo(true);

  // Every thread the engine starts inherits this mask, so the signals are all collected by sigwait() below.
  sigset_t signals;
  sigemptyset(&signals);
  sigaddset(&signals, SIGINT);
  sigaddset(&signals, SIGTERM);
  pthread_sigmask(SIG_BLOCK, &signals, nullptr);

  voxel::dpi::Engine engine;
  if (!engine.start(options, &error)) {
    std::fprintf(stderr, "cannot start: %s\n", error.c_str());
    return 1;
  }
  std::printf("READY %u fake=%d\n", static_cast<unsigned>(engine.port()), voxel::dpi::fake_supported() ? 1 : 0);
  std::fflush(stdout);

  int received = 0;
  sigwait(&signals, &received);
  engine.stop();
  const voxel::dpi::Stats s = engine.stats();
  std::printf("STATS accepted=%llu connected=%llu desynced=%llu failed=%llu up=%llu down=%llu\n", static_cast<unsigned long long>(s.accepted),
              static_cast<unsigned long long>(s.connected), static_cast<unsigned long long>(s.desynced), static_cast<unsigned long long>(s.failed),
              static_cast<unsigned long long>(s.bytes_up), static_cast<unsigned long long>(s.bytes_down));
  std::fflush(stdout);
  return 0;
}
