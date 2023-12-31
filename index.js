require("dotenv").config();
const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.PAYMENT_STRIPE_KEY);
const jwt = require("jsonwebtoken");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// verify jwt
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ez2u9zk.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const classesCollection = client.db("allYogaDB").collection("classes");
    const usersCollection = client.db("allYogaDB").collection("users");
    const addClassCollection = client.db("allYogaDB").collection("addClass");
    const paymentsCollection = client.db("allYogaDB").collection("payments");

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "Admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "Instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "10d",
      });
      res.send({ token });
    });

    // class related api
    app.get("/allClasses", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    // show popular Classes
    app.get("/showPopularClasses", async (req, res) => {
      const query = { paid: "paid" };
      const result = await addClassCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/showPopularInstructor", async (req, res) => {
      const query = { paid: "paid" };
      const result = await addClassCollection.find(query).toArray();
      res.send(result);
    });

    // add to class by student
    app.get("/studentAddClasses", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await addClassCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/studentAddClasses", async (req, res) => {
      const studentClass = req.body;
      const result = await addClassCollection.insertOne(studentClass);
      res.send(result);
    });
    app.delete("/studentAddClasses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await addClassCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/singleClass/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await addClassCollection.findOne(query);
      res.send(result);
    });

    app.put("/afterPaymentBooked/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          paid: "paid",
        },
      };
      const result = await addClassCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // student enrolled classes api
    app.get("/allEnrolledClasses", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.send([]);
      }

      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden access" });
      }
      const query = { email: email };
      const result = await paymentsCollection.find(query).toArray();
      res.send(result);
    });

    // show classes by email an instructor
    app.get(
      "/allClasses/:instructorEmail",

      async (req, res) => {
        const instructorEmail = req.params.instructorEmail;
        const query = { instructorEmail: instructorEmail };
        const classes = await classesCollection.find(query).toArray();
        res.send(classes);
      }
    );

    // instructor related api
    app.get("/instructors", async (req, res) => {
      const query = { role: "Instructor" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    app.put("/updateClass/:id", async (req, res) => {
      const id = req.params.id;
      const options = { upsert: true };
      const filter = { _id: new ObjectId(id) };
      const updateClass = req.body;
      const classes = {
        $set: {
          price: updateClass.price,
          availableSeat: updateClass.availableSeat,
          className: updateClass.className,
        },
      };
      const result = await classesCollection.updateOne(
        filter,
        classes,
        options
      );
      res.send(result);
    });

    // show approved class
    app.get("/allApprovedClasses", async (req, res) => {
      const query = { status: "Approved" };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/addClasses", verifyJWT, async (req, res) => {
      const instructorClass = req.body;
      console.log(instructorClass);
      const result = await classesCollection.insertOne(instructorClass);
      res.send(result);
    });

    // status change by admin classes
    app.patch("/users/approved/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "Approved",
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/users/denied/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "Denied",
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // feedBack TODO
    app.put("/users/feedback/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const feedback = req.body.feedback;
      console.log(feedback);
      const updateDoc = {
        $set: {
          feedback: feedback,
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // user related api
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user Already existing" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users-findUser/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    // role change to user
    app.patch("/users/admin/:id",  async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "Admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/users/instructor/:id",  async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "Instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // admin role define
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ Admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "Admin" };
      res.send(result);
    });

    // instructor role define
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ Instructor: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "Instructor" };
      res.send(result);
    });

    // payment
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentsCollection.insertOne(payment);
      res.send({ insertResult });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Yoga Center Is Running");
});
app.listen(port, () => {
  console.log(`Yoga Center Is Running is always run on ${port}`);
});
