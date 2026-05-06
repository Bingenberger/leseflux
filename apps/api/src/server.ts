import { buildApp } from './app.js'

const PORT = parseInt(process.env.PORT ?? '3001')
const HOST = process.env.HOST ?? '0.0.0.0'

const app = buildApp()

app.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  app.log.info(`Server läuft auf ${address}`)
})
