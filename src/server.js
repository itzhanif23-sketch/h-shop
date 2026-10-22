import dotenv from "dotenv";
dotenv.config();
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcrypt";
import { z } from "zod";
import { pool } from "./db.js";
import { requireAdmin, originGuard, newOrderId } from "./security.js";

const app = express(), PgSession = connectPgSimple(session);
const PORT = Number(process.env.PORT || 3000), production = process.env.NODE_ENV === "production";
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
if (production && (!process.env.APP_ORIGIN?.startsWith("https://") || process.env.COOKIE_SECURE !== "true")) throw new Error("Production requires HTTPS APP_ORIGIN and COOKIE_SECURE=true.");
app.disable("x-powered-by");
app.set("trust proxy", production ? 1 : false);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(originGuard);
app.use(session({
 store: new PgSession({ pool, tableName: "session", createTableIfMissing: false }),
 name: "hshop.sid", secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false, rolling: true,
 cookie: { httpOnly: true, secure: production, sameSite: "lax", maxAge: 8*60*60*1000 }
}));
const loginLimiter = rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:true,legacyHeaders:false});
const orderLimiter = rateLimit({windowMs:60*60*1000,limit:20,standardHeaders:true,legacyHeaders:false});
const orderSchema = z.object({
 customerName:z.string().trim().min(2).max(100),
 phone:z.string().trim().min(8).max(20).regex(/^[0-9+()\\-\\s]+$/),
 contactHandle:z.string().trim().min(3).max(80),
 playerId:z.string().trim().min(2).max(80),
 productId:z.number().int().positive(), quantity:z.number().int().min(1).max(99),
 paymentMethod:z.enum(["bkash","nagad","other"]),
 transactionReference:z.string().trim().max(100).optional().default(""),
 customerNote:z.string().trim().max(500).optional().default("")
});
const statusSchema = z.object({
 orderStatus:z.enum(["pending","payment_review","paid","processing","delivered","cancelled","refunded"]).optional(),
 paymentStatus:z.enum(["unverified","pending","verified","rejected"]).optional(),
 adminNote:z.string().trim().max(1000).optional()
}).refine(v=>v.orderStatus||v.paymentStatus||v.adminNote!==undefined,"No updates supplied");

