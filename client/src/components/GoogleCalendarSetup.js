import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext';

function GoogleCalendarSetup() {
  const { checkCalendarConnection, calendarConnected, setCalendarConnected, calendarLoading } = useCalendar();
  const { user } = useAuth();
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    // Listen for messages from the popup
    const handleMessage = async (event) => {
      console.log('Received message:', event.data);
      
      if (event.data.type === 'GOOGLE_CALENDAR_SUCCESS') {
        console.log('OAuth flow completed successfully');
        setConnecting(true);
        
        try {
          // Add a small delay to allow the server to complete token storage
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log('Checking calendar connection after OAuth...');
          await checkCalendarConnection();
          console.log('Calendar connection check completed');
        } catch (error) {
          console.error('Error checking calendar connection:', error);
        } finally {
          setConnecting(false);
        }
      } else if (event.data.type === 'GOOGLE_CALENDAR_ERROR') {
        console.error('OAuth flow failed');
        alert('Failed to connect to Google Calendar. Please try again.');
      }
    };

    console.log('Setting up message listener');
    window.addEventListener('message', handleMessage);
    return () => {
      console.log('Cleaning up message listener');
      window.removeEventListener('message', handleMessage);
    };
  }, [checkCalendarConnection]);

  const handleConnect = async () => {
    if (!user) {
      console.log('No user found, cannot start OAuth flow');
      return;
    }

    try {
      setConnecting(true);
      console.log('Starting OAuth flow...');
      const idToken = await user.getIdToken();
      
      const response = await axios.get('http://localhost:3000/api/auth/google/url', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.data.url) {
        throw new Error('No auth URL received from server');
      }

      const authUrl = response.data.url;
      console.log('Opening OAuth popup...');
      window.open(authUrl, 'Google Calendar Setup', 
        'width=600,height=600,left=200,top=200');
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      const errorMessage = error.response?.data?.details || 
                          error.response?.data?.error ||
                          error.message ||
                          'Unknown error occurred';
      alert(`Failed to start calendar setup: ${errorMessage}`);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <button 
      onClick={handleConnect} 
      disabled={connecting}
      className="connect-calendar-button"
    >
      {connecting ? 'Connecting...' : 'Connect Google Calendar'}
    </button>
  );
}

export default GoogleCalendarSetup;