#include "http.hpp"

#include <cstring>

namespace voxel::dpi::http {
namespace {

char lower(uint8_t c) { return (c >= 'A' && c <= 'Z') ? static_cast<char>(c - 'A' + 'a') : static_cast<char>(c); }

bool starts_with(const uint8_t* data, size_t size, const char* prefix) {
  const size_t length = std::strlen(prefix);
  return size >= length && std::memcmp(data, prefix, length) == 0;
}

}  // namespace

bool looks_like_request(const uint8_t* data, size_t size) {
  static const char* const kMethods[] = {"GET ", "POST ", "HEAD ", "PUT ", "DELETE ", "OPTIONS ", "CONNECT ", "PATCH ", "TRACE "};
  for (const char* method : kMethods) {
    if (starts_with(data, size, method)) return true;
  }
  return false;
}

size_t find_host(const uint8_t* data, size_t size) {
  if (!looks_like_request(data, size)) return kNotFound;
  static const char kName[] = "\nhost:";
  const size_t name_length = sizeof(kName) - 1;
  for (size_t i = 0; i + name_length <= size; ++i) {
    size_t k = 0;
    while (k < name_length && lower(data[i + k]) == kName[k]) ++k;
    if (k != name_length) continue;
    size_t p = i + name_length;
    while (p < size && (data[p] == ' ' || data[p] == '\t')) ++p;
    return p < size ? p : kNotFound;
  }
  return kNotFound;
}

bool head_complete(const uint8_t* data, size_t size) {
  for (size_t i = 0; i + 4 <= size; ++i) {
    if (data[i] == '\r' && data[i + 1] == '\n' && data[i + 2] == '\r' && data[i + 3] == '\n') return true;
  }
  return false;
}

}  // namespace voxel::dpi::http
