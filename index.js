const express = require("express")
const app = express()

const { default: makeWASocket, useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@adiwajshing/baileys")
const { Boom } = require("@hapi/boom")

const { core } = require("./lib/core")

const { state, saveState } = useSingleFileAuthState("./session.json")

const MAIN_LOGGER = require("@adiwajshing/baileys/lib/Utils/logger").default
const logger = MAIN_LOGGER.child({})
logger.level = "silent"

// servidor (Render precisa disso)
app.get("/", (req, res) => res.send("Bot online 🚀"))
app.listen(process.env.PORT || 3000)

async function startSock() {
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        logger,
        version,
        auth: state,
        printQRInTerminal: false
    })

    // 🔑 Pairing code
    if (!sock.authState.creds.registered) {
        const phoneNumber = "SEU_NUMERO_AQUI"
        const code = await sock.requestPairingCode(phoneNumber)
        console.log("Código:", code)
    }

    sock.ev.on("messages.upsert", async ({ messages }) => {
        try {
            await core(sock, messages[0])
        } catch (e) {
            console.log("Erro:", e)
        }
    })

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update

        if (connection === "close") {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode

            if (reason === DisconnectReason.loggedOut) {
                console.log("Sessão perdida, conecta de novo")
            } else {
                startSock()
            }
        }

        if (connection === "open") {
            console.log("Bot conectado ✅")
        }
    })

    sock.ev.on("creds.update", saveState)
}

startSock()