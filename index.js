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

const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const { payload } = await jwtVerify(token, JWKS);
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

async function run() {
  try {
    await client.connect();
    
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. Successfully connected to MongoDB!");

    const db = client.db("DriveFeet");
    const destinationCollection = db.collection("destination");
    const bookingCollection = db.collection("bookings");

    // ==========================================
    // CARS / DESTINATION ROUTES
    // ==========================================

    // ১. সকল গাড়ি খোঁজা (সার্চ এবং ফিল্টার সহ)
    app.get('/destination', async (req, res) => {
      const { search, carType } = req.query;
      const query = {};
      if (search) query.carName = { $regex: search, $options: 'i' };
      if (carType) query.carType = { $regex: carType, $options: 'i' };
      const result = await destinationCollection.find(query).toArray();
      res.json(result);
    });

    // ২. শুধুমাত্র লগইন করা ইউজারের অ্যাড করা গাড়িগুলো দেখা
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

    // ৩. নির্দিষ্ট একটি গাড়ির ডিটেইলস দেখা
    app.get("/destination/:id", verifyToken, async (req, res) => {
      const result = await destinationCollection.findOne({ _id: new ObjectId(req.params.id) });
      res.json(result);
    });

    // ৪. নতুন গাড়ি যুক্ত করা
    app.post("/destination", verifyToken, async (req, res) => {
      const carData = req.body;
      const userEmail = req.user?.email;

      const carWithOwner = {
        ...carData,
        ownerEmail: userEmail,
        bookingCount: 0 // নতুন গাড়ি এড করার সময় ডিফল্ট কাউন্ট ০ থাকবে
      };

      const result = await destinationCollection.insertOne(carWithOwner);
      res.json({ success: true, insertedId: result.insertedId });
    });

    // ৫. গাড়ির তথ্য আপডেট করা
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

    // ৬. গাড়ি ডিলিট করা
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


    // ==========================================
    // BOOKING ROUTES (ডুপ্লিকেট চেক রিমুভড ও কাউন্টার যুক্ত)
    // ==========================================

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

        // এখানে ডুপ্লিকেট চেক (alreadyBooked) টোটালি বাদ দেওয়া হয়েছে।
        const result = await bookingCollection.insertOne(bookingData);

        if (result.insertedId) {
          // বুকিং সফল হলে destination কালেকশনে ঐ গাড়ির bookingCount ১ বাড়ানো হবে
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

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error("Connection error:", err);
  }
}

run();

module.exports = app;