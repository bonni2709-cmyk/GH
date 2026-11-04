#include "socks5.hpp"

#include <arpa/inet.h>
#include <netinet/in.h>

#include <algorithm>
#include <cstring>

#include "net.hpp"

namespace voxel::dpi::socks5 {
namespace {

/** Compares without stopping at the first difference, so timing says nothing about how much matched. */
bool equal_constant_time(const std::string& a, const std::string& b) {
  unsigned diff = static_cast<unsigned>(a.size() ^ b.size());
  const size_t n = std::max(a.size(), b.size());
  for (size_t i = 0; i < n; ++i) {
    const unsigned x = i < a.size() ? static_cast<unsigned char>(a[i]) : 0;
    const unsigned y = i < b.size() ? static_cast<unsigned char>(b[i]) : 0;
    diff |= x ^ y;
  }
  return diff == 0;
}

bool fail(std::string* error, const char* message) {
  if (error) *error = message;
  return false;
}

}  // namespace

bool send_reply(int fd, uint8_t code) {
  const uint8_t reply[10] = {0x05, code, 0x00, 0x01, 0, 0, 0, 0, 0, 0};
  return net::send_all(fd, reply, sizeof(reply), 2000);
}

bool server_handshake(int fd, const Credentials& credentials, Target* target, std::string* error, int timeout_ms) {
  uint8_t head[2];
  if (!net::recv_exact(fd, head, 2, timeout_ms)) return fail(error, "no greeting");
  if (head[0] != 0x05) return fail(error, "not a SOCKS5 client");
  uint8_t methods[255];
  if (head[1] == 0 || !net::recv_exact(fd, methods, head[1], timeout_ms)) return fail(error, "bad method list");
  const bool password = std::find(methods, methods + head[1], 0x02) != methods + head[1];
  const uint8_t choice[2] = {0x05, static_cast<uint8_t>(password ? 0x02 : 0xFF)};
  net::send_all(fd, choice, sizeof(choice), 2000);
  if (!password) return fail(error, "the client does not offer user/password authentication");

  uint8_t version = 0;
  if (!net::recv_exact(fd, &version, 1, timeout_ms) || version != 0x01) return fail(error, "bad authentication request");
  uint8_t length = 0;
  uint8_t buffer[255];
  if (!net::recv_exact(fd, &length, 1, timeout_ms)) return fail(error, "short authentication request");
  if (length == 0 || !net::recv_exact(fd, buffer, length, timeout_ms)) return fail(error, "short user name");
  const std::string user(reinterpret_cast<char*>(buffer), length);
  if (!net::recv_exact(fd, &length, 1, timeout_ms)) return fail(error, "short authentication request");
  if (length == 0 || !net::recv_exact(fd, buffer, length, timeout_ms)) return fail(error, "short password");
  const std::string pass(reinterpret_cast<char*>(buffer), length);
  const bool known = equal_constant_time(user, credentials.user) & equal_constant_time(pass, credentials.pass);
  const uint8_t verdict[2] = {0x01, static_cast<uint8_t>(known ? 0x00 : 0x01)};
  net::send_all(fd, verdict, sizeof(verdict), 2000);
  if (!known) return fail(error, "wrong user name or password");

  uint8_t request[4];
  if (!net::recv_exact(fd, request, sizeof(request), timeout_ms)) return fail(error, "no request");
  if (request[0] != 0x05) return fail(error, "bad request version");
  if (request[1] != 0x01) {
    send_reply(fd, kReplyCommandUnsupported);
    return fail(error, "only CONNECT is supported");
  }

  Target result;
  switch (request[3]) {
    case 0x01: {
      sockaddr_in* a = reinterpret_cast<sockaddr_in*>(&result.addr);
      a->sin_family = AF_INET;
      if (!net::recv_exact(fd, reinterpret_cast<uint8_t*>(&a->sin_addr), 4, timeout_ms)) return fail(error, "short IPv4 address");
      result.addr_len = sizeof(sockaddr_in);
      break;
    }
    case 0x04: {
      sockaddr_in6* a = reinterpret_cast<sockaddr_in6*>(&result.addr);
      a->sin6_family = AF_INET6;
      if (!net::recv_exact(fd, reinterpret_cast<uint8_t*>(&a->sin6_addr), 16, timeout_ms)) return fail(error, "short IPv6 address");
      result.addr_len = sizeof(sockaddr_in6);
      break;
    }
    case 0x03: {
      uint8_t n = 0;
      if (!net::recv_exact(fd, &n, 1, timeout_ms) || n == 0 || !net::recv_exact(fd, buffer, n, timeout_ms)) return fail(error, "short host name");
      result.is_domain = true;
      result.domain.assign(reinterpret_cast<char*>(buffer), n);
      break;
    }
    default:
      send_reply(fd, kReplyAddressUnsupported);
      return fail(error, "unsupported address type");
  }
  uint8_t port[2];
  if (!net::recv_exact(fd, port, sizeof(port), timeout_ms)) return fail(error, "short port");
  result.port = static_cast<uint16_t>((port[0] << 8) | port[1]);
  if (result.addr_len != 0) {
    if (result.addr.ss_family == AF_INET) {
      reinterpret_cast<sockaddr_in*>(&result.addr)->sin_port = htons(result.port);
    } else {
      reinterpret_cast<sockaddr_in6*>(&result.addr)->sin6_port = htons(result.port);
    }
  }
  if (target) *target = result;
  return true;
}

}  // namespace voxel::dpi::socks5
