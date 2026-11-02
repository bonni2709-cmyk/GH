package chat.vale.android

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import chat.vale.core.EncryptedStore
import net.zetetic.database.sqlcipher.SQLiteDatabase
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** SQLCipher passphrase is wrapped by a non-exportable Android Keystore AES key. */
internal class AndroidVault(context: Context) : EncryptedStore {
    private val db: SQLiteDatabase

    init {
        val directory = context.noBackupFilesDir
        val file = File(directory, "vale.db")
        val wrapped = File(directory, "vault.key")
        val keystore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val alias = "vale.vault.v1"
        val password = if (wrapped.exists()) {
            val key = keystore.getKey(alias, null) as? SecretKey ?: error("Keystore key missing")
            val data = wrapped.readBytes()
            require(data.size > 12)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, data.copyOfRange(0, 12)))
            String(cipher.doFinal(data.copyOfRange(12, data.size)), Charsets.UTF_8)
        } else {
            check(!file.exists()) { "Vault key missing" }
            val key = (keystore.getKey(alias, null) as? SecretKey) ?: KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore"
            ).run {
                init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build())
                generateKey()
            }
            val secret = ByteArray(32).also { SecureRandom().nextBytes(it) }
            val pass = Base64.getUrlEncoder().withoutPadding().encodeToString(secret)
            secret.fill(0)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key) }
            val temp = File(directory, "vault.key.tmp")
            temp.writeBytes(cipher.iv + cipher.doFinal(pass.toByteArray(Charsets.UTF_8)))
            check(temp.renameTo(wrapped)) { "Could not persist vault key" }
            pass
        }
        System.loadLibrary("sqlcipher")
        db = SQLiteDatabase.openOrCreateDatabase(file, password, null, null, null)
        db.execSQL("PRAGMA secure_delete = ON")
        db.execSQL("CREATE TABLE IF NOT EXISTS vault_state (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL)")
    }

    override fun read(): String? = db.rawQuery("SELECT data FROM vault_state WHERE id = 1", emptyArray<String>()).use {
        if (it.moveToFirst()) it.getString(0) else null
    }

    override fun write(value: String) {
        db.execSQL("INSERT OR REPLACE INTO vault_state (id, data) VALUES (1, ?)", arrayOf(value))
    }

    override fun close() = db.close()
}
