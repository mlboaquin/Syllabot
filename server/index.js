const express = require('express');
const cors = require('cors');
const admin = require('./config/firebase');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

const multer = require('multer');
const pdf = require('pdf-parse');

// Set up multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });


require('dotenv').config();

// Add after your imports
const { body, validationResult } = require('express-validator');

// Add this import at the top of the file
const { storeRefreshToken, getUserRefreshToken } = require('./database/tokens');

// Add this after your initial imports
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    console.log('Received auth token:', token ? 'present' : 'missing');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      console.log('Token verified successfully for user:', decodedToken.uid);
      req.user = decodedToken;
      next();
    } catch (verifyError) {
      console.error('Token verification failed:', verifyError);
      res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Authentication error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(401).json({ error: 'Authentication failed' });
  }
};


// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Add detailed logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Add validation middleware
const validateEventInput = [
  body('summary').notEmpty().trim().escape(),
  body('description').optional().trim().escape(),
  body('startTime').isISO8601(),
  body('endTime').isISO8601(),
];

// Apply middleware to protected routes
app.post('/api/events', authenticateUser, validateEventInput, async (req, res) => {
  try {
    console.log('Starting event creation process...');
    const userId = req.user.uid;
    
    // Get refresh token
    console.log('Fetching refresh token...');
    const refreshToken = await getUserRefreshToken(userId);
    if (!refreshToken) {
      console.log('No refresh token found');
      return res.status(401).json({ error: 'Calendar not connected' });
    }

    // Set up OAuth client
    console.log('Setting up OAuth client...');
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    // Create calendar event
    console.log('Creating calendar event with data:', {
      summary: req.body.summary,
      start: req.body.startTime,
      end: req.body.endTime
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const eventData = {
      summary: req.body.summary,
      description: req.body.description,
      start: {
        dateTime: req.body.startTime,
        timeZone: 'Asia/Singapore'
      },
      end: {
        dateTime: req.body.endTime,
        timeZone: 'Asia/Singapore'
      }
    };

    console.log('Sending request to Google Calendar API...');
    const result = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventData
    });

    console.log('Event created successfully:', result.data);
    res.json(result.data);
  } catch (error) {
    console.error('Error creating event:', {
      message: error.message,
      stack: error.stack,
      details: error.response?.data
    });
    
    if (error.message === 'invalid_grant') {
      await clearInvalidToken(req.user.uid);
      res.status(401).json({ 
        error: 'Calendar connection expired',
        details: 'Please reconnect your Google Calendar'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to create event',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});

// Google Calendar API setup
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const calendar = google.calendar({
  version: 'v3',
  auth: oauth2Client
});

// Add a function to refresh tokens
const refreshAccessToken = async (refreshToken) => {
  try {
    console.log('Attempting to refresh access token');
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    const { credentials } = await oauth2Client.refreshAccessToken();
    console.log('Access token refreshed successfully');
    return credentials.access_token;
  } catch (error) {
    console.error('Error refreshing access token:', {
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
};

// Routes
// Add this route BEFORE your other routes, right after your middleware setup
app.get('/calendar-setup-success', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Calendar Setup Success</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
          }
          .success-message {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
        </style>
      </head>
      <body>
        <div class="success-message">
          <h2>Calendar Setup Successful!</h2>
          <p>You can close this window now.</p>
          <script>
            try {
              console.log('Sending success message to opener...');
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'GOOGLE_CALENDAR_SUCCESS',
                  timestamp: new Date().toISOString()
                }, '*');
                console.log('Message sent, closing window in 2 seconds...');
                setTimeout(() => window.close(), 2000);
              } else {
                console.error('No opener window found');
              }
            } catch (error) {
              console.error('Error in success page:', error);
            }
          </script>
        </div>
      </body>
    </html>
  `);
});

app.get('/calendar-setup-error', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Calendar Setup Error</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #fff0f0;
          }
          .error-message {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            color: #d32f2f;
          }
        </style>
      </head>
      <body>
        <div class="error-message">
          <h2>Calendar Setup Failed</h2>
          <p>Please close this window and try again.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'GOOGLE_CALENDAR_ERROR',
                timestamp: new Date().toISOString()
              }, '*');
              setTimeout(() => window.close(), 2000);
            }
          </script>
        </div>
      </body>
    </html>
  `);
});


app.get('/api/events', async (req, res) => {
  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: (new Date()).toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    res.json(response.data.items);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.post('/api/events', authenticateUser, validateEventInput, async (req, res) => {
  try {
    console.log('Starting event creation process...');
    const userId = req.user.uid;
    
    // Get refresh token
    console.log('Fetching refresh token...');
    const refreshToken = await getUserRefreshToken(userId);
    if (!refreshToken) {
      console.log('No refresh token found');
      return res.status(401).json({ error: 'Calendar not connected' });
    }

    // Set up OAuth client
    console.log('Setting up OAuth client...');
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    // Create calendar event
    console.log('Creating calendar event...');
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const eventData = {
      summary: req.body.summary,
      description: req.body.description,
      start: {
        dateTime: req.body.startTime,
        timeZone: 'Asia/Singapore'
      },
      end: {
        dateTime: req.body.endTime,
        timeZone: 'Asia/Singapore'
      }
    };

    console.log('Event data:', eventData);
    
    const result = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventData
    });

    console.log('Event created successfully:', result.data);
    res.json(result.data);
  } catch (error) {
    console.error('Error creating event:', error);
    
    if (error.message === 'invalid_grant') {
      await clearInvalidToken(req.user.uid);
      res.status(401).json({ 
        error: 'Calendar connection expired',
        details: 'Please reconnect your Google Calendar'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to create event',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});

// Get single event
app.get('/api/events/:eventId', authenticateUser, async (req, res) => {
  try {
    const response = await calendar.events.get({
      calendarId: 'primary',
      eventId: req.params.eventId
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Update event
app.put('/api/events/:eventId', authenticateUser, validateEventInput, async (req, res) => {
  try {
    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: req.params.eventId,
      resource: {
        summary: req.body.summary,
        description: req.body.description,
        start: {
          dateTime: req.body.startTime,
          timeZone: 'Asia/Manila',
        },
        end: {
          dateTime: req.body.endTime,
          timeZone: 'Asia/Manila',
        },
        extendedProperties: {
          private: {
            isOnsite: req.body.metadata?.isOnsite?.toString() || 'false',
            isAsync: req.body.metadata?.isAsync?.toString() || 'false',
            hours: req.body.metadata?.hours?.toString() || '1',
            courseTitle: req.body.metadata?.courseTitle || '',
            weekInfo: req.body.metadata?.weekInfo || '',
            dateRange: JSON.stringify(req.body.metadata?.dateRange || {
              start: req.body.startTime,
              end: req.body.endTime
            })
          }
        }
      },
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event
app.delete('/api/events/:eventId', authenticateUser, async (req, res) => {
  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: req.params.eventId
    });
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Add this new route to handle PDF uploads and date extraction
app.post('/api/extract-dates', authenticateUser, upload.single('pdf'), async (req, res) => {
  try {
    console.log('Starting PDF processing...');
    
    // Check if file exists
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    console.log(`File received: ${req.file.originalname}, Size: ${req.file.size} bytes`);

    // Validate file type
    if (!req.file.mimetype.includes('pdf')) {
      console.log('Invalid file type:', req.file.mimetype);
      return res.status(400).json({ error: 'File must be a PDF' });
    }

    // Process PDF with error handling
    let data;
    try {
      data = await pdf(req.file.buffer);
      console.log('PDF text extracted, length:', data.text.length);
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError);
      return res.status(400).json({ 
        error: 'Failed to parse PDF',
        details: pdfError.message
      });
    }

    // Extract course title
    const titleRegex = /<title>([\s\S]*?)<\/title>/;
    const titleMatch = data.text.match(titleRegex);
    const courseTitle = titleMatch ? titleMatch[1].trim() : 'No Course Title Found';
    console.log('Course Title:', courseTitle);

    // Extract tables
    const tableRegex = /<table>([\s\S]*?)<\/table>/g;
    const tables = data.text.match(tableRegex) || [];
    console.log(`Found ${tables.length} tables in PDF`);

    if (tables.length === 0) {
      console.log('No tables found in PDF');
      return res.status(400).json({ 
        error: 'No tables found in PDF',
        text: data.text.substring(0, 200) + '...' // First 200 chars for debugging
      });
    }

    const events = [];
    
    for (const table of tables) {
      try {
        // Process table content
        const content = table.replace(/<\/?table>/g, '').trim();
        const rows = content.split('@')
          .map(row => row.trim())
          .filter(row => row);

        console.log(`Processing table with ${rows.length} rows`);

        if (rows.length < 2) {
          console.log('Table has insufficient rows, skipping...');
          continue;
        }

        // Process headers
        const headers = rows[0].split('$').map(header => header.trim());
        console.log('Headers:', headers);

        // Process data rows
        for (let i = 1; i < rows.length; i++) {
          const values = rows[i].split('$').map(value => value.trim());
          console.log(`Row ${i} values:`, values);

          if (values.length < 7) {
            console.log(`Row ${i} has insufficient columns, skipping...`);
            continue;
          }

          try {
            // Create event object with 7 columns
            const event = {
              module: values[0],
              date: values[1],
              activitiesAndAssessment: values[2],
              technology: values[3],
              isOnsite: values[4].toLowerCase() === 'true',
              isAsync: values[5].toLowerCase() === 'true',
              hours: parseFloat(values[6]) || 1  // Parse hours from values[6], default to 1 if parsing fails
            };

            // Extract date from "Week X (Date)" or "Week X and Y (Date)" format
            const dateMatch = event.date.match(/Week \d+(?:\s+and\s+\d+)?\s*\((.*?)\)/);
            if (!dateMatch) {
              console.log(`Invalid date format in row ${i}: ${event.date}`);
              continue;
            }

            const dateRange = dateMatch[1].trim(); // Get the date range (e.g., "Nov. 18-30")
            console.log(`Processing date range: ${dateRange}`);

            // Split the range into start and end dates
            const [startDateStr, endDateStr] = dateRange.split('-').map(d => d.trim());

            // Helper function to parse month
            const parseMonth = (monthStr) => {
              const monthMap = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Sept': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
              };
              const month = monthStr.replace('.', ''); // Remove period
              return monthMap[month];
            };

            // Parse start date
            let [startMonth, startDay] = startDateStr.split(/\s+|\./).filter(Boolean);
            let startMonthNum = parseMonth(startMonth);

            // Parse end date - handle cases where month isn't specified in end date
            let endMonthNum, endDay;
            const endParts = endDateStr.split(/\s+|\./).filter(Boolean);
            if (endParts.length === 2) {
              // If month is specified in end date (e.g., "Oct. 12")
              [endMonth, endDay] = endParts;
              endMonthNum = parseMonth(endMonth);
            } else {
              // If only day is specified (e.g., "30")
              endDay = endParts[0];
              endMonthNum = startMonthNum; // Use the same month as start date
            }

            if (startMonthNum === undefined || endMonthNum === undefined) {
              console.log(`Invalid month in date range: ${dateRange}`);
              continue;
            }

            // Convert days to numbers
            startDay = parseInt(startDay);
            endDay = parseInt(endDay);

            if (isNaN(startDay) || isNaN(endDay)) {
              console.log(`Invalid day in date range: ${dateRange}`);
              continue;
            }

            const currentYear = new Date().getFullYear();
            const startDate = new Date(currentYear, startMonthNum, startDay, 9, 0, 0); // 9 AM
            const endDate = new Date(currentYear, endMonthNum, endDay, 9 + event.hours, 0, 0);

            // Handle year wrap-around (e.g., Dec-Jan dates)
            if (endMonthNum < startMonthNum) {
              endDate.setFullYear(currentYear + 1);
            }

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              console.log(`Invalid date created from range: ${dateRange}`);
              continue;
            }

            // Extract week numbers for the description
            const weekMatch = event.date.match(/Week (\d+)(?:\s+and\s+(\d+))?/);
            const weekInfo = weekMatch[2] 
              ? `Weeks ${weekMatch[1]} and ${weekMatch[2]}` 
              : `Week ${weekMatch[1]}`;

            events.push({
              summary: courseTitle + " | " + weekInfo,
              description: `${courseTitle}\n` +
                          `${'='.repeat(courseTitle.length)}\n\n` +
                          `Module: ${event.module}\n\n` +
                          `${weekInfo}\n` +
                          `Activities and Assessment:\n${event.activitiesAndAssessment}\n\n` +
                          `Technology: ${event.technology}\n` +
                          `Mode: ${event.isOnsite ? 'Onsite' : 'Online'}${event.isAsync ? ' (Asynchronous)' : ' (Synchronous)'}`,
              startTime: startDate.toISOString(),
              endTime: endDate.toISOString(),
              metadata: {
                ...event,
                courseTitle,
                weekInfo,
                dateRange: {
                  start: startDate.toISOString(),
                  end: endDate.toISOString()
                }
              }
            });

            console.log('Successfully created event:', events[events.length - 1].summary);
          } catch (rowError) {
            console.error(`Error processing row ${i}:`, rowError);
            continue;
          }
        }
      } catch (tableError) {
        console.error('Error processing table:', tableError);
        continue;
      }
    }

    console.log(`Successfully processed ${events.length} events`);
    res.json({ events });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Server error processing PDF',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// OAuth routes
app.get('/api/auth/google/url', authenticateUser, (req, res) => {
  try {
    console.log('Generating auth URL for user:', req.user.uid);
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      state: req.user.uid
    });
    
    console.log('Generated auth URL successfully');
    res.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ 
      error: 'Failed to generate auth URL',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      console.error('No code received from Google');
      return res.redirect('/calendar-setup-error');
    }

    // Get tokens from Google
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Received tokens from Google');

    // Store the refresh token
    if (tokens.refresh_token) {
      await storeRefreshToken(state, tokens.refresh_token);
      console.log('Stored refresh token for user:', state);
    }

    // Redirect to success page
    res.redirect('/calendar-setup-success');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/calendar-setup-error');
  }
});

// Update the clearInvalidToken function to use storeRefreshToken
async function clearInvalidToken(userId) {
  try {
    console.log('Clearing invalid token for user:', userId);
    await storeRefreshToken(userId, null);
    console.log('Successfully cleared invalid token');
  } catch (error) {
    console.error('Error clearing invalid token:', error);
  }
}

// Update the status check route
app.get('/api/auth/google/status', authenticateUser, async (req, res) => {
  console.log('Starting calendar status check...');
  try {
    const userId = req.user.uid;
    console.log('Authenticated user:', userId);
    
    const refreshToken = await getUserRefreshToken(userId);
    console.log('Refresh token lookup result:', refreshToken ? 'found' : 'not found');
    
    if (!refreshToken) {
      console.log('No refresh token found for user');
      return res.json({ connected: false });
    }

    try {
      console.log('Attempting to refresh access token...');
      await refreshAccessToken(refreshToken);
      console.log('Token refresh successful');
      res.json({ connected: true });
    } catch (tokenError) {
      console.error('Token refresh failed:', tokenError);
      
      // If the token is invalid, clear it
      if (tokenError.message === 'invalid_grant') {
        console.log('Invalid refresh token detected, clearing token...');
        await clearInvalidToken(userId);
      }
      
      res.json({ connected: false });
    }
  } catch (error) {
    console.error('Calendar status check failed:', {
      error: error.message,
      stack: error.stack,
      user: req.user?.uid
    });
    
    res.status(500).json({ 
      error: 'Failed to check calendar connection status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      connected: false 
    });
  }
});

// Add after your routes
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something broke!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Add for 404 handling
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});