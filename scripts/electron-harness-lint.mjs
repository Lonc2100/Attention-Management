import { auditElectronBoundaries } from './electron-harness-lint-lib.mjs'

const errors = auditElectronBoundaries(process.cwd())
if (errors.length > 0) {
  console.error('electron-harness-lint failed:')
  for (const error of errors) console.error(`- ${error.message}`)
  process.exit(1)
}

console.log('electron-harness-lint passed')
