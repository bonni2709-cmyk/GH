#include <algorithm>
#include <cstring>

#include "check.hpp"
#include "http.hpp"
#include "samples.hpp"
#include "tls.hpp"

using namespace voxel::dpi;

namespace {

std::string sni_of(const std::vector<uint8_t>& data, const tls::HelloInfo& info) {
  return std::string(reinterpret_cast<const char*>(data.data()) + info.sni_offset, info.sni_length);
}

uint32_t xorshift(uint32_t& state) {
  state ^= state << 13;
  state ^= state >> 17;
  state ^= state << 5;
  return state;
}

}  // namespace

TEST(tls_parses_real_client_hellos) {
  const auto openssl = samples::from_hex(samples::openssl_hello_hex());
  const auto curl = samples::from_hex(samples::curl_hello_hex());
  CHECK_EQ(openssl.size(), static_cast<size_t>(317));
  CHECK_EQ(curl.size(), static_cast<size_t>(517));

  const auto a = tls::parse_client_hello(openssl.data(), openssl.size());
  CHECK(a.is_client_hello);
  CHECK(a.complete);
  CHECK(a.has_sni);
  CHECK_EQ(sni_of(openssl, a), std::string(samples::kOpenSslSni));
  CHECK_EQ(a.record_payload + tls::kRecordHeader, openssl.size());

  const auto b = tls::parse_client_hello(curl.data(), curl.size());
  CHECK(b.is_client_hello && b.complete && b.has_sni);
  CHECK_EQ(sni_of(curl, b), std::string(samples::kCurlSni));
  CHECK_EQ(tls::first_record_size(curl.data(), curl.size()), curl.size());
}

TEST(tls_parser_never_reads_past_the_buffer) {
  const auto hello = samples::from_hex(samples::curl_hello_hex());
  for (size_t n = 0; n <= hello.size(); ++n) {
    // A heap copy of exactly n bytes, so AddressSanitizer notices any read beyond it.
    std::vector<uint8_t> cut(hello.begin(), hello.begin() + static_cast<std::ptrdiff_t>(n));
    const auto info = tls::parse_client_hello(cut.data(), cut.size());
    if (info.has_sni) CHECK(info.sni_offset + info.sni_length <= n);
    CHECK_EQ(info.complete, n >= hello.size());
    tls::first_record_size(cut.data(), cut.size());
  }
}

TEST(tls_parser_survives_garbage) {
  const auto hello = samples::from_hex(samples::openssl_hello_hex());
  uint32_t state = 12345;
  for (int round = 0; round < 20000; ++round) {
    std::vector<uint8_t> data = hello;
    const int flips = 1 + static_cast<int>(xorshift(state) % 6);
    for (int i = 0; i < flips; ++i) data[xorshift(state) % data.size()] = static_cast<uint8_t>(xorshift(state));
    data.resize(1 + xorshift(state) % data.size());
    const auto info = tls::parse_client_hello(data.data(), data.size());
    if (info.has_sni) CHECK(info.sni_offset + info.sni_length <= data.size());
  }
  std::vector<uint8_t> noise(4096);
  for (auto& b : noise) b = static_cast<uint8_t>(xorshift(state));
  for (size_t n = 0; n < noise.size(); n += 7) tls::parse_client_hello(noise.data(), n);
}

TEST(tls_rejects_other_payloads) {
  const std::string http = "GET / HTTP/1.1\r\nHost: example.org\r\n\r\n";
  CHECK(!tls::parse_client_hello(reinterpret_cast<const uint8_t*>(http.data()), http.size()).is_client_hello);
  CHECK_EQ(tls::first_record_size(reinterpret_cast<const uint8_t*>(http.data()), http.size()), static_cast<size_t>(0));
  const uint8_t alert[] = {0x15, 0x03, 0x03, 0x00, 0x02, 0x02, 0x28};
  CHECK(!tls::parse_client_hello(alert, sizeof(alert)).is_client_hello);
  CHECK(!tls::parse_client_hello(nullptr, 0).is_client_hello);
}

