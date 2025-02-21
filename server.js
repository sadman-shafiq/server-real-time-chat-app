const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  }
});

app.get('/', (req, res) => {
  res.send('Chat Server is running');
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });

  socket.on('chat message', (msg) => {
    //console.log('Received message:', msg);
    io.emit('chat message', msg);
  });
});

server.listen(3001, () => {
  console.log('Server is running on port 3001');
});
