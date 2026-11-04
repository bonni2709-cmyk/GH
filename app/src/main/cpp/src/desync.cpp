#include "desync.hpp"

#include <arpa/inet.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <sys/mman.h>
#include <sys/socket.h>
#include <sys/syscall.h>
#include <unistd.h>

#include <algorithm>
#include <cerrno>
#include <cstring>
#include <mutex>

#include "log.hpp"
#include "net.hpp"
#include "tls.hpp"

namespace voxel::dpi {
namespace {

constexpr int kSendTimeoutMs = 10000;

// Called through syscall(): bionic only ships these wrappers from newer API levels than the app's minSdk.
int sys_memfd_create(const char* name) {
#ifdef __NR_memfd_create
  return static_cast<int>(::syscall(__NR_memfd_create, name, 0U));
#else
  (void)name;
  errno = ENOSYS;
  return -1;
#endif
}

ssize_t sys_splice(int in_fd, int out_fd, size_t length) {
#ifdef __NR_splice
  return static_cast<ssize_t>(::syscall(__NR_splice, in_fd, static_cast<void*>(nullptr), out_fd, static_cast<void*>(nullptr), length, 0U));
#else
  (void)in_fd;
  (void)out_fd;
  (void)length;
  errno = ENOSYS;
  return -1;
#endif
}

/** A page-sized region that the kernel can reference from a socket's write queue and we can still modify. */
class SharedBuffer {
 public:
  explicit SharedBuffer(size_t size) : size_(size) {
    fd_ = sys_memfd_create("voxel-dpi");
    if (fd_ < 0) return;
    if (::ftruncate(fd_, static_cast<off_t>(size)) != 0) return;
    void* map = ::mmap(nullptr, size, PROT_READ | PROT_WRITE, MAP_SHARED, fd_, 0);
    if (map == MAP_FAILED) return;
    map_ = static_cast<uint8_t*>(map);
  }
  ~SharedBuffer() {
    if (map_ != nullptr) ::munmap(map_, size_);
    if (fd_ >= 0) ::close(fd_);
  }
  SharedBuffer(const SharedBuffer&) = delete;
  SharedBuffer& operator=(const SharedBuffer&) = delete;

  bool ok() const { return map_ != nullptr; }
  uint8_t* data() { return map_; }
  int fd() const { return fd_; }
  size_t size() const { return size_; }

 private:
  size_t size_;
  int fd_ = -1;
  uint8_t* map_ = nullptr;
};

/** Queues the buffer's content (from its start) on [sock] without copying it: the socket holds references to its pages. */
bool splice_to_socket(SharedBuffer& buffer, int sock, int timeout_ms) {
  int pipefd[2];
  if (::pipe2(pipefd, O_CLOEXEC) != 0) return false;
  bool ok = true;
  size_t queued = 0;
  while (ok && queued < buffer.size()) {
    ssize_t in = sys_splice(buffer.fd(), pipefd[1], buffer.size() - queued);
    if (in <= 0) {
      ok = false;
      break;
    }
    size_t moved = 0;
    while (moved < static_cast<size_t>(in)) {
      ssize_t out = sys_splice(pipefd[0], sock, static_cast<size_t>(in) - moved);
      if (out > 0) {
        moved += static_cast<size_t>(out);
      } else if (out < 0 && errno == EINTR) {
        continue;
      } else if (out < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) {
        if (net::wait_writable(sock, timeout_ms) <= 0) {
          ok = false;
          break;
        }
      } else {
        ok = false;
        break;
      }
    }
    queued += static_cast<size_t>(in);
  }
  ::close(pipefd[0]);
  ::close(pipefd[1]);
  return ok;
}

/** Waits (briefly) until the kernel has actually transmitted what was queued, so a TTL change cannot catch it. */
void wait_on_the_wire(int fd) {
  for (int i = 0; i < 100; ++i) {
    int pending = net::unsent_bytes(fd);
    if (pending == 0) return;
    if (pending < 0) {
      ::usleep(3000);
      return;
    }
    ::usleep(500);
  }
}

bool run_fake_probe() {
  int listener = ::socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);
  if (listener < 0) return false;
  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  int client = -1;
  int server = -1;
  bool ok = false;
  do {
    if (::bind(listener, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) != 0 || ::listen(listener, 1) != 0) break;
    socklen_t len = sizeof(addr);
    if (::getsockname(listener, reinterpret_cast<sockaddr*>(&addr), &len) != 0) break;
    client = ::socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);
    if (client < 0 || ::connect(client, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) != 0) break;
    server = ::accept4(listener, nullptr, nullptr, SOCK_CLOEXEC);
    if (server < 0) break;

    // Cork the socket so the segment stays in the write queue, rewrite the shared page, then let it go:
    // the receiver must see the rewritten bytes.
    int one = 1;
    ::setsockopt(client, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one));
    ::setsockopt(client, IPPROTO_TCP, TCP_CORK, &one, sizeof(one));
    SharedBuffer buffer(32);
    if (!buffer.ok()) break;
    std::memset(buffer.data(), 'F', 32);
    if (!splice_to_socket(buffer, client, 1000)) break;
    std::memset(buffer.data(), 'R', 32);
    int zero = 0;
    ::setsockopt(client, IPPROTO_TCP, TCP_CORK, &zero, sizeof(zero));
    uint8_t got[32];
    if (!net::recv_exact(server, got, sizeof(got), 1000)) break;
    ok = true;
    for (uint8_t b : got) ok = ok && b == 'R';
  } while (false);
  if (client >= 0) ::close(client);
  if (server >= 0) ::close(server);
  ::close(listener);
  return ok;
}