TEST(tls_fragment_records_keeps_the_payload) {
  const auto hello = samples::from_hex(samples::curl_hello_hex());
  const auto info = tls::parse_client_hello(hello.data(), hello.size());
  const size_t sni = info.sni_offset;

  // Duplicates, a cut inside the header and cuts at or past the record end are ignored.
  const auto parts = tls::fragment_records(hello.data(), hello.size(), {sni + 3, 40, sni + 3, 2, 5, hello.size(), hello.size() + 10});
  CHECK_EQ(parts.boundaries.size(), static_cast<size_t>(2));
  CHECK_EQ(parts.bytes.size(), hello.size() + 2 * tls::kRecordHeader);

  std::vector<uint8_t> payload;
  size_t at = 0;
  size_t records = 0;
  while (at < parts.bytes.size()) {
    CHECK_EQ(static_cast<int>(parts.bytes[at]), 0x16);
    CHECK_EQ(static_cast<int>(parts.bytes[at + 1]), static_cast<int>(hello[1]));
    CHECK_EQ(static_cast<int>(parts.bytes[at + 2]), static_cast<int>(hello[2]));
    const size_t length = (static_cast<size_t>(parts.bytes[at + 3]) << 8) | parts.bytes[at + 4];
    CHECK(at + 5 + length <= parts.bytes.size());
    payload.insert(payload.end(), parts.bytes.begin() + static_cast<std::ptrdiff_t>(at) + 5, parts.bytes.begin() + static_cast<std::ptrdiff_t>(at + 5 + length));
    at += 5 + length;
    ++records;
  }
  CHECK_EQ(records, static_cast<size_t>(3));
  CHECK(payload == std::vector<uint8_t>(hello.begin() + 5, hello.end()));
  // Each boundary is where a record header starts.
  for (size_t boundary : parts.boundaries) CHECK_EQ(static_cast<int>(parts.bytes[boundary]), 0x16);
}

TEST(tls_fragment_records_copies_what_follows) {
  auto hello = samples::from_hex(samples::openssl_hello_hex());
  const std::vector<uint8_t> tail = {0x14, 0x03, 0x03, 0x00, 0x01, 0x01};
  hello.insert(hello.end(), tail.begin(), tail.end());
  const auto parts = tls::fragment_records(hello.data(), hello.size(), {50});
  CHECK(std::equal(tail.begin(), tail.end(), parts.bytes.end() - static_cast<std::ptrdiff_t>(tail.size())));
  CHECK_EQ(parts.bytes.size(), hello.size() + tls::kRecordHeader);
}

TEST(tls_fragment_records_leaves_other_data_alone) {
  const std::string text = "not tls at all";
  const auto parts = tls::fragment_records(reinterpret_cast<const uint8_t*>(text.data()), text.size(), {3});
  CHECK_EQ(std::string(parts.bytes.begin(), parts.bytes.end()), text);
  CHECK(parts.boundaries.empty());
}

TEST(tls_fake_client_hello_has_the_requested_size_and_name) {
  const size_t sizes[] = {248, 256, 300, 517, 1400, 4000};
  for (size_t size : sizes) {
    const auto fake = tls::build_fake_client_hello("www.google.com", size, 7);
    CHECK_EQ(fake.size(), size);
    const auto info = tls::parse_client_hello(fake.data(), fake.size());
    CHECK(info.is_client_hello && info.complete && info.has_sni);
    if (info.has_sni) CHECK_EQ(sni_of(fake, info), std::string("www.google.com"));
    CHECK_EQ(tls::first_record_size(fake.data(), fake.size()), size);
  }
  CHECK(tls::build_fake_client_hello("www.google.com", 100, 7).empty());
  CHECK(tls::build_fake_client_hello("a.example", 10, 7).empty());
  // Different seeds give different bytes (the random field and key share), so decoys do not look alike.
  CHECK(tls::build_fake_client_hello("a.example", 400, 1) != tls::build_fake_client_hello("a.example", 400, 2));
}

TEST(http_finds_the_host_header) {
  const std::string request = "GET /sub HTTP/1.1\r\nUser-Agent: x\r\nHOST:  example.org:8080\r\nAccept: */*\r\n\r\n";
  const auto* bytes = reinterpret_cast<const uint8_t*>(request.data());
  CHECK(http::looks_like_request(bytes, request.size()));
  const size_t at = http::find_host(bytes, request.size());
  CHECK(at != http::kNotFound);
  if (at != http::kNotFound) CHECK_EQ(request.substr(at, 11), std::string("example.org"));
  CHECK(http::head_complete(bytes, request.size()));
  CHECK(!http::head_complete(bytes, request.size() - 2));

  const std::string no_host = "GET / HTTP/1.0\r\n\r\n";
  CHECK_EQ(http::find_host(reinterpret_cast<const uint8_t*>(no_host.data()), no_host.size()), http::kNotFound);
  const std::string other = "\x16\x03\x01 Host: x";
  CHECK_EQ(http::find_host(reinterpret_cast<const uint8_t*>(other.data()), other.size()), http::kNotFound);
}
