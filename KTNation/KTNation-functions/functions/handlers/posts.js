const { db } = require('../util/admin');

exports.getAllPosts = (req, res) =>{
    db.collection('posts').orderBy('createdAt', 'desc').get().then(data=>{
        let posts = [];
        data.forEach((doc) =>{
            posts.push({
                postId : doc.id,
                body : doc.data().body,
                userHandle : doc.data().userHandle,
                createdAt : doc.data().createdAt,
                likeCount : doc.data().likeCount,
                commentCount : doc.data().commentCount
            });
        });
    return res.json(posts);
    }).catch((err) => {
        console.error(err);
        return res.status(500).json({error : err.code});
    });
}

exports.postOnePost = (req, res) =>{
    const newPost = {
        body : req.body.body,
        userHandle : req.user.handle,
        createdAt : new Date().toISOString()
    };

    db.collection('posts').add(newPost).then((doc) => {
        res.json({ message : `doc ${doc.id} created`});
    }).catch((err) => {
        res.status(500).json({error : `somethings wrong`});
        console.log(err);
    })
}