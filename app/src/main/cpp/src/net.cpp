#include "net.hpp"

#include <arpa/inet.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <poll.h>
#include <sys/ioctl.h>
#include <unistd.h>

#include <algorithm>
#include <cerrno>
#include <chrono>
#include <cstring>

#ifndef SIOCOUTQNSD
#define SIOCOUTQNSD 0x894B
#endif

namespace voxel::dpi::net {
namespace {

int poll_one(int fd, short events, int timeout_ms) {
  const int64_t deadline = now_ms() + (timeout_ms < 0 ? 0 : timeout_ms);
  while (true) {
    pollfd p{};
    p.fd = fd;
    p.events = events;
    int remaining = timeout_ms < 0 ? -1 : static_cast<int>(std::max<int64_t>(0, deadline - now_ms()));
    int rc = ::poll(&p, 1, remaining);
    if (rc > 0) return 1;
    if (rc == 0) return 0;
    if (errno != EINTR) return -1;
  }
}

}  // namespace

int64_t now_ms() {
  return std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now().time_since_epoch()).count();
}

void close_fd(int& fd) {
  if (fd >= 0) {
    ::close(fd);
    fd = -1;
  }
}

bool set_nonblocking(int fd) {
  int flags = ::fcntl(fd, F_GETFL, 0);
  return flags >= 0 && ::fcntl(fd, F_SETFL, flags | O_NONBLOCK) == 0;
}

void set_nodelay(int fd) {
  int one = 1;
  ::setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one));
}

void set_keepalive(int fd) {
  int one = 1;
  ::setsockopt(fd, SOL_SOCKET, SO_KEEPALIVE, &one, sizeof(one));
}

int listen_loopback(uint16_t port, std::string* error) {
  int fd = ::socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);
  if (fd < 0) {
    if (error) *error = std::string("socket: ") + std::strerror(errno);
    return -1;
  }
  int one = 1;
  ::setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));
  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_port = htons(port);
  addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  if (::bind(fd, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) != 0 || ::listen(fd, 128) != 0 || !set_nonblocking(fd)) {
    if (error) *error = std::string("listen on 127.0.0.1: ") + std::strerror(errno);
    ::close(fd);
    return -1;
  }
  return fd;
}

uint16_t local_port(int fd) {
  sockaddr_storage addr{};
  socklen_t len = sizeof(addr);
  if (::getsockname(fd, reinterpret_cast<sockaddr*>(&addr), &len) != 0) return 0;
  if (addr.ss_family == AF_INET) return ntohs(reinterpret_cast<sockaddr_in*>(&addr)->sin_port);
  if (addr.ss_family == AF_INET6) return ntohs(reinterpret_cast<sockaddr_in6*>(&addr)->sin6_port);
  return 0;
}

bool is_ipv6(const sockaddr_storage& addr) { return addr.ss_family == AF_INET6; }

bool is_local_address(const sockaddr_storage& addr) {
  if (addr.ss_family == AF_INET) {
    uint32_t ip = ntohl(reinterpret_cast<const sockaddr_in*>(&addr)->sin_addr.s_addr);
    return (ip >> 24) == 127 || ip == 0;
  }
  if (addr.ss_family == AF_INET6) {
    const in6_addr& a = reinterpret_cast<const sockaddr_in6*>(&addr)->sin6_addr;
    if (IN6_IS_ADDR_LOOPBACK(&a) || IN6_IS_ADDR_UNSPECIFIED(&a)) return true;
    if (IN6_IS_ADDR_V4MAPPED(&a)) {
      return a.s6_addr[12] == 127 || (a.s6_addr[12] == 0 && a.s6_addr[13] == 0 && a.s6_addr[14] == 0 && a.s6_addr[15] == 0);
    }
  }
  return false;
}

