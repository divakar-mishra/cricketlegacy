package cricketlegacy.storage

import android.content.ContentValues
import android.database.DatabaseUtils
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

/**
 * One-time Android recovery for legacy AsyncStorage rows larger than a
 * CursorWindow. The old module can write those rows but cannot read them back.
 * We read the value with SQLite substrings and atomically replace it with the
 * same chunk representation used by src/storage/storage.ts.
 */
class OversizedStorageMigrationModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OversizedStorageMigrationModule")

    AsyncFunction("migrateLegacyValue") { key: String, requestedChunkSize: Int ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val databaseFile = context.getDatabasePath("RKStorage")
      if (!databaseFile.exists()) return@AsyncFunction false

      val chunkSize = requestedChunkSize.coerceIn(64 * 1024, 512 * 1024)
      val manifestKey = "$key:__chunk_manifest"
      val database = SQLiteDatabase.openDatabase(
        databaseFile.absolutePath,
        null,
        SQLiteDatabase.OPEN_READWRITE
      )

      try {
        val manifestExists = DatabaseUtils.longForQuery(
          database,
          "SELECT COUNT(*) FROM catalystLocalStorage WHERE key = ?",
          arrayOf(manifestKey)
        ) > 0
        if (manifestExists) return@AsyncFunction true

        val sqliteLength = DatabaseUtils.longForQuery(
          database,
          "SELECT COALESCE(length(value), 0) FROM catalystLocalStorage WHERE key = ?",
          arrayOf(key)
        )
        if (sqliteLength <= 0) return@AsyncFunction false

        val generation = "legacy-${System.currentTimeMillis().toString(36)}"
        var sqliteOffset = 1L
        var index = 0
        var javascriptLength = 0L

        database.beginTransaction()
        try {
          // Remove debris from an interrupted earlier attempt. The transaction
          // preserves the original row unless the full migration succeeds.
          database.delete(
            "catalystLocalStorage",
            "key GLOB ?",
            arrayOf("$key:__chunk:*")
          )

          while (sqliteOffset <= sqliteLength) {
            val cursor = database.rawQuery(
              "SELECT substr(value, ?, ?) FROM catalystLocalStorage WHERE key = ?",
              arrayOf(sqliteOffset.toString(), chunkSize.toString(), key)
            )
            val chunk = cursor.use {
              if (!it.moveToFirst()) throw SQLiteException("Legacy AsyncStorage row disappeared.")
              it.getString(0) ?: ""
            }
            if (chunk.isEmpty()) throw SQLiteException("Legacy AsyncStorage chunk was empty.")

            val chunkValues = ContentValues().apply {
              put("key", "$key:__chunk:$generation:$index")
              put("value", chunk)
            }
            if (
              database.insertWithOnConflict(
                "catalystLocalStorage",
                null,
                chunkValues,
                SQLiteDatabase.CONFLICT_REPLACE
              ) == -1L
            ) {
              throw SQLiteException("Could not write migrated AsyncStorage chunk.")
            }
            javascriptLength += chunk.length
            sqliteOffset += chunkSize
            index += 1
          }

          val manifest = JSONObject()
            .put("__chunked", 1)
            .put("generation", generation)
            .put("chunkCount", index)
            .put("length", javascriptLength)
            .toString()
          val manifestValues = ContentValues().apply {
            put("key", manifestKey)
            put("value", manifest)
          }
          if (
            database.insertWithOnConflict(
              "catalystLocalStorage",
              null,
              manifestValues,
              SQLiteDatabase.CONFLICT_REPLACE
            ) == -1L
          ) {
            throw SQLiteException("Could not write migrated AsyncStorage manifest.")
          }

          database.delete("catalystLocalStorage", "key = ?", arrayOf(key))
          database.setTransactionSuccessful()
        } finally {
          database.endTransaction()
        }
        true
      } finally {
        database.close()
      }
    }
  }
}
