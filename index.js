const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;
const app = express();

// middleware==================

const corsOptions = {
    origin: ['http://localhost:5173'],
    credentials: true,
    optionSuccessStatus: 200,

}
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// jwt verify middleware=============
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if(!token){
    return res.status(401).send({message: 'unauthorized access'});
  }
  if(token){
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if(err){
        console.log(err);
        return res.status(401).send({message: 'unauthorized access'});
      }
      console.log(decoded)
      req.user = decoded
      next()
    })
  }
}


// soloSphere
// U1nq50AfH9CX6o56


const uri = "mongodb+srv://soloSphere:U1nq50AfH9CX6o56@cluster0.g2fbusk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const jobsCollection = client.db('soloSphere').collection('jobs');
    const bidsCollection = client.db('soloSphere').collection('bids');


    // json web token=============================================

    app.post('/jwt', async(req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn:'365d',
      });
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      }).send({success: true})
    })

    // user logout on the token removed the cookie==========
    app.get('/logout', (req, res)=> {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        maxAge: 0,
      }).send({success: true})
    })



    // get all jobs data from DB===============================================

    app.get('/jobs', async (req, res) => {
        const result = await jobsCollection.find().toArray();
        res.send(result);
    })

    app.get('/job/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await jobsCollection.findOne(query)
      res.send(result)
    })

    app.post('/bid', async(req, res) => {
      const bidData = req.body;
      // check if its a duplicate data==============
      const query = {email: bidData.email, jobId: bidData.jobId}
      const allReadyApplied = await bidsCollection.findOne(query)
      if(allReadyApplied){
        return res.status(400).send('Your have already placed a bid on this data')
      }

      const result = await bidsCollection.insertOne(bidData);
      res.send(result);
    })

    app.post('/job', async(req, res) => {
      const jobData = req.body;
      const result = await jobsCollection.insertOne( jobData);
      res.send(result);
    })

    app.get('/jobs/:email',verifyToken, async(req, res) => {
      const tokenEmail = req.user.email;
      const email = req.params.email;
      if(tokenEmail !== email){
          return res.status(403).send({message: 'Forbidden access'})
      }
      const query = {'buyer.email': email};
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    })

    app.delete('/job/:id', verifyToken, async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await jobsCollection.deleteOne(query);
      res.send(result)
    })
  
    app.put('/job/:id', async(req, res) => {
      const id = req.params.id;
      const jobData = req.body;
      const query = {_id: new ObjectId(id)};
      const options = {upsert: true};
      const updateDoc = {
        $set: {
          ...jobData
        }
      }
      const result = await jobsCollection.updateOne(query, updateDoc, options);
      res.send(result)
    })

    // bid collaction============================

    app.get('/myBid/:email', verifyToken, async(req, res)=> {
      const email = req.params.email;
      const query = { email};
      const result = await bidsCollection.find(query).toArray();
      res.send(result);
    })

    // bid request buyer ================================

    app.get('/bidRequests/:email', verifyToken, async(req, res) => {
      const email = req.params.email;
      const query = {'buyer.email': email};
      const result = await bidsCollection.find(query).toArray();
      res.send(result);
    })

    // update bid request status ===================
    app.patch('/bid/:id', async(req, res) => {
      const id = req.params.id;
      const status = req.body;
      const query = {_id: new ObjectId(id)};
      const updateDoc = {
        $set: status,
      };
      const result = await bidsCollection.updateOne(query, updateDoc);
      res.send(result);
    })

    // pagination data ===================
    app.get('/allJobs', async(req, res) => {
      const page =parseInt( req.query.page) - 1;
      const size = parseInt(req.query.size);
      const filter = req.query.filter;
      const sort = req.query.sort;
      const search = req.query.search;
      let query = {
        jobTitle: { $regex: search, $options: 'i'}
      };
      if(filter) query.category = filter;

      let options = {};
      if(sort) options = {sort: {dateline: sort === 'asc' ? 1 : -1 }}
      const result = await jobsCollection.find(query, options).skip(page * size).limit(size).toArray()
      res.send(result)
    })

    app.get('/jobsCount', async(req, res) => {
      const filter = req.query.filter;
      const search = req.query.search;
      let query = {
        jobTitle: { $regex: search, $options: 'i'}
      };
      if(filter) query.category = filter;
      const count = await jobsCollection.countDocuments(query);
      res.send({count})
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('solo sphere running on the')
})

app.listen(port, () => {
    console.log(`solo sphere server running on port ${port}`);
})