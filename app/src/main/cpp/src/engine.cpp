#include "engine.hpp"

#include <arpa/inet.h>
#include <netdb.h>
#include <netinet/in.h>
#include <poll.h>
#include <pthread.h>
#include <sys/socket.h>
#include <unistd.h>

#include <algorithm>
#include <cerrno>
#include <cctype>
#include <chrono>
#include <csignal>
#include <cstring>
#include <memory>

#include "desync.hpp"
#include "http.hpp"
#include "log.hpp"
#include "net.hpp"
#include "tls.hpp"

namespace voxel::dpi {
namespace {

constexpr size_t kRelayBuffer = 32 * 1024;
constexpr size_t kFlightCap = 16 * 1024;
constexpr int kHandshakeTimeoutMs = 8000;
constexpr int kRestOfRecordWaitMs = 300;
constexpr size_t kThreadStack = 512 * 1024;

std::string lowered(std::string text) {
  for (char& c : text) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  return text;
}

struct Candidate {
  sockaddr_storage addr{};
  socklen_t len = 0;
};

bool flight_complete(const std::vector<uint8_t>& data) {
  if (data.size() >= kFlightCap) return true;
  const size_t record = tls::first_record_size(data.data(), data.size());
  if (record != 0) return data.size() >= record;
  if (http::looks_like_request(data.data(), data.size())) return http::head_complete(data.data(), data.size());
  return true;
}

uint8_t reply_for_errno(int error) {
  switch (error) {
    case ECONNREFUSED: return socks5::kReplyRefused;
    case ENETUNREACH: return socks5::kReplyNetworkUnreachable;
    case EHOSTUNREACH:
    case ETIMEDOUT: return socks5::kReplyHostUnreachable;
    default: return socks5::kReplyFailure;
  }
}

const char* kind_name(PayloadKind kind) {
  switch (kind) {
    case PayloadKind::TlsClientHello: return "TLS ClientHello";
    case PayloadKind::HttpRequest: return "HTTP request";
    default: return "other payload";
  }
}

}  // namespace

bool parse_hosts(const std::string& text, std::map<std::string, std::vector<std::string>>* out) {
  std::map<std::string, std::vector<std::string>> result;
  size_t start = 0;
  while (start <= text.size()) {
    size_t end = text.find_first_of(";\n", start);
    std::string item = text.substr(start, end == std::string::npos ? std::string::npos : end - start);
    start = end == std::string::npos ? text.size() + 1 : end + 1;
    while (!item.empty() && std::isspace(static_cast<unsigned char>(item.back()))) item.pop_back();
    size_t first = 0;
    while (first < item.size() && std::isspace(static_cast<unsigned char>(item[first]))) ++first;
    item = item.substr(first);
    if (item.empty()) continue;
    const size_t eq = item.find('=');
    if (eq == std::string::npos || eq == 0) return false;
    const std::string name = lowered(item.substr(0, eq));
    std::vector<std::string> addresses;
    size_t at = eq + 1;
    while (at <= item.size()) {
      size_t comma = item.find(',', at);
      std::string address = item.substr(at, comma == std::string::npos ? std::string::npos : comma - at);
      if (address.empty()) return false;
      addresses.push_back(address);
      if (comma == std::string::npos) break;
      at = comma + 1;
    }
    result[name] = addresses;
  }
  if (out) *out = result;
  return true;
}

struct Engine::Connection {
  Engine* engine;
  int fd;
};

Engine::Engine() = default;

Engine::~Engine() { stop(); }

bool Engine::spawn(void* (*entry)(void*), void* arg) {
  pthread_attr_t attr;
  pthread_attr_init(&attr);
  pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED);
  pthread_attr_setstacksize(&attr, kThreadStack);
  {
    std::lock_guard<std::mutex> lock(mutex_);
    ++threads_;
  }
  pthread_t thread;
  const int rc = pthread_create(&thread, &attr, entry, arg);
  pthread_attr_destroy(&attr);
  if (rc != 0) {
    finish_thread();
    return false;
  }
  return true;
}

void Engine::finish_thread() {
  std::lock_guard<std::mutex> lock(mutex_);
  --threads_;
  idle_.notify_all();
}

void Engine::track(int fd) {
  std::lock_guard<std::mutex> lock(mutex_);
  open_fds_.insert(fd);
}

void Engine::release(int& fd) {
  if (fd < 0) return;
  {
    // Erased before closing: stop() shuts the listed descriptors down and must never see a number that was reused.
    std::lock_guard<std::mutex> lock(mutex_);
    open_fds_.erase(fd);
  }
  ::close(fd);
  fd = -1;
}

