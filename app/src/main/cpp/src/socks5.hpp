#pragma once

#include <sys/socket.h>

#include <cstdint>
#include <string>

namespace voxel::dpi::socks5 {

constexpr uint8_t kReplySucceeded = 0x00;
constexpr uint8_t kReplyFailure = 0x01;
constexpr uint8_t kReplyNotAllowed = 0x02;
constexpr uint8_t kReplyNetworkUnreachable = 0x03;
constexpr uint8_t kReplyHostUnreachable = 0x04;
constexpr uint8_t kReplyRefused = 0x05;
constexpr uint8_t kReplyCommandUnsupported = 0x07;
constexpr uint8_t kReplyAddressUnsupported = 0x08;

struct Credentials {
  std::string user;
  std::string pass;
};

/** Where the client wants to go: an address, or a name for the proxy to resolve. */
struct Target {
  bool is_domain = false;
  std::string domain;
  sockaddr_storage addr{};
  socklen_t addr_len = 0;
  uint16_t port = 0;
};

/**
 * The server side of RFC 1928 with the user/password method of RFC 1929; CONNECT only. Anonymous clients are
 * turned away. On false the client has been answered as far as the protocol allows and the caller closes the socket.
 */
bool server_handshake(int fd, const Credentials& credentials, Target* target, std::string* error, int timeout_ms);

/** The final reply of the handshake: [code] with a zero bound address. */
bool send_reply(int fd, uint8_t code);

}  // namespace voxel::dpi::socks5
