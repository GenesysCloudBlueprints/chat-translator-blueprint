import view from './view.js';
import controller from './notifications-controller.js';
import translate from './translate-service.js';
import config from './config.js';

// Obtain a reference to the platformClient object
const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;

// API instances
const usersApi = new platformClient.UsersApi();
const conversationsApi = new platformClient.ConversationsApi();
const responseManagementApi = new platformClient.ResponseManagementApi();

let userId = '';
let agentName = 'AGENT_NAME';
let agentAlias = 'AGENT_ALIAS';
let customerName = 'CUSTOMER_NAME';
let currentConversation = null;
let currentConversationId = '';
let translationData = null;
let genesysCloudLanguage = 'en-us';
let translateKey = '';

/**
 * Callback function for 'message' and 'typing-indicator' events.
 * 
 * @param {Object} data the event data  
 */
let onMessage = (data) => {
    switch(data.metadata.type){
        case 'typing-indicator':
            break;
        case 'message':
            // Values from the event
            let eventBody = data.eventBody;
            let message = eventBody.body;
            let senderId = eventBody.sender.id;

            // Conversation values for cross reference
            let participant = currentConversation.participants.find(p => p.chats[0].id == senderId);
            let name = '';
            let purpose = '';

            if(participant.name != null) {
                name = participant.name;
                purpose = participant.purpose;
            } else {
                name = 'BOT';
                purpose = 'agent';
            }

            // Wait for translate to finish before calling addChatMessage
            translate.translateText(message, genesysCloudLanguage, function(translatedData) {
                view.addChatMessage(name, translatedData.translated_text, purpose);
                translationData = translatedData;
            });

            break;
    }
};

/**
 *  Translate then send message to the customer
 */
function sendChat(){
    let message = document.getElementById('message-textarea').value;

    // Get the last agent participant, this also fixes an issue when an agent
    // gets reconnected and reassigned a new participant id.
    let agentsArr = currentConversation.participants.filter(p => p.purpose == 'agent');
    let agent = agentsArr[agentsArr.length - 1];
    let communicationId = agent.chats[0].id;

    let sourceLang;

    // Default language to english if no source_language available    
    if(translationData === null) {
        sourceLang = 'en';
    } else {
        sourceLang = translationData.source_language;
    }

    // Translate text to customer's local language
    translate.translateText(message, sourceLang, function(translatedData) {
        // Wait for translate to finish before calling sendMessage
        sendMessage(translatedData.translated_text, currentConversationId, communicationId);
    });

    document.getElementById('message-textarea').value = '';
};

/**
 *  Send message to the customer
 */
function sendMessage(message, conversationId, communicationId){
    console.log(message);
    conversationsApi.postConversationsChatCommunicationMessages(
        conversationId, communicationId,
        {
            'body': message,
            'bodyType': 'standard'
        }
    )
}

/**
 * Show the chat messages for a conversation
 * @param {String} conversationId 
 * @returns {Promise} 
 */
function showChatTranscript(conversationId){
    return conversationsApi.getConversationsChatMessages(conversationId)
    .then((data) => {
        // Show each message
        data.entities.forEach((msg) => {
            if(msg.hasOwnProperty('body')) {
                let message = msg.body;

                // Determine the name by cross referencing sender id 
                // with the participant.chats.id from the conversation parameter
                let senderId = msg.sender.id;
                let name = currentConversation
                            .participants.find(p => p.chats[0].id == senderId)
                            .name;
                let purpose = currentConversation
                            .participants.find(p => p.chats[0].id == senderId)
                            .purpose;

                // Wait for translate to finish before calling addChatMessage
                translate.translateText(message, genesysCloudLanguage, function(translatedData) {
                    view.addChatMessage(name, translatedData.translated_text, purpose);
                    translationData = translatedData;
                });
            }
        });
    });
}

/**
 * Set-up the channel for chat conversations
 */
function setupChatChannel(){
    return controller.createChannel()
    .then(data => {
        // Subscribe to incoming chat conversations
        return controller.addSubscription(
            `v2.users.${userId}.conversations.chats`,
            subscribeChatConversation(currentConversationId));
    });
}

/**
 * Subscribes the conversation to the notifications channel
 * @param {String} conversationId 
 * @returns {Promise}
 */
function subscribeChatConversation(conversationId){
    return controller.addSubscription(
            `v2.conversations.chats.${conversationId}.messages`,
            onMessage);
}

/**	
 * This toggles between translator and canned response iframe	
 */	
function toggleIframe(){	
    let label = document.getElementById('toggle-iframe').textContent;	

    if(label === 'Open Chat Translator'){	
        document.getElementById('toggle-iframe').textContent = 'Open Canned Responses';
        document.getElementById('agent-assist').style.display = 'block';
        document.getElementById('canned-response-container').style.display = 'none';
    } else {	
        document.getElementById('toggle-iframe').textContent = 'Open Chat Translator';
        document.getElementById('agent-assist').style.display = 'none';
        document.getElementById('canned-response-container').style.display = 'block';
        
        // Only call getLibraries function if element does not have a child
        if(document.getElementById('libraries-container').childNodes.length == 0) getLibraries();
    }	
}

/** --------------------------
 *  CANNED RESPONSE FUNCTIONS
 * ------------------------ */
