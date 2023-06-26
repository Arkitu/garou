import path from 'path';
import pack, { Database } from 'sqlite3';
const sqlite3 = pack.verbose();

export interface User {
    id: string;
    username: string;
}

export default class DB {
    private realDB: Database;
    constructor() {
        this.realDB = new sqlite3.Database(path.join(process.cwd(), "db.sqlite"));
    }

    createTables() {
        return Promise.all([
            new Promise<void>((resolve, reject) => {
                this.realDB.run(
                    `CREATE TABLE IF NOT EXISTS users (
                        id TEXT NOT NULL,
                        username TEXT NOT NULL,
                        PRIMARY KEY (id)
                    )`, (err) => {
                        if (err) reject(err);
                        resolve();
                    }
                )
            })
        ]);
    }

    // Users

    getUser(id: string): Promise<User> {
        return new Promise((resolve, reject) => {
            this.realDB.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
                if (err) reject(err);
                resolve(row as User);
            })
        })
    }

    createUser(id: string, username: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.realDB.run("INSERT INTO users (id, username) VALUES (?, ?)", [id, username], (err) => {
                if (err) reject(err);
                resolve();
            })
        })
    }

    createUserIfNotExists(id: string, username: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.realDB.run("INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)", [id, username], (err) => {
                if (err) reject(err);
                resolve();
            })
        })
    }

    updateUser(user_id: string, username: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.createUserIfNotExists(user_id, username).then(() => {
                this.realDB.run("UPDATE users SET username = ? WHERE id = ?", [username, user_id], (err) => {
                    if (err) reject(err);
                    resolve();
                })
            })
        })
    }

    updateOrCreateUser(user_id: string, username: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.createUserIfNotExists(user_id, username).then(() => {
                this.updateUser(user_id, username).then(resolve).catch(reject);
            })
        })
    }

    getAllUsers(): Promise<User[]> {
        return new Promise((resolve, reject) => {
            this.realDB.all("SELECT * FROM users", (err, rows) => {
                if (err) reject(err);
                resolve(rows as User[]);
            })
        })
    }
}