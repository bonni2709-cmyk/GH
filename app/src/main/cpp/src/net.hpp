#pragma once

#include <sys/socket.h>

#include <cstddef>
#include <cstdint>
#include <string>

namespace voxel::dpi::net {

int64_t now_ms();

void close_fd(int& fd);
bool set_nonblocking(int fd);
void set_nodelay(int fd);
void set_keepalive(int fd);

/** A non-blocking listener on 127.0.0.1. Port 0 picks a free port. Returns -1 and fills [error] on failure. */
int listen_loopback(uint16_t port, std::string* error);
uint16_t local_port(int fd);

bool is_ipv6(const sockaddr_storage& addr);
/** Loopback or unspecified: addresses that point back at this device. */
bool is_local_address(const sockaddr_storage& addr);
std::string to_string(const sockaddr_storage& addr);

/** poll() for readability or writability: 1 ready (or hung up), 0 timeout, -1 error. Retries on EINTR. */
int wait_readable(int fd, int timeout_ms);
int wait_writable(int fd, int timeout_ms);

/** Writes everything, waiting for room on a non-blocking socket. MSG_NOSIGNAL is always set. */
bool send_all(int fd, const uint8_t* data, size_t size, int timeout_ms);
/** Reads exactly [size] bytes within [timeout_ms]; false on timeout, error or end of stream. */
bool recv_exact(int fd, uint8_t* out, size_t size, int timeout_ms);

/** Opens a non-blocking socket and connects within [timeout_ms]. Returns the descriptor or -1 with [errno_out] set. */
int connect_to(const sockaddr_storage& addr, socklen_t len, int timeout_ms, int* errno_out);

void set_ttl(int fd, bool v6, int ttl);
/** The socket's current TTL / hop limit, or -1. */
int get_ttl(int fd, bool v6);
/** Bytes queued on the socket that were not transmitted yet (SIOCOUTQNSD); -1 when the kernel cannot tell. */
int unsent_bytes(int fd);

}  // namespace voxel::dpi::net
