#include <cstring>

#include "check.hpp"
#include "log.hpp"

int main(int argc, char** argv) {
  const char* filter = argc > 1 ? argv[1] : nullptr;
  int ran = 0;
  int failed = 0;
  for (const auto& test : testing::registry()) {
    if (filter != nullptr && std::strstr(test.name, filter) == nullptr) continue;
    testing::failures_in_case() = 0;
    std::fprintf(stderr, "[ RUN  ] %s\n", test.name);
    test.run();
    ++ran;
    if (testing::failures_in_case() != 0) {
      ++failed;
      std::fprintf(stderr, "[ FAIL ] %s\n", test.name);
    } else {
      std::fprintf(stderr, "[  OK  ] %s\n", test.name);
    }
  }
  std::fprintf(stderr, "%d tests, %d failed\n", ran, failed);
  return failed == 0 && ran > 0 ? 0 : 1;
}