void Engine::warn_limited(const std::string& text) {
  const int64_t now = net::now_ms();
  int64_t start = warn_window_start_.load();
  if (now - start > 60000 && warn_window_start_.compare_exchange_strong(start, now)) warn_in_window_.store(0);
  const int seen = warn_in_window_.fetch_add(1);
  if (seen < 8) {
    log_write(LogLevel::Warn, text);
  } else if (seen == 8) {
    log_write(LogLevel::Warn, "more connection problems follow; they are not logged for a minute");
  }
}

bool Engine::start(const EngineOptions& options, std::string* error) {
  std::string scratch;
  std::string* err = error ? error : &scratch;
  if (running_.load()) {
    *err = "already running";
    return false;
  }
  if (options.credentials.user.empty() || options.credentials.pass.empty()) {
    *err = "the proxy needs a user name and a password";
    return false;
  }
  ::signal(SIGPIPE, SIG_IGN);
  options_ = options;
  accepted_ = active_ = connected_ = desynced_ = failed_ = bytes_up_ = bytes_down_ = 0;
  warn_window_start_ = 0;
  warn_in_window_ = 0;

  listener_ = net::listen_loopback(options_.listen_port, err);
  if (listener_ < 0) return false;
  port_ = net::local_port(listener_);
  if (options_.strategy.fake) fake_supported();

  running_ = true;
  if (!spawn(&Engine::accept_main, this)) {
    running_ = false;
    net::close_fd(listener_);
    *err = "cannot start a thread";
    return false;
  }
  logf(LogLevel::Info, "DPI engine listens on 127.0.0.1:%u, strategy: %s", static_cast<unsigned>(port_), options_.strategy.describe().c_str());
  return true;
}

void Engine::stop() {
  if (!running_.exchange(false)) return;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    for (int fd : open_fds_) ::shutdown(fd, SHUT_RDWR);
  }
  if (listener_ >= 0) ::shutdown(listener_, SHUT_RDWR);
  {
    std::unique_lock<std::mutex> lock(mutex_);
    idle_.wait_for(lock, std::chrono::seconds(4), [this] { return threads_ == 0; });
  }
  net::close_fd(listener_);
  const Stats s = stats();
  logf(LogLevel::Info, "DPI engine stopped: %llu connections, %llu desynced, %llu failed, %llu bytes up, %llu bytes down",
       static_cast<unsigned long long>(s.accepted), static_cast<unsigned long long>(s.desynced), static_cast<unsigned long long>(s.failed),
       static_cast<unsigned long long>(s.bytes_up), static_cast<unsigned long long>(s.bytes_down));
}

Stats Engine::stats() const {
  Stats s;
  s.accepted = accepted_.load();
  s.active = active_.load();
  s.connected = connected_.load();
  s.desynced = desynced_.load();
  s.failed = failed_.load();
  s.bytes_up = bytes_up_.load();
  s.bytes_down = bytes_down_.load();
  return s;
}

void* Engine::accept_main(void* self) {
  Engine* engine = static_cast<Engine*>(self);
  engine->accept_loop();
  engine->finish_thread();
  return nullptr;
}

void* Engine::connection_main(void* arg) {
  std::unique_ptr<Connection> connection(static_cast<Connection*>(arg));
  Engine* engine = connection->engine;
  engine->handle(connection->fd);
  engine->active_--;
  engine->finish_thread();
  return nullptr;
}

void Engine::accept_loop() {
  while (running_.load()) {
    if (net::wait_readable(listener_, 250) <= 0) continue;
    while (running_.load()) {
      int fd = ::accept4(listener_, nullptr, nullptr, SOCK_NONBLOCK | SOCK_CLOEXEC);
      if (fd < 0) {
        if (errno == EINTR) continue;
        if (errno == EMFILE || errno == ENFILE || errno == ENOBUFS || errno == ENOMEM) ::usleep(50000);
        break;
      }
      ++accepted_;
      if (active_.load() >= static_cast<uint64_t>(options_.max_connections)) {
        ::close(fd);
        ++failed_;
        warn_limited("too many connections, one was refused");
        continue;
      }
      auto* connection = new Connection{this, fd};
      ++active_;
      if (!spawn(&Engine::connection_main, connection)) {
        --active_;
        ++failed_;
        delete connection;
        ::close(fd);
        warn_limited("cannot start a thread for a connection");
      }
    }
  }
}

