// 12.0 created the server using ai

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* .env
DB_USER=parcel_DB
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

    // 15.5 make the get api to show the parcel by email or show the all parcel for admin
    app.get("/parcels", async (req, res) => {
      try {
        const email = req.query.email;
        // console.log(req.query);
        // console.log("Query Email:", email);

        const filter = email ? { userEmail: email } : {};
        // console.log(filter);

        const options = {
          sort: { creation_date: 1 }, // Ascending order
        };

        const result = await parcelsCollection.find(filter, options).toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch parcels" });
      }
      // 15.6 now to see in browser type "http://localhost:3000/parcels" to show the data
    });

    // 21.16.2 make  a get api to find a parcel by id
    app.get("/parcels/:parcelId", async (req, res) => {
      try {
        const id = req.params.parcelId;

        const query = { _id: new ObjectId(id) };
        const parcel = await parcelsCollection.findOne(query);

        if (parcel) {
          res.send(parcel);
        } else {
          res.status(404).send({ error: "Parcel not found" });
        }
      } catch (error) {
        console.error("❌ Error fetching parcel:", error);
        res.status(500).send({ error: "Failed to fetch parcel" });
      }
    });

    // 17.1 created delete api
    app.delete("/parcels/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };
        const result = await parcelsCollection.deleteOne(query);

        res.send(result);
      } catch (error) {
        console.error("❌ Delete error:", error);
        res.status(500).send({ error: "Failed to delete parcel" });
      }
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
