require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dns = require("dns")
const app = express();

const mongoose = require("mongoose");
const { url } = require('inspector');

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const { Schema } = mongoose;

const urlSchema = new Schema({
  originalUrl: { type: String, required: true },
  ipAddress: String,
  shortUrl :  Number,
});

const Url = mongoose.model('Url', urlSchema);

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

app.route('/api/shorturl').post(bodyParser.urlencoded({extended: false}));

app.post('/api/shorturl', function(req, res) {
  async function createAndSaveUrl(url) {
    const newUrl = new Url(url);
    try {
      const data = await newUrl.save();
      res.json({
        "original_url": data.originalUrl,
        "short_url": data.shortUrl
      });
    } catch (error) {
      res.json({"Error": error});
    }
  };
  
  const urlObject = new URL(req.body.url);
  
  dns.lookup(
    urlObject.origin.replace(/http:\/\/|https:\/\//, ''), 
    async function(err, address, _) {
      if (err) {
        res.json({ error: 'invalid url' });
        return;
      }

      try {
        const data = await Url.findOne({originalUrl: req.body.url});

        if (data) {
          res.json({"original_url" : data.originalUrl, "short_url": data.shortUrl});
        } else {
          try {
            const count = await Url.countDocuments({});
            if (count < 20) {
              createAndSaveUrl({
                  originalUrl: req.body.url,
                  ipAddress: address,
                  shortUrl :  count,
              });
            } else {
              res.json({"Message": "only 20 short_urls can be reserved."});
            }
          } catch (error) {
            res.json({ error: 'countDocuments error' });
            return;
          }
        }
      } catch (error) {
        res.json({ error: 'findOne error' });
        return;
      }
    }
  );
});

app.get('/api/shorturl/:shortUrl?', async function(req, res) {
  if (Number.isInteger(Number(req.params.shortUrl))) {
    try {
      const data = await Url.findOne({shortUrl: Number(req.params.shortUrl)});
      res.redirect(data.originalUrl);
    } catch (error) {
      res.json({"Error": error});
      return;
    }
  } else if (req.params.shortUrl === undefined) {
    res.json({"Message": "use /api/shorturl/<short_url> to redirect original URL." })
  } else {
    res.json({ "Error" : "Invalid short_url" });
  }
})

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
