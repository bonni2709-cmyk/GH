# Security status

Vale 0.1.0 is an unaudited experiment, **not a secure or anonymous messenger**. Do not use it for sensitive data.

## Protocol summary

Each identity is an Ed25519 key pair. For a message, Ed25519 keys are converted to X25519 and `crypto_box_beforenm` derives a shared secret. HMAC-SHA-256 derives a direction- and application-specific XChaCha20-Poly1305 key. A random 192-bit nonce is generated per packet. A versioned canonical header (ID, sender, recipient and timestamps) is authenticated as AEAD associated data; the complete header, nonce and ciphertext are signed with Ed25519. Recipient verifies the signature, limits, lifetime and known sender before decryption. Packet IDs are retained for replay suppression beyond the seven-day acceptance window. The protocol has not been reviewed or proven secure and provides **no forward secrecy**.

Direct transport uses bounded TCP frames, a 3-hop limit, private/link-local/loopback IPv4 destinations and explicit opt-in relays. IP addresses and packet headers are not hidden. The optional relay requires both endpoints to be contacts; it is not a discovery service, a Tor proxy, or a Bluetooth mesh. Hostile LANs can deny service or observe metadata.

On Android the database is SQLCipher and the random passphrase is wrapped by a non-exportable Android Keystore AES-GCM key. On Windows SQLite3MultipleCiphers is configured for SQLCipher v4 and the random passphrase is protected by current-user DPAPI. Access to an unlocked account, a compromised OS, memory, backups or an endpoint may expose data. Removing a timer-expired message is best effort, not secure erasure. The calculator is concealment, not authentication or a wipe.

Report security issues privately to the repository owner. Do not post secrets, private keys or sensitive messages in public issues.
