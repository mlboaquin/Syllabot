import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const CalendarContext = createContext();

export function CalendarProvider({ children }) {
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const checkCalendarConnection = async () => {
    console.log('Checking calendar connection...', { 
      user: !!user, 
      currentStatus: calendarConnected,
      timestamp: new Date().toISOString()
    });
    
    if (!user) {
      console.log('No user found, setting calendar to disconnected');
      setCalendarConnected(false);
      setLoading(false);
      return;
    }

    try {
      const idToken = await user.getIdToken();
      console.log('Got ID token, making status request...');
      
      const response = await axios.get('http://localhost:3000/api/auth/google/status', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      console.log('Calendar status response:', response.data);
      setCalendarConnected(response.data.connected);
      console.log('Calendar connection status updated to:', response.data.connected);
    } catch (error) {
      console.error('Calendar connection check failed:', error);
      setCalendarConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('CalendarContext: User state changed', { hasUser: !!user });
    if (user) {
      checkCalendarConnection();
    } else {
      setCalendarConnected(false);
      setLoading(false);
    }
  }, [user]);

  const value = {
    calendarConnected,
    setCalendarConnected,
    loading,
    checkCalendarConnection
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
} 