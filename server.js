const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server);

// Подключение к MongoDB

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB подключена'))
    .catch(err => console.error('Ошибка подключения к MongoDB:', err));


// Схема клиента
const ClientSchema = new mongoose.Schema({
    deviceId: String,
    lastSeen: Date,
    location: {
        lat: Number,
        lng: Number
    },
    battery: Number,
    status: String
});

const Client = mongoose.model('Client', ClientSchema);

// Приём данных от Android-трекера
app.post('/api/update', async (req, res) => {
    const { deviceId, lat, lng } = req.body;
    const update = { lastSeen: new Date(), location: { lat, lng } };
    
    await Client.findOneAndUpdate({ deviceId }, update, { upsert: true });
    
    io.emit('location_update', { deviceId, lat, lng });
    res.sendStatus(200);
});

// Раздаём страницу с картой
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(port, '0.0.0.0', () => console.log(`Система мониторинга запущена на порту ${port}`));
