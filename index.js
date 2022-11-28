const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const jwt = require('jsonwebtoken');
const { query } = require('express');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 9000;
// middleware
app.use(cors());
app.use(express.json());

console.log(process.env.DB_USER)
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.8wshdhj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })

}

async function run() {
    try {
        const productCollection = client.db('offerUp').collection('productCategories');
        const usersCollection = client.db('offerUp').collection('users');
        const feedbackCollection = client.db('offerUp').collection('feedback');
        const advertisementCollection = client.db('offerUp').collection('advertisement');
        const bookingsCollection = client.db('offerUp').collection('bookings');
        const paymentsCollection = client.db('offerUp').collection('payments');


        //Note: make sure verify Admin after verify JWT
        const verifyAdmin = async (req, res, next) => {
            console.log('Inside verifyAdmin', req.decoded.email)
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }



        app.get('/category', async (req, res) => {
            const query = {}
            const result = await productCollection.find(query).toArray()
            res.send(result)
        })
        //To find Brand Name: 
        app.get('/categoryList', async (req, res) => {
            const query = {}
            const result = await productCollection.find(query).project({ category_name: 1 }).toArray()
            res.send(result)
        })

        //Loading all users: 
        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        });
        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log(user);
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });
        app.post('/feedback', async (req, res) => {
            const user = req.body;
            console.log(user);
            const result = await feedbackCollection.insertOne(user);
            res.send(result);
        });
        app.get('/feedback', async (req, res) => {
            const query = {}
            const result = await feedbackCollection.find(query).limit(3).sort({ $natural: -1 }).toArray()
            res.send(result)
        })
        // get Specific add by user 
        app.get('/userAd', async (req, res) => {
            const email = req.query.userEmail
            const query = { email: email }
            const cursor = advertisementCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' })
        });


        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const booking = await bookingsCollection.findOne(query)
            res.send(booking)
        })
        //Getting booking Data : 
        app.get('/bookings', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const bookings = await bookingsCollection.find(query).toArray()
            res.send(bookings)
        })




        //Sending Booking data to Server 
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const query = {
                email: booking.email,
                name: booking.name
            }
            const alreadyBooked = await bookingsCollection.find(query).toArray();
            if (alreadyBooked.length) {
                const message = `You already have a booking on ${booking.name}`
                return res.send({ acknowledged: false, message })
            }
            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        });



        //Advertisement Collection : 
        app.get('/advertisements', async(req,res)=> {
            const email = req.query.email;
            const query = { email: email }
            const myAd = await advertisementCollection.find(query).toArray()
            res.send(myAd)
        })


        app.get('/advertisement', async (req, res) => {
            const query = {}
            const result = await advertisementCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/advertisement', async (req, res) => {
            const advertisement = req.body;
            const result = await advertisementCollection.insertOne(advertisement)
            res.send(result)
        })

        app.delete('/advertisement/:id',verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const result = await advertisementCollection.deleteOne(filter)
            res.send(result)
        })
        app.delete('/users/:id',verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const result = await usersCollection.deleteOne(filter)
            res.send(result)
        })


        //Make Admin 
        app.put('/users/admin/:id',verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })
        //Showing data for buyer: 
        app.get('/users/buyer/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query)
            res.send({ isBuyer: user?.userType === 'buyer' })
        })

        //Showing Data for Seller : 
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query)
            res.send({ isSeller: user?.userType === 'seller' })
        })
        // getAmin 
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })

        // Payment 
        //payment Stipes 

        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });


        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.bookingId
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedResult = await bookingsCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })

    }
    finally {

    }
}
run().catch(console.dir);









app.get('/', async (req, res) => {
    res.send('Offer Up server is running');
})

app.listen(port, () => console.log(`Offer Up portal running on ${port}`))