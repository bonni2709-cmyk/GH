#include "strategy.hpp"

#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <set>

#include "http.hpp"
#include "tls.hpp"

namespace voxel::dpi {
namespace {

constexpr size_t kMaxPositions = 8;

std::string trim(const std::string& text) {
  size_t begin = 0;
  size_t end = text.size();
  while (begin < end && std::isspace(static_cast<unsigned char>(text[begin]))) ++begin;
  while (end > begin && std::isspace(static_cast<unsigned char>(text[end - 1]))) --end;
  return text.substr(begin, end - begin);
}

std::string lowered(std::string text) {
  for (char& c : text) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  return text;
}

bool all_digits(const std::string& text) {
  return !text.empty() && std::all_of(text.begin(), text.end(), [](char c) { return c >= '0' && c <= '9'; });
}

bool parse_number(const std::string& text, long min, long max, long* out) {
  if (!all_digits(text) || text.size() > 6) return false;
  long value = std::strtol(text.c_str(), nullptr, 10);
  if (value < min || value > max) return false;
  *out = value;
  return true;
}

bool parse_pos(const std::string& raw, Pos* out) {
  const std::string text = lowered(trim(raw));
  if (text.empty()) return false;
  Pos pos;
  std::string rest;
  if (text.compare(0, 3, "sni") == 0) {
    pos.base = Pos::Base::Name;
    rest = text.substr(3);
  } else if (text.compare(0, 4, "host") == 0) {
    pos.base = Pos::Base::Name;
    rest = text.substr(4);
  } else if (text.compare(0, 3, "mid") == 0) {
    pos.base = Pos::Base::Mid;
    rest = text.substr(3);
  } else if (text.compare(0, 3, "end") == 0) {
    pos.base = Pos::Base::End;
    rest = text.substr(3);
  } else {
    long value = 0;
    if (!parse_number(text, 0, 65535, &value)) return false;
    pos.offset = value;
    *out = pos;
    return true;
  }
  if (!rest.empty()) {
    if (rest[0] != '+' && rest[0] != '-') return false;
    long value = 0;
    if (!parse_number(rest.substr(1), 0, 65535, &value)) return false;
    pos.offset = rest[0] == '-' ? -value : value;
  }
  *out = pos;
  return true;
}

bool parse_positions(const std::string& value, std::vector<Pos>* out, std::string* error, const std::string& key) {
  std::vector<Pos> list;
  size_t start = 0;
  while (start <= value.size()) {
    size_t comma = value.find(',', start);
    std::string part = value.substr(start, comma == std::string::npos ? std::string::npos : comma - start);
    Pos pos;
    if (!parse_pos(part, &pos)) {
      *error = "bad position '" + trim(part) + "' in " + key;
      return false;
    }
    list.push_back(pos);
    if (comma == std::string::npos) break;
    start = comma + 1;
  }
  if (list.size() > kMaxPositions) {
    *error = "too many positions in " + key + " (at most " + std::to_string(kMaxPositions) + ")";
    return false;
  }
  out->insert(out->end(), list.begin(), list.end());
  return true;
}

bool valid_host_name(const std::string& name) {
  if (name.empty() || name.size() > 253) return false;
  return std::all_of(name.begin(), name.end(), [](char c) { return std::isalnum(static_cast<unsigned char>(c)) || c == '.' || c == '-'; });
}

bool apply_items(const std::string& text, Strategy* s, std::string* error, int depth);

bool apply_item(const std::string& raw, Strategy* s, std::string* error, int depth) {
  const std::string item = trim(raw);
  if (item.empty() || item[0] == '#') return true;
  const size_t eq = item.find('=');
  const std::string key = lowered(trim(item.substr(0, eq)));
  const std::string value = eq == std::string::npos ? "" : trim(item.substr(eq + 1));
  const bool has_value = eq != std::string::npos;

  if (key == "preset" || (!has_value && preset_text(key) != nullptr)) {
    const std::string name = key == "preset" ? lowered(value) : key;
    const char* text = preset_text(name);
    if (text == nullptr) {
      *error = "unknown preset '" + name + "'";
      return false;
    }
    if (depth > 0) {
      *error = "presets cannot be nested";
      return false;
    }
    return apply_items(text, s, error, depth + 1);
  }
  if (key == "split" || key == "tlsrec" || key == "oob") {
    if (!has_value || value.empty()) {
      *error = key + " needs positions, like " + key + "=1,sni+2";
      return false;
    }
    std::vector<Pos>* target = key == "split" ? &s->split : key == "tlsrec" ? &s->tlsrec : &s->oob;
    if (!parse_positions(value, target, error, key)) return false;
    if (key == "oob" && s->oob.size() > 1) {
      // The receiving kernel turns an earlier urgent byte into ordinary data when a later one arrives before it was read.
      *error = "oob takes a single position: a second urgent byte would reach the server as data";
      return false;
    }
    return true;
  }
  if (key == "disorder" || key == "fake") {
    long ttl = key == "disorder" ? 1 : 6;
    if (has_value && !value.empty() && !parse_number(value, 1, 64, &ttl)) {
      *error = key + " takes a TTL between 1 and 64";
      return false;
    }
    if (key == "disorder") {
      s->disorder = true;
      s->disorder_ttl = static_cast<int>(ttl);
    } else {
      s->fake = true;
      s->fake_ttl = static_cast<int>(ttl);
    }
    return true;
  }
  if (key == "fakesni") {
    if (!valid_host_name(value)) {
      *error = "fakesni needs a host name";
      return false;
    }
    s->fake_sni = value;
    return true;
  }
  if (key == "delay") {
    long ms = 0;
    if (!parse_number(value, 0, 1000, &ms)) {
      *error = "delay takes milliseconds between 0 and 1000";
      return false;
    }
    s->delay_ms = static_cast<int>(ms);
    return true;
  }
  if (key == "hold") {
    long ms = 0;
    if (!parse_number(value, 0, 100, &ms)) {
      *error = "hold takes milliseconds between 0 and 100";
      return false;
    }
    s->hold_ms = static_cast<int>(ms);
    return true;
  }
  *error = "unknown option '" + key + "'";
  return false;
}

bool apply_items(const std::string& text, Strategy* s, std::string* error, int depth) {
  size_t start = 0;
  while (start <= text.size()) {
    size_t end = text.find_first_of(";\n", start);
    if (!apply_item(text.substr(start, end == std::string::npos ? std::string::npos : end - start), s, error, depth)) return false;
    if (end == std::string::npos) break;
    start = end + 1;
  }
  return true;
}

std::string pos_text(const Pos& pos) {
  if (pos.base == Pos::Base::Abs) return std::to_string(pos.offset);
  const char* name = pos.base == Pos::Base::Name ? "sni" : pos.base == Pos::Base::Mid ? "mid" : "end";
  std::string text = name;
  if (pos.offset > 0) text += "+" + std::to_string(pos.offset);
  if (pos.offset < 0) text += "-" + std::to_string(-pos.offset);
  return text;
}

std::string list_text(const char* key, const std::vector<Pos>& list) {
  std::string text = key;
  text += "=";
  for (size_t i = 0; i < list.size(); ++i) {
    if (i) text += ",";
    text += pos_text(list[i]);
  }
  return text;
}

struct Context {
  size_t size = 0;
  bool has_name = false;
  size_t name_offset = 0;
};

bool evaluate(const Pos& pos, const Context& ctx, size_t* out) {
  long base = 0;
  switch (pos.base) {
    case Pos::Base::Abs: base = 0; break;
    case Pos::Base::Name: base = static_cast<long>(ctx.has_name ? ctx.name_offset : ctx.size / 2); break;
    case Pos::Base::Mid: base = static_cast<long>(ctx.size / 2); break;
    case Pos::Base::End: base = static_cast<long>(ctx.size); break;
  }
  const long value = base + pos.offset;
  if (value < 0) return false;
  *out = static_cast<size_t>(value);
  return true;
}

}  // namespace

const char* preset_text(const std::string& name) {
  const std::string n = lowered(name);
  if (n == "light") return "split=1,sni+2";
  if (n == "standard") return "tlsrec=sni+2;split=1,sni+2";
  if (n == "strong") return "tlsrec=sni+2;split=1,sni+2;disorder=1";
  return nullptr;
}

std::vector<std::string> preset_names() { return {"light", "standard", "strong"}; }

std::string Strategy::describe() const {
  std::vector<std::string> items;
  if (!tlsrec.empty()) items.push_back(list_text("tlsrec", tlsrec));
  if (!split.empty()) items.push_back(list_text("split", split));
  if (!oob.empty()) items.push_back(list_text("oob", oob));
  if (disorder) items.push_back("disorder=" + std::to_string(disorder_ttl));
  if (fake) {
    items.push_back("fake=" + std::to_string(fake_ttl));
    items.push_back("fakesni=" + fake_sni);
  }
  if (delay_ms > 0) items.push_back("delay=" + std::to_string(delay_ms));
  if (hold_ms != Strategy().hold_ms) items.push_back("hold=" + std::to_string(hold_ms));
  std::string text;
  for (size_t i = 0; i < items.size(); ++i) {
    if (i) text += ";";
    text += items[i];
  }
  return text.empty() ? "off" : text;
}

bool parse_strategy(const std::string& text, Strategy* out, std::string* error) {
  std::string scratch;
  std::string* err = error ? error : &scratch;
  const std::string whole = lowered(trim(text));
  Strategy result;
  if (!whole.empty() && whole != "off" && whole != "none") {
    if (!apply_items(text, &result, err, 0)) return false;
  }
  if (out) *out = result;
  return true;
}

Plan build_plan(const Strategy& strategy, const uint8_t* data, size_t size) {
  Plan plan;
  plan.disorder = strategy.disorder;
  plan.disorder_ttl = strategy.disorder_ttl;
  plan.fake = strategy.fake;
  plan.fake_ttl = strategy.fake_ttl;
  plan.fake_sni = strategy.fake_sni;
  plan.delay_ms = strategy.delay_ms;
  plan.hold_ms = strategy.hold_ms;
  if (size == 0) return plan;

  const tls::HelloInfo hello = tls::parse_client_hello(data, size);
  Context ctx;
  if (hello.is_client_hello) {
    plan.kind = PayloadKind::TlsClientHello;
    ctx.has_name = hello.has_sni;
    ctx.name_offset = hello.sni_offset;
  } else {
    const size_t host = http::find_host(data, size);
    if (http::looks_like_request(data, size)) plan.kind = PayloadKind::HttpRequest;
    if (host != http::kNotFound) {
      ctx.has_name = true;
      ctx.name_offset = host;
    }
  }

  // TLS records first: they change the bytes, and with them every later offset.
  std::vector<size_t> record_cuts;
  if (plan.kind == PayloadKind::TlsClientHello) {
    Context original;
    original.size = size;
    original.has_name = ctx.has_name;
    original.name_offset = ctx.name_offset;
    const size_t record_end = std::min(size, tls::kRecordHeader + hello.record_payload);
    for (const Pos& pos : strategy.tlsrec) {
      size_t at = 0;
      if (evaluate(pos, original, &at) && at > tls::kRecordHeader && at < record_end) record_cuts.push_back(at);
    }
    std::sort(record_cuts.begin(), record_cuts.end());
    record_cuts.erase(std::unique(record_cuts.begin(), record_cuts.end()), record_cuts.end());
  }
  if (record_cuts.empty()) {
    plan.stream.assign(data, data + size);
  } else {
    plan.stream = tls::fragment_records(data, size, record_cuts).bytes;
    if (ctx.has_name) {
      // Every record header inserted at or before the host name pushes it to the right.
      const size_t shifted = static_cast<size_t>(std::count_if(record_cuts.begin(), record_cuts.end(), [&](size_t c) { return c <= ctx.name_offset; }));
      ctx.name_offset += shifted * tls::kRecordHeader;
    }
  }
  ctx.size = plan.stream.size();

  std::set<size_t> cuts;
  std::set<size_t> urgent;
  for (const Pos& pos : strategy.split) {
    size_t at = 0;
    if (evaluate(pos, ctx, &at) && at >= 1 && at < ctx.size) cuts.insert(at);
  }
  for (const Pos& pos : strategy.oob) {
    size_t at = 0;
    if (evaluate(pos, ctx, &at) && at >= 1 && at < ctx.size) {
      cuts.insert(at);
      urgent.insert(at);
    }
  }
  // Reordering or replacing the first segment needs a first segment that is not the whole payload. A decoy has to
  // reach past the start of the host name to be worth anything; a held-back segment can be as short as one byte.
  if ((strategy.fake || strategy.disorder) && cuts.empty() && ctx.size >= 2) {
    size_t at = 1;
    if (strategy.fake) at = ctx.has_name ? ctx.name_offset + 1 : ctx.size / 2;
    if (at >= 1 && at < ctx.size) cuts.insert(at);
  }

  plan.cuts.assign(cuts.begin(), cuts.end());
  plan.oob_after.assign(urgent.begin(), urgent.end());
  return plan;
}

}  // namespace voxel::dpi
