#include <algorithm>

#include "check.hpp"
#include "samples.hpp"
#include "strategy.hpp"
#include "tls.hpp"

using namespace voxel::dpi;

namespace {

Strategy parse_ok(const std::string& text) {
  Strategy s;
  std::string error;
  const bool ok = parse_strategy(text, &s, &error);
  if (!ok) testing::report(__FILE__, __LINE__, "'" + text + "' should parse but: " + error);
  return s;
}

std::string error_of(const std::string& text) {
  Strategy s;
  std::string error;
  if (parse_strategy(text, &s, &error)) testing::report(__FILE__, __LINE__, "'" + text + "' should not parse");
  return error;
}

std::vector<uint8_t> curl_hello() { return samples::from_hex(samples::curl_hello_hex()); }

}  // namespace

TEST(strategy_empty_and_off_do_nothing) {
  CHECK(!parse_ok("").active());
  CHECK(!parse_ok("  \n ").active());
  CHECK(!parse_ok("off").active());
  CHECK(!parse_ok("None").active());
  CHECK_EQ(parse_ok("off").describe(), std::string("off"));
}

TEST(strategy_parses_every_option) {
  const Strategy s = parse_ok(" Split = 1, sni+2 , mid ; tlsrec=host-1 ;oob=3\n disorder=2; fake ; fakesni=Example.org; delay=15; hold=40 ");
  CHECK_EQ(s.split.size(), static_cast<size_t>(3));
  CHECK_EQ(s.tlsrec.size(), static_cast<size_t>(1));
  CHECK_EQ(s.oob.size(), static_cast<size_t>(1));
  CHECK(s.disorder);
  CHECK_EQ(s.disorder_ttl, 2);
  CHECK(s.fake);
  CHECK_EQ(s.fake_ttl, 6);
  CHECK_EQ(s.fake_sni, std::string("Example.org"));
  CHECK_EQ(s.delay_ms, 15);
  CHECK_EQ(s.hold_ms, 40);
  CHECK_EQ(Strategy().hold_ms, 5);
  CHECK(s.active());
  CHECK(s.split[1].base == Pos::Base::Name && s.split[1].offset == 2);
  CHECK(s.split[2].base == Pos::Base::Mid);
  CHECK(s.tlsrec[0].base == Pos::Base::Name && s.tlsrec[0].offset == -1);
}

TEST(strategy_describe_round_trips) {
  const char* texts[] = {"split=1,sni+2", "tlsrec=sni+2;split=1,sni+2;disorder=1", "oob=4;delay=20", "fake=3;fakesni=a.b;split=end-2,mid+1;hold=20", "light", "standard", "strong"};
  for (const char* text : texts) {
    const Strategy once = parse_ok(text);
    const Strategy twice = parse_ok(once.describe());
    CHECK_EQ(once.describe(), twice.describe());
  }
}

TEST(strategy_presets) {
  for (const std::string& name : preset_names()) {
    CHECK(preset_text(name) != nullptr);
    CHECK(parse_ok(name).active());
    CHECK_EQ(parse_ok("preset=" + name).describe(), parse_ok(name).describe());
  }
  CHECK(preset_text("nonsense") == nullptr);
  // A preset can be refined.
  const Strategy refined = parse_ok("standard;delay=25;oob=7");
  CHECK_EQ(refined.delay_ms, 25);
  CHECK_EQ(refined.oob.size(), static_cast<size_t>(1));
  CHECK(!refined.tlsrec.empty());
  CHECK_EQ(parse_ok("STRONG").describe(), parse_ok("strong").describe());
}

TEST(strategy_rejects_mistakes_with_a_reason) {
  CHECK(error_of("bogus").find("unknown option 'bogus'") != std::string::npos);
  CHECK(error_of("split").find("needs positions") != std::string::npos);
  CHECK(error_of("split=").find("needs positions") != std::string::npos);
  CHECK(error_of("split=x").find("bad position 'x'") != std::string::npos);
  CHECK(error_of("split=1,").find("bad position") != std::string::npos);
  CHECK(error_of("split=sni*2").find("bad position") != std::string::npos);
  CHECK(error_of("split=-3").find("bad position") != std::string::npos);
  CHECK(error_of("split=70000").find("bad position") != std::string::npos);
  CHECK(error_of("split=1,2,3,4,5,6,7,8,9").find("too many") != std::string::npos);
  CHECK(error_of("oob=1,2").find("single position") != std::string::npos);
  CHECK(error_of("oob=1;oob=2").find("single position") != std::string::npos);
  CHECK(error_of("disorder=0").find("TTL") != std::string::npos);
  CHECK(error_of("fake=65").find("TTL") != std::string::npos);
  CHECK(error_of("fake=x").find("TTL") != std::string::npos);
  CHECK(error_of("delay=1001").find("delay") != std::string::npos);
  CHECK(error_of("delay=").find("delay") != std::string::npos);
  CHECK(error_of("hold=101").find("hold") != std::string::npos);
  CHECK(error_of("fakesni=").find("host name") != std::string::npos);
  CHECK(error_of("fakesni=bad name!").find("host name") != std::string::npos);
  CHECK(error_of("preset=nope").find("unknown preset 'nope'") != std::string::npos);
  CHECK(error_of("split=1;preset=").find("unknown preset") != std::string::npos);
}

