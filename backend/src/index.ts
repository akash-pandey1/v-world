import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { sockets } from './sockets/sockets'
import routes from './routes/routes'
import { sessionManager } from './session'
import mongoose from 'mongoose'
import { expressjwt } from 'express-jwt'

require('dotenv').config()

const app = express()
const server = http.createServer(app)

app.use(cors({
    origin: process.env.FRONTEND_URL
}))

app.use(express.json({ limit: '20mb' }))
app.use(express.urlencoded({ limit: '20mb', extended: true }))

// Initialize Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL
  }
})

const JWT_SECRET = process.env.JWT_SECRET || 'changeme'
let jwtMiddleware = expressjwt({
  secret: JWT_SECRET,
  algorithms: ['HS256'],
  requestProperty: 'user',
})
jwtMiddleware = jwtMiddleware.unless({ path: ['/auth/signup', '/auth/login'] })

app.use(jwtMiddleware as any)
app.use(routes())

sockets(io)

mongoose.connect('mongodb://localhost:27017/gather-clone')
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err))

function onRealmUpdate(payload: any) {
    const id = payload.new.id
    let refresh = false
    if (JSON.stringify(payload.new.map_data) !== JSON.stringify(payload.old.map_data)) {
        refresh = true
    }
    if (payload.new.share_id !== payload.old.share_id) {
        refresh = true
    }
    if (payload.new.only_owner) {
        refresh = true
    }
    if (refresh) {
        sessionManager.terminateSession(id, "This realm has been changed by the owner.")
    }
}

function onRealmDelete(payload: any) {
    sessionManager.terminateSession(payload.old.id, "This realm is no longer available.")
}

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`)
})


export { io }