#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace voxel::dpi {

/**
 * A place in the first payload of a connection. Written `N`, `sni`, `sni+3`, `host-1`, `mid` or `end-2`:
 * `sni` and `host` both mean the first byte of the host name (the SNI of a TLS hello or the Host header of an
 * HTTP request) and fall back to the middle of the payload when there is none.
 */
struct Pos {
  enum class Base { Abs, Name, Mid, End };
  Base base = Base::Abs;
  long offset = 0;
};

/** What to do with the first client payload of every proxied connection. */
struct Strategy {
  std::vector<Pos> split;   // send the payload as separate TCP segments cut here
  std::vector<Pos> tlsrec;  // cut the TLS ClientHello record into several records here
  std::vector<Pos> oob;     // after the segment that ends here send one urgent (out-of-band) byte; at most one position
  bool disorder = false;    // the first segment goes out with a tiny TTL and is retransmitted after the others
  int disorder_ttl = 1;
  bool fake = false;        // a decoy ClientHello with a low TTL occupies the first segment's place on the wire
  int fake_ttl = 6;
  std::string fake_sni = "www.google.com";
  int delay_ms = 0;         // pause between segments
  int hold_ms = 5;          // how long the decoy's memory stays untouched after it was sent, until a NIC has surely read it

  bool active() const { return !split.empty() || !tlsrec.empty() || !oob.empty() || disorder || fake; }
  /** The canonical text form; parsing it yields the same strategy. */
  std::string describe() const;
};

/**
 * Parses `key=value;key=value` (`;` or newlines separate items). Keys: split, tlsrec, oob (position lists),
 * disorder[=ttl], fake[=ttl], fakesni, delay (ms), hold (ms), preset (a preset name). A lone preset name is a preset.
 * Empty text, `off` and `none` give an inactive strategy.
 */
bool parse_strategy(const std::string& text, Strategy* out, std::string* error);

/** The strategy text of a preset (light, standard, strong), or nullptr. */
const char* preset_text(const std::string& name);
std::vector<std::string> preset_names();

enum class PayloadKind { Other, TlsClientHello, HttpRequest };

/** The first payload turned into what is to be put on the wire. */
struct Plan {
  PayloadKind kind = PayloadKind::Other;
  std::vector<uint8_t> stream;     // the bytes, after TLS record fragmentation
  std::vector<size_t> cuts;        // TCP segment boundaries, strictly increasing, each inside (0, stream.size())
  std::vector<size_t> oob_after;   // the cuts after which an urgent byte follows
  bool disorder = false;
  int disorder_ttl = 1;
  bool fake = false;
  int fake_ttl = 6;
  std::string fake_sni;
  int delay_ms = 0;
  int hold_ms = 5;

  size_t segment_count() const { return cuts.size() + 1; }
};

Plan build_plan(const Strategy& strategy, const uint8_t* data, size_t size);

}  // namespace voxel::dpi
