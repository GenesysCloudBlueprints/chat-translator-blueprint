const https = require('https');
const fs = require('fs');
const express = require('express');
const { Translate } = require('@aws-sdk/client-translate');
require('dotenv').config();
const cors = require('cors');

// Configure the AWS Translate client
const translateService = new Translate({ 
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});
const app = express();

// Local ssl certificates
const privateKey = fs.readFileSync('ssl/_localhost.key', 'utf8');
const certificate = fs.readFileSync('ssl/_localhost.crt', 'utf8');
const credentials = {key: privateKey, cert: certificate};

app.use(cors());
app.use(express.static('docs'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const httpsServer = https.createServer(credentials, app);

app.post('/translate', (req, res) => {
    const body = req.body;
    const params = {
        Text: body.raw_text,
        SourceLanguageCode: body.source_language,
        TargetLanguageCode: body.target_language
    };

    // Use the translate service
    translateService.translateText(params)
    .then((data) =>{
        let statusCode = data['$metadata'].httpStatusCode;
        let translatedText = data.TranslatedText;

        res.status(statusCode).json({ 
            source_language: data.SourceLanguageCode,
            translated_text: translatedText
        });
    })
    .catch(err => {
        console.error(err);
        res.status(400);
    });
});


httpsServer.listen(443);
console.log('HTTPS listening on: 443');
