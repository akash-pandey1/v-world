import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { sockets } from './sockets/sockets'
import routes from './routes/routes'
import { sessionManager } from './session'
import { expressjwt } from 'express-jwt'
import jwt from 'jsonwebtoken'
import { connectDB } from './config/db';


require('dotenv').config()

const app = express()
const server = http.createServer(app);
connectDB();

// Determine frontend URL based on environment
const isProd = process.env.NODE_ENV === 'production';
const frontendUrl = isProd ? process.env.FRONTEND_URL_PROD : process.env.FRONTEND_URL;

// CORS configuration - allow all origins
app.use(cors({
  origin: true, // Allow all origins
  credentials: true
}));

app.use(express.json({ limit: '20mb' }))
app.use(express.urlencoded({ limit: '20mb', extended: true }))

// Initialize Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: frontendUrl
  }
})

// Add JWT authentication middleware for Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    console.log('[SOCKET] No JWT token provided in auth');
    return next(new Error('Authentication error: No token provided'));
  }

  if (!JWT_SECRET) {
    console.log('[SOCKET] JWT_SECRET not configured');
    return next(new Error('Authentication error: Server configuration error'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    socket.data.user = decoded;
    console.log('[SOCKET] JWT token verified for user:', decoded.id);
    next();
  } catch (error) {
    console.log('[SOCKET] JWT token verification failed:', error);
    return next(new Error('Authentication error: Invalid token'));
  }
});

const JWT_SECRET = process.env.JWT_SECRET ;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
let jwtMiddleware = expressjwt({
  secret: JWT_SECRET,
  algorithms: ['HS256'],
  requestProperty: 'user',
})
jwtMiddleware = jwtMiddleware.unless({ path: ['/auth/signup', '/auth/login'] })

app.use(jwtMiddleware as any)
app.use(routes())

sockets(io)



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
const portNumber = parseInt(PORT.toString(), 10)

if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
  throw new Error(`Invalid PORT: ${PORT}. Must be a number between 1 and 65535`);
}

server.listen(portNumber, () => {
  console.log(`🚀 V-World server is running on port ${portNumber}`)
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🌐 Frontend URL: ${frontendUrl || 'http://localhost:3000'}`)
})


export { io }