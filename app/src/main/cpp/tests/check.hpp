#pragma once

// A tiny test harness: TEST(name) { CHECK(...); } registers a case, tests/main.cpp runs them all.

#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

namespace testing {

struct Case {
  const char* name;
  void (*run)();
};

inline std::vector<Case>& registry() {
  static std::vector<Case> cases;
  return cases;
}

inline int& failures_in_case() {
  static int count = 0;
  return count;
}

struct Registrar {
  Registrar(const char* name, void (*run)()) { registry().push_back({name, run}); }
};

inline void report(const char* file, int line, const std::string& what) {
  ++failures_in_case();
  std::fprintf(stderr, "  FAILED %s:%d: %s\n", file, line, what.c_str());
}

template <typename A, typename B>
std::string describe_pair(const A& a, const B& b) {
  using std::to_string;
  return to_string(a) + " vs " + to_string(b);
}

inline std::string describe_pair(const std::string& a, const std::string& b) { return "\"" + a + "\" vs \"" + b + "\""; }
inline std::string describe_pair(const char* a, const char* b) { return std::string("\"") + a + "\" vs \"" + b + "\""; }
inline std::string describe_pair(const std::string& a, const char* b) { return describe_pair(a, std::string(b)); }

}  // namespace testing

#define TEST(name)                                                  \
  static void test_##name();                                        \
  static ::testing::Registrar registrar_##name(#name, &test_##name); \
  static void test_##name()

#define CHECK(condition)                                                    \
  do {                                                                      \
    if (!(condition)) ::testing::report(__FILE__, __LINE__, #condition);    \
  } while (false)

#define CHECK_EQ(a, b)                                                                                          \
  do {                                                                                                          \
    const auto va = (a);                                                                                        \
    const auto vb = (b);                                                                                        \
    if (!(va == vb)) ::testing::report(__FILE__, __LINE__, std::string(#a " == " #b ": ") + ::testing::describe_pair(va, vb)); \
  } while (false)
