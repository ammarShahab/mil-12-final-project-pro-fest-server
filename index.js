// 12.0 created the server using ai

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* .env
DB_USER=parcels_DB
DB_PASS=O6EaVubWJrjOctcC
*/

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bmunlsr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("parcelDeliveryDB");
    parcelsCollection = db.collection("parcels");
    console.log("✅ Connected to MongoDB");

    // POST: Add a parcel
    app.post("/parcels", async (req, res) => {
      const parcel = req.body;
      const result = await parcelsCollection.insertOne(parcel);
      res.send(result);
    });

    // GET: All parcels
    app.get("/parcels", async (req, res) => {
      const result = await parcelsCollection.find().toArray();
      res.send(result);
    });

    // PUT: Update parcel (delivery/payment status)
    app.put("/parcels/:id", async (req, res) => {
      const { id } = req.params;
      const updateFields = req.body;
      const result = await parcelsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields }
      );
      res.send(result);
    });

    app.get("/", (req, res) => {
      res.send("✅ Parcel Delivery Server is running successfully!");
    });

    app.listen(port, () => {
      console.log(`🚀 Server running at http://localhost:${port}`);
    });
  } catch (err) {
    console.error("❌ Error connecting to DB", err);
  }
}

run();