/** The bytes of the decoy that stands in for a first segment of [length] bytes. */
std::vector<uint8_t> make_decoy(const Plan& plan, size_t length) {
  static uint32_t counter = 0x2545F491u;
  counter = counter * 1664525u + 1013904223u;
  if (plan.kind == PayloadKind::TlsClientHello) {
    // A ClientHello for the decoy host name, cut to the length of the real first segment (or padded to it).
    for (size_t size = std::max<size_t>(length, 300); size <= 16384; size *= 2) {
      std::vector<uint8_t> hello = tls::build_fake_client_hello(plan.fake_sni, size, counter);
      if (hello.empty()) continue;
      hello.resize(length, 0);
      return hello;
    }
  }
  const std::string text = "GET / HTTP/1.1\r\nHost: " + plan.fake_sni + "\r\nConnection: close\r\n\r\n";
  std::vector<uint8_t> out(length, ' ');
  std::memcpy(out.data(), text.data(), std::min(length, text.size()));
  return out;
}

bool send_fake_first(int fd, bool v6, const Plan& plan, const uint8_t* real, size_t length, std::string* error) {
  SharedBuffer buffer(length);
  if (!buffer.ok()) {
    *error = std::string("shared buffer: ") + std::strerror(errno);
    return false;
  }
  const std::vector<uint8_t> decoy = make_decoy(plan, length);
  std::memcpy(buffer.data(), decoy.data(), length);

  int normal_ttl = net::get_ttl(fd, v6);
  if (normal_ttl <= 0) normal_ttl = 64;
  net::set_ttl(fd, v6, plan.fake_ttl);
  const bool queued = splice_to_socket(buffer, fd, kSendTimeoutMs);
  if (queued) {
    wait_on_the_wire(fd);
    // The device reads the pages when it transmits, which can be a moment after the kernel handed the segment over.
    if (plan.hold_ms > 0) ::usleep(static_cast<useconds_t>(plan.hold_ms) * 1000);
  }
  // From here on the kernel retransmits the real bytes from the same pages, with the normal TTL.
  std::memcpy(buffer.data(), real, length);
  net::set_ttl(fd, v6, normal_ttl);
  if (!queued) *error = std::string("splice: ") + std::strerror(errno);
  return queued;
}

bool send_disordered_first(int fd, bool v6, const Plan& plan, const uint8_t* real, size_t length, std::string* error) {
  int normal_ttl = net::get_ttl(fd, v6);
  if (normal_ttl <= 0) normal_ttl = 64;
  net::set_ttl(fd, v6, plan.disorder_ttl);
  const bool sent = net::send_all(fd, real, length, kSendTimeoutMs);
  if (sent) wait_on_the_wire(fd);
  net::set_ttl(fd, v6, normal_ttl);
  if (!sent) *error = std::string("send: ") + std::strerror(errno);
  return sent;
}

}  // namespace

bool fake_supported() {
  static std::once_flag once;
  static bool supported = false;
  std::call_once(once, [] {
    supported = run_fake_probe();
    logf(LogLevel::Info, "fake segments %s on this kernel", supported ? "work" : "are not available");
  });
  return supported;
}

bool send_plan(int fd, const Plan& plan, std::string* error) {
  std::string scratch;
  std::string* err = error ? error : &scratch;
  if (plan.stream.empty()) return true;

  sockaddr_storage local{};
  socklen_t local_len = sizeof(local);
  const bool v6 = ::getsockname(fd, reinterpret_cast<sockaddr*>(&local), &local_len) == 0 && local.ss_family == AF_INET6;
  net::set_nodelay(fd);

  std::vector<std::pair<size_t, size_t>> segments;  // [begin, end)
  size_t begin = 0;
  for (size_t cut : plan.cuts) {
    segments.emplace_back(begin, cut);
    begin = cut;
  }
  segments.emplace_back(begin, plan.stream.size());

  size_t next = 0;
  if (segments.size() > 1 && plan.fake && fake_supported()) {
    const auto [b, e] = segments[0];
    if (!send_fake_first(fd, v6, plan, plan.stream.data() + b, e - b, err)) return false;
    next = 1;
  } else if (segments.size() > 1 && (plan.disorder || plan.fake)) {
    // A disorder request, or a fake one the kernel cannot do: the first segment is held back by a tiny TTL either way.
    const auto [b, e] = segments[0];
    if (!send_disordered_first(fd, v6, plan, plan.stream.data() + b, e - b, err)) return false;
    next = 1;
  }

  for (size_t i = 0; i < segments.size(); ++i) {
    if (i >= next) {
      const auto [b, e] = segments[i];
      if (!net::send_all(fd, plan.stream.data() + b, e - b, kSendTimeoutMs)) {
        *err = std::string("send: ") + std::strerror(errno);
        return false;
      }
    }
    if (i + 1 >= segments.size()) break;
    if (std::find(plan.oob_after.begin(), plan.oob_after.end(), segments[i].second) != plan.oob_after.end()) {
      const uint8_t urgent = 'a';
      if (::send(fd, &urgent, 1, MSG_OOB | MSG_NOSIGNAL) != 1) {
        *err = std::string("send urgent byte: ") + std::strerror(errno);
        return false;
      }
    }
    if (plan.delay_ms > 0) ::usleep(static_cast<useconds_t>(plan.delay_ms) * 1000);
  }
  return true;
}

}  // namespace voxel::dpi
