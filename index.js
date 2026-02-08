const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');


const app = express();
const server = createServer(app);
const io = new Server(server);

// Socket auth middleware (checks token in auth or query)
const authenticateSocket = (socket, next) => {
	const token = socket.handshake.auth && socket.handshake.auth.token
		? socket.handshake.auth.token
		: socket.handshake.query && socket.handshake.query.token;

	if (!token) {
		return next(new Error('unauthorized'));
	}

	// Attach minimal user context (placeholder)
	socket.user = { token };
	return next();
};

// Simple namespaces: /chat and /admin
const chatNs = io.of('/chat');
chatNs.on('connection', (socket) => {
	console.log('[chat] user connected');
	socket.on('message', (msg) => {
		chatNs.emit('sendmessage', msg + 'from chat');
	});
	socket.on('disconnect', () => {
		console.log('[chat] user disconnected');
	});
});

const adminNs = io.of('/admin');
adminNs.on('connection', (socket) => {
	console.log('[admin] user connected');
	socket.on('message', (msg) => {
		adminNs.emit('sendmessage', msg + 'from admin');
	});
	socket.on('disconnect', () => {
		console.log('[admin] user disconnected');
	});
});

const gameNameSpace = io.of('/game');
gameNameSpace.use(authenticateSocket);
gameNameSpace.on('connection', (socket) => {
    const token = socket.handshake.query.token;
    console.log(token);
	console.log('[game] user connected');
	// Socket-level middleware: intercept 'message' events for number > 10

	socket.on('message', (msg) => {
        
        socket.emit('admin', msg + 'this messeage is for admin');
		gameNameSpace.emit('sendmessage', msg + 'from game');
	});
	socket.on('disconnect', () => {
		console.log('[game] user disconnected');
	});
});

io.on('connection', (socket) => {
	socket.on('message', (userId) => {
        console.log(userId);
		io.emit('sendmessage', userId + 'from server');
	});

	// Simple two-user room join
	socket.on('joinRoom', (roomId) => {
		const room = io.sockets.adapter.rooms.get(roomId);
		const occupants = room ? room.size : 0;
		if (occupants >= 2) {
			socket.emit('roomFull', roomId);
			return;
		}

		socket.join(roomId);
		socket.emit('roomJoined', roomId);

		if (occupants + 1 === 2) {
			io.to(roomId).emit('ready', roomId);
		}
	});

	socket.on('leaveRoom', (roomId) => {
		socket.leave(roomId);
		socket.emit('roomLeft', roomId);
	});

	socket.on('disconnect', () => {
		console.log('user disconnected');
	});
});

app.get('/', (req, res) => {
  res.json({ message: 'Hello world' });
});

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});