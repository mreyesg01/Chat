// index.js (Servidor de chat con Socket.IO)
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'

const app = express()
app.use(cors())
app.get('/', (req, res) => res.send('WS OK'))

const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })

// Estado en memoria (demo)
const rooms = new Map()
function ensureRoom(id) {
  if (!rooms.has(id)) rooms.set(id, { peers: new Set(), history: [] })
  return rooms.get(id)
}

io.on('connection', (socket) => {
  socket.on('join', ({ roomId, nick }) => {
    socket.data.nick = nick
    socket.join(roomId)
    const r = ensureRoom(roomId)
    r.peers.add(nick)
    socket.emit('history', r.history.slice(-100))
    io.to(roomId).emit('peers', Array.from(r.peers))
  })

  socket.on('leave', ({ roomId, nick }) => {
    const r = ensureRoom(roomId)
    r.peers.delete(nick)
    socket.leave(roomId)
    io.to(roomId).emit('peers', Array.from(r.peers))
  })

  socket.on('rename', ({ nick, roomId }) => {
    const r = ensureRoom(roomId)
    if (socket.data.nick) r.peers.delete(socket.data.nick)
    socket.data.nick = nick
    r.peers.add(nick)
    io.to(roomId).emit('peers', Array.from(r.peers))
  })

  socket.on('chat', (msg) => {
    const { roomId } = msg
    const r = ensureRoom(roomId)
    const enriched = { ...msg, ts: msg.ts || Date.now() }
    r.history.push(enriched)
    io.to(roomId).emit('chat', enriched)
  })

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue
      const r = ensureRoom(roomId)
      if (socket.data.nick) r.peers.delete(socket.data.nick)
      io.to(roomId).emit('peers', Array.from(r.peers))
    }
  })
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => console.log('WS listo en :' + PORT))
