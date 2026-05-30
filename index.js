const express = require ('express')
const dotenv = require('dotenv')
const cors = require("cors")
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
dotenv.config()
const uri =process.env.MONGODB_URI;
const app = express()

const PORT = process.env.PORT;
app.use(cors())
app.use(express.json())

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

     const db = client.db("DriveFeet") 


  const destinationCollection = db.collection("destination")

  const bookingCollection = db.collection("bookings")

  app.get('/destination', async (req,res)=> {
    const result = await destinationCollection.find().toArray()
    res.json(result);
  });

app.post('/destination',async(req,res)=>{

const destinationData = req.body
console.log(destinationData)
const result = await destinationCollection.insertOne(destinationData)

res.json(result)
})

app.get("/destination/:id", async (req, res )=>{
  const {id} = req.params
  const result = await destinationCollection.findOne({_id: new ObjectId(id)})
  res.json(result)
})


app.post("/booking", async (req, res) => {

  const bookingData = req.body;
  const result = await bookingCollection.insertOne(bookingData)
  res.json(result);

})

     await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res)=>{
    res.send("Server is running fine!" )
})

app.listen(PORT,()=>{

    console.log(`Server running on port ${PORT}`)
})