app.use(express.static("public", { extensions:["html"] }));
app.post("/api/tournament/registrations", async (req, res) => {
  try {
    const schema = z.object({
      playerName: z.string().trim().min(2).max(100),
      gameUid: z.string().trim().min(1).max(40),
      phone: z.string().trim().min(8).max(20),
      entryType: z.enum(["free", "paid"]),
      prizePreference: z.enum(["coins", "cash"])
    });

    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Please check all registration fields."
      });
    }

    const {
      playerName,
      gameUid,
      phone,
      entryType,
      prizePreference
    } = parsed.data;

    const result = await pool.query(
      `INSERT INTO tournament_registrations
       (player_name, game_uid, phone, entry_type, prize_preference)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING public_id, status, created_at`,
      [playerName, gameUid, phone, entryType, prizePreference]
    );

    return res.status(201).json({
      message: "Registration submitted successfully.",
      registration: result.rows[0]
    });
  } catch (error) {
    console.error("Tournament registration failed:", error.message);
    return res.status(500).json({
      error: "Registration failed. Please try again later."
    });
  }
});
app.get("/api/health",(_req,res)=>res.json({ok:true,service:"h-shop-api"}));
app.get("/api/products",async(_req,res,next)=>{try{
 const {rows}=await pool.query("SELECT id,slug,name,platform,coins,price_paisa,old_price_paisa FROM products WHERE active=TRUE ORDER BY coins ASC");
 res.json({products:rows});
}catch(e){next(e);}});
app.get("/api/admin/me",(req,res)=>req.session?.admin?res.json({authenticated:true,admin:{id:req.session.admin.id,email:req.session.admin.email}}):res.status(401).json({authenticated:false}));
app.post("/api/admin/login",loginLimiter,async(req,res,next)=>{try{
 const p=z.object({email:z.string().email().max(254),password:z.string().min(1).max(200)}).safeParse(req.body);
 if(!p.success)return res.status(400).json({error:"Enter a valid email and password."});
 const {rows}=await pool.query("SELECT id,email,password_hash,is_active FROM admins WHERE email=$1",[p.data.email.trim().toLowerCase()]);
 const a=rows[0],valid=a&&a.is_active&&await bcrypt.compare(p.data.password,a.password_hash);
 if(!valid)return res.status(401).json({error:"Invalid login details."});
 await new Promise((resolve,reject)=>req.session.regenerate(err=>err?reject(err):resolve()));
 req.session.admin={id:a.id,email:a.email};
 await pool.query("UPDATE admins SET last_login_at=NOW() WHERE id=$1",[a.id]);
 res.json({ok:true,admin:{id:a.id,email:a.email}});
}catch(e){next(e);}});
app.post("/api/admin/logout",requireAdmin,async(req,res,next)=>{try{
 await new Promise((resolve,reject)=>req.session.destroy(err=>err?reject(err):resolve()));
 res.clearCookie("hshop.sid",{httpOnly:true,sameSite:"lax",secure:production});res.json({ok:true});
}catch(e){next(e);}});
app.get("/api/admin/orders",requireAdmin,async(req,res,next)=>{try{
 const page=Math.max(1,Math.min(10000,Number(req.query.page)||1)),limit=30,offset=(page-1)*limit;
 const status=typeof req.query.status==="string"?req.query.status:"";
 const allowed=["pending","payment_review","paid","processing","delivered","cancelled","refunded"];
 if(status&&!allowed.includes(status))return res.status(400).json({error:"Invalid status filter."});
 const args=status?[status,limit,offset]:[limit,offset],where=status?"WHERE order_status=$1":"";
 const li=status?2:1,oi=status?3:2;
 const {rows}=await pool.query(`SELECT public_id,customer_name,phone,contact_handle,player_id,product_name_snapshot,unit_price_paisa,quantity,total_paisa,payment_method,transaction_reference,payment_status,order_status,customer_note,admin_note,created_at,updated_at,delivered_at FROM orders ${where} ORDER BY created_at DESC LIMIT $${li} OFFSET $${oi}`,args);
 res.json({orders:rows,page,perPage:limit});
}catch(e){next(e);}});
app.patch("/api/admin/orders/:publicId",requireAdmin,async(req,res,next)=>{try{
 const p=statusSchema.safeParse(req.body);if(!p.success)return res.status(400).json({error:"Invalid order update."});
 const input=p.data,{rows}=await pool.query("SELECT id,order_status,payment_status FROM orders WHERE public_id=$1",[req.params.publicId]);
 const old=rows[0];if(!old)return res.status(404).json({error:"Order not found."});
 const os=input.orderStatus??old.order_status,ps=input.paymentStatus??old.payment_status;
 if(["paid","processing","delivered"].includes(os)&&ps!=="verified")return res.status(400).json({error:"Verify payment before marking paid, processing, or delivered."});
 const {rows:updated}=await pool.query("UPDATE orders SET order_status=$1,payment_status=$2,admin_note=COALESCE($3,admin_note),updated_at=NOW(),delivered_at=CASE WHEN $1='delivered' THEN COALESCE(delivered_at,NOW()) ELSE delivered_at END WHERE id=$4 RETURNING public_id,order_status,payment_status,admin_note,updated_at,delivered_at",[os,ps,input.adminNote??null,old.id]);
 await pool.query("INSERT INTO admin_audit_log(admin_id,action,order_id,details,ip_address) VALUES($1,$2,$3,$4::jsonb,$5)",[req.session.admin.id,"order_updated",old.id,JSON.stringify({from:{orderStatus:old.order_status,paymentStatus:old.payment_status},to:updated[0]}),req.ip]);
 res.json({order:updated[0]});
}catch(e){next(e);}});
app.post("/api/orders",orderLimiter,async(req,res,next)=>{try{
 const p=orderSchema.safeParse(req.body);
 if(!p.success)return res.status(400).json({error:"Please check required fields.",details:p.error.issues.map(i=>({field:i.path.join("."),message:i.message}))});
 const d=p.data,{rows:pr}=await pool.query("SELECT id,name,price_paisa FROM products WHERE id=$1 AND active=TRUE",[d.productId]);
 const product=pr[0];if(!product)return res.status(400).json({error:"This package is unavailable."});
 const publicId=newOrderId(),total=product.price_paisa*d.quantity;
 const {rows}=await pool.query(`INSERT INTO orders(public_id,customer_name,phone,contact_handle,player_id,product_id,product_name_snapshot,unit_price_paisa,quantity,total_paisa,payment_method,transaction_reference,customer_note) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULLIF($12,''),NULLIF($13,'')) RETURNING public_id,product_name_snapshot,quantity,total_paisa,payment_status,order_status,created_at`,
 [publicId,d.customerName,d.phone,d.contactHandle,d.playerId,product.id,product.name,product.price_paisa,d.quantity,total,d.paymentMethod,d.transactionReference,d.customerNote]);
 res.status(201).json({order:rows[0],message:"Order received for manual review. Payment is not automatically verified."});
}catch(e){next(e);}});
app.get("/api/orders/:publicId",async(req,res,next)=>{try{
 const phone=String(req.query.phone||"").trim();if(phone.length<8||phone.length>20)return res.status(400).json({error:"Order ID and order phone number are required."});
 const {rows}=await pool.query("SELECT public_id,product_name_snapshot,quantity,total_paisa,payment_status,order_status,created_at,updated_at,delivered_at FROM orders WHERE public_id=$1 AND phone=$2",[req.params.publicId,phone]);
 if(!rows[0])return res.status(404).json({error:"Order not found. Check the order ID and phone number."});
 res.json({order:rows[0]});
}catch(e){next(e);}});
app.use((err,_req,res,_next)=>{console.error("Request failed:",err.message);res.status(500).json({error:"Something went wrong. Please try again later."});});
app.listen(PORT,()=>console.log(`H Shop running at http://localhost:${PORT}`));