int Engine::open_upstream(const socks5::Target& target, uint8_t* reply, std::string* where) {
  std::vector<Candidate> candidates;
  if (!target.is_domain) {
    Candidate c;
    c.addr = target.addr;
    c.len = target.addr_len;
    candidates.push_back(c);
    *where = net::to_string(target.addr);
  } else {
    *where = target.domain + ":" + std::to_string(target.port);
    const std::string name = lowered(target.domain);
    const auto known = options_.hosts.find(name);
    if (known != options_.hosts.end()) {
      for (const std::string& text : known->second) {
        Candidate c;
        auto* v4 = reinterpret_cast<sockaddr_in*>(&c.addr);
        auto* v6 = reinterpret_cast<sockaddr_in6*>(&c.addr);
        if (::inet_pton(AF_INET, text.c_str(), &v4->sin_addr) == 1) {
          v4->sin_family = AF_INET;
          v4->sin_port = htons(target.port);
          c.len = sizeof(sockaddr_in);
          candidates.push_back(c);
        } else if (::inet_pton(AF_INET6, text.c_str(), &v6->sin6_addr) == 1) {
          v6->sin6_family = AF_INET6;
          v6->sin6_port = htons(target.port);
          c.len = sizeof(sockaddr_in6);
          candidates.push_back(c);
        }
      }
    }
    if (candidates.empty()) {
      addrinfo hints{};
      hints.ai_family = AF_UNSPEC;
      hints.ai_socktype = SOCK_STREAM;
      addrinfo* found = nullptr;
      if (::getaddrinfo(target.domain.c_str(), std::to_string(target.port).c_str(), &hints, &found) == 0) {
        for (addrinfo* a = found; a != nullptr; a = a->ai_next) {
          if (a->ai_addrlen > sizeof(sockaddr_storage)) continue;
          Candidate c;
          std::memcpy(&c.addr, a->ai_addr, a->ai_addrlen);
          c.len = static_cast<socklen_t>(a->ai_addrlen);
          candidates.push_back(c);
        }
        ::freeaddrinfo(found);
      }
    }
    if (candidates.empty()) {
      *reply = socks5::kReplyHostUnreachable;
      return -1;
    }
  }

  if (!options_.allow_local_targets) {
    candidates.erase(std::remove_if(candidates.begin(), candidates.end(), [](const Candidate& c) { return net::is_local_address(c.addr); }), candidates.end());
    if (candidates.empty()) {
      *reply = socks5::kReplyNotAllowed;
      return -1;
    }
  }
  // IPv4 first: a device without IPv6 would wait out a full timeout on every IPv6 candidate.
  std::stable_sort(candidates.begin(), candidates.end(), [](const Candidate& a, const Candidate& b) {
    return a.addr.ss_family == AF_INET && b.addr.ss_family != AF_INET;
  });
  if (candidates.size() > 4) candidates.resize(4);

  const int64_t deadline = net::now_ms() + options_.connect_timeout_ms;
  int last_error = ETIMEDOUT;
  for (size_t i = 0; i < candidates.size() && running_.load(); ++i) {
    const int64_t left = deadline - net::now_ms();
    if (left <= 0) break;
    const int slice = static_cast<int>(std::max<int64_t>(1500, left / static_cast<int64_t>(candidates.size() - i)));
    int error = 0;
    int fd = net::connect_to(candidates[i].addr, candidates[i].len, static_cast<int>(std::min<int64_t>(slice, left)), &error);
    if (fd >= 0) return fd;
    last_error = error;
  }
  *reply = reply_for_errno(last_error);
  *where += std::string(" (") + std::strerror(last_error) + ")";
  return -1;
}

bool Engine::read_first_flight(int client, int upstream, std::vector<uint8_t>* out, bool* client_closed) {
  int64_t deadline = net::now_ms() + options_.first_flight_wait_ms;
  uint8_t chunk[4096];
  while (running_.load()) {
    const int64_t left = deadline - net::now_ms();
    if (left <= 0) break;
    pollfd fds[2] = {};
    fds[0].fd = client;
    fds[0].events = POLLIN;
    fds[1].fd = upstream;
    fds[1].events = POLLIN;
    const int rc = ::poll(fds, 2, static_cast<int>(left));
    if (rc < 0) {
      if (errno == EINTR) continue;
      return false;
    }
    if (rc == 0) break;
    // A server that talks first (or hangs up) means there is no client payload to wait for.
    if (fds[1].revents != 0 && out->empty()) break;
    if (fds[0].revents == 0) continue;
    const ssize_t n = ::recv(client, chunk, sizeof(chunk), 0);
    if (n > 0) {
      out->insert(out->end(), chunk, chunk + n);
      if (flight_complete(*out)) break;
      deadline = std::min(deadline, net::now_ms() + kRestOfRecordWaitMs);
    } else if (n == 0) {
      *client_closed = true;
      break;
    } else if (errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR) {
      return false;
    }
  }
  return true;
}

