const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Хранилище в памяти
const users = new Map();
const messages = [];

// REST API
app.get('/', (req, res) => {
  res.json({ status: 'Melio Server Running! 🚀', users: users.size, messages: messages.length });
});

// Регистрация
app.post('/api/register', (req, res) => {
  const { name, username, password } = req.body;
  
  for (let user of users.values()) {
    if (user.name.toLowerCase() === name.toLowerCase()) {
      return res.status(400).json({ error: 'Имя уже занято' });
    }
    if (username && user.username?.toLowerCase() === username.toLowerCase()) {
      return res.status(400).json({ error: 'Username уже занят' });
    }
  }
  
  const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const newUser = {
    id: userId,
    name,
    username: username || null,
    password,
    avatar: null,
    online: false,
    createdAt: new Date().toISOString()
  };
  
  users.set(userId, newUser);
  res.json({ success: true, user: newUser });
});

// Логин
app.post('/api/login', (req, res) => {
  const { nameOrUsername, password } = req.body;
  
  for (let user of users.values()) {
    if ((user.name.toLowerCase() === nameOrUsername.toLowerCase() ||
         user.username?.toLowerCase() === nameOrUsername.toLowerCase()) &&
         user.password === password) {
      user.online = true;
      return res.json({ success: true, user });
    }
  }
  
  res.status(401).json({ error: 'Неверные данные' });
});

// Получить всех юзеров
app.get('/api/users', (req, res) => {
  res.json(Array.from(users.values()).map(u => ({
    id: u.id,
    name: u.name,
    username: u.username,
    avatar: u.avatar,
    online: u.online
  })));
});

// WebSocket для real-time
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);
  
  let currentUserId = null;
  
  // Авторизация
  socket.on('auth', (userId) => {
    currentUserId = userId;
    const user = users.get(userId);
    if (user) {
      user.online = true;
      user.socketId = socket.id;
      
      io.emit('user_online', { userId, name: user.name });
      
      // Отправляем всю историю
      socket.emit('messages_history', messages);
      
      console.log(`✅ ${user.name} authenticated`);
    }
  });
  
  // Отправка сообщения
  socket.on('send_message', (data) => {
    const user = users.get(currentUserId);
    if (!user) return;
    
    const message = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      chatId: data.chatId || 'main',
      senderId: currentUserId,
      senderName: user.name,
      senderAvatar: user.avatar,
      text: data.text,
      status: 'sent',
      createdAt: new Date().toISOString()
    };
    
    messages.push(message);
    
    // Ограничим историю до 500 сообщений
    if (messages.length > 500) {
      messages.shift();
    }
    
    io.emit('new_message', message);
    console.log(`📨 Message from ${user.name}: ${data.text}`);
  });
  
  // Печатает...
  socket.on('typing', (data) => {
    const user = users.get(currentUserId);
    if (user) {
      socket.broadcast.emit('user_typing', {
        userId: currentUserId,
        name: user.name,
        chatId: data.chatId
      });
    }
  });
  
  // Отключение
  socket.on('disconnect', () => {
    if (currentUserId) {
      const user = users.get(currentUserId);
      if (user) {
        user.online = false;
        io.emit('user_offline', { userId: currentUserId, name: user.name });
        console.log(`❌ ${user.name} disconnected`);
      }
    }
  });
});

// Запуск
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`✅ Melio Server running on port ${PORT}`);
});
