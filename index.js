const express = require('express');
const dotenv = require('dotenv');
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// 'jose' ইমপোর্ট করার সবচেয়ে নিরাপদ ও আধুনিক নিয়ম (CommonJS-এর জন্য)
const jose = require('jose'); 

dotenv.config();

const app = express();

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// jose অবজেক্ট থেকে সরাসরি মেথড কল করা হচ্ছে, কোনো সাব-পাথ ছাড়া
const JWKS = jose.createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  try {
    const token = authHeader.split(" ")[1];
    // এখানে নিরাপদভাবে ভেরিফাই করা হচ্ছে
    const { payload } = await jose.jwtVerify(token, JWKS);
    console.log(payload);
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

// ডেটাবেজ কালেকশন
const db = client.db("DriveFeet");
const destinationCollection = db.collection("destination");
const bookingCollection = db.collection("bookings");

// আপনার তৈরি করা সব রাউট এবং ফাংশন (হুবহু আগের মতোই অপরিবর্তিত আছে)
app.get('/', (req, res) => {
  res.json({ message: 'Car App Server is running! 🚗' });
});

app.get('/destination', async (req, res) => {
  const { search, carType } = req.query;
  const query = {};
  if (search) query.carName = { $regex: search, $options: 'i' };
  if (carType) query.carType = { $regex: carType, $options: 'i' };
  const result = await destinationCollection.find(query).toArray();
  res.json(result);
});

app.get('/my-cars', verifyToken, async (req, res) => {
  try {
    const userEmail = req.user?.email; 
    if (!userEmail) {
      return res.status(400).json({ success: false, message: "User email not found in token" });
    }
    
    const query = { ownerEmail: userEmail };
    const result = await destinationCollection.find(query).toArray();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/destination/:id", verifyToken, async (req, res) => {
  const result = await destinationCollection.findOne({ _id: new ObjectId(req.params.id) });
  res.json(result);
});

app.post("/destination", verifyToken, async (req, res) => {
  const carData = req.body;
  const userEmail = req.user?.email;

  const carWithOwner = {
    ...carData,
    ownerEmail: userEmail,
    bookingCount: 0 
  };

  const result = await destinationCollection.insertOne(carWithOwner);
  res.json({ success: true, insertedId: result.insertedId });
});

app.put("/cars/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const userEmail = req.user?.email;
    const updatedData = req.body;

    const car = await destinationCollection.findOne({ _id: new ObjectId(id) });
    if (!car) {
      return res.status(404).json({ success: false, message: "Car not found" });
    }
    if (car.ownerEmail !== userEmail) {
      return res.status(403).json({ success: false, message: "Forbidden: You cannot update someone else's car" });
    }

    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        dailyPrice: updatedData.dailyPrice,
        description: updatedData.description,
        availability: updatedData.availability,
        imageUrl: updatedData.imageUrl,
        carType: updatedData.carType,
        pickupLocation: updatedData.pickupLocation,
      },
    };

    const result = await destinationCollection.updateOne(filter, updateDoc);
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/cars/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const userEmail = req.user?.email;

    const car = await destinationCollection.findOne({ _id: new ObjectId(id) });
    if (!car) {
      return res.status(404).json({ success: false, message: "Car not found" });
    }
    if (car.ownerEmail !== userEmail) {
      return res.status(403).json({ success: false, message: "Forbidden: You cannot delete someone else's car" });
    }

    const result = await destinationCollection.deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/booking/:email", verifyToken, async (req, res) => {
  const email = req.params.email;
  const result = await bookingCollection.find({
    userEmail: { $regex: new RegExp(`^${email.trim()}$`, 'i') }
  }).toArray();
  res.json(result);
});

app.post("/booking", verifyToken, async (req, res) => {
  try {
    const bookingData = req.body;
    const result = await bookingCollection.insertOne(bookingData);

    if (result.insertedId) {
      await destinationCollection.updateOne(
        { _id: new ObjectId(bookingData.carId) },
        { $inc: { bookingCount: 1 } }
      );
    }

    res.json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/booking/:bookingId", verifyToken, async (req, res) => {
  const { bookingId } = req.params;
  const result = await bookingCollection.deleteOne({
    _id: new ObjectId(bookingId)
  });
  res.json({ success: true, deletedCount: result.deletedCount });
});

module.exports = app;