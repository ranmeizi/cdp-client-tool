import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import fs from 'node:fs';
import path from 'node:path';

const app = express();
const server = createServer(app);
const io = new Server(server);

const script = fs.readFileSync(path.resolve(process.cwd(), '../src/task1.mjs'))

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('a user connected');

    // 发送一个 save 消息
    // socket.emit('setFile', {
    //     payload: {
    //         filename: 'modules/helloworld.js',
    //         content: 'console.log("hello world")',
    //     }
    // }, val => {
    //     console.log('return message:', val);
    // });

    // 测试exec
    socket.emit('exec_remote_script', {
        payload: {
            raw: script,
        }
    }, val => {
        console.log('return message:', val);
    });
});

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});