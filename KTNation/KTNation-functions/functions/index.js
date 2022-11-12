//import firebase from "firebase/app";
//import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const app = require("express")();


admin.initializeApp();

const firebaseConfig = {
    apiKey: "AIzaSyDl96F8-imSfucDyPdGyOr-TS5ellzvuaY",
    authDomain: "kt-nation.firebaseapp.com",
    projectId: "kt-nation",
    storageBucket: "kt-nation.appspot.com",
    messagingSenderId: "301333276210",
    appId: "1:301333276210:web:37b7ae5cafca4fea923e2b",
    measurementId: "G-JK58CT0ZHV"
  };

const firebase = require("firebase/app");
const mAuth = require("firebase/auth");
firebase.initializeApp(firebaseConfig);
const auth = mAuth.getAuth();

const db = admin.firestore();

app.get('/posts', (req, res) =>{
    db.collection('posts').orderBy('createdAt', 'desc').get().then(data=>{
        let posts = [];
        data.forEach((doc) =>{
            posts.push({
                postId : doc.id,
                body : doc.data().body,
                userHandle : doc.data().userHandle,
                createdAt : doc.data().createdAt

            });
        });
    return res.json(posts);
    }).catch((err) => console.error(err));
})

app.post('/post',(req, res) =>{
    const newPost = {
        body : req.body.body,
        userHandle : req.body.userHandle,
        createdAt : new Date().toISOString()
    };

    db.collection('posts').add(newPost).then((doc) => {
        res.json({ message : `doc ${doc.id} created`});
    }).catch((err) => {
        res.status(500).json({error : `somethings wrong`});
        console.log(err);
    })
});

//signup route
app.post('/signup', (req, res) => {
    const newUser = {
        email : req.body.email,
        password : req.body.password,
        confirmPassword : req.body.confirmPassword,
        handle : req.body.handle
    };

    let token;
    db.doc(`/users/${newUser.handle}`).get()
    .then((doc) => {
        if(doc.exists){
            return res.status(400).json({handle : 'Already taken'});
        }else {
            return mAuth.createUserWithEmailAndPassword(auth, newUser.email, newUser.password);
        }
    }).then((data) => {
        userId = data.user.uid;
        return data.user.getIdToken();
    }).then((idToken) => {
        token=idToken;
        const userCredentials = {
            handle : newUser.handle,
            email : newUser.email,
            createdAt : new Date().toISOString(),
            userId  
        };
        
       return db.doc(`/users/${newUser.handle}`).set(userCredentials); 
    })
    .then(() =>{
        return res.status(201).json(token);
    }).catch((err) => {
        if(err.code === 'auth/email-already-in-use'){
            return res.status(400).json({email : 'Email is already signed up'});    
        }else{
        return res.status(500).json({error : err.code});
        }
    });
    

});

exports.api = functions.https.onRequest(app);
