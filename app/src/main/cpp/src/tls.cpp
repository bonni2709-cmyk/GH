#include "tls.hpp"

#include <algorithm>

namespace voxel::dpi::tls {
namespace {

constexpr uint8_t kHandshake = 0x16;
constexpr uint8_t kClientHello = 0x01;

size_t be16(const uint8_t* p) { return (static_cast<size_t>(p[0]) << 8) | p[1]; }

void put16(std::vector<uint8_t>& out, size_t value) {
  out.push_back(static_cast<uint8_t>(value >> 8));
  out.push_back(static_cast<uint8_t>(value));
}

void put24(std::vector<uint8_t>& out, size_t value) {
  out.push_back(static_cast<uint8_t>(value >> 16));
  out.push_back(static_cast<uint8_t>(value >> 8));
  out.push_back(static_cast<uint8_t>(value));
}

struct Rng {
  uint32_t state;
  explicit Rng(uint32_t seed) : state(seed ? seed : 0x9e3779b9u) {}
  uint8_t next() {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return static_cast<uint8_t>(state >> 11);
  }
};

void put_random(std::vector<uint8_t>& out, Rng& rng, size_t count) {
  for (size_t i = 0; i < count; ++i) out.push_back(rng.next());
}

void put_extension(std::vector<uint8_t>& out, size_t type, const std::vector<uint8_t>& body) {
  put16(out, type);
  put16(out, body.size());
  out.insert(out.end(), body.begin(), body.end());
}

}  // namespace

size_t first_record_size(const uint8_t* data, size_t size) {
  if (size < kRecordHeader || data[0] != kHandshake || data[1] != 0x03) return 0;
  return kRecordHeader + be16(data + 3);
}

HelloInfo parse_client_hello(const uint8_t* d, size_t n) {
  HelloInfo info;
  if (n < kRecordHeader + 1 || d[0] != kHandshake || d[1] != 0x03 || d[2] > 0x04) return info;
  if (d[5] != kClientHello) return info;
  info.is_client_hello = true;
  info.record_payload = be16(d + 3);
  const size_t record_end = kRecordHeader + info.record_payload;
  info.complete = n >= record_end;
  const size_t end = std::min(n, record_end);

  // handshake header (4) + client_version (2) + random (32)
  size_t p = kRecordHeader + 4 + 2 + 32;
  if (p + 1 > end) return info;
  p += 1 + d[p];  // session id
  if (p + 2 > end) return info;
  p += 2 + be16(d + p);  // cipher suites
  if (p + 1 > end) return info;
  p += 1 + d[p];  // compression methods
  if (p + 2 > end) return info;
  const size_t extensions_len = be16(d + p);
  p += 2;
  const size_t extensions_end = std::min(end, p + extensions_len);
  while (p + 4 <= extensions_end) {
    const size_t type = be16(d + p);
    const size_t length = be16(d + p + 2);
    p += 4;
    if (type == 0x0000) {
      // server_name: list length (2), name type (1), name length (2), name
      if (length >= 5 && p + 5 <= extensions_end && d[p + 2] == 0) {
        const size_t name_length = be16(d + p + 3);
        const size_t name_offset = p + 5;
        if (name_length > 0 && name_offset + name_length <= extensions_end) {
          info.has_sni = true;
          info.sni_offset = name_offset;
          info.sni_length = name_length;
        }
      }
      return info;
    }
    p += length;
  }
  return info;
}

Fragmented fragment_records(const uint8_t* data, size_t size, std::vector<size_t> cuts) {
  Fragmented result;
  const size_t first = first_record_size(data, size);
  if (first == 0 || first > size) {
    result.bytes.assign(data, data + size);
    return result;
  }
  std::sort(cuts.begin(), cuts.end());
  cuts.erase(std::unique(cuts.begin(), cuts.end()), cuts.end());
  cuts.erase(std::remove_if(cuts.begin(), cuts.end(), [first](size_t c) { return c <= kRecordHeader || c >= first; }), cuts.end());
  cuts.push_back(first);

  result.bytes.reserve(size + cuts.size() * kRecordHeader);
  size_t start = kRecordHeader;
  for (size_t i = 0; i < cuts.size(); ++i) {
    const size_t stop = cuts[i];
    result.bytes.push_back(data[0]);
    result.bytes.push_back(data[1]);
    result.bytes.push_back(data[2]);
    put16(result.bytes, stop - start);
    result.bytes.insert(result.bytes.end(), data + start, data + stop);
    if (i + 1 < cuts.size()) result.boundaries.push_back(result.bytes.size());
    start = stop;
  }
  result.bytes.insert(result.bytes.end(), data + first, data + size);
  return result;
}

std::vector<uint8_t> build_fake_client_hello(const std::string& sni, size_t total_size, uint32_t seed) {
  Rng rng(seed);
  std::vector<uint8_t> body;  // everything after the 4-byte handshake header

  body.push_back(0x03);
  body.push_back(0x03);
  put_random(body, rng, 32);
  body.push_back(32);
  put_random(body, rng, 32);

  static const uint16_t kSuites[] = {0x1301, 0x1302, 0x1303, 0xc02b, 0xc02f, 0xc02c, 0xc030, 0xcca9, 0xcca8, 0xc013, 0xc014, 0x009c, 0x009d, 0x002f, 0x0035};
  put16(body, sizeof(kSuites));
  for (uint16_t suite : kSuites) put16(body, suite);
  body.push_back(1);
  body.push_back(0);

  std::vector<uint8_t> extensions;
  {
    std::vector<uint8_t> ext;
    put16(ext, sni.size() + 3);
    ext.push_back(0);
    put16(ext, sni.size());
    ext.insert(ext.end(), sni.begin(), sni.end());
    put_extension(extensions, 0x0000, ext);
  }
  {
    std::vector<uint8_t> ext;
    put16(ext, 6);
    put16(ext, 0x001d);
    put16(ext, 0x0017);
    put16(ext, 0x0018);
    put_extension(extensions, 0x000a, ext);
  }
  {
    static const uint16_t kAlgorithms[] = {0x0403, 0x0804, 0x0401, 0x0503, 0x0805, 0x0501, 0x0806, 0x0601};
    std::vector<uint8_t> ext;
    put16(ext, sizeof(kAlgorithms));
    for (uint16_t a : kAlgorithms) put16(ext, a);
    put_extension(extensions, 0x000d, ext);
  }
  {
    static const char kH2[] = "h2";
    static const char kHttp11[] = "http/1.1";
    std::vector<uint8_t> ext;
    put16(ext, 1 + 2 + 1 + 8);
    ext.push_back(2);
    ext.insert(ext.end(), kH2, kH2 + 2);
    ext.push_back(8);
    ext.insert(ext.end(), kHttp11, kHttp11 + 8);
    put_extension(extensions, 0x0010, ext);
  }
  {
    std::vector<uint8_t> ext = {0x04, 0x03, 0x04, 0x03, 0x03};
    put_extension(extensions, 0x002b, ext);
  }
  {
    std::vector<uint8_t> ext;
    put16(ext, 2 + 2 + 32);
    put16(ext, 0x001d);
    put16(ext, 32);
    put_random(ext, rng, 32);
    put_extension(extensions, 0x0033, ext);
  }
  {
    std::vector<uint8_t> ext = {0x01, 0x01};
    put_extension(extensions, 0x002d, ext);
  }

  // The padding extension (4 bytes of header plus filler) absorbs whatever is left to reach the requested size.
  const size_t fixed = kRecordHeader + 4 + body.size() + 2 + extensions.size() + 4;
  if (total_size < fixed) return {};
  const size_t padding = total_size - fixed;
  put16(extensions, 0x0015);
  put16(extensions, padding);
  extensions.insert(extensions.end(), padding, 0);

  put16(body, extensions.size());
  body.insert(body.end(), extensions.begin(), extensions.end());

  std::vector<uint8_t> out;
  out.reserve(total_size);
  out.push_back(kHandshake);
  out.push_back(0x03);
  out.push_back(0x01);
  put16(out, 4 + body.size());
  out.push_back(kClientHello);
  put24(out, body.size());
  out.insert(out.end(), body.begin(), body.end());
  return out;
}

}  // namespace voxel::dpi::tls
