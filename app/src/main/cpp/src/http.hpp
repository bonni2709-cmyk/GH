#pragma once

#include <cstddef>
#include <cstdint>

namespace voxel::dpi::http {

constexpr size_t kNotFound = static_cast<size_t>(-1);

/** True when the buffer begins like an HTTP request ("GET ", "POST ", ...). */
bool looks_like_request(const uint8_t* data, size_t size);

/** Offset of the first byte of the Host header's value, or kNotFound. */
size_t find_host(const uint8_t* data, size_t size);

/** True once the end of the request head ("\r\n\r\n") is in the buffer. */
bool head_complete(const uint8_t* data, size_t size);

}  // namespace voxel::dpi::http
