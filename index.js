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
// 21.17.4 import the stripe from ai created doc and paste the gateway key
const stripe = require("stripe")(process.env.PAYMENT_GATEWAY_KEY);

/* .env
DB_USER=parcel_DB
DB_PASS=O6EaVubWJrjOctcC

PAYMENT_GATEWAY_KEY=sk_test_51ResXyPDXAjOVcw8VNGP2DgTWFLAeCiUext7KD1tFqXlc8DaADjd0HqyuRA6QFfq6nKCz6MccD3d51cJLZ5GF5cC00hxQOcsmZ
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
    paymentsCollection = db.collection("payments");
    usersCollection = db.collection("users");
    console.log("✅ Connected to MongoDB");

    // POST: Add a parcel
    app.post("/parcels", async (req, res) => {
      const parcel = req.body;
      const result = await parcelsCollection.insertOne(parcel);
      res.send(result);
    });

    // 23.0 my requirement is create a user database to save user data by email and also check if the user is present it will not create user in db but if not present it will create user in db. By default add the user role=user
    app.post("/users", async (req, res) => {
      try {
        const email = req.body.email;

        let userExist = await usersCollection.findOne({ email });

        if (userExist) {
          // Update last login
          /*  await usersCollection.updateOne(
            { email },
            { $set: { last_log_in: now } }
          );
          user.last_log_in = now; */
          return res
            .status(200)
            .send({ message: "user  already exists", inserted: false });
        }

        // 23.2 if user is not exists the userInfo that is created in 23.1 will be in req.body
        const user = req.body;
        const result = await usersCollection.insertOne(user);

        res.send(result);
      } catch (error) {
        console.error("User check error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
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

    // 21.17 Create a PaymentIntent. Note: code is created by ai on that site ai assistant using command "i want to create custom card payment system using node js". then install stripe "npm install stripe". Now follow the step to apply stripe => create account in stripe https://docs.stripe.com/sdks.=> In dashboard if that site u will get Api keys. now copy the publishable key and save to client site dotenv.local => copy the secret key and save to server .env name gateway key.
    app.post("/create-payment-intent", async (req, res) => {
      const amountInCents = req.body.amountInCents;
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 21.17.8 now create mark the parcel as paid and create payment history

    app.post("/payments", async (req, res) => {
      try {
        const {
          parcelId,
          email,
          amount,
          paymentMethod,
          transactionId,
          payment_status,
        } = req.body;

        const paymentTime = new Date().toISOString();

        // Update parcel payment status
        const parcelUpdateResult = await parcelsCollection.updateOne(
          { _id: new ObjectId(parcelId) },
          { $set: { payment_status: "Paid" } }
        );

        // Save payment history
        const paymentRecord = {
          parcelId,
          email,
          amount,
          paymentMethod,
          payment_status,
          paymentTime,
          transactionId,
        };

        console.log(paymentRecord);

        const paymentSaveResult = await paymentsCollection.insertOne(
          paymentRecord
        );

        res.send(paymentSaveResult);
      } catch (error) {
        console.error("❌ Payment processing error:", error);
        res.status(500).send({ error: "Payment failed" });
      }
    });

    // 21.17.9 Get Payment History by User (Client)

    app.get("/payments", async (req, res) => {
      try {
        const email = req.query.email;

        const filter = email ? { email } : {};

        const payments = await paymentsCollection
          .find(filter)
          .sort({ paymentTime: -1 }) // latest first
          .toArray();

        res.send(payments);
      } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).send({ error: "Failed to load payments" });
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
