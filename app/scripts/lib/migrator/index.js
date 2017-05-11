const asyncQ = require('async-q')

class Migrator {

  constructor (opts = {}) {
    const migrations = opts.migrations || []
    this.migrations = migrations.sort((a, b) => a.version - b.version)
    const lastMigration = this.migrations.slice(-1)[0]
    // use specified defaultVersion or highest migration version
    this.defaultVersion = opts.defaultVersion || (lastMigration && lastMigration.version) || 0
  }

  // run all pending migrations on meta in place
  migrateData (versionedData = this.generateInitialState()) {
    const remaining = this.migrations.filter(migrationIsPending)
    if (remaining.length === 0) return versionedData
    return (
      asyncQ.eachSeries(remaining, (migration) => this.runMigration(versionedData, migration))
      .then((migratedData) => migratedData.pop())
    )

    // migration is "pending" if hit has a higher
    // version number than currentVersion
    function migrationIsPending (migration) {
      return migration.version > versionedData.meta.version
    }
  }

  runMigration (versionedData, migration) {
    return migration.migrate(versionedData)
      .then((migratedData) => {
        if (!migratedData.data) return Promise.reject(new Error('Migrator - Migration returned empty data'))
        if (migration.version !== undefined && migratedData.meta.version !== migration.version) return Promise.reject(new Error('Migrator - Migration did not update version number correctly'))

        return Promise.resolve(migratedData)
      })
  }

  generateInitialState (initState) {
    return {
      meta: {
        version: this.defaultVersion,
      },
      data: initState,
    }
  }

}

module.exports = Migrator
