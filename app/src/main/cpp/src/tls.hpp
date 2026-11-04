#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace voxel::dpi::tls {

constexpr size_t kRecordHeader = 5;

/** What could be read from the start of a buffer that may hold a TLS ClientHello. Never reads past [size]. */
struct HelloInfo {
  bool is_client_hello = false;   // a handshake record that starts with a ClientHello
  size_t record_payload = 0;      // declared payload length of that first record
  bool complete = false;          // the whole first record is in the buffer
  bool has_sni = false;
  size_t sni_offset = 0;          // offset of the first host name byte
  size_t sni_length = 0;
};

HelloInfo parse_client_hello(const uint8_t* data, size_t size);

/** Header plus payload length of the TLS handshake record at the start of the buffer; 0 when there is none. */
size_t first_record_size(const uint8_t* data, size_t size);

struct Fragmented {
  std::vector<uint8_t> bytes;
  /** Offsets in [bytes] where one record ends and the next begins. */
  std::vector<size_t> boundaries;
};

/**
 * Re-encodes the first record as several records, cutting its payload at [cuts] (offsets in the original buffer,
 * strictly inside the payload; others are ignored). What follows the first record is copied unchanged.
 */
Fragmented fragment_records(const uint8_t* data, size_t size, std::vector<size_t> cuts);

/**
 * A plausible ClientHello for [sni] that is exactly [total_size] bytes long, record header included.
 * Empty when [total_size] is too small to hold one.
 */
std::vector<uint8_t> build_fake_client_hello(const std::string& sni, size_t total_size, uint32_t seed);

}  // namespace voxel::dpi::tls
