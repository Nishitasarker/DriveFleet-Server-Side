const express = require('express');
const dotenv = require('dotenv');
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
dotenv.config();
const uri = process.env.MONGODB_URI;
const app = express();

const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    const db = client.db("DriveFeet");

    const destinationCollection = db.collection("destination");
    const bookingCollection = db.collection("bookings");

    // ১. সব গাড়ির ডাটা গেট করা
    app.get('/destination', async (req, res) => {
      const result = await destinationCollection.find().toArray();
      res.json(result);
    });

    // ২. নতুন গাড়ি অ্যাড করা
    app.post('/destination', async (req, res) => {
      const destinationData = req.body;
      const result = await destinationCollection.insertMany(Array.isArray(destinationData) ? destinationData : [destinationData]);
      res.json(result);
    });

    // ৩. নির্দিষ্ট একটি গাড়ির ডিটেইলস গেট করা
    app.get("/destination/:id", async (req, res) => {
      const { id } = req.params;
      const result = await destinationCollection.findOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    // 🚀 লজিক্যাল ফিক্স: নির্দিষ্ট লগইন করা ইউজারের EMAIL দিয়ে ডাটা খোঁজা (Trim ও Case Insensitive করা হয়েছে)
    app.get("/booking/:userEmail", async (req, res) => {
      try {
        const userEmail = req.params.userEmail.trim();
        const result = await bookingCollection.find({ 
          userEmail: { $regex: new RegExp(`^${userEmail}$`, 'i') } 
        }).toArray();
        res.json(result);
      } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error" });
      }
    });


    

    // 🚀 নতুন বুকিং ডাটাবেজে সেভ করা এবং ডুপ্লিকেট বুকিং চেক করা
    app.post("/booking", async (req, res) => {
      const bookingData = req.body;
      const { userEmail, carId } = bookingData;

      // ডাটাবেজে চেক করা হচ্ছে এই ইমেইল দিয়ে এই গাড়িটি ইতিমধ্যে বুক করা আছে কিনা
      const alreadyBooked = await bookingCollection.findOne({ 
        userEmail: { $regex: new RegExp(`^${userEmail.trim()}$`, 'i') }, 
        carId: carId 
      });

      if (alreadyBooked) {
        return res.status(400).json({ 
          success: false, 
          message: "You have already booked this car once!" 
        });
      }

      const result = await bookingCollection.insertOne(bookingData);
      res.json({ success: true, insertedId: result.insertedId });
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}

app.delete('/booking/:bookingId', async (req,res)=>{
  const {bookingId} = req.params;
  const result = await bookingCollection.deleteOne({_id: new ObjectId(bookingId)})
  res.json(result)
})
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send("Server is running fine!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});