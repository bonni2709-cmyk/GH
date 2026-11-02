package chat.vale.desktop

import chat.vale.core.EncryptedStore
import com.sun.jna.platform.win32.Crypt32Util
import org.sqlite.mc.SQLiteMCSqlCipherConfig
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.SecureRandom
import java.sql.Connection
import java.util.Base64

/** SQLite3MultipleCiphers in SQLCipher-4 mode; key is bound to the current Windows user by DPAPI. */
internal class DesktopVault(private val directory: File = File(System.getenv("LOCALAPPDATA") ?: error("LOCALAPPDATA not available"), "Vale")) : EncryptedStore {
    private val connection: Connection

    init {
        check(System.getProperty("os.name").startsWith("Windows", ignoreCase = true)) { "This build requires Windows DPAPI" }
        directory.mkdirs()
        val database = File(directory, "vale.db")
        val wrapped = File(directory, "vault.key")
        val password = if (wrapped.exists()) {
            String(Crypt32Util.cryptUnprotectData(wrapped.readBytes()), Charsets.UTF_8)
        } else {
            check(!database.exists()) { "Vault key missing" }
            val secret = ByteArray(32).also { SecureRandom().nextBytes(it) }
            val pass = Base64.getUrlEncoder().withoutPadding().encodeToString(secret)
            secret.fill(0)
            val temp = File(directory, "vault.key.tmp")
            temp.writeBytes(Crypt32Util.cryptProtectData(pass.toByteArray(Charsets.UTF_8)))
            Files.move(temp.toPath(), wrapped.toPath(), StandardCopyOption.REPLACE_EXISTING)
            pass
        }
        connection = SQLiteMCSqlCipherConfig.getV4Defaults().withKey(password).build()
            .createConnection("jdbc:sqlite:${database.absolutePath}")
        connection.createStatement().use {
            it.execute("PRAGMA secure_delete = ON")
            it.execute("CREATE TABLE IF NOT EXISTS vault_state (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL)")
        }
    }

    override fun read(): String? = connection.createStatement().use { statement ->
        statement.executeQuery("SELECT data FROM vault_state WHERE id = 1").use { if (it.next()) it.getString(1) else null }
    }

    override fun write(value: String) {
        connection.prepareStatement("INSERT OR REPLACE INTO vault_state (id, data) VALUES (1, ?)").use {
            it.setString(1, value); it.executeUpdate()
        }
    }

    override fun close() = connection.close()
}