void Engine::relay(int client, int upstream, bool client_closed) {
  struct Direction {
    int from;
    int to;
    std::vector<uint8_t> buffer;
    size_t offset = 0;
    size_t length = 0;
    bool eof = false;
    bool shut = false;
    std::atomic<uint64_t>* counter;
  };
  Direction up{client, upstream, std::vector<uint8_t>(kRelayBuffer), 0, 0, client_closed, false, &bytes_up_};
  Direction down{upstream, client, std::vector<uint8_t>(kRelayBuffer), 0, 0, false, false, &bytes_down_};
  Direction* const directions[2] = {&up, &down};
  int64_t last_activity = net::now_ms();

  while (running_.load()) {
    for (Direction* d : directions) {
      if (d->eof && d->length == 0 && !d->shut) {
        ::shutdown(d->to, SHUT_WR);
        d->shut = true;
      }
    }
    if (up.shut && down.shut) return;

    pollfd fds[4] = {};
    Direction* owner[4] = {};
    bool reading[4] = {};
    int count = 0;
    for (Direction* d : directions) {
      if (d->length == 0 && !d->eof) {
        fds[count].fd = d->from;
        fds[count].events = POLLIN;
        owner[count] = d;
        reading[count] = true;
        ++count;
      }
      if (d->length > 0) {
        fds[count].fd = d->to;
        fds[count].events = POLLOUT;
        owner[count] = d;
        reading[count] = false;
        ++count;
      }
    }
    if (count == 0) return;
    const int rc = ::poll(fds, static_cast<nfds_t>(count), 1000);
    if (rc < 0) {
      if (errno == EINTR) continue;
      return;
    }
    if (rc == 0) {
      if (net::now_ms() - last_activity > options_.idle_timeout_ms) {
        log_write(LogLevel::Debug, "closing an idle connection");
        return;
      }
      continue;
    }
    for (int i = 0; i < count; ++i) {
      if (fds[i].revents == 0) continue;
      Direction* d = owner[i];
      if (reading[i]) {
        const ssize_t n = ::recv(d->from, d->buffer.data(), d->buffer.size(), 0);
        if (n > 0) {
          d->offset = 0;
          d->length = static_cast<size_t>(n);
          d->counter->fetch_add(static_cast<uint64_t>(n));
          last_activity = net::now_ms();
        } else if (n == 0) {
          d->eof = true;
        } else if (errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR) {
          return;
        }
      } else {
        const ssize_t n = ::send(d->to, d->buffer.data() + d->offset, d->length - d->offset, MSG_NOSIGNAL);
        if (n > 0) {
          d->offset += static_cast<size_t>(n);
          if (d->offset == d->length) d->offset = d->length = 0;
          last_activity = net::now_ms();
        } else if (n < 0 && errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR) {
          return;
        }
      }
    }
  }
}

void Engine::handle(int client) {
  track(client);
  net::set_nodelay(client);
  net::set_keepalive(client);

  socks5::Target target;
  std::string problem;
  if (!socks5::server_handshake(client, options_.credentials, &target, &problem, kHandshakeTimeoutMs)) {
    ++failed_;
    warn_limited("SOCKS5 handshake failed: " + problem);
    release(client);
    return;
  }

  uint8_t reply = socks5::kReplyFailure;
  std::string where;
  int upstream = open_upstream(target, &reply, &where);
  if (upstream < 0) {
    socks5::send_reply(client, reply);
    ++failed_;
    warn_limited("cannot reach " + where);
    release(client);
    return;
  }
  track(upstream);
  if (!socks5::send_reply(client, socks5::kReplySucceeded)) {
    ++failed_;
    release(upstream);
    release(client);
    return;
  }
  ++connected_;
  net::set_nodelay(upstream);
  net::set_keepalive(upstream);

  std::vector<uint8_t> first;
  bool client_closed = false;
  bool alive = read_first_flight(client, upstream, &first, &client_closed);
  if (alive && !first.empty()) {
    if (options_.strategy.active()) {
      const Plan plan = build_plan(options_.strategy, first.data(), first.size());
      std::string error;
      if (send_plan(upstream, plan, &error)) {
        ++desynced_;
        logf(LogLevel::Debug, "%s: %s, %zu bytes in %zu segments", where.c_str(), kind_name(plan.kind), plan.stream.size(), plan.segment_count());
      } else {
        warn_limited("sending the first payload to " + where + " failed: " + error);
        alive = false;
      }
    } else if (!net::send_all(upstream, first.data(), first.size(), 10000)) {
      alive = false;
    }
    bytes_up_ += first.size();
  }
  if (alive) relay(client, upstream, client_closed);
  release(upstream);
  release(client);
}

}  // namespace voxel::dpi
