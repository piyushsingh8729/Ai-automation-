const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

// If you want to use environment variables, create a .env file
require('dotenv').config();

// Define the required scopes
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');

async function main() {
  try {
    console.log('🔐 Authorizing with Google Calendar API...');
    const auth = await authorize();
    
    console.log('📅 Fetching calendar events...');
    const events = await listEvents(auth);
    
    console.log('\n🎉 Success! Here are your upcoming events:\n');
    displayEvents(events);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function authorize() {
  try {
    // Load client secrets from the credentials file you downloaded
    const content = await fs.readFile('credentials.json');
    const credentials = JSON.parse(content);
    
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    {console.log( client_secret, client_id)}
    // Check if we have previously stored a token
    try {
      const token = await fs.readFile(TOKEN_PATH);
      oAuth2Client.setCredentials(JSON.parse(token));
      return oAuth2Client;
    } catch (err) {
      // No token found, get new token
      return getAccessToken(oAuth2Client);
    }
  } catch (err) {
    console.error('Error loading client secret file:', err);
    throw err;
  }
}

async function getAccessToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('Authorize this app by visiting this URL:', authUrl);
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();

      oAuth2Client.getToken(code, async (err, token) => {
        if (err) {
          console.error('Error retrieving access token', err);
          reject(err);
          return;
        }
        
        oAuth2Client.setCredentials(token);
        
        // Store the token to disk for later program executions
        try {
          await fs.writeFile(TOKEN_PATH, JSON.stringify(token));
          console.log('Token stored to', TOKEN_PATH);
        } catch (err) {
          console.error('Error storing token:', err);
        }
        
        resolve(oAuth2Client);
      });
    });
  });
}

async function listEvents(auth) {
  const calendar = google.calendar({ version: 'v3', auth });
  
  // Get events from the next 7 days
  const now = new Date();
  const oneWeekLater = new Date();
  oneWeekLater.setDate(now.getDate() + 7);

  const res = await calendar.events.list({
    calendarId: 'primary', // Use 'primary' for the user's primary calendar
    timeMin: now.toISOString(),
    timeMax: oneWeekLater.toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return res.data.items;
}

function displayEvents(events) {
  if (events.length === 0) {
    console.log('No upcoming events found in the next week.');
    return;
  }

  events.forEach((event, index) => {
    const start = event.start.dateTime || event.start.date;
    const end = event.end.dateTime || event.end.date;
    
    console.log(`📌 Event ${index + 1}: ${event.summary}`);
    console.log(`   🕐 Start: ${formatDate(start)}`);
    console.log(`   🏁 End: ${formatDate(end)}`);
    if (event.description) {
      console.log(`   📝 Description: ${event.description.substring(0, 100)}...`);
    }
    if (event.location) {
      console.log(`   📍 Location: ${event.location}`);
    }
    console.log('   ──────────────────────────────────────────');
  });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString(); // Formats date in a human-readable way
}

// Run the application
if (require.main === module) {
  main();
}

module.exports = { authorize, listEvents };