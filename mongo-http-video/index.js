const express = require("express");
const app = express();
const fs = require("fs");
const mongodb = require('mongodb');
const url = 'mongodb://user:password@db:27017';

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

// Sorry about this monstrosity
app.get('/init-video', function (req, res) {
  mongodb.MongoClient.connect(url, function (error, client) {
    if (error) {
      res.json(error);
      return;
    }

    const db = client.db('videos');
    var bucket = new mongodb.GridFSBucket(db);
    fs.createReadStream('./bigbuck.mp4').pipe(bucket.openUploadStream('bigbuck.mp4'));
    res.json("Done...");
  });
});

app.get("/mongo-video", function (req, res) {
  mongodb.MongoClient.connect(url, function (error, client) {
    if (error) {
      res.json(error);
      return;
    }

    // Ensure there is a range given for the video
    const range = req.headers.range;
    if (!range) {
      res.status(400).send("Requires Range header");
    }

    const db = client.db('videos');
    db.collection('fs.files').findOne({}, (err, video) => {
      if (!video) {
        res.status(404).send("No video uploaded!");
        return;
      }

      // Find video size and range
      const videoSize = video.length;
      const start = Number(range.replace(/\D/g, ""));
      const end = videoSize - 1;

      // Create headers
      const contentLength = end - start + 1;
      const headers = {
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": contentLength,
        "Content-Type": "video/mp4",
      };

      // HTTP Status 206 for Partial Content
      res.writeHead(206, headers);

      // create video read stream for this particular chunk
      const bucket = new mongodb.GridFSBucket(db);
      const downStream = bucket.openDownloadStreamByName('bigbuck.mp4', {
        start
      });

      // Finally pipe video to response
      downStream.pipe(res);
    });
  });
});

app.listen(8000, function () {
  console.log("Listening on port 8000!");
});
