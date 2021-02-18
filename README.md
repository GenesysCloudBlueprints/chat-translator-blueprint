# Deployment Guide for Chat Translator on Genesys Cloud

> View the full [Genesys Cloud Chat Translator Blueprint article](https://developer.mypurecloud.com/blueprints/chat-translator-blueprint/) on the Genesys Cloud Developer Center.

This Genesys Blueprint provides instructions for deploying a chat translator on Genesys Cloud. The Chat Translator uses AWS translate service to determine and translate message from the customer's foreign language to the agent's configured language in Genesys Cloud. The agent will respond using their configured language and the Chat Translator translates the message back to the customer's foreign language. The Chat Translator also supports translation of canned responses configured in Genesys Cloud.

Genesys Cloud uses the Interaction Widget to translate and send messages to the customer.

![Flowchart](blueprint/images/flowchart.png "Flowchart")