/**
 * Get all libraries in the org
 */
 function getLibraries(){    
    return responseManagementApi.getResponsemanagementLibraries()
    .then((libraries) => {
        libraries.entities.forEach((library) => {
            getResponses(library.id, library.name);
        });
    });
}

/**
 * Get all responses of each library
 * @param {String} libraryId 
 * @param {String} libraryName 
 */
function getResponses(libraryId, libraryName){
    return responseManagementApi.getResponsemanagementResponses(libraryId)
    .then((responses) => {
        view.displayLibraries(libraryId, libraryName);

        responses.entities.forEach((response) => {
            view.displayResponses(response, doResponseSubstitution);
        });
    });
}

/**
 * Search all responses in the org
 * @param {String} query 
 */
function searchResponse(query){
    return responseManagementApi.postResponsemanagementResponsesQuery({'queryPhrase': query})
    .then((responses) => {
        responses.results.entities.forEach((response) => {
            view.toggleDIVs();
            view.displaySearchResults(response, doResponseSubstitution);
        });
    });
}

/**
 * Replaces the dynamic variables in canned responses with appropriate
 * values. This function is used in the view when an agent clicks a response.
 * @param {String} text 
 * @param {String} responseId 
 */
function doResponseSubstitution(text, responseId){
    let finalText = text;

    // Do the default substitutions first
    finalText = finalText.replace(/{{AGENT_NAME}}/g, agentName);
    finalText = finalText.replace(/{{CUSTOMER_NAME}}/g, customerName);
    finalText = finalText.replace(/{{AGENT_ALIAS}}/g, agentAlias);
    

    let participantData = currentConversation.participants
                            .find(p => p.purpose == 'customer').attributes;

    // Do the custom substitutions
    return responseManagementApi.getResponsemanagementResponse(responseId)
    .then((responseData) => {
        let subs = responseData.substitutions;
        subs.forEach(sub => {
            let subRegex = new RegExp(`{{${sub.id}}}`, 'g');
            let val = `{{${sub.id}}}`;

            // Check if substitution exists on the participant data, if not
            // use default value
            if(participantData[sub.id]){
                val = participantData[sub.id];
            } else {
                val = sub.defaultValue ? sub.defaultValue : val;
            }

            finalText = finalText.replace(subRegex, val);
        });

        return finalText;
    })
    .catch(e => console.error(e));
}

/**
* TODO: Delete this with User API once feature has been added.
* This function gets the Agent Chat name of the user to replace with
* the AGENT_ALIAS variable in the canned response.
*/
function getAgentAlias(){
    return fetch(`https://api.${config.genesysCloud.region}/api/v2/users/${userId}/profile?fl=*`, {
        method: 'GET',
        headers: {
            'Authorization': `bearer ${client.authData.accessToken}`
        },
    })
    .then(response => response.json())
    .then(data => {
        return data.agent ? data.agent.name[0].value : null;
    })
    .catch(e => console.error(e));
}
    

/** --------------------------------------------------------------
 *                       EVENT HANDLERS
 * -------------------------------------------------------------- */
document.getElementById('toggle-iframe')	
    .addEventListener('click', () => toggleIframe());

document.getElementById('chat-form')
    .addEventListener('submit', () => sendChat());

document.getElementById('btn-send-message')
    .addEventListener('click', () => sendChat());

document.getElementById('message-textarea')
    .addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendChat();
            if(e.preventDefault) e.preventDefault(); // prevent new line
            return false; // Just a workaround for old browsers
        }
    });

document.getElementById('find-response-btn')
    .addEventListener('click', function(){
        let query = document.getElementById('find-response').value;
        searchResponse(query);
    });

document.getElementById('find-response')
    .addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            let query = document.getElementById('find-response').value;
            searchResponse(query);
        }
    });

document.getElementById('toggle-search')
    .addEventListener('click', () => view.toggleDIVs());

/** --------------------------------------------------------------
 *                       INITIAL SETUP
 * -------------------------------------------------------------- */
const urlParams = new URLSearchParams(window.location.search);
currentConversationId = urlParams.get('conversationid');
genesysCloudLanguage = urlParams.get('language');

client.setPersistSettings(true, 'chat-translator');
client.setEnvironment(config.genesysCloud.region);
client.loginImplicitGrant(
    config.clientID,
    config.redirectUri,
    { state: JSON.stringify({
        conversationId: currentConversationId,
        language: genesysCloudLanguage
    }) })
.then(data => {
    console.log(data);

    // Assign conversation id
    let stateData = JSON.parse(data.state);
    currentConversationId = stateData.conversationId;
    genesysCloudLanguage = stateData.language;
    
    // Get Details of current User
    return usersApi.getUsersMe();
}).then(userMe => {
    userId = userMe.id;
    agentName = userMe.name;

    return getAgentAlias();
}).then(agentName => {
    agentAlias = agentName ? agentName : agentAlias;

    // Get current conversation
    return conversationsApi.getConversation(currentConversationId);
}).then((conv) => { 
    currentConversation = conv;
    customerName = conv.participants.find(p => p.purpose == 'customer').name;

    return setupChatChannel();
}).then(data => { 
    // Get current chat conversations
    return showChatTranscript(currentConversationId);
}).then(data => {
    console.log('Finished Setup');

// Error Handling
}).catch(e => console.log(e));