TEST(plan_cuts_a_tls_hello_at_the_host_name) {
  const auto hello = curl_hello();
  const size_t sni = tls::parse_client_hello(hello.data(), hello.size()).sni_offset;
  const Plan plan = build_plan(parse_ok("split=1,sni+2,end-1"), hello.data(), hello.size());
  CHECK(plan.kind == PayloadKind::TlsClientHello);
  CHECK(plan.stream == hello);
  CHECK(plan.cuts == (std::vector<size_t>{1, sni + 2, hello.size() - 1}));
  CHECK_EQ(plan.segment_count(), static_cast<size_t>(4));
}

TEST(plan_ignores_positions_outside_the_payload) {
  const auto hello = curl_hello();
  const Plan plan = build_plan(parse_ok("split=0,60000,end,end+5,sni-9999,mid,mid"), hello.data(), hello.size());
  CHECK(plan.cuts == (std::vector<size_t>{hello.size() / 2}));
  CHECK(build_plan(parse_ok("split=1"), hello.data(), 1).cuts.empty());
  CHECK(build_plan(parse_ok("split=1"), nullptr, 0).stream.empty());
}

TEST(plan_tls_records_shift_the_later_positions) {
  const auto hello = curl_hello();
  const auto info = tls::parse_client_hello(hello.data(), hello.size());
  const size_t sni = info.sni_offset;
  const Plan plan = build_plan(parse_ok("tlsrec=sni+2;split=sni+2,sni+10"), hello.data(), hello.size());
  CHECK_EQ(plan.stream.size(), hello.size() + tls::kRecordHeader);
  // The first cut ends the first record, just before the header that was inserted; the second one lies behind it.
  CHECK(plan.cuts == (std::vector<size_t>{sni + 2, sni + 10}));
  CHECK_EQ(static_cast<int>(plan.stream[sni + 2]), 0x16);
  CHECK_EQ(plan.stream[3] * 256 + plan.stream[4], static_cast<int>(sni + 2 - tls::kRecordHeader));
  // 'sni' keeps naming the host name after the headers moved it: here the header lies behind it, so nothing shifted.
  const Plan before = build_plan(parse_ok("tlsrec=sni-5;split=sni"), hello.data(), hello.size());
  CHECK(before.cuts == (std::vector<size_t>{sni + tls::kRecordHeader}));
  CHECK_EQ(std::string(reinterpret_cast<const char*>(before.stream.data()) + before.cuts[0], 5), std::string(samples::kCurlSni).substr(0, 5));
}

TEST(plan_tls_records_are_only_for_client_hellos) {
  const std::string text = "GET / HTTP/1.1\r\nHost: example.org\r\n\r\n";
  const Plan plan = build_plan(parse_ok("tlsrec=10;split=host+3"), reinterpret_cast<const uint8_t*>(text.data()), text.size());
  CHECK(plan.kind == PayloadKind::HttpRequest);
  CHECK_EQ(plan.stream.size(), text.size());
  CHECK(plan.cuts == (std::vector<size_t>{text.find("example.org") + 3}));
  // Anything else: 'sni' falls back to the middle.
  const std::string blob(41, 'x');
  const Plan other = build_plan(parse_ok("split=sni"), reinterpret_cast<const uint8_t*>(blob.data()), blob.size());
  CHECK(other.kind == PayloadKind::Other);
  CHECK(other.cuts == (std::vector<size_t>{20}));
}

TEST(plan_fake_and_disorder_get_a_first_segment) {
  const auto hello = curl_hello();
  const size_t sni = tls::parse_client_hello(hello.data(), hello.size()).sni_offset;
  const Plan disorder = build_plan(parse_ok("disorder"), hello.data(), hello.size());
  CHECK(disorder.disorder);
  CHECK(disorder.cuts == (std::vector<size_t>{1}));
  // A decoy has to cover the start of the host name.
  const Plan fake = build_plan(parse_ok("fake=4"), hello.data(), hello.size());
  CHECK(fake.fake);
  CHECK_EQ(fake.fake_ttl, 4);
  CHECK(fake.cuts == (std::vector<size_t>{sni + 1}));
  const Plan explicit_cut = build_plan(parse_ok("fake;split=7"), hello.data(), hello.size());
  CHECK(explicit_cut.cuts == (std::vector<size_t>{7}));
}

TEST(plan_oob_adds_its_own_cut) {
  const auto hello = curl_hello();
  const Plan plan = build_plan(parse_ok("split=1;oob=5"), hello.data(), hello.size());
  CHECK(plan.cuts == (std::vector<size_t>{1, 5}));
  CHECK(plan.oob_after == (std::vector<size_t>{5}));
}
