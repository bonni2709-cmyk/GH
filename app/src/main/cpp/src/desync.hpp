#pragma once

#include <string>

#include "strategy.hpp"

namespace voxel::dpi {

/**
 * True when the kernel lets a queued segment be rewritten before it is retransmitted (memfd + splice with
 * shared pages). Tested once, on loopback. The `fake` option needs it and is skipped without it.
 */
bool fake_supported();

/**
 * Puts the first payload of a connection on the wire as [plan] says. [fd] is a connected TCP socket with
 * nothing sent yet. On false the connection is unusable (a send failed).
 */
bool send_plan(int fd, const Plan& plan, std::string* error);

}  // namespace voxel::dpi
