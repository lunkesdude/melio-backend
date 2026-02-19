const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Хранилище данных (в памяти, для начала)
let users = [
  {
    id: '1',
    displayName: 'Lunkes',
    username: '@Lunkes',
    password: 'Lunkes009', // В реальности нужно хешировать!
    avatar: '',
    bio: 'Создатель Melio',
    level: 99,
    xp: 0,
    crystals: 999999,
    isAdmin: true,
    isVerified: true,
    hasMelioPlus: true,
    melioPlusExpiry: null,
    achievements: [],
    nftCollection: [],
    favorites: [],
    additionalUsernames: [],
    createdAt: new Date().toISOString(),
    banned: false,
    restrictions: []
  }
];

let messages = [];
let posts = [];
let channels = [
  {
    id: 'melio-official',
    username: '@Melio',
    name: 'Melio News',
    description: 'Официальный новостной канал',
    owner: '@Lunkes',
    isOfficial: true,
    isVerified: true,
    subscribers: [],
    posts: []
  }
];

// Генератор юзернеймов
function generateUsername(displayName) {
  // Транслитерация
  const translit = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };
  
  let username = displayName.toLowerCase().split('').map(char => 
    translit[char] || char
  ).join('');
  
  // Удаляем всё кроме букв, цифр и _
  username = username.replace(/[^a-z0-9_]/g, '');
  
  // Проверяем занятость
  let finalUsername = username;
  let counter = 1;
  
  while (users.find(u => u.username === '@' + finalUsername)) {
    finalUsername = username + '_' + counter;
    counter++;
  }
  
  return '@' + finalUsername;
}

// ============= ROUTES =============

// Главная
app.get('/', (req, res) => {
  res.json({ 
    message: 'Melio API работает!',
    version: '1.0.0'
  });
});

// ===== АВТОРИЗАЦИЯ =====

// Регистрация
app.post('/api/auth/register', (req, res) => {
  const { displayName, username, password } = req.body;
  
  if (!displayName || !password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }
  
  // Генерируем юзернейм если не указан
  let finalUsername = username || generateUsername(displayName);
  
  // Проверяем занятость
  if (users.find(u => u.username === finalUsername)) {
    return res.status(400).json({ error: 'Юзернейм занят' });
  }
  
  const newUser = {
    id: Date.now().toString(),
    displayName,
    username: finalUsername,
    password, // В реальности хешировать!
    avatar: '',
    bio: '',
    level: 1,
    xp: 0,
    crystals: 0,
    isAdmin: false,
    isVerified: false,
    hasMelioPlus: false,
    melioPlusExpiry: null,
    achievements: [],
    nftCollection: [],
    favorites: [],
    additionalUsernames: [],
    createdAt: new Date().toISOString(),
    banned: false,
    restrictions: []
  };
  
  users.push(newUser);
  
  // Не отправляем пароль обратно
  const { password: _, ...userWithoutPassword } = newUser;
  
  res.json({ 
    success: true, 
    user: userWithoutPassword,
    suggestedUsername: finalUsername
  });
});

// Вход
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = users.find(u => u.username === username && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  
  if (user.banned) {
    return res.status(403).json({ error: 'Аккаунт заблокирован' });
  }
  
  const { password: _, ...userWithoutPassword } = user;
  
  res.json({ 
    success: true, 
    user: userWithoutPassword 
  });
});

// ===== ПОЛЬЗОВАТЕЛИ =====

