import dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcrypt";
import { pool } from "./db.js";
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 14 || password.startsWith("replace_with_")) {
 console.error("Set ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 14 characters in .env."); process.exit(1);
}
try {
 const hash = await bcrypt.hash(password, 12);
 await pool.query("INSERT INTO admins(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO NOTHING",[email,hash]);
 const products = [
 ["coins-140","Luis Suarez +50 coins",50,10000,null],
 ["coins-350","Iker Casillas +100 coins",100,30000,null],
 ["combo-150","Luis + Casillas +150 coins",150,40000,null],
 ["coins-130","130 Coins",130,15000,null],
 ["coins-300","300 Coins",300,33000,null],
 ["coins-550","550 Coins",550,53000,59000],
 ["coins-750","750 Coins",750,71500,80000],
 ["coins-1040","1040 Coins",1040,96000,110000],
 ["coins-2130","2130 Coins",2130,198000,220000],
 ["coins-3250","3250 Coins",3250,297000,330000],
 ["coins-5700","5700 Coins",5700,484000,540000],
 ["coins-12800","12800 Coins",12800,1034000,1109000]
 ];
 for (const [slug,name,coins,price,old] of products)
  await pool.query("INSERT INTO products(slug,name,coins,price_paisa,old_price_paisa) VALUES($1,$2,$3,$4,$5) ON CONFLICT(slug) DO NOTHING",[slug,name,coins,price,old]);
 console.log("Admin/products seeded. Existing admin credentials were not changed.");
} finally { await pool.end(); }
