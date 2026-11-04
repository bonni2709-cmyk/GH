#include <sys/socket.h>
#include <unistd.h>

#include <cstring>

#include "check.hpp"
#include "net.hpp"
#include "socks5.hpp"

using namespace voxel::dpi;

namespace {

struct Pair {
  int server = -1;
  int client = -1;
  Pair() {
    int fds[2];
    if (::socketpair(AF_UNIX, SOCK_STREAM, 0, fds) == 0) {
      server = fds[0];
      client = fds[1];
    }
  }
  ~Pair() {
    if (server >= 0) ::close(server);
    if (client >= 0) ::close(client);
  }
  void send(const std::vector<uint8_t>& bytes) { net::send_all(client, bytes.data(), bytes.size(), 1000); }
  std::vector<uint8_t> received() {
    ::shutdown(server, SHUT_WR);
    std::vector<uint8_t> out;
    uint8_t buffer[256];
    while (true) {
      ssize_t n = ::recv(client, buffer, sizeof(buffer), 0);
      if (n <= 0) break;
      out.insert(out.end(), buffer, buffer + n);
    }
    return out;
  }
};

const socks5::Credentials kCredentials{"voxel", "s3cret"};

std::vector<uint8_t> concat(std::initializer_list<std::vector<uint8_t>> parts) {
  std::vector<uint8_t> out;
  for (const auto& p : parts) out.insert(out.end(), p.begin(), p.end());
  return out;
}

std::vector<uint8_t> greeting() { return {0x05, 0x01, 0x02}; }

std::vector<uint8_t> login(const std::string& user, const std::string& pass) {
  std::vector<uint8_t> out = {0x01, static_cast<uint8_t>(user.size())};
  out.insert(out.end(), user.begin(), user.end());
  out.push_back(static_cast<uint8_t>(pass.size()));
  out.insert(out.end(), pass.begin(), pass.end());
  return out;
}

std::vector<uint8_t> good_login() { return login("voxel", "s3cret"); }

}  // namespace

TEST(socks5_accepts_an_ipv4_connect) {
  Pair pair;
  pair.send(concat({greeting(), good_login(), {0x05, 0x01, 0x00, 0x01, 203, 0, 113, 7, 0x01, 0xBB}}));
  socks5::Target target;
  std::string error;
  CHECK(socks5::server_handshake(pair.server, kCredentials, &target, &error, 500));
  CHECK(!target.is_domain);
  CHECK_EQ(target.port, static_cast<uint16_t>(443));
  CHECK_EQ(net::to_string(target.addr), std::string("203.0.113.7:443"));
  CHECK(pair.received() == (std::vector<uint8_t>{0x05, 0x02, 0x01, 0x00}));
}

TEST(socks5_accepts_a_domain_and_an_ipv6_connect) {
  {
    Pair pair;
    std::vector<uint8_t> request = {0x05, 0x01, 0x00, 0x03, 11};
    const std::string name = "example.org";
    request.insert(request.end(), name.begin(), name.end());
    request.push_back(0x1F);
    request.push_back(0x90);
    pair.send(concat({greeting(), good_login(), request}));
    socks5::Target target;
    std::string error;
    CHECK(socks5::server_handshake(pair.server, kCredentials, &target, &error, 500));
    CHECK(target.is_domain);
    CHECK_EQ(target.domain, std::string("example.org"));
    CHECK_EQ(target.port, static_cast<uint16_t>(8080));
  }
  {
    Pair pair;
    std::vector<uint8_t> request = {0x05, 0x01, 0x00, 0x04};
    for (int i = 0; i < 15; ++i) request.push_back(0);
    request.push_back(1);  // ::1
    request.push_back(0x00);
    request.push_back(0x50);
    pair.send(concat({greeting(), good_login(), request}));
    socks5::Target target;
    std::string error;
    CHECK(socks5::server_handshake(pair.server, kCredentials, &target, &error, 500));
    CHECK_EQ(net::to_string(target.addr), std::string("[::1]:80"));
  }
}

TEST(socks5_turns_away_a_wrong_password) {
  Pair pair;
  pair.send(concat({greeting(), login("voxel", "s3cre7")}));
  std::string error;
  CHECK(!socks5::server_handshake(pair.server, kCredentials, nullptr, &error, 500));
  CHECK(error.find("wrong user name or password") != std::string::npos);
  CHECK(pair.received() == (std::vector<uint8_t>{0x05, 0x02, 0x01, 0x01}));
}

TEST(socks5_turns_away_a_wrong_user_and_prefix_matches) {
  for (const char* user : {"vox", "voxelx", "VOXEL", ""}) {
    Pair pair;
    pair.send(concat({greeting(), login(user, "s3cret")}));
    std::string error;
    CHECK(!socks5::server_handshake(pair.server, kCredentials, nullptr, &error, 300));
  }
}

TEST(socks5_refuses_anonymous_clients) {
  Pair pair;
  pair.send({0x05, 0x01, 0x00});
  std::string error;
  CHECK(!socks5::server_handshake(pair.server, kCredentials, nullptr, &error, 500));
  CHECK(pair.received() == (std::vector<uint8_t>{0x05, 0xFF}));
}

TEST(socks5_refuses_other_commands_and_address_types) {
  {
    Pair pair;
    pair.send(concat({greeting(), good_login(), {0x05, 0x03, 0x00, 0x01, 1, 2, 3, 4, 0, 53}}));
    std::string error;
    CHECK(!socks5::server_handshake(pair.server, kCredentials, nullptr, &error, 500));
    const auto replies = pair.received();
    CHECK_EQ(replies.size(), static_cast<size_t>(4 + 10));
    CHECK_EQ(static_cast<int>(replies[5]), 0x07);
  }
  {
    Pair pair;
    pair.send(concat({greeting(), good_login(), {0x05, 0x01, 0x00, 0x09}}));
    std::string error;
    CHECK(!socks5::server_handshake(pair.server, kCredentials, nullptr, &error, 500));
    const auto replies = pair.received();
    CHECK_EQ(static_cast<int>(replies[5]), 0x08);
  }
}

TEST(socks5_gives_up_on_truncated_input) {
  const std::vector<std::vector<uint8_t>> scripts = {
      {},
      {0x05},
      {0x04, 0x01, 0x00},
      {0x05, 0x00},
      {0x05, 0x02, 0x00},
      concat({greeting(), {0x01, 0x05, 'v', 'o'}}),
      concat({greeting(), good_login(), {0x05, 0x01, 0x00, 0x01, 1, 2}}),
      concat({greeting(), good_login(), {0x05, 0x01, 0x00, 0x03, 9, 'a', 'b'}}),
      concat({greeting(), good_login(), {0x05, 0x01, 0x00, 0x03, 0}}),
  };
  for (const auto& script : scripts) {
    Pair pair;
    pair.send(script);
    ::shutdown(pair.client, SHUT_WR);
    std::string error;
    CHECK(!socks5::server_handshake(pair.server, kCredentials, nullptr, &error, 300));
    CHECK(!error.empty());
  }
}