// Получить пользователя
app.get('/api/users/:username', (req, res) => {
  const user = users.find(u => u.username === req.params.username);
  
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  
  const { password: _, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

// Обновить профиль
app.put('/api/users/:username', (req, res) => {
  const { displayName, bio, avatar } = req.body;
  const user = users.find(u => u.username === req.params.username);
  
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  
  if (displayName) user.displayName = displayName;
  if (bio !== undefined) user.bio = bio;
  if (avatar !== undefined) user.avatar = avatar;
  
  const { password: _, ...userWithoutPassword } = user;
  res.json({ success: true, user: userWithoutPassword });
});

// Удалить аккаунт
app.delete('/api/users/:username', (req, res) => {
  const index = users.findIndex(u => u.username === req.params.username);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  
  users.splice(index, 1);
  res.json({ success: true, message: 'Аккаунт удалён' });
});

// ===== СООБЩЕНИЯ =====

// Отправить сообщение
app.post('/api/messages/send', (req, res) => {
  const { from, to, content, attachments } = req.body;
  
  const message = {
    id: Date.now().toString(),
    from,
    to,
    content,
    attachments: attachments || [],
    timestamp: new Date().toISOString(),
    read: false
  };
  
  messages.push(message);
  res.json({ success: true, message });
});

// Получить сообщения
app.get('/api/messages/:username', (req, res) => {
  const userMessages = messages.filter(
    m => m.from === req.params.username || m.to === req.params.username
  );
  
  res.json(userMessages);
});

// ===== ПОСТЫ =====

// Создать пост
app.post('/api/posts/create', (req, res) => {
  const { author, content, attachments } = req.body;
  
  const post = {
    id: Date.now().toString(),
    author,
    content,
    attachments: attachments || [],
    likes: [],
    comments: [],
    createdAt: new Date().toISOString()
  };
  
  posts.push(post);
  res.json({ success: true, post });
});

// Получить ленту
app.get('/api/posts/feed', (req, res) => {
  // Сортируем по дате, новые первые
  const sortedPosts = posts.sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );
  
  res.json(sortedPosts);
});

// Удалить пост
app.delete('/api/posts/:id', (req, res) => {
  const index = posts.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Пост не найден' });
  }
  
  posts.splice(index, 1);
  res.json({ success: true });
});

// ===== АДМИН =====

// Забанить
app.post('/api/admin/ban', (req, res) => {
  const { adminUsername, targetUsername, banned } = req.body;
  
  const admin = users.find(u => u.username === adminUsername);
  if (!admin || !admin.isAdmin) {
    return res.status(403).json({ error: 'Нет прав' });
  }
  
  const target = users.find(u => u.username === targetUsername);
  if (!target) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  
  target.banned = banned;
  res.json({ success: true, user: target });
});

// Выдать NFT
app.post('/api/admin/give-nft', (req, res) => {
  const { adminUsername, targetUsername, nftId } = req.body;
  
  const admin = users.find(u => u.username === adminUsername);
  if (!admin || !admin.isAdmin) {
    return res.status(403).json({ error: 'Нет прав' });
  }
  
  const target = users.find(u => u.username === targetUsername);
  if (!target) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  
  target.nftCollection.push({
    id: nftId,
    receivedAt: new Date().toISOString()
  });
  
  res.json({ success: true, user: target });
});

// Выдать кристаллы
app.post('/api/admin/give-crystals', (req, res) => {
  const { adminUsername, targetUsername, amount } = req.body;
  
  const admin = users.find(u => u.username === adminUsername);
  if (!admin || !admin.isAdmin) {
    return res.status(403).json({ error: 'Нет прав' });
  }
  
  const target = users.find(u => u.username === targetUsername);
  if (!target) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  
  target.crystals += amount;
  res.json({ success: true, user: target });
});

// Дать галочку
app.post('/api/admin/verify', (req, res) => {
  const { adminUsername, targetUsername, verified } = req.body;
  
  const admin = users.find(u => u.username === adminUsername);
  if (!admin || !admin.isAdmin) {
    return res.status(403).json({ error: 'Нет прав' });
  }
  
  const target = users.find(u => u.username === targetUsername);
  if (!target) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  
  target.isVerified = verified;
  res.json({ success: true, user: target });
});

// Установить уровень
app.post('/api/admin/set-level', (req, res) => {
  const { adminUsername, targetUsername, level } = req.body;
  
  const admin = users.find(u => u.username === adminUsername);
  if (!admin || !admin.isAdmin) {
    return res.status(403).json({ error: 'Нет прав' });
  }
  
  const target = users.find(u => u.username === targetUsername);
  if (!target) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  
  target.level = level;
  res.json({ success: true, user: target });
});

// ===== МАГАЗИН =====

// Купить Melio Plus
app.post('/api/shop/buy-plus', (req, res) => {
  const { username, months } = req.body;
  
  const prices = {
    1: 250,
    3: 700,
    6: 1300,
    9: 1800,
    12: 2200
  };
  
  const price = prices[months];
  if (!price) {
    return res.status(400).json({ error: 'Неверный период' });
  }
  
  const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  
  if (user.crystals < price) {
    return res.status(400).json({ error: 'Недостаточно кристаллов' });
  }
  
  user.crystals -= price;
  user.hasMelioPlus = true;
  
  // Добавляем месяцы к текущей дате
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + months);
  user.melioPlusExpiry = expiry.toISOString();
  
  res.json({ success: true, user });
});

// Обменять NFT на кристаллы
app.post('/api/shop/exchange-nft', (req, res) => {
  const { username, nftId } = req.body;
  
  const nftValues = {
    'silver-giftbox': 25,
    'gold-giftbox': 100,
    'emerald': 500
  };
  
  const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  
  const nftIndex = user.nftCollection.findIndex(n => n.id === nftId);
  if (nftIndex === -1) {
    return res.status(404).json({ error: 'NFT не найден' });
  }
  
  const value = nftValues[nftId] || 0;
  user.crystals += value;
  user.nftCollection.splice(nftIndex, 1);
  
  res.json({ success: true, user, crystalsAdded: value });
});

// ===== КАНАЛЫ =====

// Получить канал
app.get('/api/channels/:username', (req, res) => {
  const channel = channels.find(c => c.username === req.params.username);
  
  if (!channel) {
    return res.status(404).json({ error: 'Канал не найден' });
  }
  
  res.json(channel);
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Melio сервер запущен на порту ${PORT}`);
});