std::string to_string(const sockaddr_storage& addr) {
  char buffer[INET6_ADDRSTRLEN] = {0};
  if (addr.ss_family == AF_INET) {
    const auto* a = reinterpret_cast<const sockaddr_in*>(&addr);
    ::inet_ntop(AF_INET, &a->sin_addr, buffer, sizeof(buffer));
    return std::string(buffer) + ":" + std::to_string(ntohs(a->sin_port));
  }
  if (addr.ss_family == AF_INET6) {
    const auto* a = reinterpret_cast<const sockaddr_in6*>(&addr);
    ::inet_ntop(AF_INET6, &a->sin6_addr, buffer, sizeof(buffer));
    return std::string("[") + buffer + "]:" + std::to_string(ntohs(a->sin6_port));
  }
  return "?";
}

int wait_readable(int fd, int timeout_ms) { return poll_one(fd, POLLIN, timeout_ms); }
int wait_writable(int fd, int timeout_ms) { return poll_one(fd, POLLOUT, timeout_ms); }

bool send_all(int fd, const uint8_t* data, size_t size, int timeout_ms) {
  const int64_t deadline = now_ms() + timeout_ms;
  size_t done = 0;
  while (done < size) {
    ssize_t n = ::send(fd, data + done, size - done, MSG_NOSIGNAL);
    if (n > 0) {
      done += static_cast<size_t>(n);
      continue;
    }
    if (n < 0 && errno == EINTR) continue;
    if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) {
      int left = static_cast<int>(deadline - now_ms());
      if (left <= 0 || wait_writable(fd, left) <= 0) return false;
      continue;
    }
    return false;
  }
  return true;
}

bool recv_exact(int fd, uint8_t* out, size_t size, int timeout_ms) {
  const int64_t deadline = now_ms() + timeout_ms;
  size_t done = 0;
  while (done < size) {
    int left = static_cast<int>(deadline - now_ms());
    if (left < 0) left = 0;
    int ready = wait_readable(fd, left);
    if (ready <= 0) return false;
    ssize_t n = ::recv(fd, out + done, size - done, 0);
    if (n > 0) {
      done += static_cast<size_t>(n);
    } else if (n == 0) {
      return false;
    } else if (errno != EINTR && errno != EAGAIN && errno != EWOULDBLOCK) {
      return false;
    }
  }
  return true;
}

int connect_to(const sockaddr_storage& addr, socklen_t len, int timeout_ms, int* errno_out) {
  int fd = ::socket(addr.ss_family, SOCK_STREAM | SOCK_CLOEXEC | SOCK_NONBLOCK, 0);
  if (fd < 0) {
    if (errno_out) *errno_out = errno;
    return -1;
  }
  int rc = ::connect(fd, reinterpret_cast<const sockaddr*>(&addr), len);
  if (rc != 0 && errno != EINPROGRESS) {
    if (errno_out) *errno_out = errno;
    ::close(fd);
    return -1;
  }
  if (rc != 0) {
    int ready = wait_writable(fd, timeout_ms);
    int error = ETIMEDOUT;
    if (ready > 0) {
      socklen_t size = sizeof(error);
      if (::getsockopt(fd, SOL_SOCKET, SO_ERROR, &error, &size) != 0) error = errno;
    }
    if (ready <= 0 || error != 0) {
      if (errno_out) *errno_out = error;
      ::close(fd);
      return -1;
    }
  }
  return fd;
}

void set_ttl(int fd, bool v6, int ttl) {
  if (v6) {
    ::setsockopt(fd, IPPROTO_IPV6, IPV6_UNICAST_HOPS, &ttl, sizeof(ttl));
  } else {
    ::setsockopt(fd, IPPROTO_IP, IP_TTL, &ttl, sizeof(ttl));
  }
}

int get_ttl(int fd, bool v6) {
  int ttl = 0;
  socklen_t size = sizeof(ttl);
  int rc = v6 ? ::getsockopt(fd, IPPROTO_IPV6, IPV6_UNICAST_HOPS, &ttl, &size) : ::getsockopt(fd, IPPROTO_IP, IP_TTL, &ttl, &size);
  return rc == 0 ? ttl : -1;
}

int unsent_bytes(int fd) {
  int pending = 0;
  if (::ioctl(fd, SIOCOUTQNSD, &pending) != 0) return -1;
  return pending;
}

}  // namespace voxel::dpi::net
