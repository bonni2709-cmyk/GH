#pragma once

#include <atomic>
#include <condition_variable>
#include <cstdint>
#include <map>
#include <mutex>
#include <set>
#include <string>
#include <vector>

#include "socks5.hpp"
#include "strategy.hpp"

namespace voxel::dpi {

constexpr const char* kVersion = "1.0.0";

struct EngineOptions {
  Strategy strategy;
  socks5::Credentials credentials;
  /** 0 picks a free port. */
  uint16_t listen_port = 0;
  /** Lets clients reach loopback addresses. Off in the app (the proxy must never loop back into the device); on in tests. */
  bool allow_local_targets = false;
  int max_connections = 256;
  int connect_timeout_ms = 10000;
  int idle_timeout_ms = 15 * 60 * 1000;
  /** How long to wait for the client's first payload before relaying without touching anything. */
  int first_flight_wait_ms = 3000;
  /** Names the proxy resolves itself (lower case), before it asks the system resolver. */
  std::map<std::string, std::vector<std::string>> hosts;
};

struct Stats {
  uint64_t accepted = 0;   // connections taken from clients
  uint64_t active = 0;     // connections in flight
  uint64_t connected = 0;  // connections to the target that were established
  uint64_t desynced = 0;   // first payloads that went out with the strategy applied
  uint64_t failed = 0;     // connections that never got going: bad handshake, unreachable target, refused
  uint64_t bytes_up = 0;   // client to target
  uint64_t bytes_down = 0; // target to client
};

/** Parses `name=address,address;name=address` into [out] (names lower-cased). False on anything malformed. */
bool parse_hosts(const std::string& text, std::map<std::string, std::vector<std::string>>* out);

/**
 * A SOCKS5 CONNECT proxy on 127.0.0.1 that relays every connection and applies the strategy to the first
 * payload the client sends. Authentication (user/password) is mandatory: the proxy is meant for one client,
 * the VPN core that was given the credentials.
 */
class Engine {
 public:
  Engine();
  ~Engine();
  Engine(const Engine&) = delete;
  Engine& operator=(const Engine&) = delete;

  bool start(const EngineOptions& options, std::string* error);
  void stop();
  bool running() const { return running_.load(); }
  uint16_t port() const { return port_; }
  Stats stats() const;

 private:
  struct Connection;
  static void* accept_main(void* self);
  static void* connection_main(void* arg);

  bool spawn(void* (*entry)(void*), void* arg);
  void finish_thread();
  void accept_loop();
  void handle(int client);
  int open_upstream(const socks5::Target& target, uint8_t* reply, std::string* where);
  bool read_first_flight(int client, int upstream, std::vector<uint8_t>* out, bool* client_closed);
  void relay(int client, int upstream, bool client_closed);

  void track(int fd);
  void release(int& fd);
  void warn_limited(const std::string& text);

  EngineOptions options_;
  std::atomic<bool> running_{false};
  int listener_ = -1;
  uint16_t port_ = 0;

  std::mutex mutex_;
  std::condition_variable idle_;
  int threads_ = 0;
  std::set<int> open_fds_;

  std::atomic<uint64_t> accepted_{0};
  std::atomic<uint64_t> active_{0};
  std::atomic<uint64_t> connected_{0};
  std::atomic<uint64_t> desynced_{0};
  std::atomic<uint64_t> failed_{0};
  std::atomic<uint64_t> bytes_up_{0};
  std::atomic<uint64_t> bytes_down_{0};

  std::atomic<int64_t> warn_window_start_{0};
  std::atomic<int> warn_in_window_{0};
};

}  // namespace voxel::dpi
