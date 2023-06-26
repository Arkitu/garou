import dotenv from 'dotenv';
import path from 'path';

export default function loadConfig() {
    dotenv.config({
        path: path.join(process.cwd(), "config.env")
    });
}