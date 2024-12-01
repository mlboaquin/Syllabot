import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext';
import GoogleCalendarSetup from './GoogleCalendarSetup';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

function PDFUploader() {
  const [file, setFile] = useState(null);
  const [extractedEvents, setExtractedEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { calendarConnected, loading: calendarLoading, setCalendarConnected } = useCalendar();

  useEffect(() => {
    console.log('PDFUploader: Calendar connection status:', { 
      calendarConnected, 
      calendarLoading 
    });
  }, [calendarConnected, calendarLoading]);

  const handleUpload = async () => {
    if (!file || !user) return;
  
    setLoading(true);
    const formData = new FormData();
    formData.append('pdf', file);
  
    try {
      const idToken = await user.getIdToken();
      console.log('Uploading PDF...');
      
      const response = await axios.post('http://localhost:3000/api/extract-dates', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${idToken}`
        }
      });
  
      console.log('Server response:', response.data);
  
      if (response.data.events && response.data.events.length > 0) {
        setExtractedEvents(response.data.events);
        alert(`Successfully extracted ${response.data.events.length} events!`);
      } else {
        alert('No events were found in the PDF. Please check the format.');
      }
    } catch (error) {
      console.error('Full error:', error);
      const errorMessage = error.response?.data?.details || 
                          error.response?.data?.error ||
                          error.message ||
                          'Unknown error occurred';
      alert(`Error processing PDF: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async (event) => {
    if (!user) {
      alert('Please sign in first');
      return;
    }

    if (!calendarConnected) {
      console.log('Calendar not connected, current status:', { calendarConnected, calendarLoading });
      alert('Please connect your Google Calendar first');
      return;
    }

    try {
      console.log('Starting event creation...', event);
      const idToken = await user.getIdToken();
      
      const response = await axios.post('http://localhost:3000/api/events', event, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      if (response.data) {
        console.log('Event created successfully:', response.data);
        alert('Event added to calendar successfully!');
      }
    } catch (error) {
      console.error('Failed to create event:', error);
      
      if (error.code === 'ECONNABORTED') {
        alert('Request timed out. Please try again.');
      } else if (error.response?.status === 401) {
        alert('Calendar connection expired. Please reconnect your Google Calendar.');
        setCalendarConnected(false);
      } else {
        const errorMessage = error.response?.data?.details || 
                          error.response?.data?.error ||
                          error.message ||
                          'Unknown error occurred';
        alert(`Failed to add event to calendar: ${errorMessage}`);
      }
    }
  };

  if (!user) {
    return (
      <div className="pdf-uploader">
        <p>Please sign in to use this feature</p>
      </div>
    );
  }

  return (
    <div className="pdf-uploader">
      {!calendarConnected && (
        <div className="calendar-setup-warning">
          <p>Please connect your Google Calendar first</p>
          <GoogleCalendarSetup />
        </div>
      )}
      
      <div className="upload-section">
        <label className="upload-button">
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files[0])}
          />
          Choose PDF File
        </label>
        <button 
          onClick={handleUpload} 
          disabled={!file || loading}
          className="process-button"
        >
          {loading ? 'Processing...' : 'Upload and Extract Events'}
        </button>
      </div>

      {extractedEvents.length > 0 && (
        <div className="extracted-events">
          <h3>Extracted Events:</h3>
          <ul className="events-list">
            {extractedEvents.map((event, index) => (
              <li key={index} className="event-item">
                <h4 className="event-title">{event.summary}</h4>
                <p className="event-detail">Date: {new Date(event.startTime).toLocaleDateString()}</p>
                <p className="event-detail">Time: {new Date(event.startTime).toLocaleTimeString()} - {new Date(event.endTime).toLocaleTimeString()}</p>
                <pre className="event-description">{event.description}</pre>
                <button 
                  onClick={() => createEvent(event)} 
                  disabled={loading}
                  className="add-calendar-button"
                >
                  Add to Calendar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default PDFUploader;