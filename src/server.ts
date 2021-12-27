import axios from 'axios';
import { json } from 'body-parser';
import { createCanvas, loadImage, registerFont } from 'canvas';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { v4 } from 'uuid';

dotenv.config();

const SIZE = 1000;
const PADDING = 200;
const MAP_LOC = {
    topLeft: [49.5629331, 15.9357536] as Point,
    bottomRight: [49.5588008, 15.9471531] as Point,
};

type Point = [number, number];

/*setInterval(() => {
    axios.get(`${process.env.SELF_URL}/upkeep`);
}, 60 * 1000);*/

async function startServer() {
    const port = parseInt(process.env.PORT || '') || 8888;
    const app = express();

    app.use(cookieParser());
    app.use(cors());
    app.use(json());
    app.use('/get/', express.static('export'));

    app.get('/upkeep', (req, res) => res.send('OK'));

    registerFont(path.join(__dirname, '..', 'fonts', 'NUNITO-BOLD.TTF'), { family: 'Nunito' });
    const logoOstrovy = await loadImage(path.join(__dirname, '..', 'images', 'ostrovy-logo.png'));
    const logoDuha = await loadImage(path.join(__dirname, '..', 'images', 'duha-logo.png'));
    const map = await loadImage(path.join(__dirname, '..', 'images', 'map.png'));

    app.post('/save', async (req, res) => {
        let { nickname, points, shape } = req.body as { nickname: string; points: Point[]; shape: Point[] };
        nickname = decodeURIComponent(nickname);
        console.log(`New save from "${nickname}"`);

        const minX = shape.reduce((prev, curr) => Math.min(prev, curr[0]), shape[0][0]);
        const maxX = shape.reduce((prev, curr) => Math.max(prev, curr[0]), shape[0][0]);
        const minY = shape.reduce((prev, curr) => Math.min(prev, curr[1]), shape[0][1]);
        const maxY = shape.reduce((prev, curr) => Math.max(prev, curr[1]), shape[0][1]);
        const width = Math.abs(maxX - minX) * 1.5;
        const height = Math.abs(maxY - minY);
        const larger = Math.max(width, height);
        const scale = (SIZE - PADDING * 2) / larger;

        function normalize(point: Point) {
            return [
                PADDING + (point[1] - minY) * scale + (SIZE - PADDING * 2 - height * scale) / 2,
                SIZE - PADDING - (point[0] - minX) * scale * 1.5 + (SIZE - PADDING * 2 - width * scale) / 2,
            ] as Point;
        }

        const canvas = createCanvas(SIZE, SIZE);
        const ctx = canvas.getContext('2d');

        const mapTop = normalize(MAP_LOC.topLeft);
        const mapBottom = normalize(MAP_LOC.bottomRight);
        ctx.drawImage(map, mapTop[0], mapTop[1], mapBottom[0] - mapTop[0], mapBottom[1] - mapTop[1]);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.fillStyle = 'black';

        ctx.font = '40px Nunito';
        ctx.textBaseline = 'top';
        ctx.fillText(nickname, 50, 900);

        ctx.drawImage(logoOstrovy, 40, 40, 250, 170);
        ctx.drawImage(logoDuha, 830, 910, 130, 50);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.strokeStyle = 'rgba(117, 121, 238, 0.2)';
        ctx.lineWidth = 30;
        ctx.beginPath();
        points.forEach((point) => {
            ctx.lineTo(normalize(point)[0], normalize(point)[1]);
        });
        ctx.stroke();

        ctx.strokeStyle = 'black';
        ctx.lineWidth = 10;
        ctx.beginPath();
        shape.forEach((point) => {
            ctx.lineTo(normalize(point)[0], normalize(point)[1]);
        });
        ctx.stroke();

        const uuid = v4();

        // SAVE
        const out = fs.createWriteStream(path.join(__dirname, '..', 'export', uuid + '.png'));
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        out.on('finish', () => {
            console.log(`The PNG file was created at ${path.join(__dirname, '..', 'export', uuid + '.png')}`);

            axios.post(process.env.ZAPIER_URL || '', `${process.env.SELF_URL}/get/${uuid}.png`);
        });

        res.send('OK');
    });

    app.listen(port, () => console.log(`Server is running at http://localhost:${port}`));
    return app;
}

startServer();
