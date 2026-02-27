

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import authRoutes from "./src/routes/authRoutes.js";
import ticketRoutes from "./src/routes/ticketRoutes.js";
import supportRoutes from "./src/routes/supportRoutes.js";

const app = express();

/* ===============================
   IMPORTANT: MIDDLEWARE FIRST
=================================*/

// CORS must come BEFORE routes
// app.use(
//   cors({
//     origin: "http://localhost:3002",
//     credentials: true,
//   })
// );
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3002"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

/* ===============================
   ROUTES
=================================*/

app.get("/", (req, res) => {
  res.json({ message: "SabbPe Admin Backend Running 🚀" });
});

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/support", supportRoutes);

/* ===============================
   ERROR HANDLER
=================================*/

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong" });
});

/* ===============================
   START SERVER
=================================*/

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});