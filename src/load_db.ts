import DB from "./db.js";

export default async function loadDb() {
    global.db = new DB();
    await db.createTables();
}