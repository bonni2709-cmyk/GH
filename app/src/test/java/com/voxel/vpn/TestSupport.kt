package com.voxel.vpn

import org.junit.Assert.fail

/** Runs [block] and returns the exception it must throw. */
inline fun <reified T : Throwable> expectThrows(block: () -> Unit): T {
    try {
        block()
    } catch (e: Throwable) {
        if (e is T) return e
        throw AssertionError("Expected ${T::class.java.simpleName} but got $e", e)
    }
    fail("Expected ${T::class.java.simpleName} but nothing was thrown")
    throw IllegalStateException("unreachable")
}

object Samples {
    /** 32 raw bytes 0..31 as unpadded base64url: a syntactically valid REALITY public key. */
    const val REALITY_PBK = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8"
    const val UUID = "11111111-2222-3333-4444-555555555555"

    const val VLESS_REALITY =
        "vless://$UUID@203.0.113.7:443?encryption=none&flow=xtls-rprx-vision&security=reality&sni=www.microsoft.com" +
            "&fp=chrome&pbk=$REALITY_PBK&sid=6ba85179e30d4fc2&spx=%2F&type=tcp&headerType=none#Reality%20NL"

    const val VLESS_WS_TLS =
        "vless://$UUID@cdn.example.com:443?encryption=none&security=tls&sni=cdn.example.com&type=ws" +
            "&host=cdn.example.com&path=%2Fws%3Fed%3D2048&alpn=h2%2Chttp%2F1.1&fp=firefox#WS%20CDN"
}
