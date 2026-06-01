const express = require('express');
const dotenv = require('dotenv');
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

const JWKS = createRemoteJWKSet(new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`));

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];
  console.log(token); // ← শুধু token আসবে
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }
  
  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
  }
};

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    console.log("Successfully connected to MongoDB!");
    
    const db = client.db("DriveFeet");
    const destinationCollection = db.collection("destination");
    const bookingCollection = db.collection("bookings");

    app.get('/destination', async (req, res) => {
      const result = await destinationCollection.find().toArray();
      res.json(result);
    });

    app.get("/destination/:id", verifyToken, async (req, res) => {
      const result = await destinationCollection.findOne({ _id: new ObjectId(req.params.id) });
      res.json(result);
    });

    app.post("/booking", verifyToken, async (req, res) => {
      const bookingData = req.body;
      const alreadyBooked = await bookingCollection.findOne({
        userEmail: { $regex: new RegExp(`^${bookingData.userEmail.trim()}$`, 'i') },
        carId: bookingData.carId
      });

      if (alreadyBooked) return res.status(400).json({ success: false, message: "Already booked!" });
      
      const result = await bookingCollection.insertOne(bookingData);
      res.json({ success: true, insertedId: result.insertedId });
    });

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error("Connection error:", err);
  }
}

run();