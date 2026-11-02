package chat.vale.desktop

import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

class DesktopVaultTest {
    @Test fun dataIsEncryptedAndCanBeReopened() {
        val directory = Files.createTempDirectory("vale-vault-test").toFile()
        try {
            DesktopVault(directory).useVault { it.write("private test payload") }
            val bytes = directory.resolve("vale.db").readBytes()
            assertFalse(String(bytes, Charsets.ISO_8859_1).contains("private test payload"))
            assertFalse(String(bytes.take(16).toByteArray(), Charsets.ISO_8859_1).startsWith("SQLite format 3"))
            DesktopVault(directory).useVault { assertEquals("private test payload", it.read()) }
        } finally { directory.deleteRecursively() }
    }

    private inline fun DesktopVault.useVault(block: (DesktopVault) -> Unit) {
        try { block(this) } finally { close() }
    }
}
