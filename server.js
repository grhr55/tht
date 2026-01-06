const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');
const https = require('https');

dotenv.config();

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const options = {
    key: fs.readFileSync('./key.pem'),
    cert: fs.readFileSync('./cert.pem')
};

const server = https.createServer(options, app);
const io = new Server(server);

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

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

app.post('/api/update', async (req, res) => {
    const { deviceId, lat, lng } = req.body;
    const update = { lastSeen: new Date(), location: { lat, lng } };

    await Client.findOneAndUpdate({ deviceId }, update, { upsert: true });

    io.emit('location_update', { deviceId, lat, lng });
    res.sendStatus(200);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(port, '0.0.0.0', () => console.log(`Monitorig system running on port ${port}`));