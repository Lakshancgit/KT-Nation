const { db ,admin } = require('../util/admin');
const  config  = require('../util/config');

const firebase = require("firebase/app");
const mAuth = require("firebase/auth");
//const { getStorage } = require("firebase/storage");
firebase.initializeApp(config);
const auth = mAuth.getAuth();
//const storage = getStorage(firebase);

const { validateSignupData , validateLoginData , reduceUserDetails } = require('../util/validators');
const { DatabaseBuilder } = require('firebase-functions/v1/firestore');

exports.signup = (req, res) => {
    const newUser = {
        email : req.body.email,
        password : req.body.password,
        confirmPassword : req.body.confirmPassword,
        handle : req.body.handle
    };

   const { valid , errors } = validateSignupData(newUser);
   if(!valid) return res.status(400).json(errors);

   const noImg = 'no-img.png';
    

    let token, userId;
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
            imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
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
    

}

exports.login = (req, res) =>{
    const user = {
        email : req.body.email,
        password : req.body.password
    };

    const { valid , errors } = validateLoginData(user);
    if(!valid) return res.status(400).json(errors);
   

    mAuth.signInWithEmailAndPassword(auth, user.email, user.password)
    .then((data) => {
        return data.user.getIdToken();
    })
    .then((token) => {
        return res.json({token});
    })
    .catch((err) =>{
        if(err.code === 'auth/wrong-password') {return res.status(403).json({general : 'Password is wrong!'});}
        else {return res.status(500).json({error : err.code});}
    });

}

//add user details
exports.addUserDetails = (req, res) => {
    let userDetails = reduceUserDetails(req.body);

    db.doc(`/users/${req.user.handle}`).update(userDetails)
    .then(() => {
        return res.json({message : 'details added success'});
    }).catch((err) => {
        return res.status(500).json({error : err.code});
    });
}

// Get any user's details
exports.getUserDetails = (req, res) => {
    let userData = {};
    db.doc(`/users/${req.params.handle}`)
      .get()
      .then((doc) => {
        if (doc.exists) {
          userData.user = doc.data();
          return db
            .collection("posts")
            .where("userHandle", "==", req.params.handle)
            .orderBy("createdAt", "desc")
            .get();
        } else {
          return res.status(404).json({ error: "User not found" });
        }
      })
      .then((data) => {
        userData.posts = [];
        data.forEach((doc) => {
          userData.posts.push({
            body: doc.data().body,
            createdAt: doc.data().createdAt,
            userHandle: doc.data().userHandle,
            userImage: doc.data().userImage,
            likeCount: doc.data().likeCount,
            commentCount: doc.data().commentCount,
            postId: doc.id,
          });
        });
        return res.json(userData);
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  };

// Get own user details
exports.getAuthenticatedUser = (req, res) => {
    let userData = {};
    db.doc(`/users/${req.user.handle}`)
      .get()
      .then((doc) => {
        if (doc.exists) {
          userData.credentials = doc.data();
          return db
            .collection("likes")
            .where("userHandle", "==", req.user.handle)
            .get();
        }
      })
      .then((data) => {
        userData.likes = [];
        data.forEach((doc) => {
          userData.likes.push(doc.data());
        });
        return db
          .collection("notifications")
          .where("recipient", "==", req.user.handle)
          .orderBy("createdAt", "desc")
          .limit(10)
          .get();
      })
      .then((data) => {
        userData.notifications = [];
        data.forEach((doc) => {
          userData.notifications.push({
            recipient: doc.data().recipient,
            sender: doc.data().sender,
            createdAt: doc.data().createdAt,
            postId: doc.data().postId,
            type: doc.data().type,
            read: doc.data().read,
            notificationId: doc.id,
          });
        });
        return res.json(userData);
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  };

  exports.markNotificationsRead = (req, res) => {
    let batch = db.batch();
    req.body.forEach((notificationId) => {
      const notification = db.doc(`/notifications/${notificationId}`);
      batch.update(notification, { read: true });
    });
    batch
      .commit()
      .then(() => {
        return res.json({ message: "Notifications marked read" });
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  };

  
exports.uploadImage = (req, res) =>{
    const BusBoy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');

    const busboy = BusBoy({headers: req.headers});

    let imageToBeUploaded = {};
    let imageFileName;

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) =>{
        console.log(fieldname, filename, encoding, mimetype);
        const imageExtension = filename.toString().split('.')[filename.toString().split('.').length -1];
        console.log('imageExtension'.imageExtension);
        imageFileName = `${Math.round(
            Math.random() * 1000000000000
          ).toString()}.${imageExtension}`;
          const filepath = path.join(os.tmpdir(), imageFileName);
          imageToBeUploaded = { filepath, mimetype };
          file.pipe(fs.createWriteStream(filepath));
    });

    busboy.on('finish' , () => {
        admin.storage().bucket().upload(imageToBeUploaded.filepath, {
            resumable: false,
            metadata: {
                metadata:{
                    contentType: imageToBeUploaded.mimetype
                }
            }
        })
        .then(() => {
            const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
            return db.doc(`/users/${req.user.handle}`).update(imageUrl); 
        })
        .then(() => {
            return res.json({message: 'image uploaded'});
        })
        .catch((err) => {
            return res.status(500).json({Error :'Error'}); 
        })
    })

    busboy.end(req.rawBody);
}