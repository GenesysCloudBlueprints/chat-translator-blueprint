import config from './config.js';

// Genesys Cloud Language Code to AWS Translate Language Code
const languageCodeMapping = {
    'cs': 'cs',
    'da': 'da',
    'de': 'de',
    'en-us': 'en',
    'es': 'es',
    'fr': 'fr',
    'it': 'it',
    'nl': 'nl',
    'no': 'no',
    'pl': 'pl',
    'pt-br': 'pt',
    'fi': 'fi',
    'sv': 'sv',
    'tr': 'tr',
    'th': 'th',
    'ja': 'ja',
    'zh-cn': 'zh',
    'zh-tw': 'zh-TW'
}

export default {
    translateText(key, text, language, callback){
        let language_code = languageCodeMapping[language] ? 
                    languageCodeMapping[language] : language;

        let data = {
            raw_text: text,
            source_language: 'auto',
            target_language: language_code
        }

        fetch(config.awsEndpoints.translateText + `${key}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            }
        )
        .then(response => response.json())
        .then(translationData => {
            console.log(JSON.stringify(translationData));

            callback(translationData);
        })
        .catch(e => console.error(e));
    },

    getKey(token){
        return fetch(config.awsEndpoints.getKey,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    gcloud_token: token
                })
            }
        )
        .then(response => response.json())
        .then(data => {
            return data.translate_key;
        })
        .catch(e => console.error(e));
    }
}
