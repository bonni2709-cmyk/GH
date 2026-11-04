cmake_minimum_required(VERSION 3.22.1)
project(voxeldpi LANGUAGES CXX)

# libvoxeldpi.so: the DPI desync engine of the app (a SOCKS5 proxy on 127.0.0.1 that cuts up the first payload of
# every connection). Android Gradle builds the `voxeldpi` target. On a development machine the same sources build
# the `voxel-dpi` tool and the unit tests:
#
#   cmake -S app/src/main/cpp -B build/dpi -DCMAKE_BUILD_TYPE=Debug -DVOXEL_DPI_SANITIZE=ON
#   cmake --build build/dpi && ctest --test-dir build/dpi --output-on-failure

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
set(CMAKE_CXX_VISIBILITY_PRESET hidden)
set(CMAKE_VISIBILITY_INLINES_HIDDEN ON)

option(VOXEL_DPI_SANITIZE "Build the host tools with AddressSanitizer and UndefinedBehaviorSanitizer" OFF)
option(VOXEL_DPI_WERROR "Turn compiler warnings into errors" OFF)

find_package(Threads REQUIRED)

add_library(voxeldpi_core STATIC
  src/log.cpp
  src/net.cpp
  src/tls.cpp
  src/http.cpp
  src/strategy.cpp
  src/desync.cpp
  src/socks5.cpp
  src/engine.cpp)
target_include_directories(voxeldpi_core PUBLIC src)
target_link_libraries(voxeldpi_core PUBLIC Threads::Threads)
target_compile_options(voxeldpi_core PUBLIC -Wall -Wextra -Wpedantic)
if(VOXEL_DPI_WERROR)
  target_compile_options(voxeldpi_core PUBLIC -Werror)
endif()

if(ANDROID)
  add_library(voxeldpi SHARED src/jni.cpp)
  target_link_libraries(voxeldpi PRIVATE voxeldpi_core log)
  # Android 15 devices with 16 KB pages need 16 KB aligned segments.
  target_link_options(voxeldpi PRIVATE -Wl,-z,max-page-size=16384)
else()
  if(VOXEL_DPI_SANITIZE)
    target_compile_options(voxeldpi_core PUBLIC -fsanitize=address,undefined -fno-omit-frame-pointer -fno-sanitize-recover=undefined)
    target_link_options(voxeldpi_core PUBLIC -fsanitize=address,undefined)
  endif()

  add_executable(voxel-dpi src/cli.cpp)
  target_link_libraries(voxel-dpi PRIVATE voxeldpi_core)

  enable_testing()
  add_executable(voxel-dpi-tests
    tests/main.cpp
    tests/test_tls.cpp
    tests/test_strategy.cpp
    tests/test_socks5.cpp
    tests/test_engine.cpp)
  target_link_libraries(voxel-dpi-tests PRIVATE voxeldpi_core)
  add_test(NAME unit COMMAND voxel-dpi-tests)
endif()
