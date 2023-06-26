import DB from "../db.js";

declare global {
    var db: DB;
}

export {};