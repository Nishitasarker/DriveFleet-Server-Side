const express = require('express');
const dotenv = require('dotenv');
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jose = require('jose'); 

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:3000",
  "https://car-app-tawny.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

const JWKS = createRemoteJWKSet();

function createRemoteJWKSet() {
  try {
    return jose.createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));
  } catch (error) {
    console.error("JWKS Initialization Error: CLIENT_URL missing or invalid.");
    return null;
  }
}

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  try {
    const token = authHeader.split(" ")[1];
    if (!JWKS) throw new Error("JWKS is not configured");
    
    const { payload } = await jose.jwtVerify(token, JWKS);
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

let db, destinationCollection, bookingCollection;

async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db("DriveFeet");
    destinationCollection = db.collection("destination");
    bookingCollection = db.collection("bookings");
    console.log("Connected to MongoDB Successfully!");
  }
}

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({ success: false, message: "Database connection failed" });
  }
});

app.get('/', (req, res) => {
  res.send('Car App Server is running! 🚗');
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

// মডিফাইড ডিলিট রুট (কাউন্ট কমানোর লজিকসহ)
app.delete("/booking/:bookingId", verifyToken, async (req, res) => {
  try {
    const { bookingId } = req.params;

    // ১. প্রথমে বুকিং ডাটা খুঁজে বের করা যাতে কার আইডি (carId) পাওয়া যায়
    const booking = await bookingCollection.findOne({ _id: new ObjectId(bookingId) });
    
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // ২. বুকিংটি ডাটাবেজ থেকে ডিলিট করা
    const deleteResult = await bookingCollection.deleteOne({ _id: new ObjectId(bookingId) });

    // ৩. ডিলিট সফল হলে গাড়ির bookingCount ১ কমিয়ে দেওয়া
    if (deleteResult.deletedCount > 0) {
      await destinationCollection.updateOne(
        { _id: new ObjectId(booking.carId) },
        { $inc: { bookingCount: -1 } } // $inc: -1 দিলে ১ কমে যাবে
      );
    }

    res.json({ success: true, deletedCount: deleteResult.deletedCount });
  } catch (error) {
    console.error("Error canceling booking:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running locally on port ${PORT}`));
}

module.exports = app;