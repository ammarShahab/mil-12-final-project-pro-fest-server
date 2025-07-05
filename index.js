// 12.0 created the server using ai

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const dotenv = require("dotenv");
// 25.8 import
const admin = require("firebase-admin");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());
// 21.17.4 import the stripe from ai created doc and paste the gateway key
const stripe = require("stripe")(process.env.PAYMENT_GATEWAY_KEY);

// 25.8.1 import from firbase
const serviceAccount = require("./firebase_admin_key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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
    const parcelsCollection = db.collection("parcels");
    const paymentsCollection = db.collection("payments");
    const usersCollection = db.collection("users");
    const ridersCollection = db.collection("riders");
    console.log("✅ Connected to MongoDB");

    // 25.3 create custom middleware for verify token
    const verifyFBToken = async (req, res, next) => {
      console.log("header in middleware", req.headers); //to check, set this verifyFBToken in any get between " app.get("/parcels", verifyFBToken, async (req,res)..." method then refresh the specific page u will get the headers data in the server side console

      // 25.5 checking the header is present or not
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "unauthorized access" });
      }

      // 25.6 if headers present check token is present or not
      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
      }

      // 25.7 now we need a firebase admin key  to verify the token so first go to firebase => select the project => select the service account tab => in Learn More => run "npm install firebase-admin --save" => Now again go to the service account and copy the code "var admin = require("firebase-admin"); var serviceAccount = require("path/to/serviceAccountKey.json"); admin.initializeApp({ credential: admin.credential.cert(serviceAccount)})" => paste it in 25.8 and 25.8.1 for import => then press Generate new private key to download => copy the key file to sever side and change the name to "firebase_admin_key" => change the path in 25.8.1

      // 25.9 verifying the token
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.decoded = decoded;
        // 25.10 call next
        next();

        // 25.11 now from this step as we used verifyFBToken in ("/parcels", verifyFBToken, async (req,res)..."). now tocheck it is working or not paste in browser url and change the email who is not logged in "http://localhost:3000/parcels?email=job@cob.com". u will get {"message": "unauthorized access"}
      } catch (error) {
        return res.status(403).send({ message: "forbidden access" });
      }

      // 25.4 primarily directly used here but it will be used conditionally later in 25.10 thats why commented
      // next();
    };

    // 32.0 my requirement is as like as verifyFBToken we will also verify admin using custom middleware. as we know the email and token is comes from decoded. we use email here to find the role.
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // 37.0 my requirement is verify the rider as a like as verifyAdmin that one rider cannot see the other riders data
    const verifyRider = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      if (!user || user.role !== "rider") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // POST: Add a parcel
    app.post("/parcels", async (req, res) => {
      const parcel = req.body;
      const result = await parcelsCollection.insertOne(parcel);
      res.send(result);
    });

    // 15.5 make the get api to show the parcel by email or show the all parcel for admin
    app.get("/parcels", verifyFBToken, async (req, res) => {
      try {
        // 15.5.1
        const email = req.query.email;
        // 34.3 find the parcel by status="assignable"
        const status = req.query.status;

        console.log("Query Email:", email);
        console.log("Query Status:", status);

        // 15.5.2
        const filter = {};

        // 15.5.3
        if (email) {
          filter.userEmail = email;
        }

        // 34.4
        if (status === "assignable") {
          filter.delivery_status = "Pending";
          filter.payment_status = "Paid";
        }

        const options = {
          sort: { creation_date: 1 },
        };

        const result = await parcelsCollection.find(filter, options).toArray();
        res.send(result);
      } catch (error) {
        console.error("Parcel fetch error:", error);
        res.status(500).send({ error: "Failed to fetch parcels" });
        // 15.6 now to see in browser type "http://localhost:3000/parcels" to show the data
      }
    });

    // 21.16.2 make  a get api to find a parcel by id
    app.get("/parcels/:parcelId", verifyFBToken, async (req, res) => {
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

    // 36.8
    app.patch("/parcels/:id/update-status", verifyFBToken, async (req, res) => {
      try {
        const parcelId = req.params.id;
        const { delivery_status } = req.body;

        if (!delivery_status) {
          return res
            .status(400)
            .send({ message: "delivery_status is required" });
        }

        const updateFields = { delivery_status };

        // Record current date
        const now = new Date();

        // Add human-readable date based on status
        if (delivery_status === "In-Transit") {
          updateFields.in_transit_date = now;
          updateFields.in_transit_date_str = now.toLocaleDateString("en-GB");
        } else if (delivery_status === "Delivered") {
          updateFields.delivered_date = now;
          updateFields.delivered_date_str = now.toLocaleDateString("en-GB");
        }

        const result = await parcelsCollection.updateOne(
          { _id: new ObjectId(parcelId) },
          { $set: updateFields }
        );

        res.send(result);
      } catch (error) {
        console.error("Error updating delivery status:", error);
        res.status(500).send({ message: "Failed to update status" });
      }
    });

    // 35.4
    app.patch("/parcels/:id/assign-rider", verifyFBToken, async (req, res) => {
      try {
        const parcelId = req.params.id;
        const { riderId, riderName, riderEmail } = req.body;

        if (!riderId) {
          return res.status(400).send({ message: "riderId is required" });
        }

        const result = await parcelsCollection.updateOne(
          { _id: new ObjectId(parcelId) },
          {
            $set: {
              assign_rider_id: riderId,
              assign_rider_name: riderName,
              assign_rider_email: riderEmail, // ✅ New field
              delivery_status: "Assigned",
            },
          }
        );

        res.send(result);
      } catch (error) {
        console.error("Failed to assign rider:", error);
        res.status(500).send({ message: "Assignment failed" });
      }
    });

    // 38.4
    app.patch("/parcels/:id/cashout", async (req, res) => {
      try {
        const id = req.params.id;
        console.log("parcel cashed out", id);

        const result = await parcelsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { cashed_out: true, cashed_out_date: new Date() } }
        );

        res.send(result);
      } catch (error) {
        console.error("Failed to update cashout status:", error);
        res.status(500).send({ message: "Cashout failed" });
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

    // 23.0 my requirement is create a user database to save user data by email and also check if the user is present during create user account it will not create user in db but if not present it will create user in db. By default add the user role=user
    app.post("/users", async (req, res) => {
      try {
        const email = req.body.email;

        let userExist = await usersCollection.findOne({ email });

        if (userExist) {
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

    // 26.3 create a post api for riders
    app.post("/riders", async (req, res) => {
      const rider = req.body;

      // rider.status = "Pending"; // enforce default
      const result = await ridersCollection.insertOne(rider);
      res.send(result);
    });

    // 35.0 my requirement is assign the parcel to the specific region rider and update the delivery status sending the rider name, email, id to the parcelsCollection
    app.get("/riders", verifyFBToken, async (req, res) => {
      try {
        const district = req.query.district;
        if (!district) {
          return res
            .status(400)
            .send({ message: "district query is required" });
        }

        const riders = await ridersCollection
          .find({ district /* status: "Approved"  */ })
          .project({ _id: 1, name: 1, email: 1, district: 1 })
          .toArray();

        res.send(riders);
      } catch (error) {
        console.error("Failed to fetch riders:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // 27.0 my requirement is create get api to send the pending riders data to ui and upon approve or reject the rider status will be save in db
    // 31.9 implement the token to stop the user to see server side data manually
    // 32.1 use verifyAdmin
    app.get("/riders/pending", verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const pendingRiders = await ridersCollection
          .find({ status: "Pending" })
          .toArray();
        res.send(pendingRiders);
      } catch (err) {
        console.error("Error fetching pending riders:", err);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // 31.10 but we also have to verify the api layer i.e user have token but his role is admin or not. this should be also verified.

    // 28.1 create the approved rider api
    // 32.2 use verifyAdmin
    app.get(
      "/riders/approved",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const approvedRiders = await ridersCollection
            .find({ status: "Approved" })
            .toArray();
          res.send(approvedRiders);
        } catch (error) {
          console.error("Error fetching approved riders:", error);
          res.status(500).send({ message: "Internal Server Error" });
        }
      }
    );

    // 36.4 create api to find the delivery_status
    // 37.1 implement verifyRider
    app.get("/rider/parcel", verifyFBToken, verifyRider, async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ message: "Email query is required" });
        }

        const filter = {
          assign_rider_email: email,
          delivery_status: { $in: ["Assigned", "In-Transit"] }, // ✅ match either
        };

        const options = {
          sort: { creation_date: -1 }, // Most recent first
        };

        const result = await parcelsCollection.find(filter, options).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching active parcels:", error);
        res.status(500).send({ message: "Failed to fetch active parcels" });
      }
    });

    // 38.3 create the api for completed deliveries and also implement a cash out feature
    app.get("/rider/completed-parcel", verifyFBToken, async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res
            .status(400)
            .send({ message: "assign_rider_email is required" });
        }

        const filter = {
          assign_rider_email: email,
          delivery_status: { $in: ["Delivered", "service_center_delivered"] },
        };

        const result = await parcelsCollection.find(filter).toArray();
        res.send(result);
      } catch (error) {
        console.error("Failed to fetch delivered parcels:", error);
        res.status(500).send({ message: "Failed to fetch delivered parcels" });
      }
    });

    // 27.3 create patch api for update the status in db
    app.patch("/riders/:id", async (req, res) => {
      const id = req.params.id;
      // 29.4 took the email from the body
      const { status, email } = req.body;

      try {
        const result = await ridersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );

        // 29.5 create query to find with email
        const query = { email };
        const updatedDoc = {
          $set: {
            role: "rider",
          },
        };
        // 29.6 update the role using email
        const roleResult = await usersCollection.updateOne(query, updatedDoc);
        console.log("modified Count", roleResult.modifiedCount);

        res.send(result);
      } catch (error) {
        console.error("Error updating rider status:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // 30.0 my requirement is admin can search user by email with a single word search and change the user role to admin/ user.
    // 30.1 creating a search api
    app.get("/users/search", async (req, res) => {
      const emailQuery = req.query.email;
      if (!emailQuery) {
        return res.status(400).send({ message: "Email query is required" });
      }

      try {
        const users = await usersCollection
          .find({
            email: { $regex: emailQuery, $options: "i" }, // partial match, case-insensitive
          })
          .project({ email: 1, created_at: 1, role: 1 }) // only necessary fields
          .toArray();

        if (users.length === 0) {
          return res.status(404).send({ message: "No matching users found" });
        }

        res.send(users);
      } catch (error) {
        console.error("User search error:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // 31.0 My requirement is create a admin protected route

    // 31.1 create a get api to get the role from user
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      if (user) {
        res.send({ role: user.role || "user" });
      } else {
        return res.status(404).send({ message: "user not found" });
      }
    });

    // 30.5 update role api
    app.patch("/users/role", async (req, res) => {
      const { email, role } = req.body;

      if (!email || !role) {
        return res.status(400).send({ message: "Email and role are required" });
      }

      try {
        const result = await usersCollection.updateOne(
          { email },
          { $set: { role } }
        );
        res.send(result);
      } catch (error) {
        console.error("Role update error:", error);
        res.status(500).send({ message: "Internal Server Error" });
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

    app.post("/payments", verifyFBToken, async (req, res) => {
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
    app.get("/payments", verifyFBToken, async (req, res) => {
      try {
        const email = req.query.email;

        // 25.12 verify the payments according to email
        console.log("decoded", req.decoded);
        if (req.decoded.email !== email) {
          return res.status(403).send({ message: "forbidden access" });
        }

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
