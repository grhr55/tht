const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path'); // Для работы с путями
const dotenv = require ('dotenv');


const app = express();

const cors = require('cors');
app.use(cors());
dotenv.config();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Разрешаем подключения со всех источников для простоты
        methods: ["GET", "POST"]
    }
});
// !!! ВАЖНО: Измените эту соль на свою уникальную и секретную !!!
const SALT = "Хуй"; 

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Указываем директорию для статических файлов

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  
})
.then(() => console.log('>>> MongoDB подключена'))
.catch(err => console.error('>>> Ошибка подключения MongoDB:', err));

const TargetSchema = new mongoose.Schema({
    deviceId: { type: String, unique: true, required: true },
    model: String, // Добавляем модель для лучшей идентификации
    lat: Number,
    lng: Number,
    lastSeen: { type: Date, default: Date.now },
    key: String // Храним сгенерированный ключ для быстрой проверки
});
const Target = mongoose.model('Target', TargetSchema);

// Функция генерации ключа
function generateKey(deviceId) {
    return crypto.createHash('sha256').update(deviceId + SALT).digest('hex').substring(0, 6).toUpperCase();
}

// API для обновления данных устройства
app.post('/api/update', async (req, res) => {
    const { deviceId, model, lat, lng } = req.body;

    if (!deviceId || lat == null || lng == null) {
        return res.status(400).send('Missing required fields: deviceId, lat, lng');
    }

    const generatedKey = generateKey(deviceId);

    try {
        const target = await Target.findOneAndUpdate(
            { deviceId },
            { model, lat, lng, lastSeen: new Date(), key: generatedKey },
            { upsert: true, new: true } // upsert: true - создать, если не существует; new: true - вернуть обновленный документ
        );
        
        // Отправляем обновление всем подключенным клиентам карты
        io.emit('update', { deviceId: target.deviceId, model: target.model, lat: target.lat, lng: target.lng, key: target.key });
        
        res.sendStatus(200);
    } catch (error) {
        console.error('>>> Ошибка при обновлении данных:', error);
        res.status(500).send('Server error');
    }
});

// API для проверки кода (для клиента)
app.post('/api/verify', async (req, res) => {
    const { deviceId, code } = req.body;
    if (!deviceId || !code) {
        return res.status(400).json({ success: false, message: 'Missing deviceId or code' });
    }
    try {
        const target = await Target.findOne({ deviceId });
        if (!target) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }
        res.json({ success: code === target.key });
    } catch (error) {
        console.error('>>> Ошибка при проверке кода:', error);
        res.status(500).send('Server error');
    }
});

// API для получения списка всех целей
app.get('/api/targets', async (req, res) => {
    try {
        const targets = await Target.find();
        res.json(targets);
    } catch (error) {
        console.error('>>> Ошибка при получении списка целей:', error);
        res.status(500).send('Server error');
    }
});

// Обработка подключения Socket.IO
io.on('connection', (socket) => {
    console.log('>>> Новый клиент карты подключен:', socket.id);
    socket.on('disconnect', () => {
        console.log('>>> Клиент карты отключен:', socket.id);
    });
});

// Запуск сервера
const PORT = 3000;
server.listen(`${PORT}`, '0.0.0.0', () => console.log(`>>> СЕТЬ УПРАВЛЕНИЯ ЗАПУЩЕНА на порту ${PORT}`));